// Live spoken session over the backend's WebSocket proxy at `/ws/live`:
// ticket -> subprotocol handshake -> verbatim relay of the Gemini Live frames.
// The backend owns the `setup` frame and the upstream socket; this module only
// mints the ticket, taps the mic, plays the coach, and reports turn state.

import { api, BASE_URL } from "../api";
import { createPcmPlayer, startMicCapture, type MicCapture } from "./audio";
import type { LiveSpeaker, LiveTurnState } from "./types";

export interface LiveSessionOptions {
  /** POST body for the ticket: practice carries questions, interview carries inviteId. */
  request: {
    mode: "practice" | "interview";
    targetRole?: string;
    questions?: string[];
    questionIndex?: number;
    inviteId?: string;
  };
  /** Invited-candidate JWT, mirroring api.ts's tokenOverride. Omit for a signed-in user (cookie auth). */
  tokenOverride?: string | null;
  /** Half-duplex: stop sending mic frames while the coach is speaking. Default true. */
  halfDuplex?: boolean;
  onState(state: LiveTurnState): void;
  onTranscript(speaker: LiveSpeaker, text: string, final: boolean): void;
  onError(message: string): void;
  onClose?(code: number, reason: string): void;
}

export interface LiveSession {
  stop(): void;
  sendText(text: string): void;
}

interface LiveTicket {
  ticket: string;
  model: string;
  voice: string;
  path: string;
}

interface TicketResponse {
  status?: string;
  message?: string;
  data?: LiveTicket;
}

/** The subset of the Gemini Live frames this client acts on; everything else is ignored. */
interface ServerContent {
  modelTurn?: { parts?: { inlineData?: { data?: string }; text?: string }[] };
  interimInputTranscription?: { text?: string };
  inputTranscription?: { text?: string };
  interimOutputTranscription?: { text?: string };
  outputTranscription?: { text?: string };
  interrupted?: boolean;
  turnComplete?: boolean;
}

interface ServerFrame {
  setupComplete?: boolean;
  serverContent?: ServerContent;
  goAway?: { timeLeft?: string };
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
}

export async function startLiveSession(options: LiveSessionOptions): Promise<LiveSession> {
  const { request, tokenOverride, halfDuplex = true } = options;

  let lastState: LiveTurnState | null = null;
  const emitState = (next: LiveTurnState) => {
    if (next === lastState) return;
    lastState = next;
    options.onState(next);
  };
  emitState("connecting");

  let ticket: LiveTicket;
  try {
    ticket = await fetchTicket(request, tokenOverride);
  } catch (error) {
    emitState("error");
    throw error;
  }

  // The ticket travels as a subprotocol header — a browser cannot set an
  // Authorization header on a WebSocket, and a query param would land in logs.
  const socket = new WebSocket(ticketSocketUrl(ticket.path), ["bearer", ticket.ticket]);
  socket.binaryType = "arraybuffer";

  const player = createPcmPlayer();
  let mic: MicCapture | null = null;
  let micStarted = false;
  let ready = false;
  let stopped = false;
  let closeNotified = false;
  /** A final input transcript has landed and the coach's audio has not started. */
  let awaitingReply = false;
  let stateTimer: number | null = null;

  const settledState = (): LiveTurnState => {
    if (!ready) return "connecting";
    if (player.speaking) return "speaking";
    if (awaitingReply) return "thinking";
    return "listening";
  };

  const syncState = () => {
    if (stopped) return;
    emitState(settledState());
    // Nothing fires when the last scheduled chunk drains, so keep re-checking
    // for as long as the player still reports playback.
    if (player.speaking && stateTimer === null) {
      stateTimer = window.setTimeout(() => {
        stateTimer = null;
        syncState();
      }, 100);
    }
  };

  const handleMessage = (frame: ServerFrame) => {
    if (stopped) return;

    if (frame.setupComplete) {
      ready = true;
      syncState();
      return;
    }

    // Resumption and goAway are the backend's business: it reconnects into the
    // same session before the forced close and keeps this socket alive.
    if (frame.sessionResumptionUpdate || frame.goAway) return;

    const content = frame.serverContent;
    if (!content) return;

    if (content.interrupted) {
      awaitingReply = false;
      player.stop();
    }

    for (const part of content.modelTurn?.parts ?? []) {
      const chunk = part.inlineData?.data;
      if (!chunk) continue;
      awaitingReply = false;
      player.write(decodePcm16(chunk));
    }

    // A final supersedes the interim the caller is already showing for that
    // speaker — `final: true` is "replace this speaker's current line with
    // text", so a new final cancels the previous turn's in-flight transcript
    // instead of being appended to it.
    const interimInput = content.interimInputTranscription?.text;
    if (interimInput) options.onTranscript("you", interimInput, false);
    const input = content.inputTranscription?.text;
    if (input) {
      awaitingReply = true;
      options.onTranscript("you", input, true);
    }
    const interimOutput = content.interimOutputTranscription?.text;
    if (interimOutput) options.onTranscript("coach", interimOutput, false);
    const output = content.outputTranscription?.text;
    if (output) options.onTranscript("coach", output, true);

    if (content.turnComplete) awaitingReply = false;

    syncState();
  };

  const handleRawFrame = (data: unknown) => {
    if (typeof data !== "string" && !(data instanceof ArrayBuffer)) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof data === "string" ? data : new TextDecoder().decode(data));
    } catch {
      return; // an unparseable frame is not worth tearing the session down for
    }
    if (typeof parsed !== "object" || parsed === null) return;
    handleMessage(parsed as ServerFrame);
  };

  const sendFrame = (pcm16: Int16Array) => {
    if (stopped || !ready) return;
    if (halfDuplex && player.speaking) return;
    if (socket.readyState !== WebSocket.OPEN) return;
    const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
    socket.send(
      JSON.stringify({
        realtimeInput: { audio: { data: encodeBase64(bytes), mimeType: "audio/pcm;rate=16000" } },
      }),
    );
  };

  const startMic = () => {
    if (micStarted || stopped) return;
    micStarted = true;
    void startMicCapture(sendFrame)
      .then((capture) => {
        if (stopped) capture.stop();
        else mic = capture;
      })
      .catch((error: unknown) => {
        if (stopped) return;
        options.onError(`Microphone unavailable: ${errorMessage(error)}`);
        emitState("error");
      });
  };

  const cleanup = () => {
    if (stateTimer !== null) {
      window.clearTimeout(stateTimer);
      stateTimer = null;
    }
    mic?.stop();
    mic = null;
    player.stop();
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cleanup();
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
      socket.close(1000, "client stopped");
    }
    emitState("idle");
  };

  socket.onopen = () => {
    if (stopped) return;
    startMic();
  };

  socket.onmessage = (event: MessageEvent<unknown>) => {
    handleRawFrame(event.data);
  };

  socket.onclose = (event: CloseEvent) => {
    cleanup();
    if (!closeNotified) {
      closeNotified = true;
      options.onClose?.(event.code, event.reason);
    }
    if (stopped) return;
    stopped = true;
    // A proxy refusal arrives as a close reason (`1011` "all coaches are busy"),
    // so the reason is what the UI has to show.
    const message = event.reason || (event.code === 1000 ? "" : `Live session closed (${event.code})`);
    if (message) {
      emitState("error");
      options.onError(message);
    } else {
      emitState("idle");
    }
  };

  return {
    stop,
    sendText(text: string) {
      if (stopped) return;
      if (socket.readyState !== WebSocket.OPEN) {
        options.onError("Cannot send text: the live session is not connected");
        return;
      }
      socket.send(JSON.stringify({ realtimeInput: { text } }));
    },
  };
}

async function fetchTicket(
  request: LiveSessionOptions["request"],
  tokenOverride: string | null | undefined,
): Promise<LiveTicket> {
  // Reuses the shared client rather than a second fetch wrapper: same cookie
  // credentials, same `Authorization` override, same error surface.
  const body = await api.post<TicketResponse>("/api/live/session", request, {
    tokenOverride: tokenOverride ?? undefined,
  });
  const ticket = body?.data;
  if (!ticket?.ticket || !ticket.path) throw new Error("Live session response did not include a ticket");
  return ticket;
}

function ticketSocketUrl(path: string): string {
  // http(s) -> ws(s); a relative BASE_URL stays relative and the browser
  // resolves it against the document.
  const base = BASE_URL.replace(/\/+$/, "").replace(/^http/i, "ws");
  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

function decodePcm16(base64: string): Int16Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, bytes.byteLength >> 1);
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "unknown error";
}
