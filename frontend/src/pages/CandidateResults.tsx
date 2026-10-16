import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	ArrowLeft,
	AlertCircle,
	Mic,
	Code2,
	Copy,
	Check,
	Users,
} from "lucide-react";
import { api } from "@/lib/api";
import { label } from "@/lib/labels";
import type { Interview, CandidateInvite, ResultItem, DsaResultItem } from "@/types";

/* Four states, each carried by a mark and a word as well as a plate,
   so the register stays readable with colour removed. */
type CandState = "complete" | "in-progress" | "not-started" | "not-scored";

const STATE: Record<CandState, { label: string; mark: string; cls: string }> = {
	complete: {
		label: "Complete",
		mark: "✓",
		cls: "bg-sign-black text-sign-white border-sign-black",
	},
	"in-progress": {
		label: "In progress",
		mark: "▸",
		cls: "bg-card text-foreground border-sign-black",
	},
	"not-started": {
		label: "Not started",
		mark: "○",
		cls: "border-dashed border-muted-foreground text-muted-foreground",
	},
	"not-scored": {
		label: "Not scored",
		mark: "▲",
		cls: "state-hatch border-warning text-warning",
	},
};

type SortKey = "name" | "round" | "behavioral" | "dsa" | "correctness" | "quality" | "state";

/** Round order is the route's order, not the alphabet's. */
const ROUND_RANK: Record<string, number> = { behavioral: 0, dsa: 1, done: 2 };

const mean = (xs: (number | null | undefined)[]): number | null => {
	const v = xs.filter((x): x is number => x != null);
	return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** One decimal only when the value isn't whole: 8, not 8.0 */
const show = (v: number | null) => (v == null ? "—" : Number.isInteger(v) ? String(v) : v.toFixed(1));

const ScoreCell = ({ value }: { value: number | null }) => (
	<span className="score" data-s={value == null ? "none" : String(Math.round(value))}>
		{show(value)}
	</span>
);

const CandidateResults: React.FC = () => {
	const navigate = useNavigate();
	const { id } = useParams<{ id: string }>();
	const [interview, setInterview] = useState<Interview | null>(null);
	const [candidates, setCandidates] = useState<CandidateInvite[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [expanded, setExpanded] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [stateFilter, setStateFilter] = useState<"all" | CandState>("all");
	const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!id) {
			navigate("/recruiter");
			return;
		}
		fetchData();
	}, [id]); // eslint-disable-line react-hooks/exhaustive-deps

	const fetchData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const data = await api.get<{ interview: Interview; candidates: CandidateInvite[] }>(
				`/api/interviews/${id}`,
			);
			setInterview(data.interview);
			setCandidates(data.candidates || []);
			if (data.candidates?.length) setExpanded(data.candidates[0]._id);
		} catch (err: unknown) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const nameOf = (c: CandidateInvite) =>
		c.candidate && typeof c.candidate === "object" ? c.candidate.name || "Candidate" : "Candidate";
	const emailOf = (c: CandidateInvite) =>
		c.candidate && typeof c.candidate === "object" ? c.candidate.email || "" : "";

	const behavioralOf = (c: CandidateInvite) => mean((c.results || []).map((r) => r.score));
	const dsaOf = (c: CandidateInvite) => mean((c.dsaResults || []).map((r) => r.score));
	const correctnessOf = (c: CandidateInvite) =>
		mean((c.dsaResults || []).map((r) => r.correctness ?? null));
	const qualityOf = (c: CandidateInvite) =>
		mean((c.dsaResults || []).map((r) => r.codeQuality ?? null));

	/** Completed with nothing scored is its own state — the round is left
	    unscored rather than estimated, and it is the one needing attention. */
	const stateOf = (c: CandidateInvite): CandState => {
		if (c.status === "pending") return "not-started";
		if (c.status === "started") return "in-progress";
		const scored = [...(c.results || []), ...(c.dsaResults || [])].some((r) => r.score != null);
		return scored ? "complete" : "not-scored";
	};

	const interviewType = interview?.interviewType || "behavioral";
	const showBehavioral = interviewType === "behavioral" || interviewType === "mixed";
	const showDsa = interviewType === "dsa" || interviewType === "mixed";

	const columns = useMemo(() => {
		const cols: { key: SortKey; label: string; num?: boolean }[] = [{ key: "name", label: "Candidate" }];
		if (interviewType === "mixed") cols.push({ key: "round", label: "Round" });
		if (showBehavioral) cols.push({ key: "behavioral", label: "Behavioral (1–10)", num: true });
		if (showDsa) {
			cols.push({ key: "dsa", label: "DSA (1–10)", num: true });
			cols.push({ key: "correctness", label: "Correctness", num: true });
			cols.push({ key: "quality", label: "Code quality", num: true });
		}
		cols.push({ key: "state", label: "Status" });
		return cols;
	}, [interviewType, showBehavioral, showDsa]);

	const valueOf = (c: CandidateInvite, key: SortKey): string | number | null => {
		switch (key) {
			case "name": return nameOf(c).toLowerCase();
			case "round": return ROUND_RANK[c.currentRound] ?? c.currentRound;
			case "behavioral": return behavioralOf(c);
			case "dsa": return dsaOf(c);
			case "correctness": return correctnessOf(c);
			case "quality": return qualityOf(c);
			case "state": return STATE[stateOf(c)].label;
		}
	};

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		return candidates
			.filter((c) => {
				if (stateFilter !== "all" && stateOf(c) !== stateFilter) return false;
				if (!q) return true;
				return nameOf(c).toLowerCase().includes(q) || emailOf(c).toLowerCase().includes(q);
			})
			.sort((a, b) => {
				const va = valueOf(a, sort.key);
				const vb = valueOf(b, sort.key);
				// Unscored candidates sort last regardless of direction
				if (va == null && vb == null) return 0;
				if (va == null) return 1;
				if (vb == null) return -1;
				return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
			});
	}, [candidates, query, stateFilter, sort]); // eslint-disable-line react-hooks/exhaustive-deps

	const toggleSort = (key: SortKey) =>
		setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

	const copyInvite = async () => {
		if (!interview?.inviteLink) return;
		try {
			await navigator.clipboard.writeText(interview.inviteLink);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard unavailable — the link is still visible on the dashboard
		}
	};

	if (isLoading)
		return (
			<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 mt-14">
				<div className="max-w-[1400px] mx-auto space-y-6">
					<div className="h-7 w-72 bg-secondary rounded-md" />
					<div className="h-24 bg-secondary/40 rounded-md" />
					<div className="h-96 bg-secondary/20 rounded-md" />
				</div>
			</div>
		);

	if (error)
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4 mt-14">
				<div className="w-full max-w-sm border-2 border-sign-black rounded-md bg-card p-8 text-center space-y-4">
					<AlertCircle className="w-6 h-6 text-destructive mx-auto" />
					<p className="text-[13px] font-semibold">{error}</p>
					<Button onClick={fetchData} className="font-medium">Retry</Button>
				</div>
			</div>
		);

	/* ---- the band's figures, all counted from the candidates list ---- */
	const states = candidates.map(stateOf);
	const invited = candidates.length;
	const startedCount = states.filter((s) => s !== "not-started").length;
	const completedCount = candidates.filter((c) => c.status === "completed").length;
	const scoredCount = states.filter((s) => s === "complete").length;
	const needsAttention = states.filter((s) => s === "not-scored").length;

	const daysLeft = interview?.expiresAt
		? Math.ceil((new Date(interview.expiresAt).getTime() - Date.now()) / 86400000)
		: null;

	/* The route the interview runs, and where the cohort has reached on it */
	const rounds =
		interviewType === "mixed" ? ["Behavioral", "DSA", "Done"] : interviewType === "dsa" ? ["DSA", "Done"] : ["Behavioral", "Done"];
	const activeRound =
		states.includes("not-started") && candidates.some((c) => c.currentRound === "behavioral")
			? "Behavioral"
			: candidates.some((c) => c.currentRound === "dsa")
				? "DSA"
				: "Done";
	const activeIdx = Math.max(0, rounds.indexOf(activeRound));

	// The band's third job: the next decision, in plain language. The counts
	// belong to the cohort row above and the expiry to the title meta, so
	// restating them here said the same thing three times on one screen.
	const nextLine = needsAttention
		? "Some answers could not be scored automatically. Open a candidate to review."
		: scoredCount === 0
			? "Nothing scored yet. Results appear as candidates submit."
			: scoredCount < invited
				? "Scoring continues as candidates submit."
				: "Every invited candidate has been scored.";

	return (
		<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 mt-14">
			<div className="max-w-[1400px] mx-auto space-y-5">
				{/* Breadcrumb + actions */}
				<div className="flex items-center justify-between gap-4">
					<div className="flex items-center gap-3 min-w-0">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => navigate("/recruiter")}
							className="text-muted-foreground font-medium gap-1.5 shrink-0"
						>
							<ArrowLeft className="h-3.5 w-3.5" />
							Interviews
						</Button>
						<span className="text-muted-foreground/50 shrink-0" aria-hidden="true">/</span>
						<span className="text-[13px] font-semibold text-foreground truncate">
							{interview?.title}
						</span>
					</div>
					{interview?.inviteLink && (
						<Button variant="outline" size="sm" onClick={copyInvite} className="shrink-0">
							{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
							{copied ? "Link copied" : "Copy invite link"}
						</Button>
					)}
				</div>

				{/* Title block */}
				<div>
					<h1 className="type-monument text-3xl text-foreground">{interview?.title}</h1>
					<div className="flex items-center gap-3 text-[12.5px] text-muted-foreground mt-2 flex-wrap">
						<span className="font-semibold text-foreground">{label(interviewType)}</span>
						<span aria-hidden="true">·</span>
						<span>{interview?.targetRole}</span>
						{daysLeft != null && (
							<>
								<span aria-hidden="true">·</span>
								<span>
									{daysLeft > 0
										? `Invite link expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`
										: "Invite link has expired"}
								</span>
							</>
						)}
					</div>
				</div>

				{/* Cohort figures */}
				<div className="flex flex-wrap gap-x-10 gap-y-3">
					{[
						{ n: invited, label: "Invited" },
						{ n: startedCount, label: "Started" },
						{ n: completedCount, label: "Completed" },
						{ n: needsAttention, label: "Needs attention" },
					].map((s) => (
						<div key={s.label} className="flex items-baseline gap-2">
							<b className="type-score text-2xl font-extrabold text-foreground">{s.n}</b>
							<span className="text-[12px] text-muted-foreground">{s.label}</span>
						</div>
					))}
				</div>

				{/* The band: the route, the live round, and the next decision */}
				<section className="border-2 border-sign-black rounded-md overflow-hidden" aria-label="Round order and next decision">
					<div className="flex text-[12.5px] overflow-x-auto">
						<span className="px-3.5 py-2 border-r-2 border-sign-black bg-muted text-muted-foreground text-[11.5px] flex items-center whitespace-nowrap">
							Round order
						</span>
						{rounds.map((r, i) => {
							const cls =
								i < activeIdx
									? "text-muted-foreground"
									: i === activeIdx
										? "bg-sign-black text-sign-white font-bold"
										: "bg-muted/60 text-muted-foreground";
							const mark = i < activeIdx ? "✓" : i === activeIdx ? "▸" : "○";
							return (
								<span
									key={r}
									className={`px-3.5 py-2 border-r-2 border-sign-black flex items-center gap-2 whitespace-nowrap ${cls}`}
									aria-current={i === activeIdx ? "step" : undefined}
								>
									<span aria-hidden="true">{mark}</span>
									{r}
								</span>
							);
						})}
					</div>

					<div className="bg-sign-yellow text-sign-black px-4 py-2 flex items-baseline gap-5 flex-wrap">
						<span key={activeRound} className="flap type-monument type-monument-tight text-[40px] sm:text-[54px]">
							{activeRound}
						</span>
						<span className="text-[12.5px] font-semibold">
							Round {activeIdx + 1} of {rounds.length} · {interviewType === "mixed" ? "behavioral + DSA" : label(interviewType)}
						</span>
					</div>

					<div className="on-sign px-4 py-2.5 text-[13px]">{nextLine}</div>
				</section>

				{/* Toolbar */}
				<div className="flex items-center gap-2 flex-wrap">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search candidate name"
						aria-label="Search candidate name"
						className="h-9 px-3 w-56 rounded-md border border-input bg-card text-[13px] text-foreground focus-visible:border-foreground"
					/>
					<select
						value={stateFilter}
						onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)}
						aria-label="Filter by status"
						className="h-9 px-2.5 rounded-md border border-input bg-card text-[13px] text-foreground focus-visible:border-foreground"
					>
						<option value="all">All statuses</option>
						<option value="not-scored">Needs attention</option>
						<option value="in-progress">In progress</option>
						<option value="complete">Complete</option>
						<option value="not-started">Not started</option>
					</select>
					<span className="flex-1" />
					<span className="text-[12px] text-muted-foreground">
						Showing {rows.length} of {candidates.length} invited
					</span>
				</div>

				{/* Register */}
				{candidates.length === 0 ? (
					<div className="border-2 border-dashed border-border rounded-md p-16 text-center space-y-3">
						<Users className="w-9 h-9 text-muted-foreground mx-auto" />
						<h3 className="text-base font-bold text-foreground">No candidates yet</h3>
						<p className="text-[13px] text-muted-foreground">
							Generate an invite link from the dashboard to get started.
						</p>
					</div>
				) : (
					<div className="border border-border rounded-md bg-card overflow-x-auto">
						<table className="w-full min-w-[720px] border-collapse">
							<thead>
								<tr>
									{columns.map((col) => {
										const active = sort.key === col.key;
										return (
											<th
												key={col.key}
												scope="col"
												aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
												className={`text-left text-[11.5px] font-bold text-muted-foreground px-3.5 pb-2 pt-3 border-b-2 border-sign-black whitespace-nowrap ${
													col.num ? "text-right" : ""
												}`}
											>
												<button
													onClick={() => toggleSort(col.key)}
													className={`inline-flex items-center gap-1.5 hover:text-foreground transition-colors ${col.num ? "flex-row-reverse" : ""}`}
												>
													{col.label}
													<span className="font-normal text-muted-foreground/70" aria-hidden="true">
														{active ? (sort.dir === 1 ? "↑" : "↓") : "⇅"}
													</span>
												</button>
											</th>
										);
									})}
								</tr>
							</thead>
							<tbody>
								{rows.map((c) => {
									const st = stateOf(c);
									const meta = STATE[st];
									const isOpen = expanded === c._id;
									const interactive = (c.results?.length || 0) > 0 || (c.dsaResults?.length || 0) > 0;
									return (
										<React.Fragment key={c._id}>
											<tr className={st === "not-started" ? "bg-muted/50" : ""}>
												<td className="px-3.5 py-2.5 border-b border-border align-middle">
													<button
														onClick={() => interactive && setExpanded(isOpen ? null : c._id)}
														aria-expanded={interactive ? isOpen : undefined}
														disabled={!interactive}
														className="text-left group"
													>
														<span className="block text-[14px] font-semibold text-foreground group-enabled:group-hover:underline underline-offset-2">
															{nameOf(c)}
														</span>
														<span className="block text-[11.5px] text-muted-foreground">
															{emailOf(c)}
														</span>
													</button>
												</td>
												{interviewType === "mixed" && (
													<td className="px-3.5 py-2.5 border-b border-border align-middle text-[13px] capitalize text-muted-foreground">
														{c.currentRound}
													</td>
												)}
												{showBehavioral && (
													<td className="px-3.5 py-2.5 border-b border-border align-middle text-right pr-6">
														<ScoreCell value={behavioralOf(c)} />
													</td>
												)}
												{showDsa && (
													<>
														<td className="px-3.5 py-2.5 border-b border-border align-middle text-right pr-6">
															<ScoreCell value={dsaOf(c)} />
														</td>
														<td className="px-3.5 py-2.5 border-b border-border align-middle text-right pr-6">
															<ScoreCell value={correctnessOf(c)} />
														</td>
														<td className="px-3.5 py-2.5 border-b border-border align-middle text-right pr-6">
															<ScoreCell value={qualityOf(c)} />
														</td>
													</>
												)}
												<td className="px-3.5 py-2.5 border-b border-border align-middle">
													<span
														className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-2.5 py-1 rounded-sm border-2 whitespace-nowrap ${meta.cls}`}
													>
														<span aria-hidden="true">{meta.mark}</span>
														{meta.label}
													</span>
												</td>
											</tr>

											{isOpen && interactive && (
												<tr>
													<td colSpan={columns.length} className="p-0 border-b-2 border-sign-black">
														<div className="border-l-2 border-sign-black bg-muted/40 px-5 py-4 space-y-4">
															{st === "not-scored" && (
																<div className="border-2 border-warning rounded-md bg-card px-4 py-3">
																	<div className="flex items-center gap-2.5">
																		<span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold px-2.5 py-1 rounded-sm border-2 state-hatch border-warning text-warning">
																			<span aria-hidden="true">▲</span> Evaluator unavailable
																		</span>
																		<span className="text-[12.5px] text-muted-foreground">
																			{c.completedAt
																				? `Submitted ${new Date(c.completedAt).toLocaleDateString()} — scoring did not complete`
																				: "Scoring did not complete"}
																		</span>
																	</div>
																	<p className="text-[13px] text-foreground mt-2.5 max-w-3xl leading-relaxed">
																		No score and no written feedback were recorded for this
																		candidate. The round is left unscored rather than
																		estimated. A scored round returns one score 1–10 plus
																		written feedback per answer.
																	</p>
																</div>
															)}

															{(c.results?.length || 0) > 0 && (
																<div className="space-y-3">
																	<h4 className="type-sign-label text-muted-foreground flex items-center gap-1.5">
																		<Mic className="h-3.5 w-3.5" />
																		Behavioral — {c.results.length} answer{c.results.length === 1 ? "" : "s"}
																	</h4>
																	{c.results.map((r: ResultItem, i: number) => (
																		<div key={i} className="border border-border rounded-md bg-card p-4 space-y-3">
																			<div className="flex items-start justify-between gap-4 border-b border-border pb-2.5">
																				<div className="flex items-start gap-2 min-w-0">
																					<span className="text-[11px] font-bold text-muted-foreground pt-px">
																						{i + 1}.
																					</span>
																					<h5 className="text-[13px] font-semibold text-foreground leading-snug">
																						{r.question}
																					</h5>
																				</div>
																				<span className="shrink-0 border-2 border-sign-black rounded-sm px-2 py-0.5 text-[12px] font-bold text-foreground">
																					{show(r.score)}/10
																				</span>
																			</div>
																			{r.transcription && (
																				<div className="space-y-1">
																					<span className="type-sign-label text-muted-foreground">Transcription</span>
																					<div className="bg-muted border-l-2 border-l-sign-black text-[12.5px] italic p-2.5 text-foreground/90">
																						{r.transcription}
																					</div>
																				</div>
																			)}
																			{r.feedback && (
																				<div className="space-y-1">
																					<span className="type-sign-label text-muted-foreground">Written feedback</span>
																					<p className="text-[13px] leading-relaxed text-foreground">
																						{r.feedback}
																					</p>
																				</div>
																			)}
																		</div>
																	))}
																</div>
															)}

															{(c.dsaResults?.length || 0) > 0 && (
																<div className="space-y-3">
																	<h4 className="type-sign-label text-muted-foreground flex items-center gap-1.5">
																		<Code2 className="h-3.5 w-3.5" />
																		DSA — {c.dsaResults.length} problem{c.dsaResults.length === 1 ? "" : "s"}
																	</h4>
																	{c.dsaResults.map((r: DsaResultItem, i: number) => (
																		<div key={i} className="border border-border rounded-md bg-card p-4 space-y-3">
																			<div className="flex items-start justify-between gap-4 border-b border-border pb-2.5">
																				<div className="flex items-start gap-2 min-w-0">
																					<span className="text-[11px] font-bold text-muted-foreground pt-px">
																						{i + 1}.
																					</span>
																					<div className="min-w-0">
																						<h5 className="text-[13px] font-semibold text-foreground">
																							{r.problemTitle}
																						</h5>
																						<p className="text-[10.5px] text-muted-foreground font-mono mt-0.5">
																							{r.language}
																							{r.timeSpentSeconds
																								? ` · ${Math.floor(r.timeSpentSeconds / 60)}m ${r.timeSpentSeconds % 60}s`
																								: ""}
																						</p>
																					</div>
																				</div>
																				<span className="shrink-0 border-2 border-sign-black rounded-sm px-2 py-0.5 text-[12px] font-bold text-foreground">
																					{show(r.score)}/10
																				</span>
																			</div>

																			<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
																				{[
																					{ label: "Correctness", value: show(r.correctness ?? null) },
																					{ label: "Code quality", value: show(r.codeQuality ?? null) },
																					{ label: "Time", value: r.timeComplexity || "—" },
																					{ label: "Space", value: r.spaceComplexity || "—" },
																				].map((m) => (
																					<div key={m.label} className="rounded-sm bg-muted border border-border p-2 text-center">
																						<p className="type-sign-label text-muted-foreground">{m.label}</p>
																						<p className="text-[11.5px] font-mono font-semibold mt-0.5 text-foreground">
																							{m.value}
																						</p>
																					</div>
																				))}
																			</div>

																			{r.code && (
																				<div className="space-y-1">
																					<span className="type-sign-label text-muted-foreground">Submission</span>
																					<pre className="bg-sign-black border border-sign-black text-[11px] font-mono p-3 rounded-sm overflow-x-auto max-h-48 text-sign-white/90">
																						{r.code}
																					</pre>
																				</div>
																			)}

																			{r.feedback && (
																				<div className="space-y-1">
																					<span className="type-sign-label text-muted-foreground">Written feedback</span>
																					<p className="text-[13px] leading-relaxed text-foreground">
																						{r.feedback}
																					</p>
																				</div>
																			)}
																		</div>
																	))}
																</div>
															)}
														</div>
													</td>
												</tr>
											)}
										</React.Fragment>
									);
								})}

								{rows.length === 0 && (
									<tr>
										<td colSpan={columns.length} className="px-3.5 py-10 text-center text-[13px] text-muted-foreground">
											No candidates match this filter.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
};

export default CandidateResults;
