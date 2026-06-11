import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Mic,
	MicOff,
	ArrowRight,
	Loader2,
	AlertCircle,
	Volume2,
	VolumeX,
	ArrowLeft,
	CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSpeak } from "@/hooks/useSpeak";

interface ResultItem {
	question: string;
	transcription: string;
	score: number | null;
	feedback: string;
}

const CandidateInterview: React.FC = () => {
	const navigate = useNavigate();
	const { token } = useParams<{ token: string }>();
	const [interview, setInterview] = useState<any>(null);
	const [invite, setInvite] = useState<any>(null);
	const [authToken, setAuthToken] = useState<string | null>(null);
	const [questions, setQuestions] = useState<string[]>([]);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [isRecording, setIsRecording] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isEvaluating, setIsEvaluating] = useState(false);
	const [evaluation, setEvaluation] = useState<{
		score: number;
		feedback: string;
	} | null>(null);
	const [sessionResults, setSessionResults] = useState<ResultItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [recordingSeconds, setRecordingSeconds] = useState(0);
	const [completed, setCompleted] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const { speak, stop, speaking, supported: ttsSupported } = useSpeak();

	const streamRef = useRef<MediaStream | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (!token) {
			navigate("/");
			return;
		}
		fetchInvite();
	}, [token]);

	const fetchInvite = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await api.get<{
				invite: any;
				interview: any;
				token?: string;
				user?: any;
			}>(`/api/interviews/candidate/accept/${token}`);
			setInvite(data.invite);
			setInterview(data.interview);
			setQuestions(data.interview.questions || []);
			// Keep invite token in component state only — never overwrite localStorage
			if (data.token) {
				setAuthToken(data.token);
			}
			// Restore any previous results
			if (data.invite?.results?.length > 0) {
				setSessionResults(data.invite.results);
			}
		} catch (err: any) {
			setError(err.message);
		} finally {
			setIsLoading(false);
		}
	};

	useEffect(() => {
		if (isRecording) {
			setRecordingSeconds(0);
			timerIntervalRef.current = setInterval(
				() => setRecordingSeconds((p) => p + 1),
				1000,
			);
		} else {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
		}
		return () => {
			if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
		};
	}, [isRecording]);

	const formatTimer = (s: number) =>
		`${Math.floor(s / 60)
			.toString()
			.padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

	const handleSpeakQuestion = () => {
		if (speaking) {
			stop();
		} else {
			speak(currentQuestion);
		}
	};

	// Stop TTS when starting recording
	const handleToggleRecording = async () => {
		if (speaking) stop();
		if (isRecording) {
			if (
				mediaRecorderRef.current &&
				mediaRecorderRef.current.state !== "inactive"
			)
				mediaRecorderRef.current.stop();
			setIsRecording(false);
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((t) => t.stop());
				streamRef.current = null;
			}
		} else {
			try {
				setError(null);
				setEvaluation(null);
				audioChunksRef.current = [];
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				streamRef.current = stream;
				const mediaRecorder = new MediaRecorder(stream, {
					mimeType: "audio/webm",
				});
				mediaRecorderRef.current = mediaRecorder;
				mediaRecorder.ondataavailable = (e) => {
					if (e.data?.size > 0) audioChunksRef.current.push(e.data);
				};
				mediaRecorder.onstop = async () => {
					const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
					await handleEvaluate(blob);
				};
				mediaRecorder.start();
				setIsRecording(true);
			} catch {
				setError("Could not access microphone. Please check permissions.");
			}
		}
	};

	const handleEvaluate = async (audioBlob: Blob) => {
		setIsEvaluating(true);
		setError(null);
		try {
			const formData = new FormData();
			formData.append("audio", audioBlob, "answer.webm");
			formData.append("question", questions[currentQuestionIndex]);
			const data = await api.post<{
				score: number;
				feedback: string;
				transcription: string;
			}>("/api/interviews/candidate/evaluate", formData, {
				tokenOverride: authToken || undefined,
			});
			const newResult = {
				question: questions[currentQuestionIndex],
				transcription: data.transcription || "",
				score: data.score,
				feedback: data.feedback,
			};
			setSessionResults((prev) => {
				const u = [...prev];
				u[currentQuestionIndex] = newResult;
				return u;
			});
			setEvaluation({ score: data.score, feedback: data.feedback });
		} catch (err: any) {
			setError(err.message || "Evaluation failed");
		} finally {
			setIsEvaluating(false);
		}
	};

	const handleNext = async () => {
		if (speaking) stop();
		if (isRecording) {
			if (mediaRecorderRef.current?.state !== "inactive")
				mediaRecorderRef.current?.stop();
			setIsRecording(false);
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((t) => t.stop());
				streamRef.current = null;
			}
		}
		setEvaluation(null);
		setError(null);
		if (currentQuestionIndex < questions.length - 1) {
			setCurrentQuestionIndex((p) => p + 1);
		} else {
			// All questions answered — submit results to backend
			await submitAllResults();
		}
	};

	const submitAllResults = async () => {
		setIsSubmitting(true);
		try {
			if (invite?._id) {
				for (let i = 0; i < sessionResults.length; i++) {
					const result = sessionResults[i];
					if (!result) continue;
					await api.post(
						"/api/interviews/candidate/submit",
						{
							inviteId: invite._id,
							questionIndex: i,
						},
						{ tokenOverride: authToken || undefined },
					);
				}
			}
			setCompleted(true);
		} catch (err: any) {
			setError(err.message || "Failed to submit results. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	if (isLoading)
		return (
			<div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
				<Loader2 className="w-8 h-8 text-primary animate-spin" />
				<p className="text-[13px] font-medium text-muted-foreground mt-3">
					Loading interview...
				</p>
			</div>
		);

	if (error && !questions.length)
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4">
				<div className="w-full max-w-sm border border-border rounded-[20px] bg-card p-8 text-center space-y-4">
					<AlertCircle className="w-6 h-6 text-destructive mx-auto" />
					<h3 className="font-bold text-foreground">
						Could not load interview
					</h3>
					<p className="text-[13px] text-muted-foreground">{error}</p>
					<Button onClick={() => navigate("/")} className="w-full font-medium">
						Go Home
					</Button>
				</div>
			</div>
		);

	if (isSubmitting)
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4">
				<div className="flex flex-col items-center gap-3">
					<Loader2 className="w-8 h-8 text-primary animate-spin" />
					<p className="text-[13px] font-medium text-muted-foreground">
						Submitting your responses...
					</p>
				</div>
			</div>
		);

	if (completed)
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4">
				<div className="w-full max-w-sm border border-border rounded-[20px] bg-card p-8 text-center space-y-5">
					<div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
						<CheckCircle2 className="w-7 h-7 text-success" />
					</div>
					<div className="space-y-1.5">
						<h2 className="text-xl font-bold">Interview complete</h2>
						<p className="text-[13px] text-muted-foreground">
							The recruiter will review your responses.
						</p>
					</div>
					{sessionResults.length > 0 && (
						<div className="space-y-1.5">
							{sessionResults.map((r, i) => (
								<div
									key={i}
									className="flex items-center justify-between p-2.5 bg-surface rounded-[20px] text-[13px]"
								>
									<span className="font-medium text-foreground">Q{i + 1}</span>
									<span className="font-bold text-primary">
										{r?.score || 0}/10
									</span>
								</div>
							))}
						</div>
					)}
					<Button
						onClick={() => navigate("/")}
						className="w-full font-semibold"
					>
						Return Home
					</Button>
				</div>
			</div>
		);

	const currentQuestion = questions[currentQuestionIndex];
	const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
	const isLastQuestion = currentQuestionIndex === questions.length - 1;

	return (
		<div className="min-h-screen bg-background flex flex-col pt-14">
			{/* Progress bar */}
			<div className="border-b border-border bg-surface/80  sticky top-14 z-30 py-3 px-4 sm:px-6 lg:px-8">
				<div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<button
							onClick={() => navigate("/")}
							className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
						>
							<ArrowLeft className="h-4 w-4" />
						</button>
						<div className="h-4 w-px bg-border/60" />
						<span className="text-[12px] font-semibold text-foreground">
							Question {currentQuestionIndex + 1} of {questions.length}
						</span>
					</div>
					<div className="flex items-center gap-3 w-44 sm:w-56">
						<div className="flex-1 bg-secondary h-1.5 rounded-full overflow-hidden">
							<div
								className="bg-primary h-full transition-all duration-300"
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
					<div className="border border-border  bg-card rounded-[20px] flex-1 flex flex-col overflow-hidden">
						<div className="border-b border-border px-5 py-3 bg-secondary/15">
							<span className="text-[12px] font-semibold text-foreground">
								{interview?.title || "Interview"}
							</span>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{interview?.targetRole}
							</p>
						</div>
						<div className="flex-1 p-5 flex flex-col justify-center items-center">
							<div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center relative mb-5">
								<span
									className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-40"
									style={{ animationDuration: "3s" }}
								/>
								<Volume2 className="h-7 w-7 text-primary" />
							</div>
							<p className="text-[12px] text-muted-foreground text-center">
								Listen carefully, then record your response.
							</p>
						</div>
						<div className="border-t border-border p-5 bg-background space-y-2">
							<div className="flex items-center justify-between">
								<span className="text-[10px] font-bold uppercase tracking-wider text-primary">
									Question
								</span>
								{ttsSupported && (
									<button
										onClick={handleSpeakQuestion}
										disabled={isRecording || isEvaluating}
										title={speaking ? "Stop" : "Play question aloud"}
										className={`p-1.5 rounded-full transition-all ${
											speaking
												? "bg-primary/15 text-primary animate-pulse"
												: "text-muted-foreground hover:text-primary hover:bg-primary/10"
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
						<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-[20px] border border-destructive/20 mb-3 flex items-center gap-2">
							<AlertCircle className="w-4 h-4 shrink-0" />
							<span>{error}</span>
						</div>
					)}
					<div className="border border-border  bg-card rounded-[20px] flex-1 flex flex-col overflow-hidden relative min-h-[340px]">
						<div className="flex-1 bg-black relative flex flex-col justify-center items-center overflow-hidden">
							{isEvaluating ? (
								<div className="absolute inset-0 bg-background/95  z-20 flex flex-col items-center justify-center gap-3">
									<Loader2 className="w-8 h-8 text-primary animate-spin" />
									<p className="text-[13px] font-semibold">
										Evaluating your response...
									</p>
								</div>
							) : evaluation ? (
								<div className="absolute inset-0 bg-background/95  z-20 flex flex-col justify-between p-5 overflow-y-auto">
									<div className="space-y-3">
										<div className="flex items-center justify-between border-b border-border pb-3">
											<div>
												<span className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded uppercase tracking-wider">
													Ready
												</span>
												<h3 className="text-base font-bold pt-1">Score</h3>
											</div>
											<span className="text-xl font-bold">
												{evaluation.score}
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
											onClick={() => setEvaluation(null)}
											className="font-medium"
										>
											Re-record
										</Button>
										<Button
											onClick={handleNext}
											size="sm"
											className="font-medium gap-1"
										>
											{isLastQuestion ? "Finish" : "Next"}{" "}
											<ArrowRight className="h-3.5 w-3.5" />
										</Button>
									</div>
								</div>
							) : (
								<div className="absolute inset-0 flex flex-col items-center justify-center p-5">
									<Mic className="h-10 w-10 text-white/20 mb-2" />
									<span className="text-[11px] text-white/40">
										{isRecording ? "Recording..." : "Ready to record"}
									</span>
								</div>
							)}

							{isRecording && (
								<>
									<div className="absolute top-3 right-3 flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 px-2.5 py-1 rounded-full">
										<span className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
										<span className="text-[9px] font-bold uppercase text-white tracking-wider">
											Live
										</span>
									</div>
									<div className="absolute bottom-3 left-3 bg-black/50 border border-white/10 px-2.5 py-1 rounded-full text-white font-mono text-[11px]">
										{formatTimer(recordingSeconds)}
									</div>
								</>
							)}
						</div>

						{!evaluation && (
							<div className="border-t border-border p-4 bg-background flex flex-col sm:flex-row items-center justify-between gap-3">
								<p className="text-[12px] text-muted-foreground font-medium">
									{isRecording
										? "Click stop when finished."
										: "Click to start recording."}
								</p>
								<Button
									variant={isRecording ? "destructive" : "default"}
									onClick={handleToggleRecording}
									disabled={isEvaluating}
									className="w-full sm:w-40 font-semibold shrink-0 h-9 rounded-full gap-2"
								>
									{isRecording ? (
										<>
											<MicOff className="h-3.5 w-3.5" /> Stop
										</>
									) : (
										<>
											<Mic className="h-3.5 w-3.5" /> Record
										</>
									)}
								</Button>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default CandidateInterview;
