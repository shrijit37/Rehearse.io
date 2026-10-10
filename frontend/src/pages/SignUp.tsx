import React, { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Eye,
	EyeOff,
	Mail,
	User,
	Lock,
	ArrowLeft,
	CheckCircle2,
	Building2,
	Users,
} from "lucide-react";
import { api } from "@/lib/api";
import {
	getSession,
	signInWithEmail,
	signInWithProviderRedirect,
	signUpWithEmail,
} from "@/lib/auth-client";

interface AuthUser {
	id: string;
	email: string;
	name?: string;
	role: "recruiter" | "candidate";
	onboarded?: boolean;
}

interface FormData {
	email: string;
	password: string;
	confirmPassword: string;
	firstName: string;
	lastName: string;
	role: "recruiter" | "candidate";
	consentGiven: boolean;
}

/** Better Auth answers with terse strings; show something a human can act on. */
const friendlyError = (message: string): string => {
	if (/not verified/i.test(message))
		return "Verify your email first — open the link we just sent you.";
	if (/invalid email or password/i.test(message))
		return "That email and password do not match.";
	if (/already exists/i.test(message))
		return "An account already exists for that email. Try signing in.";
	if (/password/i.test(message) && /(short|at least|weak)/i.test(message))
		return "Password must be at least 8 characters.";
	return message;
};

const SignUp: React.FC = () => {
	const navigate = useNavigate();
	const [isLogin, setIsLogin] = useState<boolean>(false);
	const [showPassword, setShowPassword] = useState<boolean>(false);
	const [showConfirmPassword, setShowConfirmPassword] =
		useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [loading, setLoading] = useState<boolean>(false);
	const [formData, setFormData] = useState<FormData>({
		email: "",
		password: "",
		confirmPassword: "",
		firstName: "",
		lastName: "",
		role: "recruiter",
		consentGiven: false,
	});

	const handleInputChange = (e: ChangeEvent<HTMLInputElement>): void => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	/** Cache the profile the backend derives from the shared session. */
	const finishSignIn = async (
		claim: Partial<Pick<FormData, "role" | "consentGiven">> = {},
	): Promise<void> => {
		const { user } = await api.post<{ user: AuthUser }>("/api/auth/claim", {
			...claim,
			consentVersion: "1.0",
		});
		localStorage.setItem("user", JSON.stringify(user));
		window.dispatchEvent(new Event("storage"));
		navigate(
			user.role === "recruiter"
				? "/recruiter"
				: user.onboarded
					? "/dashboard"
					: "/onboarding",
		);
	};

	// Already signed in at auth.shrijit.tech? Skip the form.
	useEffect(() => {
		getSession()
			.then((session) => (session ? finishSignIn() : null))
			.catch(() => {});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleSubmit = async (e: FormEvent): Promise<void> => {
		e.preventDefault();
		setError(null);
		setSuccess(null);
		setLoading(true);

		try {
			if (!isLogin && formData.password !== formData.confirmPassword) {
				setError("Passwords do not match");
				setLoading(false);
				return;
			}
			if (!isLogin && formData.password.length < 8) {
				setError("Password must be at least 8 characters");
				setLoading(false);
				return;
			}
			if (!isLogin && !formData.consentGiven) {
				setError(
					"You must accept the Privacy Policy and Terms of Service to create an account.",
				);
				setLoading(false);
				return;
			}

			if (isLogin) {
				await signInWithEmail(formData.email, formData.password);
				await finishSignIn();
				return;
			}

			await signUpWithEmail(
				formData.email,
				formData.password,
				`${formData.firstName} ${formData.lastName}`.trim(),
			);
			setSuccess("Account created — check your inbox to verify your email.");
		} catch (err: unknown) {
			setError(
				err instanceof Error
					? friendlyError(err.message)
					: "An error occurred",
			);
		} finally {
			setLoading(false);
		}
	};

	const handleProvider = (provider: "google" | "github"): void => {
		setError(null);
		signInWithProviderRedirect(provider).catch((err: unknown) =>
			setError(
				err instanceof Error
					? friendlyError(err.message)
					: "Could not start sign-in",
			),
		);
	};

	return (
		<div className="min-h-screen bg-background flex pt-14">
			{/* Auth form */}
			<div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-20 xl:px-24 py-12 relative">
				{/* Back to home */}
				<button
					onClick={() => navigate("/")}
					className="absolute top-6 left-6 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-[#3860be] transition-colors"
				>
					<ArrowLeft className="h-3.5 w-3.5" />
					Home
				</button>

				<div className="w-full max-w-md space-y-8">
					{/* Header */}
					<div className="space-y-2">
						<h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">
							{isLogin ? "Welcome back" : "Create your account"}
						</h1>
						<p className="text-[13px] text-muted-foreground leading-relaxed">
							{isLogin
								? "Sign in to manage or complete your interviews."
								: "Set up your organization and start running structured interviews."}
						</p>
					</div>

					{/* Form card */}
					<div className="border border-border/80 rounded-[20px] bg-card p-6">
						<div className="grid grid-cols-2 gap-3">
							<Button
								type="button"
								variant="outline"
								onClick={() => handleProvider("google")}
								className="h-9 text-[13px]"
							>
								<svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
									<path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z" />
									<path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
									<path fill="#FBBC05" d="M5.4 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.4a12 12 0 0 0 0 10.8l4-3.1Z" />
									<path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
								</svg>
								Google
							</Button>
							<Button
								type="button"
								variant="outline"
								onClick={() => handleProvider("github")}
								className="h-9 text-[13px]"
							>
								<svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
									<path fill="currentColor" d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.9 18.3 5.2 18.3 5.2c.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
								</svg>
								GitHub
							</Button>
						</div>

						<div className="flex items-center gap-3 py-1">
							<span className="h-px flex-1 bg-border" />
							<span className="text-[11px] uppercase tracking-wide text-muted-foreground">
								or use email
							</span>
							<span className="h-px flex-1 bg-border" />
						</div>

						<form onSubmit={handleSubmit} className="space-y-5">
							{error && (
								<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-[20px] border border-destructive/20 text-center animate-in fade-in slide-in-from-top-1 duration-150">
									{error}
								</div>
							)}
							{success && (
								<div className="bg-success/10 text-success text-[13px] font-medium p-3 rounded-[20px] border border-success/20 text-center animate-in fade-in slide-in-from-top-1 duration-150">
									{success}
								</div>
							)}

							{/* Role selection (signup only) */}
							{!isLogin && (
								<div className="space-y-2">
									<Label className="text-muted-foreground">
										I am a...
									</Label>
									<div className="grid grid-cols-2 gap-3">
										<button
											type="button"
											onClick={() =>
												setFormData((p) => ({ ...p, role: "recruiter" }))
											}
											className={`p-4 rounded-[20px] border-2 transition-all text-center space-y-2 ${
												formData.role === "recruiter"
													? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
													: "border-border hover:border-primary/30"
											}`}
										>
											<Building2
												className={`h-5 w-5 mx-auto ${formData.role === "recruiter" ? "text-primary" : "text-muted-foreground"}`}
											/>
											<p className="text-[13px] font-semibold">Recruiter</p>
											<p className="text-[11px] text-muted-foreground">
												Create & manage interviews
											</p>
										</button>
										<button
											type="button"
											onClick={() =>
												setFormData((p) => ({ ...p, role: "candidate" }))
											}
											className={`p-4 rounded-[20px] border-2 transition-all text-center space-y-2 ${
												formData.role === "candidate"
													? "border-primary bg-primary/[0.05] ring-1 ring-primary/20"
													: "border-border hover:border-primary/30"
											}`}
										>
											<Users
												className={`h-5 w-5 mx-auto ${formData.role === "candidate" ? "text-primary" : "text-muted-foreground"}`}
											/>
											<p className="text-[13px] font-semibold">Candidate</p>
											<p className="text-[11px] text-muted-foreground">
												Complete interviews
											</p>
										</button>
									</div>
								</div>
							)}

							{/* Name fields (signup only) */}
							{!isLogin && (
								<div className="grid grid-cols-2 gap-3">
									<div className="space-y-1.5">
										<Label
											htmlFor="firstName"
											className="text-muted-foreground"
										>
											First name
										</Label>
										<div className="relative">
											<User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
											<Input
												id="firstName"
												name="firstName"
												placeholder="Jane"
												value={formData.firstName}
												onChange={handleInputChange}
												className="pl-9 h-9 text-[13px]"
												required={!isLogin}
											/>
										</div>
									</div>
									<div className="space-y-1.5">
										<Label
											htmlFor="lastName"
											className="text-muted-foreground"
										>
											Last name
										</Label>
										<div className="relative">
											<User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
											<Input
												id="lastName"
												name="lastName"
												placeholder="Doe"
												value={formData.lastName}
												onChange={handleInputChange}
												className="pl-9 h-9 text-[13px]"
												required={!isLogin}
											/>
										</div>
									</div>
								</div>
							)}

							{/* Email */}
							<div className="space-y-1.5">
								<Label
									htmlFor="email"
									className="text-muted-foreground"
								>
									Email address
								</Label>
								<div className="relative">
									<Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										id="email"
										name="email"
										type="email"
										placeholder="name@company.com"
										value={formData.email}
										onChange={handleInputChange}
										className="pl-9 h-9 text-[13px]"
										required
									/>
								</div>
							</div>

							{/* Password */}
							<div className="space-y-1.5">
								<div className="flex justify-between items-center">
									<Label
										htmlFor="password"
										className="text-muted-foreground"
									>
										Password
									</Label>
									{isLogin && (
										<button
											type="button"
											onClick={() => alert("Password reset is not yet available. Please contact support.")}
											className="text-[11px] text-primary font-medium hover:underline focus:outline-none"
										>
											Forgot password?
										</button>
									)}
								</div>
								<div className="relative">
									<Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
									<Input
										id="password"
										name="password"
										type={showPassword ? "text" : "password"}
										value={formData.password}
										onChange={handleInputChange}
										className="pl-9 pr-10 h-9 text-[13px]"
										required
									/>
									<button
										type="button"
										onClick={() => setShowPassword(!showPassword)}
										className="absolute right-3 top-2.5 text-muted-foreground hover:text-[#3860be] transition-colors focus:outline-none"
									>
										{showPassword ? (
											<EyeOff className="h-4 w-4" />
										) : (
											<Eye className="h-4 w-4" />
										)}
									</button>
								</div>
							</div>

							{/* Confirm password (signup only) */}
							{!isLogin && (
								<div className="space-y-1.5">
									<Label
										htmlFor="confirmPassword"
										className="text-muted-foreground"
									>
										Confirm password
									</Label>
									<div className="relative">
										<Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
										<Input
											id="confirmPassword"
											name="confirmPassword"
											type={showConfirmPassword ? "text" : "password"}
											value={formData.confirmPassword}
											onChange={handleInputChange}
											className="pl-9 pr-10 h-9 text-[13px]"
											required={!isLogin}
										/>
										<button
											type="button"
											onClick={() =>
												setShowConfirmPassword(!showConfirmPassword)
											}
											className="absolute right-3 top-2.5 text-muted-foreground hover:text-[#3860be] transition-colors focus:outline-none"
										>
											{showConfirmPassword ? (
												<EyeOff className="h-4 w-4" />
											) : (
												<Eye className="h-4 w-4" />
											)}
										</button>
									</div>
								</div>
							)}

							{/* Consent checkbox (signup only) */}
							{!isLogin && (
								<label className="flex items-start gap-2.5 cursor-pointer">
									<input
										type="checkbox"
										checked={formData.consentGiven}
										onChange={(e) =>
											setFormData((p) => ({
												...p,
												consentGiven: e.target.checked,
											}))
										}
										className="accent-primary mt-0.5 shrink-0"
									/>
									<span className="text-[12px] text-muted-foreground leading-relaxed">
										I agree to the{" "}
										<button
											type="button"
											onClick={() => window.open("/privacy", "_blank")}
											className="text-primary font-medium hover:underline"
										>
											Privacy Policy
										</button>{" "}
										and{" "}
										<button
											type="button"
											onClick={() => window.open("/terms", "_blank")}
											className="text-primary font-medium hover:underline"
										>
											Terms of Service
										</button>
										.
									</span>
								</label>
							)}

							<Button
								type="submit"
								className="w-full font-semibold h-10"
								disabled={loading}
							>
								{loading
									? "Please wait..."
									: isLogin
										? "Sign in"
										: "Create account"}
							</Button>
						</form>

						<p className="text-center text-[13px] text-muted-foreground mt-5 pt-4 border-t border-border/60">
							{isLogin ? "New to Rehearse.io?" : "Already have an account?"}
							<button
								onClick={() => {
									setIsLogin(!isLogin);
									setError(null);
									setSuccess(null);
									setShowPassword(false);
									setShowConfirmPassword(false);
									setFormData({
										email: "",
										password: "",
										confirmPassword: "",
										firstName: "",
										lastName: "",
										role: "recruiter",
										consentGiven: false,
									});
								}}
								className="ml-1.5 text-primary font-semibold hover:underline focus:outline-none"
							>
								{isLogin ? "Create an account" : "Sign in"}
							</button>
						</p>
					</div>
				</div>
			</div>

			{/* Marketing panel (lg+) */}
			<div className="hidden lg:flex lg:w-[45%] bg-[#5200ff] text-white p-12 flex-col justify-between relative overflow-hidden select-none">

				{/* Content */}
				<div className="space-y-10 max-w-md relative z-10 my-auto">
					<div className="space-y-4">
						<h2 className="text-3xl font-bold leading-[1.15] tracking-[-0.02em]">
							Run structured first rounds at scale.
						</h2>
						<p className="text-sm text-white/80 leading-relaxed max-w-sm">
							Create sessions, invite candidates, and let AI handle the rest.
							Every evaluation consistent, every score fair.
						</p>
					</div>

					<div className="space-y-3.5">
						{[
							"Candidates interview on their own schedule, no coordination needed.",
							"AI-powered transcription, scoring, and feedback for every answer.",
							"GDPR/CCPA compliant with full data export and account deletion.",
						].map((text, i) => (
							<div key={i} className="flex items-start gap-2.5">
								<CheckCircle2 className="h-4 w-4 text-white/70 shrink-0 mt-0.5" />
								<p className="text-[13px] text-white/90 leading-relaxed">
									{text}
								</p>
							</div>
						))}
					</div>

					<div className="bg-white/[0.08] border border-white/[0.15] rounded-lg p-5">
						<blockquote className="text-[13px] text-white/85 leading-relaxed italic mb-3">
							"Rehearse.io cut our first-round screening time by 60%. The AI
							evaluations are consistent, fair, and our candidates love the
							flexibility."
						</blockquote>
						<div>
							<p className="text-[13px] font-semibold text-white">Sarah Chen</p>
							<p className="text-[11px] text-white/60">
								VP of Engineering, TechCorp
							</p>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default SignUp;
