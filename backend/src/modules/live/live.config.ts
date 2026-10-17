/**
 * Live voice session configuration.
 *
 * Every number here is measured, not copied from vendor docs — see VOICE.md at
 * the repo root for the evidence. Two of them shape this module: simultaneous
 * Live sessions are capped in the single digits per Google project (6 observed,
 * 4 planned for), and the upstream refuses the surplus with a WebSocket close
 * rather than an HTTP error, so the cap is enforced on our side where the
 * client can still be told why.
 */

export const LIVE_MODEL = process.env.GEMINI_LIVE_MODEL || "gemini-3.8-live";
export const LIVE_VOICE = process.env.GEMINI_LIVE_VOICE || "Kore";

/** Planning figure from the measured 4–6 ceiling. See VOICE.md. */
export const LIVE_MAX_SESSIONS = Number.parseInt(process.env.GEMINI_LIVE_MAX_SESSIONS || "4", 10);

export const LIVE_WS_PATH = "/ws/live";

/** Long enough for the browser to open the socket, useless if it leaks. */
export const LIVE_TICKET_TTL_SECONDS = 60;

/** Bounds on what a ticket may carry, so a signed header cannot grow without limit. */
export const LIVE_MAX_INSTRUCTION_CHARS = 2000;
export const LIVE_MAX_KICKOFF_CHARS = 400;

/** Upstream reconnects allowed after a goAway before the session is given up on. */
export const LIVE_MAX_RESUMPTIONS = 3;

const DEFAULT_UPSTREAM =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/**
 * The API key rides in the query string because that is the only placement the
 * Live endpoint accepts: measured, `Authorization: Bearer` and Google's own
 * ephemeral `auth_tokens` both fail to authenticate this socket on their own.
 * That is exactly why the socket terminates here and not in the browser.
 */
export function liveUpstreamUrl(apiKey: string): string {
    const base = process.env.GEMINI_LIVE_WS_URL || DEFAULT_UPSTREAM;
    return `${base}?key=${encodeURIComponent(apiKey)}`;
}
