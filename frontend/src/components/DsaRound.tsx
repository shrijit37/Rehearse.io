import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
	ArrowRight,
	Loader2,
	AlertCircle,
	CheckCircle2,
	Clock,
	Code2,
} from "lucide-react";
import CodeEditor, { type CodeLanguage } from "@/components/CodeEditor";
import DsaProblemPanel, { type DsaProblem } from "@/components/DsaProblemPanel";

export interface DsaEvaluation {
	score: number;
	correctness: number;
	codeQuality: number;
	timeComplexity: string;
	spaceComplexity: string;
	feedback: string;
	strengths?: string[];
	improvements?: string[];
	problemTitle: string;
	problemIndex: number;
	language: string;
	code: string;
	timeSpentSeconds: number;
}

interface DsaRoundProps {
	problems: DsaProblem[];
	/** Called when candidate submits a problem for AI evaluation */
	onEvaluate: (payload: {
		problemIndex: number;
		problem: DsaProblem;
		language: CodeLanguage;
		code: string;
		timeSpentSeconds: number;
	}) => Promise<DsaEvaluation>;
	/** Called after all problems are evaluated / finished */
	onComplete: (results: DsaEvaluation[]) => void;
	/** Optional initial results (resume) */
	initialResults?: DsaEvaluation[];
	/** Optional starting problem index */
	initialIndex?: number;
}

const DEFAULT_STARTERS: Record<CodeLanguage, string> = {
	python: "def solution(...):\n    # Write your solution here\n    pass\n",
	javascript: "function solution(...) {\n  // Write your solution here\n}\n",
	java: "class Solution {\n    public Object solution() {\n        // Write your solution here\n        return null;\n    }\n}\n",
	cpp: "class Solution {\npublic:\n    // Write your solution here\n};\n",
};

const DsaRound: React.FC<DsaRoundProps> = ({
	problems,
	onEvaluate,
	onComplete,
	initialResults = [],
	initialIndex = 0,
}) => {
	const [currentIndex, setCurrentIndex] = useState(initialIndex);
	const [language, setLanguage] = useState<CodeLanguage>("python");
	const [code, setCode] = useState("");
	const [isEvaluating, setIsEvaluating] = useState(false);
	const [evaluation, setEvaluation] = useState<DsaEvaluation | null>(null);
	const [results, setResults] = useState<DsaEvaluation[]>(initialResults);
	const [error, setError] = useState<string | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const startTimeRef = useRef(Date.now());
	const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const problem = problems[currentIndex];
	const isLast = currentIndex >= problems.length - 1;
	const progressPercent = ((currentIndex + 1) / problems.length) * 100;

	const loadStarter = useCallback(
		(idx: number, lang: CodeLanguage) => {
			const p = problems[idx];
			const starter =
				p?.starterCode?.[lang] ||
				p?.starterCode?.python ||
				DEFAULT_STARTERS[lang];
			setCode(starter);
		},
		[problems],
	);

	// Load starter when problem or language changes (if no evaluation showing)
	useEffect(() => {
		if (!evaluation) {
			loadStarter(currentIndex, language);
			startTimeRef.current = Date.now();
			setElapsed(0);
		}
	}, [currentIndex, language]); // eslint-disable-line react-hooks/exhaustive-deps

	// Elapsed timer
	useEffect(() => {
		timerRef.current = setInterval(() => {
			setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
		}, 1000);
		return () => {
			if (timerRef.current) clearInterval(timerRef.current);
		};
	}, [currentIndex]);

	const formatTime = (s: number) => {
		const m = Math.floor(s / 60)
			.toString()
			.padStart(2, "0");
		const sec = (s % 60).toString().padStart(2, "0");
		return `${m}:${sec}`;
	};

	const handleLanguageChange = (lang: CodeLanguage) => {
		if (evaluation) return;
		setLanguage(lang);
	};

	const handleSubmit = async () => {
		if (!problem || isEvaluating) return;
		if (!code.trim()) {
			setError("Please write some code before submitting.");
			return;
		}
		setIsEvaluating(true);
		setError(null);
		const timeSpentSeconds = Math.floor(
			(Date.now() - startTimeRef.current) / 1000,
		);
		try {
			const result = await onEvaluate({
				problemIndex: currentIndex,
				problem,
				language,
				code,
				timeSpentSeconds,
			});
			const full: DsaEvaluation = {
				...result,
				problemTitle: problem.title,
				problemIndex: currentIndex,
				language,
				code,
				timeSpentSeconds,
			};
			setEvaluation(full);
			setResults((prev) => {
				const next = [...prev];
				const existing = next.findIndex((r) => r.problemIndex === currentIndex);
				if (existing >= 0) next[existing] = full;
				else next.push(full);
				return next;
			});
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "Evaluation failed. Please try again.");
		} finally {
			setIsEvaluating(false);
		}
	};

	const handleNext = () => {
		if (isLast) {
			onComplete(results);
			return;
		}
		setEvaluation(null);
		setError(null);
		setCurrentIndex((i) => i + 1);
	};

	const handleRetry = () => {
		setEvaluation(null);
		setError(null);
		startTimeRef.current = Date.now();
		setElapsed(0);
	};

	if (!problem) {
		return (
			<div className="flex items-center justify-center p-12">
				<p className="text-[13px] text-muted-foreground">No problems available.</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full min-h-0">
			{/* Progress header */}
			<div className="border-b border-border bg-surface/80 py-3 px-4 sm:px-6">
				<div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
					<div className="flex items-center gap-3">
						<Code2 className="h-4 w-4 text-primary" />
						<span className="text-[12px] font-semibold text-foreground">
							DSA Round · Problem {currentIndex + 1} of {problems.length}
						</span>
					</div>
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground">
							<Clock className="h-3.5 w-3.5" />
							{formatTime(elapsed)}
						</div>
						<div className="flex items-center gap-3 w-36 sm:w-48">
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
			</div>

			{/* Main split */}
			<div className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
				{/* Problem statement */}
				<div className="lg:col-span-5 min-h-[280px] lg:min-h-0 lg:h-[calc(100vh-11rem)]">
					<DsaProblemPanel
						problem={problem}
						problemNumber={currentIndex + 1}
						totalProblems={problems.length}
					/>
				</div>

				{/* Editor + actions */}
				<div className="lg:col-span-7 flex flex-col gap-3 min-h-[360px] lg:h-[calc(100vh-11rem)]">
					{error && (
						<div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-[12px] border border-destructive/20 flex items-center gap-2">
							<AlertCircle className="w-4 h-4 shrink-0" />
							<span>{error}</span>
						</div>
					)}

					{evaluation ? (
						<div className="flex-1 border border-border rounded-[16px] bg-card overflow-hidden flex flex-col">
							<div className="border-b border-border px-5 py-3.5 bg-secondary/15 flex items-center justify-between">
								<div className="flex items-center gap-2">
									<CheckCircle2 className="h-4 w-4 text-success" />
									<span className="text-[13px] font-bold">Evaluation</span>
								</div>
								<span className="text-xl font-bold text-foreground">
									{evaluation.score}
									<span className="text-[11px] text-muted-foreground">/10</span>
								</span>
							</div>
							<div className="flex-1 overflow-y-auto p-5 space-y-4">
								<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
									{[
										{ label: "Correctness", value: evaluation.correctness },
										{ label: "Code Quality", value: evaluation.codeQuality },
										{ label: "Time", value: evaluation.timeComplexity },
										{ label: "Space", value: evaluation.spaceComplexity },
									].map((m) => (
										<div
											key={m.label}
											className="rounded-[10px] border border-border/60 bg-secondary/20 p-2.5 text-center"
										>
											<p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
												{m.label}
											</p>
											<p className="text-[13px] font-bold mt-0.5 font-mono">
												{typeof m.value === "number" ? `${m.value}/10` : m.value}
											</p>
										</div>
									))}
								</div>
								<div className="space-y-1">
									<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
										Feedback
									</p>
									<p className="text-[13px] leading-relaxed">{evaluation.feedback}</p>
								</div>
								{evaluation.strengths && evaluation.strengths.length > 0 && (
									<div className="space-y-1">
										<p className="text-[10px] font-bold uppercase tracking-wider text-success">
											Strengths
										</p>
										<ul className="list-disc list-inside text-[12px] space-y-0.5 text-foreground/90">
											{evaluation.strengths.map((s, i) => (
												<li key={i}>{s}</li>
											))}
										</ul>
									</div>
								)}
								{evaluation.improvements && evaluation.improvements.length > 0 && (
									<div className="space-y-1">
										<p className="text-[10px] font-bold uppercase tracking-wider text-warning">
											Improvements
										</p>
										<ul className="list-disc list-inside text-[12px] space-y-0.5 text-foreground/90">
											{evaluation.improvements.map((s, i) => (
												<li key={i}>{s}</li>
											))}
										</ul>
									</div>
								)}
							</div>
							<div className="border-t border-border p-4 flex justify-end gap-2">
								<Button variant="outline" size="sm" onClick={handleRetry} className="font-medium">
									Revise & resubmit
								</Button>
								<Button onClick={handleNext} size="sm" className="font-medium gap-1">
									{isLast ? "Finish DSA round" : "Next problem"}{" "}
									<ArrowRight className="h-3.5 w-3.5" />
								</Button>
							</div>
						</div>
					) : (
						<>
							<div className="flex-1 min-h-0">
								<CodeEditor
									value={code}
									onChange={setCode}
									language={language}
									onLanguageChange={handleLanguageChange}
									minHeight="100%"
									className="h-full"
								/>
							</div>
							<div className="flex items-center justify-between gap-3 pt-1">
								<p className="text-[11px] text-muted-foreground">
									Tab inserts 4 spaces. Submit when ready for AI review.
								</p>
								<Button
									onClick={handleSubmit}
									disabled={isEvaluating}
									className="font-semibold gap-2 shrink-0 min-w-[140px]"
								>
									{isEvaluating ? (
										<>
											<Loader2 className="h-4 w-4 animate-spin" /> Evaluating...
										</>
									) : (
										<>
											Submit solution <ArrowRight className="h-3.5 w-3.5" />
										</>
									)}
								</Button>
							</div>
						</>
					)}
				</div>
			</div>
		</div>
	);
};

export default DsaRound;
