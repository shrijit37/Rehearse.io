import { useCallback, useEffect, useRef, useState } from "react";
import {
	startLiveSession,
	type LiveSession,
	type LiveSessionOptions,
	type LiveTurnResult,
} from "@/lib/live/socket";
import type { LiveTurnState } from "@/lib/live/types";

export interface UseLiveAnswerOptions {
	/** The question screen is showing. False tears the session down (round change, unmount). */
	active: boolean;
	/** Change this to move to another question: the session restarts against it. */
	restartKey: string | number;
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
}

/**
 * Owns one live spoken session per question: it starts when the question screen
 * is showing, is replaced when `restartKey` changes, and stops on unmount or
 * when `active` goes false.
 *
 * `request` and the callbacks are read through a ref, so an unrelated re-render
 * cannot restart a live conversation — only `restartKey` or `restart()` can.
 */
export function useLiveAnswer(options: UseLiveAnswerOptions): LiveAnswer {
	const { active, restartKey } = options;
	const [state, setState] = useState<LiveTurnState>("idle");
	const [transcript, setTranscript] = useState("");
	const [generation, setGeneration] = useState(0);

	const latestRef = useRef(options);
	const sessionRef = useRef<LiveSession | null>(null);
	/** Tears down the session the running effect owns, in flight or open. */
	const leaveRef = useRef<() => void>(() => {});

	useEffect(() => {
		latestRef.current = options;
	});

	useEffect(() => {
		if (!active) return;

		const { request, tokenOverride, onTurn, onError } = latestRef.current;
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
			onTurn: (turn) => {
				if (cancelled) return;
				if (turn.transcription) setTranscript(turn.transcription);
				onTurn?.(turn);
			},
			onError: (message) => {
				if (!cancelled) onError?.(message);
			},
		})
			.then((session) => {
				if (cancelled) session.stop();
				else sessionRef.current = session;
			})
			.catch((error: unknown) => {
				if (cancelled) return;
				// `startLiveSession` has already reported the "error" state; this is
				// the message that explains it (no ticket, or every coach busy).
				onError?.(
					error instanceof Error
						? error.message
						: "Could not start the live session.",
				);
			});

		return () => {
			leave();
			setState("idle");
		};
	}, [active, restartKey, generation]);

	const stop = useCallback(() => {
		leaveRef.current();
		setState("idle");
	}, []);

	const restart = useCallback(() => setGeneration((value) => value + 1), []);

	return { state, transcript, stop, restart };
}
