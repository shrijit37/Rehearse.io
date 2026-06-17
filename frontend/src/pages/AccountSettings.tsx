import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	AlertCircle,
	Download,
	Trash2,
	ShieldCheck,
	ArrowLeft,
	Camera,
	Mic,
	RefreshCw,
	Volume2,
	CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";

const AccountSettings: React.FC = () => {
	const navigate = useNavigate();
	const [user, setUser] = useState<any>(null);
	const [consent, setConsent] = useState({
		consentGiven: false,
		consentDate: "",
		consentVersion: "",
	});
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [exportLoading, setExportLoading] = useState(false);
	const [consentError, setConsentError] = useState<string | null>(null);

	// Photo state
	const [photo, setPhoto] = useState<string | null>(null);
	const [cameraLoading, setCameraLoading] = useState(false);
	const [cameraError, setCameraError] = useState<string | null>(null);
	const [photoSaving, setPhotoSaving] = useState(false);
	const [photoSaved, setPhotoSaved] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | null>(null);

	// Voice state
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [isRecording, setIsRecording] = useState(false);
	const [voiceError, setVoiceError] = useState<string | null>(null);
	const [voiceSaving, setVoiceSaving] = useState(false);
	const [voiceSaved, setVoiceSaved] = useState(false);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const audioChunksRef = useRef<Blob[]>([]);

	useEffect(() => {
		const stored = localStorage.getItem("user");
		const token = localStorage.getItem("token");
		if (!stored || !token) {
			navigate("/signup");
			return;
		}
		setUser(JSON.parse(stored));
		api
			.get<{
				consentGiven: boolean;
				consentDate: string;
				consentVersion: string;
			}>("/api/auth/consent")
			.then(setConsent)
			.catch((err) => console.error("Failed to fetch consent status:", err));
	}, [navigate]);

	// Camera functions
	const startCamera = useCallback(async () => {
		try {
			setCameraError("");
			setCameraLoading(true);
			if (!videoRef.current) {
				setCameraLoading(false);
				return;
			}
			if (!navigator.mediaDevices?.getUserMedia)
				throw new Error("Camera not supported");
			if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());

			const videoStream = await navigator.mediaDevices.getUserMedia({
				video: {
					width: { ideal: 1280 },
					height: { ideal: 720 },
					facingMode: "user",
				},
			});
			streamRef.current = videoStream;
			videoRef.current.srcObject = videoStream;
			await videoRef.current.play().catch(() => {});
			setCameraLoading(false);
		} catch (err) {
			setCameraLoading(false);
			if (err instanceof Error) {
				if (err.name === "NotAllowedError")
					setCameraError("Camera permission denied. Please allow access and try again.");
				else if (err.name === "NotFoundError")
					setCameraError("No camera found on this device.");
				else setCameraError(err.message);
			}
		}
	}, []);

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
			setCameraError("Video not ready. Please wait for camera to load.");
		}
	};

	const stopCamera = () => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((t) => t.stop());
			streamRef.current = null;
		}
	};

	const handleSavePhoto = async () => {
		if (!photo) return;
		setPhotoSaving(true);
		setCameraError(null);
		try {
			await api.patch("/api/auth/profile", { photo });
			setPhotoSaved(true);
			setTimeout(() => setPhotoSaved(false), 3000);
		} catch (err: any) {
			setCameraError(err.message || "Failed to save photo");
		} finally {
			setPhotoSaving(false);
		}
	};

	// Voice functions
	const startRecording = async () => {
		try {
			setVoiceError("");
			const audioStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
			});
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
			};
			mediaRecorder.start();
			setIsRecording(true);
		} catch {
			setVoiceError("Could not access microphone. Check permissions and try again.");
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

	const handleSaveVoice = async () => {
		if (!audioBlob) return;
		setVoiceSaving(true);
		setVoiceError(null);
		try {
			const audioBase64 = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(audioBlob);
			});
			await api.patch("/api/auth/profile", { audio: audioBase64 });
			setVoiceSaved(true);
			setTimeout(() => setVoiceSaved(false), 3000);
		} catch (err: any) {
			setVoiceError(err.message || "Failed to save voice calibration");
		} finally {
			setVoiceSaving(false);
		}
	};

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
			if (mediaRecorderRef.current && isRecording) mediaRecorderRef.current.stop();
		};
	}, [isRecording]);

	const handleExportData = async () => {
		setExportLoading(true);
		try {
			const response = await api.post<Response>(
				"/api/auth/export-data",
				undefined,
				{ raw: true },
			);
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "rehearse-data-export.json";
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Export failed:", err);
		} finally {
			setExportLoading(false);
		}
	};

	const handleDeleteAccount = async () => {
		if (!deletePassword) {
			setDeleteError("Password is required");
			return;
		}
		setDeleteLoading(true);
		setDeleteError(null);
		try {
			await api.delete("/api/auth/delete-account", {
				password: deletePassword,
			});
			localStorage.removeItem("token");
			localStorage.removeItem("user");
			navigate("/");
		} catch (err: any) {
			setDeleteError(err.message || "Failed to delete account");
		} finally {
			setDeleteLoading(false);
		}
	};

	const handleConsentToggle = async (given: boolean) => {
		try {
			setConsentError(null);
			const data = await api.post<Record<string, unknown>>(
				"/api/auth/consent",
				{ consentGiven: given, consentVersion: "1.0" },
			);
			if (data && typeof data === "object" && "consent" in data) {
				setConsent(data.consent as typeof consent);
			}
		} catch (err) {
			console.error("Failed to update consent:", err);
			setConsentError(err instanceof Error ? err.message : "Failed to update consent settings");
		}
	};

	if (!user) return null;

	return (
		<div className="min-h-screen bg-background pt-20 pb-12">
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
				{/* Back + header */}
				<div className="flex items-center gap-4">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate(-1)}
						className="text-muted-foreground font-medium gap-1.5"
					>
						<ArrowLeft className="h-3.5 w-3.5" /> Back
					</Button>
					<div>
						<h1 className="text-xl font-bold tracking-[-0.02em] text-foreground">
							Account Settings
						</h1>
						<p className="text-[13px] text-muted-foreground">
							Manage your data, consent, and account.
						</p>
					</div>
				</div>

				{/* Profile */}
				<div className="border border-border rounded-[20px] bg-card p-6  space-y-4">
					<h2 className="text-[14px] font-bold text-foreground">Profile</h2>
					<div className="grid grid-cols-2 gap-4">
						<div className="space-y-1.5">
							<Label className="text-muted-foreground">
								Name
							</Label>
							<Input
								value={user.name || ""}
								disabled
								className="bg-surface text-[13px]"
							/>
						</div>
						<div className="space-y-1.5">
							<Label className="text-muted-foreground">
								Email
							</Label>
							<Input
								value={user.email || ""}
								disabled
								className="bg-surface text-[13px]"
							/>
						</div>
					</div>
					<div className="space-y-1.5">
						<Label className="text-muted-foreground">
							Role
						</Label>
						<Input
							value={user.role === "recruiter" ? "Recruiter" : "Candidate"}
							disabled
							className="bg-surface text-[13px] capitalize"
						/>
					</div>
				</div>

				{/* Profile Photo */}
				<div className="border border-border rounded-[20px] bg-card p-6  space-y-4">
					<div className="space-y-1">
						<h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
							<Camera className="h-4 w-4 text-primary" /> Profile Photo
						</h2>
						<p className="text-[12px] text-muted-foreground">
							Add a headshot for identity verification. This helps recruiters
							recognize you during interviews.
						</p>
					</div>
					{cameraError && (
						<div className="bg-destructive/10 text-destructive text-[12px] font-medium p-2.5 rounded-md border border-destructive/20 flex items-center gap-2">
							<AlertCircle className="h-3.5 w-3.5 shrink-0" /> {cameraError}
						</div>
					)}
					{photoSaved && (
						<div className="bg-success/10 text-success text-[12px] font-medium p-2.5 rounded-md border border-success/20 flex items-center gap-2">
							<CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Photo saved successfully
						</div>
					)}
					{photo ? (
						<div className="flex flex-col items-center gap-4">
							<div className="w-40 h-40 rounded-full border-4 border-card outline outline-2 outline-primary overflow-hidden ">
								<img
									src={photo}
									alt="Profile"
									className="w-full h-full object-cover"
								/>
							</div>
							<div className="flex gap-2">
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
								<Button
									size="sm"
									onClick={handleSavePhoto}
									disabled={photoSaving}
									className="font-medium"
								>
									{photoSaving ? "Saving..." : "Save Photo"}
								</Button>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center gap-4">
							<div className="relative w-full max-w-md aspect-video bg-black rounded-[20px] overflow-hidden border border-border">
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
						</div>
					)}
				</div>

				{/* Voice Calibration */}
				<div className="border border-border rounded-[20px] bg-card p-6  space-y-4">
					<div className="space-y-1">
						<h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
							<Mic className="h-4 w-4 text-primary" /> Voice Calibration
						</h2>
						<p className="text-[12px] text-muted-foreground">
							Calibrate your microphone for more accurate AI speech evaluation.
						</p>
					</div>
					{voiceError && (
						<div className="bg-destructive/10 text-destructive text-[12px] font-medium p-2.5 rounded-md border border-destructive/20 flex items-center gap-2">
							<AlertCircle className="h-3.5 w-3.5 shrink-0" /> {voiceError}
						</div>
					)}
					{voiceSaved && (
						<div className="bg-success/10 text-success text-[12px] font-medium p-2.5 rounded-md border border-success/20 flex items-center gap-2">
							<CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Voice calibration saved successfully
						</div>
					)}
					{audioUrl ? (
						<div className="flex flex-col items-center gap-4 w-full max-w-md bg-card p-4 rounded-[20px] border border-border ">
							<div className="flex items-center gap-2 w-full">
								<Volume2 className="h-4 w-4 text-success" />
								<span className="text-[13px] font-semibold">
									Calibration complete
								</span>
							</div>
							<audio src={audioUrl} controls className="w-full h-9" />
							<div className="flex gap-2 w-full">
								<Button
									variant="outline"
									size="sm"
									onClick={recordAgain}
									className="flex-1 font-medium"
								>
									<RefreshCw className="w-3.5 h-3.5 mr-1.5" />
									Re-record
								</Button>
								<Button
									size="sm"
									onClick={handleSaveVoice}
									disabled={voiceSaving}
									className="flex-1 font-medium"
								>
									{voiceSaving ? "Saving..." : "Save Calibration"}
								</Button>
							</div>
						</div>
					) : (
						<div className="flex flex-col items-center gap-4">
							<div className="w-full max-w-md bg-surface border border-border rounded-[20px] p-4 text-center">
								<p className="text-[10px] font-bold text-primary uppercase tracking-wider mb-1.5">
									Read this aloud
								</p>
								<p className="text-[13px] font-medium text-foreground leading-relaxed italic">
									"I am excited to join Rehearse.io for interview
									preparation and verify my audio levels."
								</p>
							</div>
							<Button
								variant={isRecording ? "destructive" : "default"}
								size="lg"
								className={`w-32 h-32 rounded-full font-bold text-sm  transition-all duration-300 ${isRecording ? "animate-pulse" : ""}`}
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
						</div>
					)}
				</div>

				{/* Data Export */}
				<div className="border border-border rounded-[20px] bg-card p-6  space-y-4">
					<div className="space-y-1">
						<h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
							<Download className="h-4 w-4 text-primary" /> Export Your Data
						</h2>
						<p className="text-[12px] text-muted-foreground">
							GDPR Article 20: download a copy of all your personal data as
							JSON.
						</p>
					</div>
					<Button
						variant="outline"
						onClick={handleExportData}
						disabled={exportLoading}
						className="font-medium gap-2"
					>
						{exportLoading ? "Exporting..." : "Download Data Export"}
					</Button>
				</div>

				{/* Consent */}
				<div className="border border-border rounded-[20px] bg-card p-6  space-y-4">
					<div className="space-y-1">
						<h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
							<ShieldCheck className="h-4 w-4 text-primary" /> Consent
							Management
						</h2>
						<p className="text-[12px] text-muted-foreground">
							Control your data processing consent preferences.
						</p>
					</div>
					{consentError && (
						<div className="bg-destructive/10 text-destructive text-[12px] font-medium p-2.5 rounded-md border border-destructive/20 flex items-center gap-2">
							<AlertCircle className="h-3.5 w-3.5 shrink-0" /> {consentError}
						</div>
					)}
					<div className="flex items-center justify-between p-4 bg-surface rounded-[20px] border border-border">
						<div>
							<p className="text-[13px] font-semibold text-foreground">
								Data Processing Consent
							</p>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{consent.consentGiven
									? `Granted on ${new Date(consent.consentDate).toLocaleDateString()} (v${consent.consentVersion})`
									: "Not yet granted"}
							</p>
						</div>
						<Button
							variant={consent.consentGiven ? "outline" : "default"}
							size="sm"
							className="font-medium"
							onClick={() => handleConsentToggle(!consent.consentGiven)}
						>
							{consent.consentGiven ? "Revoke" : "Grant"}
						</Button>
					</div>
					<p className="text-[11px] text-muted-foreground leading-relaxed">
						Essential data processing (authentication, security) is always
						active. Revoking consent stops optional processing such as
						analytics. Your platform functionality is unaffected.
					</p>
				</div>

				{/* Delete Account */}
				<div className="border border-destructive/20 rounded-[20px] bg-card p-6  space-y-4">
					<div className="space-y-1">
						<h2 className="text-[14px] font-bold text-destructive flex items-center gap-2">
							<Trash2 className="h-4 w-4" /> Delete Account
						</h2>
						<p className="text-[12px] text-muted-foreground">
							Permanently delete your account and all data. This cannot be
							undone.
						</p>
					</div>
					{!showDeleteConfirm ? (
						<Button
							variant="destructive"
							onClick={() => setShowDeleteConfirm(true)}
							className="font-medium"
						>
							Delete My Account
						</Button>
					) : (
						<div className="space-y-4 p-4 bg-destructive/5 border border-destructive/15 rounded-[20px]">
							<p className="text-[13px] text-foreground font-medium">
								This will permanently delete your account, all interview
								sessions, and all personal data. Enter your password to confirm.
							</p>
							{deleteError && (
								<div className="bg-destructive/10 text-destructive text-[12px] font-medium p-2.5 rounded-md border border-destructive/20 flex items-center gap-2">
									<AlertCircle className="h-3.5 w-3.5 shrink-0" /> {deleteError}
								</div>
							)}
							<div className="flex gap-3">
								<Input
									type="password"
									placeholder="Enter your password"
									value={deletePassword}
									onChange={(e) => setDeletePassword(e.target.value)}
									className="max-w-xs text-[13px]"
								/>
								<Button
									variant="destructive"
									onClick={handleDeleteAccount}
									disabled={deleteLoading || !deletePassword}
									className="font-medium"
								>
									{deleteLoading ? "Deleting..." : "Confirm Delete"}
								</Button>
								<Button
									variant="ghost"
									onClick={() => {
										setShowDeleteConfirm(false);
										setDeletePassword("");
										setDeleteError(null);
									}}
									className="font-medium"
								>
									Cancel
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default AccountSettings;
