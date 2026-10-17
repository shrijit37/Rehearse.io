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
// Two slots makes the ceiling observable without opening five sockets.
process.env.GEMINI_LIVE_MAX_SESSIONS = "2";
// Kept short so the watchdog case finishes inside the test budget.
process.env.GEMINI_LIVE_SETUP_TIMEOUT_MS = "700";

import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer, WebSocket as WsClient } from "ws";

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
// listening is enough to keep the whole run offline.
process.env.GEMINI_LIVE_WS_URL = `ws://127.0.0.1:${upstreamPort}`;

// Everything the relay logs, so the redaction guarantee can be asserted instead
// of assumed: the API key rides in the upstream URL, and transcripts are the
// candidate's own words.
const captured = { log: [] as string[], warn: [] as string[], error: [] as string[] };
for (const level of ["log", "warn", "error"] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
        captured[level].push(args.map((a) => (typeof a === "string" ? a : String(a))).join(" "));
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

        if (frame.realtimeInput?.audio) record.audioFrames.push(frame.realtimeInput.audio);
    });
});

console.log(`fake upstream on ws://127.0.0.1:${upstreamPort}`);

// ---------------------------------------------------------------------------
// Relay under test
// ---------------------------------------------------------------------------

const server: Server = createServer();
attachLiveUpgrade(server);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const wsUrl = `ws://127.0.0.1:${listeningPort(server)}${LIVE_WS_PATH}`;

interface ClientFrame {
    setupComplete?: unknown;
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
const ticketFor = (instruction: string): string =>
    mintLiveTicket({ _id: PRACTICE_USER, mode: "practice", instruction, kickoff: "Greet and ask." });

console.log("\n== auth ==");

const anonymous = await openClient("");
check("no ticket is refused", anonymous.socket.readyState !== WsClient.OPEN, `state=${anonymous.socket.readyState}`);
check("no ticket is not counted as a session", liveSessionCount() === 0, `count=${liveSessionCount()}`);

const forged = await openClient("not-a-real-ticket");
check("forged ticket is refused", forged.socket.readyState !== WsClient.OPEN, `state=${forged.socket.readyState}`);

console.log("\n== relay ==");

const good = await openClient(ticketFor("You are a test coach."));
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
check("instruction reaches the upstream", String(setup?.systemInstruction?.parts?.[0]?.text).includes("test coach"));

const kickoff = await waitFor(() => upstreamConnections[0]?.textTurns[0]);
check("relay opens the conversation with the kickoff turn", kickoff === "Greet and ask.", String(kickoff));

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
// second one — which is the connection that must carry the handle.
const firstConnection = upstreamConnections.length;
const resumed = await waitFor(
    () => (upstreamConnections.length > firstConnection + 1 ? upstreamConnections.length : undefined),
    5000,
);
check("relay reconnects after goAway", resumed !== undefined, `connections=${upstreamConnections.length}`);
check(
    "the reconnect carries the resumption handle",
    upstreamConnections[firstConnection + 1]?.setups[0]?.sessionResumption?.handle === "handle-1",
    JSON.stringify(upstreamConnections[firstConnection + 1]?.setups[0]?.sessionResumption ?? {}),
);
check("the browser socket stays open across the resume", capped.socket.readyState === WsClient.OPEN, `state=${capped.socket.readyState}`);
check(
    "the resumed session is not greeted twice",
    upstreamConnections[firstConnection + 1]?.textTurns.length === 0,
    `kickoffs=${JSON.stringify(upstreamConnections[firstConnection + 1]?.textTurns ?? [])}`,
);

console.log("\n== teardown ==");

capped.socket.close();
check("the last client releases its slot", await waitUntil(() => liveSessionCount() === 0, 5000), `count=${liveSessionCount()}`);

console.log("\n== redaction and failure paths ==");

const allLogs = [...captured.log, ...captured.warn, ...captured.error].join("\n");
check("the API key never reaches a log line", !allLogs.includes("test-key"), "a log line carried the key");
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
