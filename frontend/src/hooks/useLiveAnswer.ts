import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import {
	startLiveSession,
	type LiveSession,
	type LiveSessionOptions,
	type LiveTurnResult,
} from "@/lib/live/socket";
import type { LiveTurnState } from "@/lib/live/types";

export interface UseLiveAnswerOptions {
	/** The conversation is showing. False tears the session down (round change, unmount). */
	active: boolean;
	/** Ticket body for the session this hook is about to start. */
	request: LiveSessionOptions["request"];
	/** Invited-candidate JWT; omit for a signed-in user (cookie auth). */
	tokenOverride?: string | null;
	onTurn?(turn: LiveTurnResult): void;
	onError?(message: string): void;
}

export interface LiveAnswer {
	state: LiveTurnState;
	/** The candidate's transcript for the answer in progress; the latest segment wins. */
	transcript: string;
	/** Leave the conversation. The backend persists the answer and frees the slot on close. */
	stop(): void;
	/** Start a fresh session for the same request — after a stop, or after a failure. */
	restart(): void;
	/**
	 * Move to another question without tearing the socket down. Reconnecting per
	 * question would split one practice run into a stored session per question and
	 * greet the candidate again each time; the backend ignores an ask for the
	 * question it is already on, so a caller can fire this on every index change.
	 */
	ask(questionIndex: number, question?: string): void;
}

/**
 * Owns one live spoken session for a whole run: it starts when the conversation
 * screen is showing and stops on unmount or when `active` goes false. Questions
 * are advanced on that one socket with `ask`; only `restart()` replaces it.
 *
 * `request` and the callbacks are read through a ref, so an unrelated re-render
 * cannot restart a live conversation.
 */
export function useLiveAnswer(options: UseLiveAnswerOptions): LiveAnswer {
	const { active } = options;
	const [state, setState] = useState<LiveTurnState>("idle");
	const [transcript, setTranscript] = useState("");
	const [generation, setGeneration] = useState(0);

	const sessionRef = useRef<LiveSession | null>(null);
	/** Tears down the session the running effect owns, in flight or open. */
	const leaveRef = useRef<() => void>(() => {});
	/**
	 * An `ask` that arrived while the ticket was still being minted. Dropping it
	 * would leave the coach on the previous question while the UI has moved on,
	 * and the answer would later be scored against the wrong one.
	 */
	const pendingAskRef = useRef<{ index: number; question?: string } | null>(null);

	// Effect Events read the latest props/callbacks without making the long-lived
	// session depend on a re-render: the request it starts on and the callbacks
	// it reports through are always the current ones.
	const startOptions = useEffectEvent(() => ({
		request: options.request,
		tokenOverride: options.tokenOverride,
	}));
	const reportTurn = useEffectEvent((turn: LiveTurnResult) => options.onTurn?.(turn));
	const reportError = useEffectEvent((message: string) => options.onError?.(message));

	useEffect(() => {
		if (!active) return;

		const { request, tokenOverride } = startOptions();
		let cancelled = false;

		setState("connecting");
		setTranscript("");

		// A stop that lands while the ticket is still being minted has to reach
		// the session that is about to exist, or the mic stays hot under a UI
		// that already says the conversation ended.
		const leave = () => {
			if (cancelled) return;
			cancelled = true;
			sessionRef.current?.stop();
			sessionRef.current = null;
			pendingAskRef.current = null;
		};
		leaveRef.current = leave;

		void startLiveSession({
			request,
			tokenOverride,
			onState: (next) => {
				if (!cancelled) setState(next);
			},
			onTranscript: (speaker, text) => {
				if (!cancelled && speaker === "you") setTranscript(text);
			},
			// Reported through an effect event: a session lives across many
			// renders, and a handler captured when it started would keep whatever
			// state it closed over — the pages index results by question, so a
			// stale one misfiles them.
			onTurn: (turn) => {
				if (cancelled) return;
				if (turn.transcription) setTranscript(turn.transcription);
				reportTurn(turn);
			},
			onError: (message) => {
				if (!cancelled) reportError(message);
			},
		})
			.then((session) => {
				if (cancelled) {
					session.stop();
					return;
				}
				sessionRef.current = session;
				const pending = pendingAskRef.current;
				if (pending) {
					pendingAskRef.current = null;
					session.ask(pending.index, pending.question);
				}
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				// `startLiveSession` has already reported the "error" state; this is
				// the message that explains it (no ticket, or every coach busy).
				reportError(error instanceof Error ? error.message : "Could not start the live session.");
			});

		return () => {
			leave();
			setState("idle");
		};
		// Effect Events are stable by contract and must not appear in the deps
		// array; eslint-plugin-react-hooks 5.x predates `useEffectEvent`.
		// eslint-disable-next-line react-hooks/exhaustive-deps -- see above
	}, [active, generation]);

	const stop = useCallback(() => {
		leaveRef.current();
		setState("idle");
	}, []);

	const restart = useCallback(() => setGeneration((value) => value + 1), []);

	const ask = useCallback((questionIndex: number, question?: string) => {
		const session = sessionRef.current;
		if (!session) {
			// Still connecting (or between sessions): remember it, replayed when
			// the session lands. The latest call wins — a question advance is
			// state, not a queue.
			pendingAskRef.current = { index: questionIndex, question };
			return;
		}
		session.ask(questionIndex, question);
	}, []);

	return { state, transcript, stop, restart, ask };
}
