import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	ArrowLeft,
	Loader2,
	AlertCircle,
	Code2,
	CheckCircle2,
} from "lucide-react";
import { api } from "@/lib/api";
import DsaRound, { type DsaEvaluation } from "@/components/DsaRound";
import type { DsaProblem } from "@/components/DsaProblemPanel";
import type { CodeLanguage } from "@/components/CodeEditor";

const DIFFICULTIES = [
	{ value: "easy", label: "Easy" },
	{ value: "medium", label: "Medium" },
	{ value: "hard", label: "Hard" },
	{ value: "mixed", label: "Mixed" },
];

const DsaPractice: React.FC = () => {
	const navigate = useNavigate();
	const [step, setStep] = useState<"setup" | "round" | "done">("setup");
	const [targetRole, setTargetRole] = useState("Software Engineer");
	const [difficulty, setDifficulty] = useState("medium");
	const [count, setCount] = useState(2);
	const [problems, setProblems] = useState<DsaProblem[]>([]);
	const [results, setResults] = useState<DsaEvaluation[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const handleStart = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await api.post<{ problems: DsaProblem[] }>(
				"/api/rehearsal/dsa/start",
				{ targetRole, difficulty, count },
			);
			if (!data.problems?.length) {
				throw new Error("No problems were generated. Please try again.");
			}
			setProblems(data.problems);
			setStep("round");
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Failed to start DSA practice");
		} finally {
			setIsLoading(false);
		}
	};

	const handleEvaluate = async (payload: {
		problemIndex: number;
		problem: DsaProblem;
		language: CodeLanguage;
		code: string;
		timeSpentSeconds: number;
	}): Promise<DsaEvaluation> => {
		const data = await api.post<DsaEvaluation>("/api/rehearsal/dsa/evaluate", {
			title: payload.problem.title,
			description: payload.problem.description,
			difficulty: payload.problem.difficulty,
			constraints: payload.problem.constraints,
			examples: payload.problem.examples,
			topics: payload.problem.topics,
			expectedApproach: payload.problem.expectedApproach,
			language: payload.language,
			code: payload.code,
			timeSpentSeconds: payload.timeSpentSeconds,
		});
		return {
			...data,
			problemTitle: payload.problem.title,
			problemIndex: payload.problemIndex,
			language: payload.language,
			code: payload.code,
			timeSpentSeconds: payload.timeSpentSeconds,
		};
	};

	const handleComplete = async (sessionResults: DsaEvaluation[]) => {
		setResults(sessionResults);
		try {
			await api.post("/api/rehearsal/session", {
				sessionType: "dsa",
				targetRole,
				dsaResults: sessionResults.map((r) => ({
					problemTitle: r.problemTitle,
					problemIndex: r.problemIndex,
					language: r.language,
					code: r.code,
					score: r.score,
					correctness: r.correctness,
					codeQuality: r.codeQuality,
					timeComplexity: r.timeComplexity,
					spaceComplexity: r.spaceComplexity,
					feedback: r.feedback,
					strengths: r.strengths || [],
					improvements: r.improvements || [],
					timeSpentSeconds: r.timeSpentSeconds,
				})),
			});
		} catch {
			// Non-fatal — still show results
		}
		setStep("done");
	};

	if (step === "done") {
		const avg =
			results.length > 0
				? (
						results.reduce((a, r) => a + (r.score || 0), 0) / results.length
					).toFixed(1)
				: "—";
		return (
			<div className="min-h-screen bg-background flex items-center justify-center p-4 mt-14">
				<div className="w-full max-w-md border border-border rounded-[20px] bg-card p-8 text-center space-y-5">
					<div className="w-14 h-14 bg-success/10 rounded-full flex items-center justify-center mx-auto">
						<CheckCircle2 className="w-7 h-7 text-success" />
					</div>
					<div className="space-y-1.5">
						<h2 className="text-xl font-bold">DSA practice complete</h2>
						<p className="text-[13px] text-muted-foreground">
							Average score:{" "}
							<span className="font-bold text-foreground">{avg}/10</span>
						</p>
					</div>
					<div className="space-y-1.5 text-left">
						{results.map((r, i) => (
							<div
								key={i}
								className="flex items-center justify-between p-2.5 bg-surface rounded-[12px] text-[13px]"
							>
								<span className="font-medium truncate mr-2">{r.problemTitle}</span>
								<span className="font-bold text-primary shrink-0">
									{r.score}/10
								</span>
							</div>
						))}
					</div>
					<div className="flex flex-col gap-2">
						<Button
							onClick={() => {
								setStep("setup");
								setProblems([]);
								setResults([]);
							}}
							className="w-full font-semibold"
						>
							Practice again
						</Button>
						<Button
							variant="ghost"
							onClick={() => navigate("/dashboard")}
							className="w-full font-medium"
						>
							Back to dashboard
						</Button>
					</div>
				</div>
			</div>
		);
	}

	if (step === "round") {
		return (
			<div className="min-h-screen bg-background flex flex-col pt-14">
				<DsaRound
					problems={problems}
					onEvaluate={handleEvaluate}
					onComplete={handleComplete}
				/>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 mt-14">
			<div className="max-w-lg mx-auto space-y-6">
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
						<h1 className="text-xl font-bold tracking-[-0.02em] text-foreground flex items-center gap-2">
							<Code2 className="h-5 w-5 text-primary" /> DSA Practice
						</h1>
						<p className="text-[13px] text-muted-foreground">
							AI-generated coding problems with automated evaluation.
						</p>
					</div>
				</div>

				<div className="border border-border rounded-[20px] bg-card p-6 space-y-5">
					{error && (
						<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-[12px] border border-destructive/20 text-center">
							{error}
						</div>
					)}

					<div className="space-y-1.5">
						<Label className="text-muted-foreground">Target role</Label>
						<Input
							value={targetRole}
							onChange={(e) => setTargetRole(e.target.value)}
							placeholder="e.g., Backend Engineer"
							className="text-[13px]"
						/>
					</div>

					<div className="space-y-1.5">
						<Label className="text-muted-foreground">Difficulty</Label>
						<div className="grid grid-cols-4 gap-2">
							{DIFFICULTIES.map((d) => (
								<button
									key={d.value}
									type="button"
									onClick={() => setDifficulty(d.value)}
									className={`h-9 rounded-[10px] text-[12px] font-semibold border transition-colors ${
										difficulty === d.value
											? "bg-primary/15 border-primary text-primary"
											: "bg-background border-border text-muted-foreground hover:border-primary/40"
									}`}
								>
									{d.label}
								</button>
							))}
						</div>
					</div>

					<div className="space-y-1.5">
						<Label className="text-muted-foreground">Number of problems</Label>
						<select
							value={count}
							onChange={(e) => setCount(Number(e.target.value))}
							className="w-full h-9 px-3 rounded-[10px] border border-border bg-background text-[13px] focus:border-primary/50 focus:outline-none"
						>
							{[1, 2, 3].map((n) => (
								<option key={n} value={n}>
									{n} problem{n > 1 ? "s" : ""}
								</option>
							))}
						</select>
					</div>

					<div className="rounded-[12px] border border-border/60 bg-secondary/15 p-3 text-[12px] text-muted-foreground leading-relaxed">
						You will write solutions in Python, JavaScript, Java, or C++. AI
						reviews correctness, code quality, and complexity after each
						submission.
					</div>

					<Button
						onClick={handleStart}
						disabled={isLoading || !targetRole.trim()}
						className="w-full font-semibold gap-2"
					>
						{isLoading ? (
							<>
								<Loader2 className="h-4 w-4 animate-spin" /> Generating problems...
							</>
						) : (
							<>
								Start DSA practice <Code2 className="h-4 w-4" />
							</>
						)}
					</Button>
				</div>

				{isLoading && (
					<div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
						<AlertCircle className="h-3.5 w-3.5" />
						This may take up to a minute while problems are generated.
					</div>
				)}
			</div>
		</div>
	);
};

export default DsaPractice;
