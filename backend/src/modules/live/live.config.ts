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

/**
 * The most questions a session can address. Not just a schema bound: an
 * interview may hold at most this many (`interview.validation.ts` caps creation
 * there), because a longer list would contain questions no spoken session could
 * ever reach, and an advance past this index is refused by the relay.
 */
export const LIVE_MAX_QUESTIONS = 20;
export const LIVE_MAX_QUESTION_CHARS = 600;

/** Upstream reconnects allowed after a goAway before the session is given up on. */
export const LIVE_MAX_RESUMPTIONS = 3;

/**
 * How long the upstream gets to accept a session before the slot is handed back.
 * Without it a silent upstream would hold one of only four slots forever.
 * Measured acceptance is 0.4–1.1 s, so this is a long stop, not a tight one.
 */
export const LIVE_SETUP_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_LIVE_SETUP_TIMEOUT_MS || "15000", 10);

/**
 * The rubric model. `gemini-3.8-flash` is reachable on the REST text endpoint
 * even though the same id does not exist on the Live socket; measured 6.8 s for
 * one scored answer, which is why scoring runs after the turn rather than in it.
 */
export const LIVE_SCORING_MODEL = process.env.GEMINI_SCORING_MODEL || "gemini-3.8-flash";

/** A rubric that has not answered by then is not worth waiting for. */
export const LIVE_SCORING_TIMEOUT_MS = Number.parseInt(process.env.GEMINI_SCORING_TIMEOUT_MS || "20000", 10);

/**
 * The rubric's REST origin. A constant, deliberately not env-derived: the API
 * key travels in this request's header, so nothing outside this file may
 * choose where it goes. HTTPS is fixed here, not checked at call time.
 */
export const LIVE_SCORING_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta";

const DEFAULT_UPSTREAM =
    "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

/**
 * The API key rides in the query string because that is the only placement the
 * Live endpoint accepts: measured, `Authorization: Bearer` and Google's own
 * ephemeral `auth_tokens` both fail to authenticate this socket on their own.
 * That is exactly why the socket terminates here and not in the browser.
 *
 * `GEMINI_LIVE_WS_URL` points the relay at a local fake upstream and is honoured
 * outside production only: an env var able to aim this socket anywhere would
 * hand the key, in a query string, to whatever host it named.
 */
export function liveUpstreamUrl(apiKey: string): string {
    const override = process.env.APP_ENV === "production" ? undefined : process.env.GEMINI_LIVE_WS_URL;
    return `${override || DEFAULT_UPSTREAM}?key=${encodeURIComponent(apiKey)}`;
}
