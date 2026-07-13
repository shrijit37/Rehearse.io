import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Loader2,
	AlertCircle,
	Briefcase,
} from "lucide-react";
import { api } from "@/lib/api";
import { useSpeak } from "@/hooks/useSpeak";
import BehavioralRound from "@/components/BehavioralRound";
interface ResultItem {
	question: string;
	transcription: string;
	score: number;
	feedback: string;
}

const PRESET_ROLES = [
	"Software Engineer",
	"Senior Software Engineer",
	"Frontend Engineer",
	"Backend Engineer",
	"Full Stack Engineer",
	"Data Scientist",
	"Product Manager",
	"DevOps Engineer",
	"Engineering Manager",
	"UX Designer",
];

const RehearsalRoom: React.FC = () => {
	const navigate = useNavigate();
	const [step, setStep] = useState<"role-picker" | "interview">("role-picker");
	const [targetRole, setTargetRole] = useState<string>("");
	const [customRole, setCustomRole] = useState<string>("");
	const [questions, setQuestions] = useState<string[]>([]);
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
	const [isRecording, setIsRecording] = useState<boolean>(false);
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
	const [evaluation, setEvaluation] = useState<{
		score: number;
		feedback: string;
	} | null>(null);
	const [sessionResults, setSessionResults] = useState<ResultItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

	const { speak, stop, speaking, supported: ttsSupported } = useSpeak();

	const streamRef = useRef<MediaStream | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const isMovingNext = useRef(false);

	const startInterview = async (role: string) => {
		setTargetRole(role);
		setIsLoading(true);
		setError(null);
		try {
			const data = await api.get<{ questions: string[] }>(
				`/api/rehearsal/start?targetRole=${encodeURIComponent(role)}`,
			);
			if (data.questions?.length > 0) setQuestions(data.questions);
			else throw new Error("No interview questions were returned.");
			setStep("interview");
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "An error occurred.");
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


	const handleSpeakQuestion = () => {
		if (speaking) {
			stop();
		} else {
			if (questions[currentQuestionIndex]) {
				speak(questions[currentQuestionIndex]);
			}
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
				setError(
					"Could not access microphone. Check permissions and try again.",
				);
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
			}>("/api/rehearsal/evaluate", formData);
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
			setError(err instanceof Error ? err.message : "Evaluation failed.");
		} finally {
			setIsEvaluating(false);
		}
	};

	const handleFinishSession = async (resultsPayload: ResultItem[]) => {
		setIsEvaluating(true);
		try {
			await api.post("/api/rehearsal/session", {
				results: resultsPayload,
				targetRole,
			});
			navigate("/dashboard");
		} catch {
			setError("Failed to save session. Please try again.");
		} finally {
			setIsEvaluating(false);
		}
	};

	const handleNext = async () => {
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
		if (currentQuestionIndex < questions.length - 1) {
			setCurrentQuestionIndex((p) => p + 1);
		} else {
			const answered = sessionResults.filter(Boolean);
			if (answered.length === 0) navigate("/dashboard");
			else await handleFinishSession(answered);
		}
		isMovingNext.current = false;
	};

	useEffect(
		() => () => {
			if (streamRef.current)
				streamRef.current.getTracks().forEach((t) => t.stop());
		},
		[],
	);

	// Role picker step
	if (step === "role-picker") {
		return (
			<div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pt-14">
				<div className="w-full max-w-lg space-y-6">
					<div className="text-center space-y-2">
						<div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/15">
							<Briefcase className="h-6 w-6 text-primary" />
						</div>
						<h1 className="text-xl font-bold tracking-tight text-foreground">
							Choose Your Target Role
						</h1>
						<p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
							Select the role you're interviewing for. The AI will tailor
							practice questions to match.
						</p>
					</div>

					{error && (
						<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-[20px] border border-destructive/20 text-center">
							{error}
						</div>
					)}

					<div className="border border-border rounded-[20px] bg-card p-4 ">
						<div className="grid grid-cols-2 gap-2">
							{PRESET_ROLES.map((role) => (
								<button
									key={role}
									onClick={() => startInterview(role)}
									disabled={isLoading}
									className={`p-3 rounded-[20px] border text-left transition-all text-[13px] font-medium ${
										targetRole === role
											? "border-primary bg-primary/5 text-primary"
											: "border-border hover:border-primary/30 hover:bg-secondary/50 text-foreground"
									}`}
								>
									{role}
								</button>
							))}
						</div>
					</div>

					<div className="border border-border rounded-[20px] bg-card p-4  space-y-3">
						<Label className="text-muted-foreground">
							Or type a custom role
						</Label>
						<div className="flex gap-2">
							<Input
								placeholder="e.g., Staff ML Engineer"
								value={customRole}
								onChange={(e) => setCustomRole(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter" && customRole.trim())
										startInterview(customRole.trim());
								}}
								className="text-[13px]"
							/>
							<Button
								onClick={() => {
									if (customRole.trim()) startInterview(customRole.trim());
								}}
								disabled={!customRole.trim() || isLoading}
								className="font-semibold shrink-0"
							>
								{isLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									"Go"
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
				<Loader2 className="w-8 h-8 text-primary animate-spin" />
				<p className="text-[13px] font-medium text-muted-foreground mt-3">
					Preparing interview room...
				</p>
			</div>
		);
	}

	if (error && !questions.length) {
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4">
				<div className="w-full max-w-sm border border-border rounded-[20px] bg-card p-8 flex flex-col items-center text-center space-y-5">
					<div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
						<AlertCircle className="w-6 h-6 text-destructive" />
					</div>
					<div className="space-y-1.5">
						<h3 className="text-base font-bold text-foreground">
							Unable to start interview
						</h3>
						<p className="text-[13px] text-muted-foreground">{error}</p>
					</div>
					<Button
						onClick={() => {
							setStep("role-picker");
							setQuestions([]);
							setError(null);
						}}
						className="w-full font-semibold"
					>
						Try Again
					</Button>
				</div>
			</div>
		);
	}

	const currentQuestion = questions[currentQuestionIndex];
	const isLastQuestion = currentQuestionIndex === questions.length - 1;

	return (
		<BehavioralRound
			interview={{ title: "Practice Rehearsal", targetRole }}
			questions={questions}
			currentQuestionIndex={currentQuestionIndex}
			currentQuestion={currentQuestion}
			isRecording={isRecording}
			isEvaluating={isEvaluating}
			evaluation={evaluation}
			recordingSeconds={recordingSeconds}
			isLastQuestion={isLastQuestion}
			hasDsaAfter={false}
			error={error}
			speaking={speaking}
			ttsSupported={ttsSupported}
			onBack={() => {
				setStep("role-picker");
				setQuestions([]);
				setError(null);
			}}
			onSpeakQuestion={handleSpeakQuestion}
			onToggleRecording={handleToggleRecording}
			onResetEvaluation={() => setEvaluation(null)}
			onNext={handleNext}
		/>
	);
};

export default RehearsalRoom;
