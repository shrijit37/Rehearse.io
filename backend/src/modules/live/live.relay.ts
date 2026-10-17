import { WebSocket as WsServer, type WebSocket as ClientSocket } from "ws";
import { logAudit } from "../../middleware/auditLog";
import { LIVE_MAX_RESUMPTIONS, LIVE_MODEL, LIVE_VOICE, liveUpstreamUrl } from "./live.config";
import { releaseLiveSlot, reserveLiveSlot, type LiveTicketClaims } from "./live.service";

interface RelayOptions {
    client: ClientSocket;
    claims: LiveTicketClaims;
    apiKey: string;
}

interface UpstreamFrame {
    setupComplete?: unknown;
    goAway?: { timeLeft?: string };
    sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
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
 * the slot reservation, the setup frame the browser is not trusted to build,
 * and a resumption that keeps a live session alive across the upstream's own
 * session cap (measured: goAway about 50 s before the close).
 */
export function relayLiveSession({ client, claims, apiKey }: RelayOptions): void {
    const slot = reserveLiveSlot();
    if (!slot) {
        client.close(1011, "All coaches are busy right now. Try again in a moment.");
        return;
    }

    const upstreamUrl = liveUpstreamUrl(apiKey);
    let upstream: WebSocket | null = null;
    let finished = false;
    let resumptions = 0;
    let resumptionHandle: string | null = null;
    let goAwaySeen = false;
    let framesUp = 0;
    let framesDown = 0;
    let bytesUp = 0;
    let bytesDown = 0;

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
            if (client.readyState === WsServer.OPEN) client.close(code, reason.slice(0, 120));
        } catch {
            /* client already gone */
        }
        if (claims.mode === "interview") {
            void logAudit({
                userId: claims._id,
                action: "interview_start",
                details: `live session ended (${reason})`,
                metadata: {
                    mode: claims.mode,
                    inviteId: claims.inviteId ?? null,
                    resumptions,
                    framesUp,
                    framesDown,
                    bytesUp,
                    bytesDown,
                },
            });
        }
    };

    const inspect = (text: string): void => {
        let frame: UpstreamFrame;
        try {
            frame = JSON.parse(text) as UpstreamFrame;
        } catch {
            return;
        }
        if (frame.setupComplete) {
            // The model answers a turn, it does not open one: without this the
            // candidate hears silence after connecting.
            if (upstream?.readyState === WebSocket.OPEN) {
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
    };

    const openUpstream = (): void => {
        const socket = new WebSocket(upstreamUrl);
        socket.binaryType = "arraybuffer";
        upstream = socket;

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
