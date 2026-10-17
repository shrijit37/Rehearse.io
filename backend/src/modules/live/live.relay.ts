import { WebSocket as WsServer, type WebSocket as ClientSocket } from "ws";
import { logAudit } from "../../middleware/auditLog";
import {
    LIVE_MAX_RESUMPTIONS,
    LIVE_MODEL,
    LIVE_SETUP_TIMEOUT_MS,
    LIVE_VOICE,
    liveUpstreamUrl,
} from "./live.config";
import {
    UNSCORED_FEEDBACK,
    liveDeps,

    type LiveDeps,
    type LiveTurn,
} from "./live.persistence";
import { releaseLiveSlot, reserveLiveSlot, type LiveTicketClaims } from "./live.service";

interface RelayOptions {
    client: ClientSocket;
    claims: LiveTicketClaims;
    apiKey: string;
    /** Injected at the composition root so the transport can be tested without a database or a key. */
    deps?: LiveDeps;
}

interface UpstreamFrame {
    setupComplete?: unknown;
    goAway?: { timeLeft?: string };
    sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
    serverContent?: {
        turnComplete?: unknown;
        inputTranscription?: { text?: string };
        outputTranscription?: { text?: string };
    };
}

/**
 * `ws` refuses to send a close code the WebSocket spec reserves — 1004, 1005 and
 * 1006 raise "First argument must be a valid error code number" — and an upstream
 * that drops abnormally closes with 1006, which is exactly the case resumption
 * exists for. Map anything the client cannot legally receive onto 1011 so the
 * browser socket always actually closes.
 */
function closableCode(code: number): number {
    const reserved = code === 1004 || code === 1005 || code === 1006;
    if (!reserved && ((code >= 1000 && code <= 1015) || (code >= 3000 && code <= 4999))) return code;
    return 1011;
}

function buildSetup(claims: LiveTicketClaims, handle: string | null) {
    return {
        setup: {
            model: `models/${LIVE_MODEL}`,
            generationConfig: {
                // responseModalities belongs *under* generationConfig: at the top
                // level of `setup` the upstream closes the socket with 1007.
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: LIVE_VOICE } } },
            },
            systemInstruction: { parts: [{ text: claims.instruction }] },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            sessionResumption: handle ? { handle } : {},
        },
    };
}

/**
 * Owns one browser socket and the upstream socket behind it.
 *
 * Frames are relayed verbatim in both directions — the browser speaks the Live
 * protocol directly, so nothing here re-encodes audio. What this layer adds is
 * the slot reservation, the setup frame the browser is not trusted to build, a
 * resumption that keeps a live session alive across the upstream's own session
 * cap (measured: goAway about 50 s before the close), and the turn bookkeeping
 * that turns a conversation into persisted, scored answers.
 */
export function relayLiveSession({ client, claims, apiKey, deps = liveDeps }: RelayOptions): void {
    const slot = reserveLiveSlot();
    if (!slot) {
        client.close(1011, "All coaches are busy right now. Try again in a moment.");
        return;
    }

    const upstreamUrl = liveUpstreamUrl(apiKey);
    let upstream: WebSocket | null = null;
    let finished = false;
    let accepted = false;
    let resumptions = 0;
    let resumptionHandle: string | null = null;
    let goAwaySeen = false;
    let framesUp = 0;
    let framesDown = 0;
    let bytesUp = 0;
    let bytesDown = 0;

    // Turn bookkeeping. Transcripts are the candidate's own words, so they stay
    // in memory, go to the database, and are only ever sent to the client that
    // spoke them — never to a log.
    const turns: LiveTurn[] = [];
    let answerInProgress = "";
    let scoring = Promise.resolve();

    const sendToClient = (frame: unknown): void => {
        if (client.readyState === WsServer.OPEN) client.send(JSON.stringify(frame));
    };

    const finish = (code: number, reason: string): void => {
        if (finished) return;
        finished = true;
        releaseLiveSlot(slot);
        const closing = upstream;
        upstream = null;
        try {
            closing?.close();
        } catch {
            /* upstream already gone */
        }
        try {
            if (client.readyState === WsServer.OPEN) client.close(closableCode(code), reason.slice(0, 120));
        } catch {
            /* client already gone */
        }

        if (claims.mode === "practice") {
            // Practice has always persisted once, at the end of a session; a
            // socket that closes before any answer leaves no row, as before.
            void deps.finishPracticeSession(claims, turns).catch((error: unknown) => {
                console.warn("[live] practice session save failed:", error instanceof Error ? error.message : "unknown");
            });
        } else {
            // Counters and outcomes only: an invite id maps back to a candidate,
            // and no transcript or audio ever reaches this table.
            void logAudit({
                userId: claims._id,
                action: "interview_start",
                details: `live session ended (${reason})`,
                metadata: { mode: claims.mode, turns: turns.length, resumptions, framesUp, framesDown, bytesUp, bytesDown },
            });
        }
    };

    /**
     * Scores an answer and records it. Queued rather than parallel so the stored
     * order matches the order the answers were given.
     */
    const closeTurn = (transcription: string): void => {
        const question = claims.question;
        turns.push({ question, transcription, score: null, feedback: UNSCORED_FEEDBACK });
        const turn = turns[turns.length - 1]!;

        scoring = scoring
            .then(async () => {
                const scored = await deps.score(question, transcription);
                if (scored) {
                    turn.score = scored.score;
                    turn.feedback = scored.feedback;
                }
                // An interview writes each answer onto the invite as it lands;
                // practice accumulates and writes once at the end, as it always has.
                if (claims.mode === "interview") await deps.recordTurn(claims, turn);
                // The client cannot see the score otherwise: it is decided here,
                // and this frame is the only channel back to the page.
                sendToClient({ proxy: { type: "turn", ...turn } });
            })
            .catch((error: unknown) => {
                console.warn("[live] turn scoring failed:", error instanceof Error ? error.message : "unknown");
            });
    };

    const inspect = (text: string): void => {
        let frame: UpstreamFrame;
        try {
            frame = JSON.parse(text) as UpstreamFrame;
        } catch {
            return;
        }
        if (frame.setupComplete) {
            accepted = true;
            // The model answers a turn, it does not open one: without this the
            // candidate hears silence after connecting. Only the first
            // connection gets it — a resumed socket also reports setupComplete,
            // and re-sending would make the coach greet twice.
            if (resumptions === 0 && upstream?.readyState === WebSocket.OPEN) {
                upstream.send(JSON.stringify({ realtimeInput: { text: claims.kickoff } }));
            }
            return;
        }
        if (frame.sessionResumptionUpdate?.newHandle) {
            resumptionHandle = frame.sessionResumptionUpdate.newHandle;
        }
        if (frame.goAway) {
            goAwaySeen = true;
            console.log(`[live] goAway received (timeLeft=${frame.goAway.timeLeft ?? "?"})`);
        }

        const finalInput = frame.serverContent?.inputTranscription?.text;
        if (finalInput) answerInProgress += (answerInProgress ? " " : "") + finalInput;
        if (frame.serverContent?.turnComplete && answerInProgress.trim()) {
            closeTurn(answerInProgress.trim());
            answerInProgress = "";
        }
    };

    const openUpstream = (): void => {
        const socket = new WebSocket(upstreamUrl);
        socket.binaryType = "arraybuffer";
        upstream = socket;
        accepted = false;

        // Armed per connection and self-cancelling: it only fires if this socket
        // is still the live one and the upstream never accepted the session, so
        // no handle has to be stored or cleared.
        setTimeout(() => {
            if (!accepted && upstream === socket) finish(1011, "The voice service did not accept the session.");
        }, LIVE_SETUP_TIMEOUT_MS);

        socket.onopen = () => socket.send(JSON.stringify(buildSetup(claims, resumptionHandle)));

        socket.onmessage = (event: MessageEvent) => {
            if (finished) return;
            if (typeof event.data === "string") {
                framesDown++;
                bytesDown += Buffer.byteLength(event.data);
                if (client.readyState === WsServer.OPEN) client.send(event.data);
                inspect(event.data);
                return;
            }
            const view = Buffer.from(event.data as ArrayBuffer);
            framesDown++;
            bytesDown += view.byteLength;
            if (client.readyState === WsServer.OPEN) client.send(view);
            inspect(view.toString("utf8"));
        };

        socket.onclose = (event: CloseEvent) => {
            if (finished || upstream !== socket) return;
            const canResume =
                Boolean(resumptionHandle) &&
                resumptions < LIVE_MAX_RESUMPTIONS &&
                (goAwaySeen || event.code === 1008 || event.code === 1001);
            if (canResume) {
                resumptions++;
                goAwaySeen = false;
                console.log(`[live] upstream closed ${event.code} — resuming (${resumptions}/${LIVE_MAX_RESUMPTIONS})`);
                openUpstream();
                return;
            }
            finish(event.code || 1011, event.reason || "Live session ended upstream");
        };

        socket.onerror = () => console.error("[live] upstream socket error");
    };

    client.on("message", (data, isBinary) => {
        if (finished || !upstream) return;
        // The browser sends text frames (base64 audio JSON); binary is passed
        // through unchanged in case a client ever streams raw PCM.
        const payload = isBinary ? Buffer.from(data as Buffer) : data.toString();
        framesUp++;
        bytesUp += payload.length;
        if (upstream.readyState === WebSocket.OPEN) upstream.send(payload);
    });

    client.on("close", () => finish(1000, "client closed"));
    client.on("error", (err: Error) => {
        console.error("[live] client socket error:", err.message);
        finish(1011, "client socket error");
    });

    openUpstream();
}
