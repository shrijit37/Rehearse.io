import React from "react";
import {
	ArrowLeft,
	Volume2,
	VolumeX,
	AlertCircle,
	Loader2,
	Mic,
	MicOff,
	ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiveTurnState } from "@/lib/live/types";

export interface BehavioralRoundProps {
	interview: { title: string; targetRole: string } | null;
	questions: string[];
	currentQuestionIndex: number;
	currentQuestion: string;
	/** Turn state of the live spoken session; "idle" when no session is running. */
	liveState: LiveTurnState;
	/** The candidate's transcript for the answer in progress. */
	liveTranscript: string;
	/** Set once the backend has scored this answer; the score is null when it could not. */
	evaluation: { score: number | null; feedback: string } | null;
	isLastQuestion: boolean;
	hasDsaAfter: boolean;
	error: string | null;
	speaking: boolean;
	ttsSupported: boolean;
	onBack: () => void;
	onSpeakQuestion: () => void;
	/** Leave the live conversation. */
	onStopSession: () => void;
	/** Start a fresh conversation for the same question, after a stop or a failure. */
	onRestartSession: () => void;
	/** Clear the score and let the candidate answer the question again. */
	onRetryAnswer: () => void;
	onNext: () => void;
}

/** What the candidate is told while the coach's socket is in each state. */
const LIVE_STATUS: Record<LiveTurnState, string> = {
	idle: "The conversation is not running.",
	connecting: "Connecting to your coach...",
	listening: "Listening — answer out loud.",
	thinking: "Going over your answer...",
	speaking: "Your coach is speaking...",
	error: "The conversation stopped.",
};

/** The indicator pill, which borrows the old "Live" badge and extends it. */
const LIVE_BADGE: Record<LiveTurnState, string> = {
	idle: "Ended",
	connecting: "Connecting",
	listening: "Live",
	thinking: "Thinking",
	speaking: "Speaking",
	error: "Ended",
};

const BehavioralRound: React.FC<BehavioralRoundProps> = ({
	interview,
	questions,
	currentQuestionIndex,
	currentQuestion,
	liveState,
	liveTranscript,
	evaluation,
	isLastQuestion,
	hasDsaAfter,
	error,
	speaking,
	ttsSupported,
	onBack,
	onSpeakQuestion,
	onStopSession,
	onRestartSession,
	onRetryAnswer,
	onNext,
}) => {
	const progressPercent =
		questions.length > 0
			? ((currentQuestionIndex + 1) / questions.length) * 100
			: 0;
	const isLive = liveState !== "idle" && liveState !== "error";
	const isWaiting = liveState === "connecting" || liveState === "thinking";

	return (
		<div className="min-h-screen bg-background flex flex-col pt-14">
			{/* Progress bar */}
			<div className="border-b border-border bg-surface/80 sticky top-14 z-30 py-3 px-4 sm:px-6 lg:px-8">
				<div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<button
							onClick={onBack}
							className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
							aria-label="Back to home"
						>
							<ArrowLeft className="h-4 w-4" />
						</button>
						<div className="h-4 w-px bg-border/60" />
						<span className="text-[12px] font-semibold text-foreground">
							Question {currentQuestionIndex + 1} of {questions.length}
							{hasDsaAfter && (
								<span className="text-muted-foreground font-normal">
									{" "}
									· then DSA
								</span>
							)}
						</span>
					</div>
					<div className="flex items-center gap-3 w-44 sm:w-56">
						<div className="flex-1 bg-secondary h-1.5 rounded-full overflow-hidden">
							<div
								className="bg-sign-black h-full transition-all duration-300"
								style={{ width: `${progressPercent}%` }}
							/>
						</div>
						<span className="text-[11px] font-bold text-muted-foreground">
							{Math.round(progressPercent)}%
						</span>
					</div>
				</div>
			</div>

			{/* Main content */}
			<div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:grid md:grid-cols-12 gap-5">
				{/* Question panel */}
				<div className="md:col-span-5 flex flex-col">
					<div className="border border-border bg-card rounded-md flex-1 flex flex-col overflow-hidden">
						<div className="border-b border-border px-5 py-3 bg-secondary/15">
							<span className="text-[12px] font-semibold text-foreground">
								{interview?.title || "Interview"}
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{interview?.targetRole}
							</p>
						</div>
						<div className="flex-1 p-5 flex flex-col justify-center items-center">
							<div className="w-20 h-20 rounded-full bg-sign-black border border-sign-black flex items-center justify-center relative mb-5">
								<span
									className="absolute inset-0 rounded-full border border-sign-black/25 animate-ping opacity-40"
									style={{ animationDuration: "3s" }}
								/>
								<Volume2 className="h-7 w-7 text-sign-yellow" />
							</div>
							<p className="text-[12px] text-muted-foreground text-center">
								Listen carefully, then answer out loud.
							</p>
						</div>
						<div className="border-t border-border p-5 bg-background space-y-2">
							<div className="flex items-center justify-between">
								<span className="type-sign-label text-foreground">
									Question
								</span>
								{ttsSupported && (
									<button
										onClick={onSpeakQuestion}
										disabled={isLive}
										title={
											liveState === "listening"
												? "Leave the conversation to replay the question"
												: speaking
													? "Stop"
													: "Play question aloud"
										}
										className={`p-1.5 rounded-full transition-all ${
											speaking
												? "bg-sign-black text-sign-white animate-pulse"
												: "text-muted-foreground hover:text-foreground hover:bg-surface-active"
										} disabled:opacity-30 disabled:cursor-not-allowed`}
									>
										{speaking ? (
											<VolumeX className="h-4 w-4" />
										) : (
											<Volume2 className="h-4 w-4" />
										)}
									</button>
								)}
							</div>
							<h2 className="text-[14px] font-semibold text-foreground leading-snug">
								"{currentQuestion}"
							</h2>
						</div>
					</div>
				</div>

				{/* Recording panel */}
				<div className="md:col-span-7 flex flex-col relative">
					{error && (
						<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-md border border-destructive/20 mb-3 flex items-center gap-2">
							<AlertCircle className="w-4 h-4 shrink-0" />
							<span>{error}</span>
						</div>
					)}
					<div className="border border-border bg-card rounded-md flex-1 flex flex-col overflow-hidden relative min-h-[340px]">
						<div className="flex-1 bg-black relative flex flex-col justify-center items-center overflow-hidden">
							{evaluation ? (
								<div className="absolute inset-0 bg-background/95 z-20 flex flex-col justify-between p-5 overflow-y-auto">
									<div className="space-y-3">
										<div className="flex items-center justify-between border-b border-border pb-3">
											<div>
												<span className="type-sign-label text-success bg-success/10 px-2 py-0.5 rounded ">
													Ready
												</span>
												<h3 className="text-base font-bold pt-1">Score</h3>
											</div>
											<span className="text-xl font-bold">
												{evaluation.score ?? "—"}
												<span className="text-[11px] text-muted-foreground">
													/10
												</span>
											</span>
										</div>
										<p className="text-[13px] text-foreground leading-relaxed">
											{evaluation.feedback}
										</p>
									</div>
									<div className="border-t border-border pt-3 flex justify-end gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={onRetryAnswer}
											className="font-medium"
										>
											Answer again
										</Button>
										<Button
											onClick={onNext}
											size="sm"
											className="font-medium gap-1"
										>
											{isLastQuestion
												? hasDsaAfter
													? "Continue to DSA"
													: "Finish"
												: "Next"}{" "}
											<ArrowRight className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
							) : (
								<div className="absolute inset-0 flex flex-col items-center justify-center p-6">
									{isWaiting ? (
										<Loader2 className="h-10 w-10 text-sign-yellow animate-spin mb-2" />
									) : liveState === "speaking" ? (
										<Volume2 className="h-10 w-10 text-sign-yellow mb-2" />
									) : (
										<Mic className="h-10 w-10 text-white/20 mb-2" />
									)}
									<span className="text-[11px] text-white/40 text-center">
										{LIVE_STATUS[liveState]}
									</span>
									{liveTranscript && (
										<p className="mt-4 max-h-28 overflow-y-auto max-w-md text-center text-[13px] leading-relaxed text-white/75">
											“{liveTranscript}”
										</p>
									)}
								</div>
							)}

							{isLive && (
								<div className="absolute top-3 right-3 flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 px-2.5 py-1 rounded-full">
									<span className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
									<span className="type-sign-label text-white ">
										{LIVE_BADGE[liveState]}
									</span>
								</div>
							)}
						</div>

						{!evaluation && (
							<div className="border-t border-border p-4 bg-background flex flex-col sm:flex-row items-center justify-between gap-3">
								<p className="text-[12px] text-muted-foreground font-medium">
									{!isLive
										? "Start a new conversation to answer this question."
										: liveState === "speaking"
											? "Your coach is replying — wait for your turn."
											: "Answer out loud; your coach replies when you pause."}
								</p>
								{isLive ? (
									<Button
										variant="destructive"
										onClick={onStopSession}
										className="w-full sm:w-40 font-semibold shrink-0 h-9 rounded-full gap-2"
									>
										<MicOff className="h-3.5 w-3.5" /> Stop
									</Button>
								) : (
									<Button
										onClick={onRestartSession}
										className="w-full sm:w-40 font-semibold shrink-0 h-9 rounded-full gap-2"
									>
										<Mic className="h-3.5 w-3.5" /> Try again
									</Button>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default BehavioralRound;
