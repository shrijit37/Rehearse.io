import React from "react";
import { Tag } from "lucide-react";

export interface DsaExample {
	input: string;
	output: string;
	explanation?: string;
}

export interface DsaProblem {
	_id?: string;
	title: string;
	description: string;
	difficulty: "easy" | "medium" | "hard" | string;
	constraints?: string;
	examples?: DsaExample[];
	topics?: string[];
	starterCode?: {
		python?: string;
		javascript?: string;
		java?: string;
		cpp?: string;
	};
	expectedApproach?: string;
}

const difficultyStyles: Record<string, string> = {
	easy: "bg-success/15 text-success border-success/30",
	medium: "bg-warning/15 text-warning border-warning/30",
	hard: "bg-destructive/15 text-destructive border-destructive/30",
};

interface DsaProblemPanelProps {
	problem: DsaProblem;
	problemNumber?: number;
	totalProblems?: number;
}

const DsaProblemPanel: React.FC<DsaProblemPanelProps> = ({
	problem,
	problemNumber,
	totalProblems,
}) => {
	const diff = (problem.difficulty || "medium").toLowerCase();

	return (
		<div className="h-full flex flex-col overflow-hidden border border-border rounded-[16px] bg-card">
			<div className="border-b border-border px-5 py-3.5 bg-secondary/15 flex items-start justify-between gap-3">
				<div className="min-w-0">
					{problemNumber != null && totalProblems != null && (
						<p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
							Problem {problemNumber} of {totalProblems}
						</p>
					)}
					<h2 className="text-[15px] font-bold text-foreground leading-snug">
						{problem.title}
					</h2>
				</div>
				<span
					className={`shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border ${
						difficultyStyles[diff] || difficultyStyles.medium
					}`}
				>
					{diff}
				</span>
			</div>

			<div className="flex-1 overflow-y-auto p-5 space-y-5">
				{/* Description */}
				<section className="space-y-2">
					<h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
						Description
					</h3>
					<p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap">
						{problem.description}
					</p>
				</section>

				{/* Examples */}
				{problem.examples && problem.examples.length > 0 && (
					<section className="space-y-3">
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
							Examples
						</h3>
						{problem.examples.map((ex, i) => (
							<div
								key={i}
								className="rounded-[10px] border border-border/60 bg-secondary/20 p-3 space-y-1.5"
							>
								<p className="text-[11px] font-semibold text-muted-foreground">
									Example {i + 1}
								</p>
								<div className="font-mono text-[12px] space-y-1">
									<p>
										<span className="text-muted-foreground">Input: </span>
										<span className="text-foreground">{ex.input}</span>
									</p>
									<p>
										<span className="text-muted-foreground">Output: </span>
										<span className="text-primary">{ex.output}</span>
									</p>
									{ex.explanation && (
										<p className="text-[11px] text-muted-foreground font-sans pt-1">
											{ex.explanation}
										</p>
									)}
								</div>
							</div>
						))}
					</section>
				)}

				{/* Constraints */}
				{problem.constraints && (
					<section className="space-y-2">
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-primary">
							Constraints
						</h3>
						<pre className="text-[12px] font-mono text-muted-foreground whitespace-pre-wrap leading-relaxed">
							{problem.constraints}
						</pre>
					</section>
				)}

				{/* Topics */}
				{problem.topics && problem.topics.length > 0 && (
					<section className="space-y-2">
						<h3 className="text-[10px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
							<Tag className="h-3 w-3" /> Topics
						</h3>
						<div className="flex flex-wrap gap-1.5">
							{problem.topics.map((t) => (
								<span
									key={t}
									className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-secondary border border-border text-muted-foreground"
								>
									{t}
								</span>
							))}
						</div>
					</section>
				)}
			</div>
		</div>
	);
};

export default DsaProblemPanel;
