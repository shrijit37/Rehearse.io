import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Plus,
	Trash2,
	ArrowLeft,
	Loader2,
	Code2,
	Mic,
	Layers,
	Sparkles,
} from "lucide-react";
import { api } from "@/lib/api";
import type { Organization } from "@/types";
import type { DsaProblem } from "@/components/DsaProblemPanel";

type InterviewType = "behavioral" | "dsa" | "mixed";

const InterviewSetup: React.FC = () => {
	const navigate = useNavigate();
	const [title, setTitle] = useState("");
	const [targetRole, setTargetRole] = useState("");
	const [description, setDescription] = useState("");
	const [interviewType, setInterviewType] = useState<InterviewType>("mixed");
	const [questions, setQuestions] = useState<string[]>([""]);
	const [dsaProblems, setDsaProblems] = useState<DsaProblem[]>([]);
	const [dsaDifficulty, setDsaDifficulty] = useState("medium");
	const [dsaCount, setDsaCount] = useState(2);
	const [isGeneratingDsa, setIsGeneratingDsa] = useState(false);
	const [expiresAt, setExpiresAt] = useState("");
	const [organizations, setOrganizations] = useState<Organization[]>([]);
	const [selectedOrgId, setSelectedOrgId] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		api
			.get<{ data: Organization[]; total: number }>("/api/org")
			.then((data) => {
				setOrganizations(data.data || []);
				if (data.data?.length > 0) setSelectedOrgId(data.data[0]._id);
			})
			.catch((err) => console.error("Failed to fetch organizations:", err));
	}, [navigate]);

	const needsBehavioral =
		interviewType === "behavioral" || interviewType === "mixed";
	const needsDsa = interviewType === "dsa" || interviewType === "mixed";

	const addQuestion = () => setQuestions([...questions, ""]);
	const removeQuestion = (idx: number) => {
		if (questions.length <= 1) return;
		setQuestions(questions.filter((_, i) => i !== idx));
	};
	const updateQuestion = (idx: number, value: string) => {
		const updated = [...questions];
		updated[idx] = value;
		setQuestions(updated);
	};

	const handleGenerateDsa = async () => {
		if (!targetRole.trim()) {
			setError("Enter a target role before generating DSA problems.");
			return;
		}
		setIsGeneratingDsa(true);
		setError(null);
		try {
			const data = await api.post<{ problems: DsaProblem[] }>(
				"/api/interviews/generate-dsa",
				{
					targetRole: targetRole.trim(),
					difficulty: dsaDifficulty,
					count: dsaCount,
				},
			);
			if (!data.problems?.length) {
				throw new Error("No problems generated. Try again.");
			}
			setDsaProblems(data.problems);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to generate DSA problems");
		} finally {
			setIsGeneratingDsa(false);
		}
	};

	const removeDsaProblem = (idx: number) => {
		setDsaProblems((prev) => prev.filter((_, i) => i !== idx));
	};

	const handleSubmit = async () => {
		if (!title || !targetRole || !selectedOrgId || !expiresAt) {
			setError(
				"Please fill in title, role, organization, and expiration date.",
			);
			return;
		}
		const validQuestions = questions.filter((q) => q.trim());
		if (needsBehavioral && validQuestions.length === 0) {
			setError("Add at least one behavioral question.");
			return;
		}
		if (needsDsa && dsaProblems.length === 0) {
			setError("Generate or add at least one DSA problem.");
			return;
		}

		setIsSubmitting(true);
		setError(null);
		try {
			await api.post("/api/interviews", {
				title,
				targetRole,
				description,
				interviewType,
				questions: needsBehavioral ? validQuestions : [],
				dsaProblems: needsDsa ? dsaProblems : [],
				dsaDifficulty,
				expiresAt,
				organizationId: selectedOrgId,
				status: "active",
			});
			navigate("/recruiter");
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsSubmitting(false);
		}
	};

	const typeOptions: {
		value: InterviewType;
		label: string;
		desc: string;
		icon: React.ReactNode;
	}[] = [
		{
			value: "behavioral",
			label: "Behavioral",
			desc: "Voice Q&A only",
			icon: <Mic className="h-4 w-4" />,
		},
		{
			value: "dsa",
			label: "DSA only",
			desc: "Coding problems",
			icon: <Code2 className="h-4 w-4" />,
		},
		{
			value: "mixed",
			label: "Mixed",
			desc: "Voice then coding",
			icon: <Layers className="h-4 w-4" />,
		},
	];

	return (
		<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 mt-14">
			<div className="max-w-3xl mx-auto space-y-6">
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
							Create Interview Session
						</h1>
						<p className="text-[13px] text-muted-foreground">
							Set up behavioral, DSA, or mixed first-round interviews.
						</p>
					</div>
				</div>

				{/* Form card */}
				<div className="border border-border rounded-[20px] bg-card p-6 space-y-5">
					{error && (
						<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-[20px] border border-destructive/20 text-center">
							{error}
						</div>
					)}

					<div className="space-y-1.5">
						<Label className="text-muted-foreground">Organization</Label>
						<select
							value={selectedOrgId}
							onChange={(e) => setSelectedOrgId(e.target.value)}
							className="w-full h-9 px-3 rounded-[20px] border border-border bg-background text-[13px] focus:border-primary/50 focus:outline-none"
						>
							{organizations.length === 0 && (
								<option value="">No organizations found</option>
							)}
							{organizations.map((org) => (
								<option key={org._id} value={org._id}>
									{org.name}
								</option>
							))}
						</select>
					</div>

					<div className="space-y-1.5">
						<Label className="text-muted-foreground">Interview Title</Label>
						<Input
							placeholder="e.g., Senior Frontend Engineer — Round 1"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							maxLength={300}
							className="text-[13px]"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-muted-foreground">Target Role</Label>
						<Input
							placeholder="e.g., Senior Software Engineer"
							value={targetRole}
							onChange={(e) => setTargetRole(e.target.value)}
							className="text-[13px]"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-muted-foreground">
							Description (optional)
						</Label>
						<Input
							placeholder="Brief description of the interview purpose"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							maxLength={2000}
							className="text-[13px]"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-muted-foreground">Expires At</Label>
						<Input
							type="datetime-local"
							value={expiresAt}
							onChange={(e) => setExpiresAt(e.target.value)}
							className="text-[13px]"
						/>
					</div>

					{/* Interview type */}
					<div className="space-y-2">
						<Label className="text-muted-foreground">Interview format</Label>
						<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
							{typeOptions.map((opt) => (
								<button
									key={opt.value}
									type="button"
									onClick={() => setInterviewType(opt.value)}
									className={`flex items-start gap-3 p-3.5 rounded-[14px] border text-left transition-all ${
										interviewType === opt.value
											? "border-primary bg-primary/10"
											: "border-border bg-background hover:border-primary/40"
									}`}
								>
									<span
										className={
											interviewType === opt.value
												? "text-primary mt-0.5"
												: "text-muted-foreground mt-0.5"
										}
									>
										{opt.icon}
									</span>
									<span>
										<span className="block text-[13px] font-semibold text-foreground">
											{opt.label}
										</span>
										<span className="block text-[11px] text-muted-foreground">
											{opt.desc}
										</span>
									</span>
								</button>
							))}
						</div>
					</div>

					{/* Behavioral questions */}
					{needsBehavioral && (
						<div className="space-y-3 pt-2 border-t border-border">
							<div className="flex items-center justify-between">
								<Label className="text-muted-foreground flex items-center gap-1.5">
									<Mic className="h-3.5 w-3.5" /> Behavioral questions
								</Label>
								<Button
									variant="ghost"
									size="sm"
									onClick={addQuestion}
									className="text-primary font-medium h-7 text-[12px] gap-1"
								>
									<Plus className="h-3 w-3" /> Add
								</Button>
							</div>
							<div className="space-y-2">
								{questions.map((q, idx) => (
									<div key={idx} className="flex items-start gap-2">
										<span className="text-[12px] font-bold text-muted-foreground mt-2 w-5 text-right shrink-0">
											{idx + 1}.
										</span>
										<Input
											placeholder={`Question ${idx + 1}`}
											value={q}
											onChange={(e) => updateQuestion(idx, e.target.value)}
											className="flex-1 text-[13px]"
										/>
										<Button
											variant="ghost"
											size="icon"
											onClick={() => removeQuestion(idx)}
											className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0"
											disabled={questions.length <= 1}
										>
											<Trash2 className="h-3.5 w-3.5" />
										</Button>
									</div>
								))}
							</div>
						</div>
					)}

					{/* DSA problems */}
					{needsDsa && (
						<div className="space-y-3 pt-2 border-t border-border">
							<div className="flex items-center justify-between">
								<Label className="text-muted-foreground flex items-center gap-1.5">
									<Code2 className="h-3.5 w-3.5" /> DSA problems
								</Label>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
								<div className="space-y-1.5">
									<Label className="text-[11px] text-muted-foreground">
										Difficulty
									</Label>
									<select
										value={dsaDifficulty}
										onChange={(e) => setDsaDifficulty(e.target.value)}
										className="w-full h-9 px-3 rounded-[10px] border border-border bg-background text-[13px] focus:outline-none focus:border-primary/50"
									>
										<option value="easy">Easy</option>
										<option value="medium">Medium</option>
										<option value="hard">Hard</option>
										<option value="mixed">Mixed</option>
									</select>
								</div>
								<div className="space-y-1.5">
									<Label className="text-[11px] text-muted-foreground">
										Count
									</Label>
									<select
										value={dsaCount}
										onChange={(e) => setDsaCount(Number(e.target.value))}
										className="w-full h-9 px-3 rounded-[10px] border border-border bg-background text-[13px] focus:outline-none focus:border-primary/50"
									>
										{[1, 2, 3].map((n) => (
											<option key={n} value={n}>
												{n}
											</option>
										))}
									</select>
								</div>
								<div className="flex items-end">
									<Button
										type="button"
										variant="outline"
										onClick={handleGenerateDsa}
										disabled={isGeneratingDsa}
										className="w-full font-medium gap-1.5 h-9"
									>
										{isGeneratingDsa ? (
											<>
												<Loader2 className="h-3.5 w-3.5 animate-spin" />{" "}
												Generating...
											</>
										) : (
											<>
												<Sparkles className="h-3.5 w-3.5" /> AI Generate
											</>
										)}
									</Button>
								</div>
							</div>

							{dsaProblems.length === 0 ? (
								<div className="border border-dashed border-border rounded-[14px] p-8 text-center text-[12px] text-muted-foreground">
									Generate AI-powered DSA problems tailored to the target role.
								</div>
							) : (
								<div className="space-y-2">
									{dsaProblems.map((p, idx) => (
										<div
											key={idx}
											className="flex items-start gap-3 p-3 border border-border rounded-[12px] bg-secondary/10"
										>
											<span className="text-[12px] font-bold text-muted-foreground mt-0.5">
												{idx + 1}.
											</span>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 flex-wrap">
													<p className="text-[13px] font-semibold text-foreground truncate">
														{p.title}
													</p>
													<span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-border text-muted-foreground">
														{p.difficulty}
													</span>
												</div>
												<p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
													{p.description}
												</p>
												{p.topics && p.topics.length > 0 && (
													<p className="text-[10px] text-muted-foreground/70 mt-1">
														{p.topics.join(" · ")}
													</p>
												)}
											</div>
											<Button
												variant="ghost"
												size="icon"
												onClick={() => removeDsaProblem(idx)}
												className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
											>
												<Trash2 className="h-3.5 w-3.5" />
											</Button>
										</div>
									))}
								</div>
							)}
						</div>
					)}

					{/* Actions */}
					<div className="flex gap-3 pt-4 border-t border-border">
						<Button
							onClick={handleSubmit}
							disabled={isSubmitting || isGeneratingDsa}
							className="font-semibold px-6 gap-2"
						>
							{isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
							{isSubmitting ? "Creating..." : "Create Interview"}
						</Button>
						<Button
							variant="ghost"
							onClick={() => navigate(-1)}
							className="font-medium"
						>
							Cancel
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default InterviewSetup;
