import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Loader2,
	AlertCircle,
	CheckCircle2,
	Code2,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSpeak } from "@/hooks/useSpeak";
import type { Interview, CandidateInvite, User, DsaResultItem } from "@/types";
import DsaRound, { type DsaEvaluation } from "@/components/DsaRound";
import type { DsaProblem } from "@/components/DsaProblemPanel";
import type { CodeLanguage } from "@/components/CodeEditor";
import BehavioralRound from "@/components/BehavioralRound";
interface ResultItem {
	question: string;
	transcription: string;
	score: number | null;
	feedback: string;
}

type Phase = "behavioral" | "dsa" | "done";

const CandidateInterview: React.FC = () => {
	const navigate = useNavigate();
	const { token } = useParams<{ token: string }>();
	const [interview, setInterview] = useState<Interview | null>(null);
	const [invite, setInvite] = useState<CandidateInvite | null>(null);
	const [authToken, setAuthToken] = useState<string | null>(null);
	const [questions, setQuestions] = useState<string[]>([]);
	const [dsaProblems, setDsaProblems] = useState<DsaProblem[]>([]);
	const [phase, setPhase] = useState<Phase>("behavioral");
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
	const [isRecording, setIsRecording] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isEvaluating, setIsEvaluating] = useState(false);
	const [evaluation, setEvaluation] = useState<{
		score: number;
		feedback: string;
	} | null>(null);
	const [sessionResults, setSessionResults] = useState<ResultItem[]>([]);
	const [dsaResults, setDsaResults] = useState<DsaEvaluation[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [recordingSeconds, setRecordingSeconds] = useState(0);
	const [completed, setCompleted] = useState(false);

	const { speak, stop, speaking, supported: ttsSupported } = useSpeak();

	const streamRef = useRef<MediaStream | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const isMovingNext = useRef(false);

	useEffect(() => {
		if (!token) {
			navigate("/");
			return;
		}

		const storedAuthToken = sessionStorage.getItem("candidateAuthToken");
		if (storedAuthToken) {
			setAuthToken(storedAuthToken);
		}

		fetchInvite();
	}, [token]); // eslint-disable-line react-hooks/exhaustive-deps

	const fetchInvite = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await api.get<{
				invite: CandidateInvite;
				interview: Interview;
				token?: string;
				user?: User;
				message?: string;
			}>(`/api/interviews/candidate/accept/${token}`);

			const inv = data.invite;
			const iv = data.interview;

			setInvite(inv);
			setInterview(iv);
			setQuestions(iv?.questions || []);
			setDsaProblems(iv?.dsaProblems || []);

			if (data.token) {
				setAuthToken(data.token);
				sessionStorage.setItem("candidateAuthToken", data.token);
			}

			if (inv?.results?.length > 0) {
				setSessionResults(inv.results);
			}
			if (inv?.dsaResults?.length > 0) {
				setDsaResults(
					inv.dsaResults.map((r: DsaResultItem) => ({
						score: r.score ?? 0,
						correctness: r.correctness ?? 0,
						codeQuality: r.codeQuality ?? 0,
						timeComplexity: r.timeComplexity ?? "",
						spaceComplexity: r.spaceComplexity ?? "",
						feedback: r.feedback,
						strengths: r.strengths,
						improvements: r.improvements,
						problemTitle: r.problemTitle,
						problemIndex: r.problemIndex ?? 0,
						language: r.language,
						code: r.code,
						timeSpentSeconds: r.timeSpentSeconds ?? 0,
					})),
				);
			}

			if (inv?.status === "completed") {
				setCompleted(true);
				setPhase("done");
				return;
			}

			// Determine phase from interview type + progress
			const type = iv?.interviewType || "behavioral";
			const hasBehavioral = (iv?.questions?.length || 0) > 0;
			const hasDsa = (iv?.dsaProblems?.length || 0) > 0;

			if (inv?.currentRound === "dsa" || type === "dsa") {
				setPhase("dsa");
			} else if (
				inv?.currentRound === "done"
			) {
				setPhase("done");
				setCompleted(true);
			} else if (type === "mixed" && hasBehavioral) {
				// If all behavioral answered, go to DSA
				if (
					(inv?.results?.length || 0) >= (iv?.questions?.length || 0) &&
					hasDsa
				) {
					setPhase("dsa");
				} else {
					setPhase("behavioral");
					const nextQ = Math.min(
						inv?.results?.length || 0,
						Math.max(0, (iv?.questions?.length || 1) - 1),
					);
					setCurrentQuestionIndex(nextQ);
				}
			} else if (type === "behavioral" || hasBehavioral) {
				setPhase("behavioral");
				const nextQ = Math.min(
					inv?.results?.length || 0,
					Math.max(0, (iv?.questions?.length || 1) - 1),
				);
				setCurrentQuestionIndex(nextQ);
			} else {
				setPhase(hasDsa ? "dsa" : "behavioral");
			}
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	// Clear the candidate auth token once the interview is finished.
	useEffect(() => {
		if (completed || phase === "done") {
			sessionStorage.removeItem("candidateAuthToken");
		}
	}, [completed, phase]);

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


	const currentQuestion = questions[currentQuestionIndex];

	const handleSpeakQuestion = () => {
		if (speaking) {
			stop();
		} else if (currentQuestion) {
			speak(currentQuestion);
		}
	};

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
					if (isMovingNext.current) {
						isMovingNext.current = false;
						return;
					}
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
			formData.append("inviteId", invite?._id || "");
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
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Evaluation failed");
		} finally {
			setIsEvaluating(false);
		}
	};

	const handleNextBehavioral = async () => {
		if (speaking) stop();
		isMovingNext.current = true;
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

		// Persist this question index
		try {
			if (invite?._id) {
				const submitRes = await api.post<{
					nextRound?: string;
					completed?: boolean;
				}>(
					"/api/interviews/candidate/submit",
					{
						inviteId: invite._id,
						questionIndex: currentQuestionIndex,
					},
					{ tokenOverride: authToken || undefined },
				);

				if (currentQuestionIndex < questions.length - 1) {
					setCurrentQuestionIndex((p) => p + 1);
				} else {
					// Behavioral done
					const type = interview?.interviewType || "behavioral";
					if (
						(type === "mixed" || submitRes.nextRound === "dsa") &&
						dsaProblems.length > 0
					) {
						setPhase("dsa");
					} else {
						setCompleted(true);
						setPhase("done");
					}
				}
			}
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to submit answer");
		}
		isMovingNext.current = false;
	};

	const handleDsaEvaluate = async (payload: {
		problemIndex: number;
		problem: DsaProblem;
		language: CodeLanguage;
		code: string;
		timeSpentSeconds: number;
	}): Promise<DsaEvaluation> => {
		const data = await api.post<DsaEvaluation & { completed?: boolean }>(
			"/api/interviews/candidate/evaluate-dsa",
			{
				inviteId: invite?._id || "",
				problemIndex: payload.problemIndex,
				language: payload.language,
				code: payload.code,
				timeSpentSeconds: payload.timeSpentSeconds,
			},
			{ tokenOverride: authToken || undefined },
		);
		return {
			...data,
			problemTitle: payload.problem.title,
			problemIndex: payload.problemIndex,
			language: payload.language,
			code: payload.code,
			timeSpentSeconds: payload.timeSpentSeconds,
		};
	};

	const handleDsaComplete = (results: DsaEvaluation[]) => {
		setDsaResults(results);
		setCompleted(true);
		setPhase("done");
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

	if (error && !interview)
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

	if (completed || phase === "done") {
		const allScores = [
			...sessionResults.map((r) => r?.score).filter((s): s is number => s != null),
			...dsaResults.map((r) => r?.score).filter((s): s is number => s != null),
		];
		const avg =
			allScores.length > 0
				? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
				: null;

		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4">
				<div className="w-full max-w-md border border-border rounded-[20px] bg-card p-8 text-center space-y-5">
					<div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
						<CheckCircle2 className="w-7 h-7 text-success" />
					</div>
					<div className="space-y-1.5">
						<h2 className="text-xl font-bold">Interview complete</h2>
						<p className="text-[13px] text-muted-foreground">
							The recruiter will review your responses.
							{avg && (
								<>
									{" "}
									Overall average:{" "}
									<span className="font-bold text-foreground">{avg}/10</span>
								</>
							)}
						</p>
					</div>
					{sessionResults.length > 0 && (
						<div className="space-y-1.5 text-left">
							<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
								Behavioral
							</p>
							{sessionResults.map((r, i) => (
								<div
									key={i}
									className="flex items-center justify-between p-2.5 bg-surface rounded-[12px] text-[13px]"
								>
									<span className="font-medium text-foreground">Q{i + 1}</span>
									<span className="font-bold text-primary">
										{r?.score || 0}/10
									</span>
								</div>
							))}
						</div>
					)}
					{dsaResults.length > 0 && (
						<div className="space-y-1.5 text-left">
							<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
								<Code2 className="h-3 w-3" /> DSA
							</p>
							{dsaResults.map((r, i) => (
								<div
									key={i}
									className="flex items-center justify-between p-2.5 bg-surface rounded-[12px] text-[13px]"
								>
									<span className="font-medium text-foreground truncate mr-2">
										{r.problemTitle}
									</span>
									<span className="font-bold text-primary shrink-0">
										{r.score}/10
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
	}

	// DSA phase
	if (phase === "dsa" && dsaProblems.length > 0) {
		return (
			<div className="min-h-screen bg-background flex flex-col pt-14">
				{questions.length > 0 && (
					<div className="border-b border-border bg-secondary/10 px-4 py-2 text-center">
						<p className="text-[11px] font-medium text-muted-foreground">
							Behavioral round complete · Starting DSA coding round
						</p>
					</div>
				)}
				{error && (
					<div className="mx-4 mt-3 bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-[12px] border border-destructive/20 flex items-center gap-2">
						<AlertCircle className="w-4 h-4 shrink-0" />
						<span>{error}</span>
					</div>
				)}
				<DsaRound
					problems={dsaProblems}
					onEvaluate={handleDsaEvaluate}
					onComplete={handleDsaComplete}
					initialResults={dsaResults}
					initialIndex={Math.min(
						dsaResults.length,
						Math.max(0, dsaProblems.length - 1),
					)}
				/>
			</div>
		);
	}

	// Behavioral phase
	const isLastQuestion = currentQuestionIndex === questions.length - 1;
	const type = interview?.interviewType || "behavioral";
	const hasDsaAfter =
		(type === "mixed" || type === "dsa") && dsaProblems.length > 0;

	return (
		<BehavioralRound
			interview={interview}
			questions={questions}
			currentQuestionIndex={currentQuestionIndex}
			currentQuestion={currentQuestion}
			isRecording={isRecording}
			isEvaluating={isEvaluating}
			evaluation={evaluation}
			recordingSeconds={recordingSeconds}
			isLastQuestion={isLastQuestion}
			hasDsaAfter={hasDsaAfter}
			error={error}
			speaking={speaking}
			ttsSupported={ttsSupported}
			onBack={() => navigate("/")}
			onSpeakQuestion={handleSpeakQuestion}
			onToggleRecording={handleToggleRecording}
			onResetEvaluation={() => setEvaluation(null)}
			onNext={handleNextBehavioral}
		/>
	);
};

export default CandidateInterview;
