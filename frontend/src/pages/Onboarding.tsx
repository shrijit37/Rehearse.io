import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Upload,
	Camera,
	Mic,
	AlertCircle,
	FileText,
	CheckCircle2,
	ChevronRight,
	RefreshCw,
	Trash2,
	Volume2,
} from "lucide-react";

interface OnboardingStep {
	step: number;
	title: string;
	description: string;
}

const Onboarding = () => {
	const steps: OnboardingStep[] = [
		{
			step: 1,
			title: "Resume",
			description: "Upload your professional background.",
		},
		{
			step: 2,
			title: "Photo",
			description: "Capture a headshot for verification.",
		},
		{ step: 3, title: "Voice", description: "Calibrate your microphone." },
	];

	const navigate = useNavigate();
	const [currentStep, setCurrentStep] = useState(1);
	const [progress, setProgress] = useState((1 / steps.length) * 100);
	const [resumeFile, setResumeFile] = useState<File | null>(null);
	const [photo, setPhoto] = useState<string | null>(null);
	const [isRecording, setIsRecording] = useState(false);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [stream, setStream] = useState<MediaStream | null>(null);
	const [error, setError] = useState<string>("");
	const [cameraLoading, setCameraLoading] = useState(false);

	const videoRef = useRef<HTMLVideoElement>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	const getRootProps = () => ({
		onClick: () => {
			const input = document.createElement("input");
			input.type = "file";
			input.accept = ".pdf,.docx,.doc";
			input.onchange = (e) => {
				const files = (e.target as HTMLInputElement).files;
				if (files && files.length > 0) setResumeFile(files[0]);
			};
			input.click();
		},
	});

	const startCamera = useCallback(async () => {
		try {
			setError("");
			setCameraLoading(true);
			if (!videoRef.current) {
				setCameraLoading(false);
				return;
			}
			if (!navigator.mediaDevices?.getUserMedia)
				throw new Error("Camera not supported");
			if (stream) stream.getTracks().forEach((t) => t.stop());

			const videoStream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: "user",
				},
			});
			setStream(videoStream);
			videoRef.current.srcObject = videoStream;
			await videoRef.current.play().catch(() => {});
			setCameraLoading(false);
		} catch (err) {
			setCameraLoading(false);
			if (err instanceof Error) {
				if (err.name === "NotAllowedError")
					setError(
						"Camera permission denied. Please allow access and try again.",
					);
				else if (err.name === "NotFoundError")
					setError("No camera found on this device.");
				else setError(err.message);
			}
		}
	}, [stream]);

	const capturePhoto = () => {
		if (videoRef.current && videoRef.current.videoWidth > 0) {
			const canvas = document.createElement("canvas");
			canvas.width = videoRef.current.videoWidth;
			canvas.height = videoRef.current.videoHeight;
			const ctx = canvas.getContext("2d");
			if (ctx) {
				ctx.drawImage(videoRef.current, 0, 0);
				setPhoto(canvas.toDataURL("image/jpeg", 0.8));
			}
			stopCamera();
		} else {
			setError("Video not ready. Please wait for camera to load.");
		}
	};

	const stopCamera = () => {
		if (stream) {
			stream.getTracks().forEach((t) => t.stop());
			setStream(null);
		}
	};

	const startRecording = async () => {
		try {
			setError("");
			const audioStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
			setStream(audioStream);
			const mediaRecorder = new MediaRecorder(audioStream);
			mediaRecorderRef.current = mediaRecorder;
			audioChunksRef.current = [];
			mediaRecorder.ondataavailable = (e) => {
				if (e.data.size > 0) audioChunksRef.current.push(e.data);
			};
			mediaRecorder.onstop = () => {
				const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
				setAudioUrl(URL.createObjectURL(blob));
				setAudioBlob(blob);
				audioStream.getTracks().forEach((t) => t.stop());
				setStream(null);
			};
			mediaRecorder.start();
			setIsRecording(true);
		} catch {
			setError("Could not access microphone. Check permissions and try again.");
		}
	};

	const stopRecording = () => {
		if (mediaRecorderRef.current && isRecording) {
			mediaRecorderRef.current.stop();
			setIsRecording(false);
		}
	};

	const recordAgain = () => {
		setAudioUrl(null);
		setAudioBlob(null);
		setIsRecording(false);
	};

	const handleNext = () => {
		if (currentStep < steps.length) {
			const next = currentStep + 1;
			setCurrentStep(next);
			setProgress((next / steps.length) * 100);
		}
	};

	const handleBack = () => {
		if (currentStep > 1) {
			const prev = currentStep - 1;
			setCurrentStep(prev);
			setProgress((prev / steps.length) * 100);
		}
	};

	const handleFinish = async () => {
		setError("");
		setIsSubmitting(true);
		try {
			const formData = new FormData();
			if (resumeFile) formData.append("resume", resumeFile);
			if (photo) formData.append("photo", photo);
			if (audioBlob) formData.append("audio", audioBlob, "calibration.webm");

			const token = localStorage.getItem("token");
			const apiBase = import.meta.env.VITE_API_URL || "http://localhost:9000";
			const response = await fetch(`${apiBase}/api/auth/onboard`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.message || "Onboarding failed");
			}

			const data = await response.json();
			if (data.user) localStorage.setItem("user", JSON.stringify(data.user));
			window.dispatchEvent(new Event("storage"));
			navigate("/dashboard");
		} catch (err: any) {
			setError(err.message || "An error occurred.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const isNextDisabled = () => {
		switch (currentStep) {
			case 1:
				return !resumeFile;
			case 2:
				return false; // Camera step is optional
			case 3:
				return false; // Voice step is optional
			default:
				return true;
		}
	};

	useEffect(() => {
		if (currentStep === 2 && !photo && !stream && !cameraLoading) startCamera();
	}, [currentStep, photo, stream, cameraLoading, startCamera]);

	useEffect(
		() => () => {
			if (stream) stream.getTracks().forEach((t) => t.stop());
			if (mediaRecorderRef.current && isRecording)
				mediaRecorderRef.current.stop();
		},
		[stream, isRecording],
	);

	return (
		<div className="min-h-screen bg-background flex flex-col pt-14">
			<div className="flex-1 flex flex-col md:flex-row max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 gap-10">
				{/* Sidebar: steps */}
				<div className="w-full md:w-64 shrink-0 space-y-6">
					<div className="space-y-1">
						<h2 className="text-lg font-bold tracking-tight text-foreground">
							Complete your profile
						</h2>
						<p className="text-[13px] text-muted-foreground leading-relaxed">
							These calibration steps help the AI evaluate your responses
							accurately.
						</p>
					</div>

					<div className="flex flex-col gap-0">
						{steps.map((s, idx) => {
							const isDone = s.step < currentStep;
							const isActive = s.step === currentStep;
							return (
								<div key={s.step} className="flex items-start gap-3 relative">
									{/* Connector line */}
									{idx < steps.length - 1 && (
										<div
											className={`absolute left-[13px] top-[28px] bottom-0 w-px ${isDone ? "bg-primary" : "bg-border/60"}`}
										/>
									)}
									{/* Step circle */}
									<div className="shrink-0 z-10 mt-0.5">
										{isDone ? (
											<div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
												<CheckCircle2 className="h-4 w-4" />
											</div>
										) : isActive ? (
											<div className="w-7 h-7 rounded-full border-2 border-primary bg-background text-primary flex items-center justify-center text-xs font-bold">
												{s.step}
											</div>
										) : (
											<div className="w-7 h-7 rounded-full border border-border bg-background text-muted-foreground flex items-center justify-center text-xs font-semibold">
												{s.step}
											</div>
										)}
									</div>
									<div className="pb-6 pt-0.5">
										<p
											className={`text-[13px] font-semibold ${isActive ? "text-foreground" : isDone ? "text-muted-foreground" : "text-muted-foreground/70"}`}
										>
											{s.title}
										</p>
										<p className="text-[11px] text-muted-foreground">
											{s.description}
										</p>
									</div>
								</div>
							);
						})}
					</div>
				</div>

				{/* Main content card */}
				<div className="flex-1 flex flex-col">
					<div className="border border-border/80 rounded-xl bg-card shadow-sm flex-1 flex flex-col overflow-hidden">
						{/* Progress bar */}
						<div className="border-b border-border/60 px-6 py-3 flex items-center justify-between bg-secondary/20">
							<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Step {currentStep} of {steps.length}
							</span>
							<div className="flex items-center gap-3 w-36">
								<div className="flex-1 bg-secondary h-1.5 rounded-full overflow-hidden">
									<div
										className="bg-primary h-full transition-all duration-300"
										style={{ width: `${progress}%` }}
									/>
								</div>
								<span className="text-[11px] font-bold text-foreground">
									{Math.round(progress)}%
								</span>
							</div>
						</div>

						{/* Step content */}
						<div className="flex-1 p-8 flex flex-col justify-center min-h-[340px]">
							{error && (
								<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-lg border border-destructive/20 mb-6 flex items-center gap-2 animate-in fade-in duration-200">
									<AlertCircle className="w-4 h-4 shrink-0" />
									<span>{error}</span>
								</div>
							)}

							{currentStep === 1 && (
								<div className="flex flex-col items-center">
									{resumeFile ? (
										<div className="w-full max-w-md bg-surface border border-border/60 rounded-lg p-4 flex items-center gap-4 animate-in zoom-in-95 duration-200">
											<div className="w-10 h-10 bg-primary/10 border border-primary/15 text-primary rounded-lg flex items-center justify-center shrink-0">
												<FileText className="h-5 w-5" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-[13px] font-semibold text-foreground truncate">
													{resumeFile.name}
												</p>
												<p className="text-[11px] text-muted-foreground">
													{(resumeFile.size / (1024 * 1024)).toFixed(2)} MB
												</p>
											</div>
											<button
												onClick={() => setResumeFile(null)}
												className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
											>
												<Trash2 className="h-4 w-4" />
											</button>
										</div>
									) : (
										<div
											{...getRootProps()}
											className="w-full max-w-md border-2 border-dashed border-border hover:border-primary/40 bg-surface/50 hover:bg-secondary/50 rounded-xl p-10 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 select-none group"
										>
											<div className="w-12 h-12 bg-card border border-border rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform">
												<Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
											</div>
											<h3 className="text-sm font-semibold text-foreground mb-1">
												Upload your resume
											</h3>
											<p className="text-[12px] text-muted-foreground max-w-xs">
												PDF or Word document, up to 5 MB
											</p>
										</div>
									)}
								</div>
							)}

							{currentStep === 2 && (
								<div className="flex flex-col items-center gap-5">
									{photo ? (
										<div className="flex flex-col items-center gap-4 animate-in zoom-in-95 duration-200">
											<div className="w-40 h-40 rounded-full border-4 border-card outline outline-2 outline-primary overflow-hidden shadow-md">
												<img
													src={photo}
													alt="Profile"
													className="w-full h-full object-cover"
												/>
											</div>
											<Button
												variant="outline"
												size="sm"
												onClick={() => {
													setPhoto(null);
													startCamera();
												}}
												className="font-medium"
											>
												<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
												Retake
											</Button>
										</div>
									) : (
										<div className="w-full max-w-md flex flex-col items-center gap-4">
											<div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden border border-border">
												{cameraLoading && (
													<div className="absolute inset-0 flex items-center justify-center bg-secondary/80 z-10">
														<RefreshCw className="animate-spin h-5 w-5 text-primary" />
													</div>
												)}
												<video
													ref={videoRef}
													autoPlay
													playsInline
													muted
													className={`w-full h-full object-cover ${cameraLoading ? "opacity-0" : ""}`}
												/>
											</div>
											<Button
												onClick={capturePhoto}
												disabled={cameraLoading}
												className="font-semibold px-6"
											>
												<Camera className="w-4 h-4 mr-1.5" />
												Capture
											</Button>
											<Button
												variant="ghost"
												onClick={handleNext}
												className="text-muted-foreground font-medium text-[13px]"
											>
												Skip for now
											</Button>
											<p className="text-[11px] text-muted-foreground text-center max-w-xs">
												A profile photo helps recruiters verify your identity. You can add one later in account settings.
											</p>
										</div>
									)}
								</div>
							)}

							{currentStep === 3 && (
								<div className="flex flex-col items-center gap-5 w-full">
									<div className="w-full max-w-md bg-surface border border-border/60 rounded-lg p-4 text-center">
										<p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">
											Read this aloud
										</p>
										<p className="text-[13px] font-medium text-foreground leading-relaxed italic">
											"I am excited to join Rehearse.io for interview
											preparation and verify my audio levels."
										</p>
									</div>
									{audioUrl ? (
										<div className="flex flex-col items-center gap-4 w-full max-w-md bg-card p-4 rounded-lg border border-border/80 shadow-sm animate-in zoom-in-95 duration-200">
											<div className="flex items-center gap-2 w-full">
												<Volume2 className="h-4 w-4 text-success" />
												<span className="text-[13px] font-semibold">
													Calibration complete
												</span>
											</div>
											<audio src={audioUrl} controls className="w-full h-9" />
											<Button
												variant="outline"
												size="sm"
												onClick={recordAgain}
												className="w-full font-medium"
											>
												<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
												Re-record
											</Button>
										</div>
									) : (
										<div className="flex flex-col items-center gap-4">
											<Button
												variant={isRecording ? "destructive" : "default"}
												size="lg"
												className={`w-32 h-32 rounded-full font-bold text-sm shadow-md transition-all duration-300 ${isRecording ? "animate-pulse" : ""}`}
												onClick={isRecording ? stopRecording : startRecording}
											>
												{isRecording ? (
													"STOP"
												) : (
													<>
														<Mic className="w-5 h-5 mr-2" />
														RECORD
													</>
												)}
											</Button>
											<p className="text-[12px] text-muted-foreground font-medium">
												{isRecording
													? "Recording..."
													: "Click to record calibration"}
											</p>
											<Button
												variant="ghost"
												onClick={handleFinish}
												className="text-muted-foreground font-medium text-[13px]"
											>
												Skip for now
											</Button>
											<p className="text-[11px] text-muted-foreground text-center max-w-xs">
												Microphone calibration helps the AI evaluate your responses more accurately. You can complete this later in account settings.
											</p>
										</div>
									)}
								</div>
							)}
						</div>

						{/* Footer nav */}
						<div className="border-t border-border/60 px-6 py-4 flex items-center justify-between bg-secondary/10">
							<Button
								variant="ghost"
								onClick={handleBack}
								disabled={currentStep === 1 || isSubmitting}
								className="text-muted-foreground font-semibold text-[13px]"
							>
								Back
							</Button>
							<Button
								onClick={
									currentStep === steps.length ? handleFinish : handleNext
								}
								disabled={isNextDisabled() || isSubmitting}
								className="font-semibold px-5"
							>
								{isSubmitting
									? "Saving..."
									: currentStep === steps.length
										? "Finish"
										: "Continue"}
								{!isSubmitting && <ChevronRight className="h-4 w-4 ml-1" />}
							</Button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default Onboarding;
