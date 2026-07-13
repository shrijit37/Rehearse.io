import React from "react";
import { BarChart3, MessageSquare, Code2 } from "lucide-react";
import type { ResultItem, DsaResultItem } from "@/types";

interface ResultDetailPanelProps {
	title: string;
	targetRole: string;
	results: ResultItem[];
	dsaResults?: DsaResultItem[];
}

const ResultDetailPanel: React.FC<ResultDetailPanelProps> = ({
	title,
	targetRole,
	results,
	dsaResults = [],
}) => {
	const behavioralAvg =
		results.length > 0
			? (() => {
					const valid = results.filter(
						(r): r is ResultItem & { score: number } => r.score != null,
					);
					return valid.length > 0
						? (valid.reduce((acc, r) => acc + r.score, 0) / valid.length).toFixed(1)
						: "—";
				})()
			: "—";

	return (
		<div className="border border-border/80 rounded-[20px] bg-card overflow-hidden animate-in fade-in duration-200">
			<div className="border-b border-border/60 bg-secondary/15 px-6 py-4 flex items-center justify-between">
				<div className="space-y-1">
					<span className="text-[10px] font-bold bg-primary/10 text-primary border border-primary/15 rounded px-2 py-0.5 uppercase tracking-wider">
						{targetRole}
					</span>
					<h3 className="text-base font-bold text-foreground flex items-center gap-1.5 pt-1">
						<BarChart3 className="h-4 w-4 text-primary" />
						{title}
					</h3>
				</div>
				<div className="text-right">
					<span className="text-[9px] font-bold text-muted-foreground uppercase block">
						Score
					</span>
					<span className="text-xl font-bold">
						{behavioralAvg}
						<span className="text-[11px] text-muted-foreground">/10</span>
					</span>
				</div>
			</div>
			<div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
				{results.map((result: ResultItem, idx: number) => (
					<div
						key={result.question || idx}
						className="border border-border/50 rounded-[20px] p-4 space-y-3"
					>
						<div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2.5">
							<div className="flex items-start gap-2">
								<span className="text-[11px] font-bold text-primary pt-px">
									{idx + 1}.
								</span>
								<h4 className="text-[13px] font-semibold text-foreground leading-snug">
									{result.question}
								</h4>
							</div>
							<span className="shrink-0 px-2 py-0.5 bg-secondary text-[11px] font-bold rounded border border-border">
								{result.score != null ? `${result.score}/10` : "—"}
							</span>
						</div>
						{result.transcription && (
							<div className="space-y-1">
								<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
									<MessageSquare className="h-3 w-3" /> Transcription
								</span>
								<div className="bg-secondary/40 border-l-2 border-l-primary text-[12px] text-foreground/80 italic p-2.5 rounded-r-md leading-relaxed">
									{result.transcription}
								</div>
							</div>
						)}
						<div className="space-y-1">
							<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
								AI Feedback
							</span>
							<p className="text-[13px] text-foreground leading-relaxed">
								{result.feedback}
							</p>
						</div>
					</div>
				))}

				{dsaResults.length > 0 && (
					<div className="pt-2 space-y-3">
						<p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
							<Code2 className="h-3 w-3" /> DSA Results
						</p>
						{dsaResults.map((r, idx) => (
							<div
								key={`dsa-${idx}`}
								className="border border-border/50 rounded-[20px] p-4 space-y-3"
							>
								<div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2.5">
									<div className="flex items-start gap-2">
										<span className="text-[11px] font-bold text-primary pt-px">
											{idx + 1}.
										</span>
										<h4 className="text-[13px] font-semibold text-foreground leading-snug">
											{r.problemTitle}
										</h4>
									</div>
									<span className="shrink-0 px-2 py-0.5 bg-secondary text-[11px] font-bold rounded border border-border">
										{r.score != null ? `${r.score}/10` : "—"}
									</span>
								</div>
								<div className="flex flex-wrap gap-2 text-[11px]">
									{r.correctness != null && (
										<span className="px-2 py-0.5 rounded bg-secondary/60 border border-border">
											Correctness: {r.correctness}/10
										</span>
									)}
									{r.codeQuality != null && (
										<span className="px-2 py-0.5 rounded bg-secondary/60 border border-border">
											Code Quality: {r.codeQuality}/10
										</span>
									)}
									{r.language && (
										<span className="px-2 py-0.5 rounded bg-secondary/60 border border-border">
											{r.language}
										</span>
									)}
								</div>
								{(r.timeComplexity || r.spaceComplexity) && (
									<div className="text-[12px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
										{r.timeComplexity && <span>Time: {r.timeComplexity}</span>}
										{r.spaceComplexity && (
											<span>Space: {r.spaceComplexity}</span>
										)}
									</div>
								)}
								{r.code && (
									<div className="space-y-1">
										<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											Submitted Code
										</span>
										<pre className="bg-secondary/40 border border-border rounded-md p-2.5 text-[11px] text-foreground/80 overflow-x-auto">
											<code>{r.code}</code>
										</pre>
									</div>
								)}
								{r.feedback && (
									<div className="space-y-1">
										<span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
											AI Feedback
										</span>
										<p className="text-[13px] text-foreground leading-relaxed">
											{r.feedback}
										</p>
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

export default ResultDetailPanel;
