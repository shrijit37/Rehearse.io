import React, { useState, type ChangeEvent, type FormEvent } from "react";
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

			const endpoint = isLogin ? "/api/auth/login" : "/api/auth/signup";
			const payload = isLogin
				? { email: formData.email, password: formData.password }
				: {
						name: `${formData.firstName} ${formData.lastName}`,
						email: formData.email,
						password: formData.password,
						role: formData.role,
						consentGiven: formData.consentGiven,
						consentVersion: "1.0",
					};

			const data = await api.post<{ token: string; user: AuthUser }>(
				endpoint,
				payload,
			);

			localStorage.setItem("token", data.token);
			localStorage.setItem("user", JSON.stringify(data.user));
			setSuccess(
				isLogin ? "Signed in successfully." : "Account created successfully.",
			);
			window.dispatchEvent(new Event("storage"));

			setTimeout(() => {
				if (!isLogin) {
					// New signup: redirect based on role
					if (data.user?.role === "recruiter") {
						navigate("/recruiter");
					} else {
						navigate("/onboarding");
					}
				} else {
					// Login: redirect based on role and onboarding status
					if (data.user?.role === "recruiter") {
						navigate("/recruiter");
					} else {
						// Candidate login — check if they have completed onboarding (resume present)
						if (data.user?.onboarded) {
							navigate("/dashboard");
						} else {
							navigate("/onboarding");
						}
					}
				}
			}, 600);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
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
