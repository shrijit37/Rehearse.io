/**
 * Live voice proxy — behavioural test.
 *
 * The upstream is faked, so this needs no Google key, no database and no
 * network. It asserts the things the relay is responsible for: building the
 * setup frame the browser is not trusted to send, opening the conversation so
 * the candidate does not hear silence, forwarding frames verbatim both ways,
 * surviving the upstream's own session cap through resumption, and refusing
 * callers who should not get a socket at all.
 *
 * Run: bun tests/live-proxy.ts   (also runs inside ./scripts/test)
 *
 * The modules under test are imported dynamically on purpose: `env` and
 * `live.config` read `process.env` at module scope, so the values below must be
 * in place before they load. Static imports would hoist above them.
 */

process.env.DATABASE_URL ||= "postgresql://x:x@127.0.0.1:1/none";
process.env.JWT_SECRET ||= "test-secret";
process.env.GEMINI_API_KEY ||= "test-key";
process.env.LIVE_TICKET_SECRET ||= "test-ticket-secret";
// Two slots makes the ceiling observable without opening five sockets.
process.env.GEMINI_LIVE_MAX_SESSIONS = "2";
// Kept short so the watchdog case finishes inside the test budget.
process.env.GEMINI_LIVE_SETUP_TIMEOUT_MS = "700";

import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { WebSocketServer, WebSocket as WsClient } from "ws";
import type { LiveTurn } from "../src/modules/live/live.persistence";

const { attachLiveUpgrade } = await import("../src/modules/live/live.upgrade");
const { mintLiveTicket, liveSessionCount } = await import("../src/modules/live/live.service");
const { LIVE_WS_PATH } = await import("../src/modules/live/live.config");

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ""): void {
    if (ok) {
        passed++;
        console.log(`  ok   ${name}`);
    } else {
        failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
        console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
    }
}

const sleep = (ms: number): Promise<void> => {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, ms);
    return promise;
};

async function waitFor<T>(read: () => T | undefined, ms = 4000): Promise<T | undefined> {
    const deadline = Date.now() + ms;
    while (Date.now() <= deadline) {
        const value = read();
        if (value !== undefined) return value;
        await sleep(20);
    }
    return undefined;
}

/** For conditions: a boolean predicate, so `false` keeps waiting instead of resolving. */
async function waitUntil(read: () => boolean, ms = 4000): Promise<boolean> {
    const deadline = Date.now() + ms;
    while (Date.now() <= deadline) {
        if (read()) return true;
        await sleep(20);
    }
    return false;
}

/** Port of a listening server. `address()` is a union, so narrow rather than cast. */
function listeningPort(server: Server | WebSocketServer): number {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server is not listening on a TCP port");
    return (address satisfies AddressInfo).port;
}

// ---------------------------------------------------------------------------
// Fake upstream: enough of the Live protocol to exercise the relay.
// ---------------------------------------------------------------------------

interface UpstreamSetup {
    model?: string;
    generationConfig?: {
        responseModalities?: string[];
        speechConfig?: { voiceConfig?: { prebuiltVoiceConfig?: { voiceName?: string } } };
    };
    systemInstruction?: { parts?: { text?: string }[] };
    inputAudioTranscription?: unknown;
    outputAudioTranscription?: unknown;
    sessionResumption?: { handle?: string };
}

interface UpstreamConnection {
    setups: UpstreamSetup[];
    textTurns: string[];
    audioFrames: { data: string; mimeType?: string }[];
}

interface UpstreamFrame {
    setup?: UpstreamSetup;
    realtimeInput?: { text?: string; audio?: { data: string; mimeType?: string } };
}

const upstreamConnections: UpstreamConnection[] = [];
const upstream = new WebSocketServer({ port: 0 });
await new Promise<void>((resolve) => upstream.once("listening", resolve));
const upstreamPort = listeningPort(upstream);
// Read at call time by liveUpstreamUrl, so setting it once the fake is
// listening is enough to keep the whole run offline. Aiming the relay at an
// override also takes an explicit opt-in (never in production), which is
// asserted below.
process.env.GEMINI_LIVE_WS_URL = `ws://127.0.0.1:${upstreamPort}`;
process.env.ALLOW_LIVE_WS_OVERRIDE = "true";

// Everything the relay logs, so the redaction guarantee can be asserted instead
// of assumed: the API key rides in the upstream URL, and transcripts are the
// candidate's own words.
const captured: string[] = [];
for (const level of ["log", "warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
        const line = args.map((a) => (typeof a === "string" ? a : String(a))).join(" ");
        // The application's own lines only. The suite prints to the same console,
        // and a failing assertion's detail would otherwise be captured as if the
        // code had leaked it.
        if (line.startsWith("[live]") || line.startsWith("Audit log error")) captured.push(line);
        original(...args);
    };
}

const PCM_24K_SILENCE = Buffer.alloc(320).toString("base64");

upstream.on("connection", (socket) => {
    const record: UpstreamConnection = { setups: [], textTurns: [], audioFrames: [] };
    upstreamConnections.push(record);

    socket.on("message", (data) => {
        const frame = JSON.parse(data.toString()) as UpstreamFrame;

        if (frame.setup) {
            record.setups.push(frame.setup);
            const instruction = frame.setup.systemInstruction?.parts?.[0]?.text ?? "";

            // An upstream that accepts the connection and then says nothing is
            // indistinguishable from a hung one, and it holds a slot.
            if (instruction.includes("SILENT")) return;

            // An abrupt drop: terminate() sends no close frame, so the relay
            // sees the reserved code 1006 that it must not forward verbatim.
            if (instruction.includes("DROP")) {
                socket.terminate();
                return;
            }

            socket.send(Buffer.from(JSON.stringify({ setupComplete: {} })));

            // A session whose instruction asks for it behaves like one hitting
            // the upstream's documented cap: handle, then goAway, then close.
            if (instruction.includes("GOAWAY")) {
                setTimeout(() => {
                    socket.send(JSON.stringify({ sessionResumptionUpdate: { newHandle: "handle-1", resumable: true } }));
                }, 60);
                setTimeout(() => {
                    socket.send(JSON.stringify({ goAway: { timeLeft: "2s" } }));
                    socket.close(1008, "session duration cap");
                }, 160);
            }
            return;
        }

        if (frame.realtimeInput?.text) {
            record.textTurns.push(frame.realtimeInput.text);
            socket.send(JSON.stringify({ serverContent: { outputTranscription: { text: "Hello." } } }));
            // The real server sends its frames as binary, so the relay must not
            // assume text.
            socket.send(
                Buffer.from(
                    JSON.stringify({
                        serverContent: {
                            modelTurn: {
                                parts: [{ inlineData: { data: PCM_24K_SILENCE, mimeType: "audio/pcm;rate=24000" } }],
                            },
                            turnComplete: true,
                        },
                    }),
                ),
            );
            return;
        }

        if (frame.realtimeInput?.audio) {
            record.audioFrames.push(frame.realtimeInput.audio);
            // "AAAA" stands in for a spoken answer: the real upstream emits a
            // final input transcript and then closes the turn.
            // "BBBB" is a final transcript whose turn never completes: the answer
            // is in progress when the candidate moves on.
            if (frame.realtimeInput.audio.data === "BBBB") {
                socket.send(JSON.stringify({ serverContent: { inputTranscription: { text: "a pending answer" } } }));
            }
            if (frame.realtimeInput.audio.data === "AAAA") {
                const answer = `answer ${record.audioFrames.length}`;
                socket.send(JSON.stringify({ serverContent: { inputTranscription: { text: answer } } }));
                setTimeout(() => socket.send(Buffer.from(JSON.stringify({ serverContent: { turnComplete: true } }))), 20);
            }
        }
    });
});

console.log(`fake upstream on ws://127.0.0.1:${upstreamPort}`);

// ---------------------------------------------------------------------------
// Relay under test
// ---------------------------------------------------------------------------

const server: Server = createServer();
// Fakes for the relay's only outside dependencies: the scoring call and the two
// persistence paths. The relay's own behaviour is what is under test here.
const scored: { question: string; transcription: string }[] = [];
const recorded: LiveTurn[] = [];
const saves: { userId: string; turns: LiveTurn[] }[] = [];
let scoringFails = false;
let saveStatus = 201;
let saveThrows = false;
attachLiveUpgrade(server, {
    async score(question, transcription) {
        scored.push({ question, transcription });
        if (scoringFails) return null;
        return { score: 7, feedback: "Clear structure, add a metric." };
    },
    async recordTurn(_claims, turn) {
        recorded.push(turn);
    },
    async resolveQuestion(_claims, index) {
        return `database question ${index}`;
    },
    async finishPracticeSession(claims, turns) {
        saves.push({ userId: claims._id, turns: [...turns] });
        // A failed drizzle insert reports its statement and bound parameters in
        // its *message*, which is why the relay must never log that message.
        // Returning the status is what the real dependency does.
        if (saveThrows) {
            throw new Error(
                `Failed query: insert into "rehearsal_sessions" ... params: ${JSON.stringify(turns[0]?.transcription)}`,
            );
        }
        return saveStatus;
    },
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const wsUrl = `ws://127.0.0.1:${listeningPort(server)}${LIVE_WS_PATH}`;

interface ClientFrame {
    setupComplete?: unknown;
    proxy?: {
        type?: string;
        questionIndex?: number;
        question?: string;
        transcription?: string;
        score?: number | null;
        feedback?: string;
    };
    serverContent?: {
        turnComplete?: unknown;
        outputTranscription?: { text?: string };
        modelTurn?: { parts?: { inlineData?: { data?: string } }[] };
    };
}

interface TestClient {
    socket: WsClient;
    frames: ClientFrame[];
    close: { code: number; reason: string } | null;
    error: string | null;
}

/** Opens a client and resolves once it is open, closed, or errored. */
function openClient(ticket: string): Promise<TestClient> {
    const socket = new WsClient(wsUrl, ticket ? ["bearer", ticket] : []);
    const client: TestClient = { socket, frames: [], close: null, error: null };
    socket.on("message", (data) => client.frames.push(JSON.parse(data.toString()) as ClientFrame));
    socket.on("close", (code, reason) => {
        client.close = { code, reason: reason.toString() };
    });
    socket.on("error", (err) => {
        client.error = err.message;
    });

    const { promise, resolve } = Promise.withResolvers<TestClient>();
    const settle = (): void => resolve(client);
    socket.once("open", settle);
    socket.once("close", settle);
    socket.once("error", settle);
    setTimeout(settle, 3000);
    return promise;
}

const PRACTICE_USER = "00000000-0000-0000-0000-000000000001";
/** The client that spans several questions — the one whose saves prove the shape. */
const MULTI_QUESTION_USER = "00000000-0000-0000-0000-000000000002";
const BASE_QUESTION = "Tell me about a time you had to make a decision with incomplete data.";
/**
 * A practice ticket. `trigger` rides in the *question*: the coach's instruction
 * is built from the question in the relay (the browser never carries it), and
 * the fake upstream keys its SILENT/DROP/GOAWAY behaviours off the instruction
 * it is handed.
 */
const ticketFor = (trigger?: string, userId = PRACTICE_USER): string =>
    mintLiveTicket({
        _id: userId,
        mode: "practice",
        question: trigger ? `${BASE_QUESTION} ${trigger}` : BASE_QUESTION,
        questionIndex: 0,
        targetRole: "Software Engineer",
    });

console.log("\n== auth ==");

const anonymous = await openClient("");
check("no ticket is refused", anonymous.socket.readyState !== WsClient.OPEN, `state=${anonymous.socket.readyState}`);
check("no ticket is not counted as a session", liveSessionCount() === 0, `count=${liveSessionCount()}`);

const forged = await openClient("not-a-real-ticket");
check("forged ticket is refused", forged.socket.readyState !== WsClient.OPEN, `state=${forged.socket.readyState}`);

// The minting route's own auth gate: the socket handshake is covered above, but
// an anonymous or forged caller must not reach the handler either. (A valid
// bearer is not asserted here: it would need a database lookup.) Imported
// dynamically for the same reason as the modules above — the router reaches
// `env`, which reads `process.env` at module scope.
const mintApp = express();
mintApp.use(express.json());
mintApp.use("/api/live", (await import("../src/modules/live/live.routes")).default);
const mintServer = mintApp.listen(0);
const mintUrl = `http://127.0.0.1:${listeningPort(mintServer)}/api/live/session`;
const mintInit = { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } as const;
const anonymousMint = await fetch(mintUrl, mintInit);
check("ticket minting refuses an anonymous caller", anonymousMint.status === 401, `status=${anonymousMint.status}`);
const forgedMint = await fetch(mintUrl, {
    ...mintInit,
    headers: { ...mintInit.headers, authorization: "Bearer not-a-jwt" },
});
check("ticket minting refuses a forged bearer", forgedMint.status === 401, `status=${forgedMint.status}`);
mintServer.close();

console.log("\n== relay ==");

const good = await openClient(ticketFor(undefined, MULTI_QUESTION_USER));
const connected = await waitFor(() => (good.socket.readyState === WsClient.OPEN ? true : undefined));
check("valid ticket upgrades", connected === true, `state=${good.socket.readyState}, error=${good.error ?? "none"}`);

const setup = await waitFor(() => upstreamConnections[0]?.setups[0]);
check("relay sends its own setup frame", Boolean(setup), JSON.stringify(setup ?? {}).slice(0, 200));
check("setup targets the configured model", setup?.model === "models/gemini-3.8-live", String(setup?.model));
check("audio output is requested", JSON.stringify(setup?.generationConfig?.responseModalities) === '["AUDIO"]');
check(
    "voice is nested under generationConfig",
    Boolean(setup?.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName),
    JSON.stringify(setup?.generationConfig?.speechConfig ?? {}),
);
check("transcripts are requested both ways", Boolean(setup?.inputAudioTranscription && setup?.outputAudioTranscription));
const instructionText = String(setup?.systemInstruction?.parts?.[0]?.text);
check(
    "the setup instruction is built from the ticket's role and question",
    instructionText.includes("Software Engineer") && instructionText.includes(BASE_QUESTION),
    instructionText.slice(0, 120),
);

const kickoff = await waitFor(() => upstreamConnections[0]?.textTurns[0]);
check(
    "relay opens the conversation with the shipped opener",
    kickoff === "Greet the candidate in one short sentence, then ask the question.",
    String(kickoff),
);

check(
    "setupComplete is relayed to the browser",
    await waitUntil(() => good.frames.some((f) => f.setupComplete)),
);
check(
    "binary upstream frames reach the browser",
    await waitUntil(() => good.frames.some((f) => f.serverContent?.modelTurn !== undefined)),
);
check(
    "audio payload survives the relay byte-for-byte",
    good.frames.some((f) => f.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data === PCM_24K_SILENCE),
);
check("turnComplete is relayed", good.frames.some((f) => f.serverContent?.turnComplete === true));

good.socket.send(JSON.stringify({ realtimeInput: { audio: { data: "AAAA", mimeType: "audio/pcm;rate=16000" } } }));
const audioUp = await waitFor(() => upstreamConnections[0]?.audioFrames[0]);
check("browser audio reaches the upstream verbatim", audioUp?.data === "AAAA", JSON.stringify(audioUp ?? {}));
check("the declared input rate is preserved", audioUp?.mimeType === "audio/pcm;rate=16000", String(audioUp?.mimeType));
check("one live session is counted", liveSessionCount() === 1, `count=${liveSessionCount()}`);

console.log("\n== scored turns ==");

const proxyFrame = await waitFor(
    () => good.frames.find((f) => f.proxy?.type === "turn"),
    5000,
);
check("a completed answer is scored", proxyFrame?.proxy?.score === 7, JSON.stringify(proxyFrame?.proxy ?? {}));
check(
    "the score is sent to the page over the socket",
    typeof proxyFrame?.proxy?.feedback === "string" && proxyFrame.proxy.feedback.includes("structure"),
    String(proxyFrame?.proxy?.feedback),
);
check(
    "the scored question is the one that was asked",
    proxyFrame?.proxy?.question?.includes("incomplete data") === true,
    String(proxyFrame?.proxy?.question),
);
check("scoring received the transcript, not the audio", scored[0]?.transcription === "answer 1", JSON.stringify(scored[0] ?? {}));
check("practice does not write per turn", recorded.length === 0, `recorded=${recorded.length}`);

good.socket.send(JSON.stringify({ realtimeInput: { audio: { data: "AAAA", mimeType: "audio/pcm;rate=16000" } } }));
const secondTurn = await waitFor(() => (good.frames.filter((f) => f.proxy?.type === "turn").length >= 2 ? true : undefined), 5000);
check("a second answer is scored too", secondTurn === true, `proxy frames=${good.frames.filter((f) => f.proxy?.type === "turn").length}`);

scoringFails = true;
good.socket.send(JSON.stringify({ realtimeInput: { audio: { data: "AAAA", mimeType: "audio/pcm;rate=16000" } } }));
const unscored = await waitFor(() => {
    const frames = good.frames.filter((f) => f.proxy?.type === "turn");
    return frames.length >= 3 ? frames[2] : undefined;
}, 5000);
check(
    "a failed rubric stores the answer as unscored rather than inventing a grade",
    unscored?.proxy?.score === null && (unscored?.proxy?.feedback ?? "").includes("could not be scored"),
    JSON.stringify(unscored?.proxy ?? {}),
);
scoringFails = false;

console.log("\n== one session, several questions ==");

// Advancing a question must not need a new socket: a reconnect would store a
// separate practice session per question and greet the candidate again each time.
const beforeAsk = upstreamConnections[0]?.textTurns.length ?? 0;
good.socket.send(JSON.stringify({ proxy: { type: "ask", index: 1, question: "Second question?" } }));
const asked = await waitFor(
    () => (upstreamConnections[0] && upstreamConnections[0].textTurns.length > beforeAsk ? upstreamConnections[0].textTurns[beforeAsk] : undefined),
    4000,
);
check("a question can be advanced on the open socket", (asked ?? "").includes("Second question?"), String(asked));

const turnsBefore = upstreamConnections[0]?.textTurns.length ?? 0;
good.socket.send(JSON.stringify({ proxy: { type: "ask", index: 1, question: "Second question?" } }));
await sleep(250);
check(
    "re-asking the question it is already on is ignored",
    (upstreamConnections[0]?.textTurns.length ?? 0) === turnsBefore,
    `textTurns=${upstreamConnections[0]?.textTurns.length}`,
);

good.socket.send(JSON.stringify({ realtimeInput: { audio: { data: "AAAA", mimeType: "audio/pcm;rate=16000" } } }));
const secondAnswer = await waitFor(() => {
    const frames = good.frames.filter((f) => f.proxy?.type === "turn");
    return frames.find((f) => f.proxy?.questionIndex === 1);
}, 5000);
check(
    "the answer is attributed to the question that was asked",
    secondAnswer?.proxy?.question === "Second question?",
    JSON.stringify(secondAnswer?.proxy ?? {}),
);

// A pending utterance is an answer the candidate already gave: advancing the
// question must close it, not drop it.
good.socket.send(JSON.stringify({ realtimeInput: { audio: { data: "BBBB", mimeType: "audio/pcm;rate=16000" } } }));
await sleep(200);
good.socket.send(JSON.stringify({ proxy: { type: "ask", index: 2, question: "Third question?" } }));
const closedPending = await waitFor(() => {
    const frames = good.frames.filter((f) => f.proxy?.type === "turn");
    return frames.find((f) => f.proxy?.transcription === "a pending answer");
}, 5000);
check(
    "an answer that was still in progress is closed, not discarded",
    Boolean(closedPending),
    JSON.stringify(closedPending?.proxy ?? {}),
);
check(
    "it is attributed to the question it was answering, not the one being advanced to",
    closedPending?.proxy?.questionIndex === 1 && closedPending.proxy.question === "Second question?",
    JSON.stringify(closedPending?.proxy ?? {}),
);

console.log("\n== concurrency ceiling ==");

const second = await openClient(ticketFor("second"));
await waitFor(() => (second.socket.readyState === WsClient.OPEN ? true : undefined));
check("a second session is accepted up to the cap", liveSessionCount() === 2, `count=${liveSessionCount()}`);

const third = await openClient(ticketFor("third"));
const refused = await waitFor(() => third.close ?? undefined);
check("the session past the cap is refused", refused?.code === 1011, `code=${refused?.code}, error=${third.error ?? "none"}`);
check("the refusal explains itself", (refused?.reason ?? "").includes("busy"), String(refused?.reason));
check("refused sessions never reach the upstream", upstreamConnections.length === 2, `connections=${upstreamConnections.length}`);

console.log("\n== resumption across the upstream session cap ==");

// Both slots are held by the sessions above, so release them first: the case
// under test needs a session that actually reaches the upstream.
good.socket.close();
second.socket.close();
check("slots drain when a client closes", await waitUntil(() => liveSessionCount() === 0, 5000), `count=${liveSessionCount()}`);

const capped = await openClient(ticketFor("GOAWAY please."));
// The capped client opens one upstream connection, then the goAway forces a
// second one — which is the connection that must carry the handle. Wait for that
// connection's setup frame, not merely for the connection to exist.
const firstConnection = upstreamConnections.length;
const resumedSetup = await waitFor(() => upstreamConnections[firstConnection + 1]?.setups[0], 5000);
check("relay reconnects after goAway", resumedSetup !== undefined, `connections=${upstreamConnections.length}`);
check(
    "the reconnect carries the resumption handle",
    resumedSetup?.sessionResumption?.handle === "handle-1",
    JSON.stringify(resumedSetup?.sessionResumption ?? {}),
);
check("the browser socket stays open across the resume", capped.socket.readyState === WsClient.OPEN, `state=${capped.socket.readyState}`);
// The resumed socket answers setupComplete too; give a broken guard time to
// reveal itself before asserting the kickoff was not repeated.
await sleep(250);
check(
    "the resumed session is not greeted twice",
    upstreamConnections[firstConnection + 1]?.textTurns.length === 0,
    `kickoffs=${JSON.stringify(upstreamConnections[firstConnection + 1]?.textTurns ?? [])}`,
);

console.log("\n== what the browser's ticket carries ==");

// A ticket is a bearer value the candidate holds, and a JWT payload is base64
// rather than encryption, so what it carries is what the candidate can read.
// This is an allow-list: any claim added later has to be justified here.
const TICKET_CLAIMS = [
    "_id",
    "purpose",
    "mode",
    "inviteId",
    "jti",
    "question",
    "questionIndex",
    "targetRole",
    "iat",
    "exp",
];
const decodedTicket = JSON.parse(
    Buffer.from(ticketFor("trigger.").split(".")[1]!, "base64url").toString("utf8"),
) as Record<string, unknown>;
check(
    "a ticket carries nothing beyond the turn the candidate is on",
    Object.keys(decodedTicket).every((key) => TICKET_CLAIMS.includes(key)),
    Object.keys(decodedTicket).join(","),
);
check(
    "a ticket carries no coach instruction or opener",
    !("instruction" in decodedTicket) &&
        !("kickoff" in decodedTicket) &&
        !JSON.stringify(decodedTicket).includes("spoken interview coach"),
    JSON.stringify(decodedTicket).slice(0, 160),
);

console.log("\n== aiming the upstream socket ==");

// Dynamic for the same reason as the imports at the top: `live.config` reads
// `process.env` at module scope, and the assertions below change those values.
const { liveUpstreamUrl } = await import("../src/modules/live/live.config");
const overrideUrl = liveUpstreamUrl("k");
check("an opted-in non-production run reaches the override", overrideUrl.startsWith("ws://127.0.0.1:"), overrideUrl);
const savedAllow = process.env.ALLOW_LIVE_WS_OVERRIDE;
const savedAppEnv = process.env.APP_ENV;
const savedNodeEnv = process.env.NODE_ENV;
delete process.env.ALLOW_LIVE_WS_OVERRIDE;
check(
    "without the opt-in the override is ignored",
    liveUpstreamUrl("k").startsWith("wss://generativelanguage.googleapis.com/"),
    liveUpstreamUrl("k"),
);
process.env.ALLOW_LIVE_WS_OVERRIDE = "true";
process.env.APP_ENV = "production";
check(
    "production ignores the override even when it is opted in",
    liveUpstreamUrl("k").startsWith("wss://generativelanguage.googleapis.com/"),
    liveUpstreamUrl("k"),
);
delete process.env.APP_ENV;
process.env.NODE_ENV = "production";
check(
    "a production NODE_ENV alone closes the override",
    liveUpstreamUrl("k").startsWith("wss://generativelanguage.googleapis.com/"),
    liveUpstreamUrl("k"),
);
if (savedAllow === undefined) delete process.env.ALLOW_LIVE_WS_OVERRIDE;
else process.env.ALLOW_LIVE_WS_OVERRIDE = savedAllow;
if (savedAppEnv === undefined) delete process.env.APP_ENV;
else process.env.APP_ENV = savedAppEnv;
if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
else process.env.NODE_ENV = savedNodeEnv;

console.log("\n== teardown ==");

capped.socket.close();
check("the last client releases its slot", await waitUntil(() => liveSessionCount() === 0, 5000), `count=${liveSessionCount()}`);
const runSaves = await waitFor(() => {
    const mine = saves.filter((entry) => entry.userId === MULTI_QUESTION_USER);
    return mine.length > 0 ? mine : undefined;
}, 5000);
check("practice persists once, when the session ends", runSaves?.length === 1, `saves=${runSaves?.length ?? 0}`);
check(
    "one practice run is one stored session, not one per question",
    runSaves?.[0]?.turns.length === 5,
    `turns in the single save=${runSaves?.[0]?.turns.length ?? 0}`,
);
check(
    "the saved rows carry question, transcript, score and feedback",
    runSaves?.[0]?.turns[0]?.question?.includes("incomplete data") === true &&
        runSaves?.[0]?.turns[0]?.transcription === "answer 1" &&
        runSaves?.[0]?.turns[0]?.score === 7,
    JSON.stringify(runSaves?.[0]?.turns[0] ?? {}),
);
check(
    "every saved turn knows which question it answered",
    runSaves?.[0]?.turns.map((turn) => turn.questionIndex).join(",") === "0,0,0,1,1",
    runSaves?.[0]?.turns.map((turn) => turn.questionIndex).join(",") ?? "",
);

const interviewTicket = mintLiveTicket({
    _id: PRACTICE_USER,
    mode: "interview",
    inviteId: "55555555-5555-4555-8555-555555555555",
    question: "First interview question?",
    questionIndex: 0,
    targetRole: "Software Engineer",
});
const connectionsBeforeInterview = upstreamConnections.length;
const interviewClient = await openClient(interviewTicket);
await waitUntil(() => upstreamConnections.length > connectionsBeforeInterview, 3000);
const interviewConnection = connectionsBeforeInterview;
const beforeInterviewAsk = upstreamConnections[interviewConnection]?.textTurns.length ?? 0;
interviewClient.socket.send(JSON.stringify({ proxy: { type: "ask", index: 1 } }));
const askedFromDatabase = await waitFor(
    () => {
        const record = upstreamConnections[interviewConnection];
        if (!record || record.textTurns.length <= beforeInterviewAsk) return undefined;
        return record.textTurns[beforeInterviewAsk];
    },
    4000,
);
check(
    "an interview question comes from the database, not the caller",
    (askedFromDatabase ?? "").includes("database question 1"),
    String(askedFromDatabase),
);
interviewClient.socket.close();
await waitUntil(() => liveSessionCount() === 0, 3000);

const reusable = ticketFor("replay.");
const firstUse = await openClient(reusable);
await waitUntil(() => firstUse.socket.readyState === WsClient.OPEN, 3000);
const secondUse = await openClient(reusable);
await waitUntil(() => secondUse.close !== null || secondUse.error !== null, 3000);
check("a ticket cannot open a second session", secondUse.socket.readyState !== WsClient.OPEN, `state=${secondUse.socket.readyState}`);
check("the replay is refused as used", firstUse.socket.readyState === WsClient.OPEN, `first=${firstUse.socket.readyState}`);
firstUse.socket.close();
await waitUntil(() => liveSessionCount() === 0, 3000);

console.log("\n== redaction and failure paths ==");

const allLogs = captured.join("\n");
check("the API key never reaches a log line", !allLogs.includes("test-key"), "a log line carried the key");
check(
    "the upstream URL never reaches a log line",
    !allLogs.includes("?key=") && !allLogs.includes("127.0.0.1:"),
    "a log line carried the upstream URL, which has the key in its query string",
);
check(
    "spoken content never reaches a log line",
    !allLogs.includes("Hello.") && !allLogs.includes(PCM_24K_SILENCE.slice(0, 24)),
    "a log line carried transcript or audio content",
);

const silent = await openClient(ticketFor("SILENT upstream."));
const timedOut = await waitFor(() => silent.close ?? undefined, 5000);
check("an upstream that never accepts is given up on", timedOut?.code === 1011, `code=${timedOut?.code}, error=${silent.error ?? "none"}`);
check("the abandon explains itself", (timedOut?.reason ?? "").includes("did not accept"), String(timedOut?.reason));
check("an abandoned session frees its slot", await waitUntil(() => liveSessionCount() === 0, 3000), `count=${liveSessionCount()}`);

const dropped = await openClient(ticketFor("DROP mid-session."));
const abnormal = await waitFor(() => dropped.close ?? undefined, 5000);
check("an abrupt upstream drop still closes the client", abnormal !== null, `error=${dropped.error ?? "none"}`);
check(
    "the reserved code 1006 is never forwarded to the client",
    abnormal?.code === 1011,
    `code=${abnormal?.code}, reason=${abnormal?.reason}`,
);

saveStatus = 500;
const leaky = await openClient(ticketFor("save fails."));
await waitUntil(() => leaky.socket.readyState === WsClient.OPEN, 3000);
leaky.socket.send(JSON.stringify({ realtimeInput: { audio: { data: "AAAA", mimeType: "audio/pcm;rate=16000" } } }));
await waitUntil(() => leaky.frames.some((f) => f.proxy?.type === "turn"), 5000);
leaky.socket.close();
await waitUntil(() => liveSessionCount() === 0, 3000);
await sleep(400);
const afterFailure = captured.join("\n");
const leakedTranscript = saves
    .flatMap((entry) => entry.turns.map((turn) => turn.transcription))
    .filter((text) => afterFailure.includes(text));
check(
    "a failed database write does not log its parameters",
    leakedTranscript.length === 0,
    `transcripts in logs: ${JSON.stringify(leakedTranscript)}`,
);
check(
    "a failed audit write does not log its statement",
    !afterFailure.includes('insert into "audit_logs"'),
    "the audit statement reached a log line",
);
check(
    "a failed write is still visible as an outcome",
    afterFailure.includes("not saved (status 500)"),
    "the failure was silently swallowed",
);

// The same invariant when the dependency throws instead of reporting: the throw
// path must not print the driver's message either.
saveStatus = 201;
saveThrows = true;
const throwing = await openClient(ticketFor("save throws."));
await waitUntil(() => throwing.socket.readyState === WsClient.OPEN, 3000);
throwing.socket.send(JSON.stringify({ realtimeInput: { audio: { data: "AAAA", mimeType: "audio/pcm;rate=16000" } } }));
await waitUntil(() => throwing.frames.some((f) => f.proxy?.type === "turn"), 5000);
throwing.socket.close();
await waitUntil(() => liveSessionCount() === 0, 3000);
await sleep(400);
const afterThrow = captured.join("\n");
check(
    "a thrown write failure does not log its message",
    !afterThrow.includes("Failed query") && !afterThrow.includes("params:"),
    "the thrown driver message reached a log line",
);
saveStatus = 201;
saveThrows = false;

const { startLiveSessionSchema } = await import("../src/modules/live/live.validation");
check(
    "an out-of-range question index is rejected before any work",
    !startLiveSessionSchema.safeParse({ mode: "practice", questions: ["a", "b"], questionIndex: 5 }).success,
);
check(
    "an in-range question index is accepted",
    startLiveSessionSchema.safeParse({ mode: "practice", questions: ["a", "b"], questionIndex: 1 }).success,
);
check(
    "an interview is not required to carry questions",
    startLiveSessionSchema.safeParse({ mode: "interview", inviteId: "invite-1", questionIndex: 4 }).success,
);

server.close();
upstream.close();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
}
