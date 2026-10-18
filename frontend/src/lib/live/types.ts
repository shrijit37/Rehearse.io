/** Turn state of a live spoken session, as driven by the coach's socket. */
export type LiveTurnState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "error";

/** Who a live transcript segment came from. */
export type LiveSpeaker = "you" | "coach";
