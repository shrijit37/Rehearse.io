import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Calendar,
	Award,
	ChevronRight,
	Play,
	History,
	AlertCircle,
	TrendingUp,
	BarChart3,
	MessageSquare,
	Users,
} from "lucide-react";
import { api } from "@/lib/api";

interface ResultItem {
	_id: string;
	question: string;
	transcription: string;
	score: number | null;
	feedback: string;
}

interface RehearsalSession {
	_id: string;
	targetRole: string;
	results: ResultItem[];
	createdAt: string;
}

interface InvitedInterview {
	_id: string;
	status: string;
	interview: {
		_id: string;
		title: string;
		targetRole: string;
		status: string;
		expiresAt: string;
		organization: { name: string } | null;
	} | null;
	results: ResultItem[];
	startedAt?: string;
	completedAt?: string;
	createdAt: string;
}

/** Normalize both session types into a common shape for shared rendering. */
interface NormalizedSession {
	_id: string;
	title: string;
	targetRole: string;
	status?: string;
	organization?: string;
	dateStr: string;
	avg: string;
	results: ResultItem[];
	scoreSum: number;
}

function normalizeSessions(
	history: RehearsalSession[],
	invited: InvitedInterview[],
): NormalizedSession[] {
	const fmt: Intl.DateTimeFormatOptions = {
		month: "short",
		day: "numeric",
		year: "numeric",
	};

	const practiceSessions: NormalizedSession[] = history.map((s) => {
		const validResults = s.results.filter(
			(r): r is ResultItem & { score: number } => r.score != null,
		);
		const avg =
			validResults.length > 0
				? (
						validResults.reduce((acc, r) => acc + r.score, 0) /
						validResults.length
					).toFixed(1)
				: "—";
		return {
			_id: s._id,
			title: s.targetRole,
			targetRole: s.targetRole,
			dateStr: new Date(s.createdAt).toLocaleDateString(undefined, fmt),
			avg,
			results: s.results,
			scoreSum: validResults.reduce((acc, r) => acc + r.score, 0),
		};
	});

	const inviteSessions: NormalizedSession[] = invited.map((inv) => {
		const results = inv.results || [];
		const validResults = results.filter(
			(r): r is ResultItem & { score: number } => r.score != null,
		);
		const avg =
			validResults.length > 0
				? (
						validResults.reduce((acc: number, r) => acc + r.score, 0) /
						validResults.length
					).toFixed(1)
				: "—";
		return {
			_id: inv._id,
			title: inv.interview?.title || "Interview",
			targetRole: inv.interview?.targetRole || "—",
			status: inv.status,
			organization: inv.interview?.organization?.name,
			dateStr: new Date(inv.createdAt).toLocaleDateString(undefined, fmt),
			avg,
			results,
			scoreSum: validResults.reduce((acc: number, r) => acc + r.score, 0),
		};
	});

	return [...inviteSessions, ...practiceSessions];
}

// ── Shared sub-components ──────────────────────────────────────────────────────

const ResultDetailPanel: React.FC<{
	title: string;
	targetRole: string;
	results: ResultItem[];
}> = ({ title, targetRole, results }) => {
	const avg =
		results.length > 0
			? (() => {
					const valid = results.filter(
						(r): r is ResultItem & { score: number } => r.score != null,
					);
					return valid.length > 0
						? (
								valid.reduce((acc, r) => acc + r.score, 0) / valid.length
							).toFixed(1)
						: "—";
				})()
			: "—";

	return (
		<div className="border border-border/80 rounded-xl bg-card overflow-hidden animate-in fade-in duration-200">
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
						{avg}
						<span className="text-[11px] text-muted-foreground">/10</span>
					</span>
				</div>
			</div>
			<div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
				{results.map((result: ResultItem, idx: number) => (
					<div
						key={result._id || idx}
						className="border border-border/50 rounded-lg p-4 space-y-3"
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
			</div>
		</div>
	);
};

const SessionListItem: React.FC<{
	session: NormalizedSession;
	isSelected: boolean;
	onClick: () => void;
	showStatus?: boolean;
}> = ({ session, isSelected, onClick, showStatus }) => {
	const statusColor =
		session.status === "completed"
			? "bg-success/10 text-success border-success/20"
			: session.status === "started"
				? "bg-warning/10 text-warning border-warning/20"
				: "bg-secondary text-muted-foreground border-border";

	return (
		<button
			onClick={onClick}
			className={`w-full text-left p-3.5 border rounded-lg transition-all flex items-center justify-between select-none ${
				isSelected
					? "bg-card border-primary/60 shadow-sm"
					: "bg-card border-border/60 hover:border-primary/30"
			}`}
		>
			<div className="space-y-1 min-w-0 pr-3">
				<p className="text-[13px] font-semibold text-foreground truncate">
					{session.title}
				</p>
				<div className="flex items-center gap-2">
					<span className="inline-block px-2 py-0.5 text-[10px] font-bold bg-primary/10 text-primary border border-primary/15 rounded">
						{session.targetRole}
					</span>
					{showStatus && session.status && (
						<span
							className={`inline-block px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider border ${statusColor}`}
						>
							{session.status}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
					<Calendar className="w-3 h-3" />
					<span>{session.dateStr}</span>
					{session.organization && (
						<>
							<span>·</span>
							<span>{session.organization}</span>
						</>
					)}
				</div>
			</div>
			<div className="flex items-center gap-2 shrink-0">
				<div className="text-right">
					<p className="text-[9px] font-bold text-muted-foreground uppercase">
						Avg
					</p>
					<p className="text-sm font-bold text-foreground">
						{session.avg}
						<span className="text-[10px] text-muted-foreground">/10</span>
					</p>
				</div>
				<ChevronRight
					className={`h-3.5 w-3.5 transition-transform ${isSelected ? "text-primary translate-x-0.5" : "text-muted-foreground/50"}`}
				/>
			</div>
		</button>
	);
};

// ── Main component ─────────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
	const navigate = useNavigate();
	const [history, setHistory] = useState<RehearsalSession[]>([]);
	const [invitedInterviews, setInvitedInterviews] = useState<
		InvitedInterview[]
	>([]);
	const [activeTab, setActiveTab] = useState<"practice" | "invited">("invited");
	const [isLoading, setIsLoading] = useState<boolean>(true);
	const [error, setError] = useState<string | null>(null);
	const [selectedId, setSelectedId] = useState<string | null>(null);

	useEffect(() => {
		const fetchData = async () => {
			setIsLoading(true);
			setError(null);
			try {
				const [historyData, inviteData] = await Promise.all([
					api.get<{ data: RehearsalSession[]; total: number }>(
						"/api/rehearsal/history",
					),
					api.get<{ data: InvitedInterview[]; total: number }>(
						"/api/interviews/candidate/my-interviews",
					),
				]);
				const historyItems = historyData.data || [];
				const inviteItems = inviteData.data || [];
				setHistory(historyItems);
				setInvitedInterviews(inviteItems);
				if (inviteItems.length > 0) {
					setSelectedId(inviteItems[0]._id);
					setActiveTab("invited");
				} else if (historyItems.length > 0) {
					setSelectedId(historyItems[0]._id);
					setActiveTab("practice");
				}
			} catch (err: any) {
				setError(err.message || "An error occurred.");
			} finally {
				setIsLoading(false);
			}
		};
		fetchData();
	}, []);

	// Single-pass stats computation
	const { totalSessions, averageScore, highestScore } = useMemo(() => {
		let scoreSum = 0,
			count = 0,
			peak = 0;
		for (const s of history) {
			for (const r of s.results) {
				if (r.score != null) {
					scoreSum += r.score;
					count++;
					if (r.score > peak) peak = r.score;
				}
			}
		}
		for (const inv of invitedInterviews) {
			for (const r of inv.results || []) {
				if (r.score != null) {
					scoreSum += r.score;
					count++;
					if (r.score > peak) peak = r.score;
				}
			}
		}
		return {
			totalSessions: history.length + invitedInterviews.length,
			averageScore: count > 0 ? (scoreSum / count).toFixed(1) : "—",
			highestScore: count > 0 ? peak : "—",
		};
	}, [history, invitedInterviews]);

	const invitedSessions = useMemo(
		() => normalizeSessions([], invitedInterviews),
		[invitedInterviews],
	);
	const practiceSessions = useMemo(
		() => normalizeSessions(history, []),
		[history],
	);
	const activeSessions =
		activeTab === "invited" ? invitedSessions : practiceSessions;
	const selectedSession = activeSessions.find((s) => s._id === selectedId);

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 mt-14">
				<div className="max-w-5xl mx-auto space-y-8 animate-pulse">
					<div className="space-y-2">
						<div className="h-7 w-48 bg-secondary rounded-md" />
						<div className="h-4 w-72 bg-secondary rounded-md" />
					</div>
					<div className="grid grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div
								key={i}
								className="h-24 bg-secondary/50 rounded-lg border border-border/40"
							/>
						))}
					</div>
					<div className="h-96 bg-secondary/30 rounded-xl border border-border/40" />
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4 mt-14">
				<div className="w-full max-w-sm border border-border/80 rounded-xl bg-card p-8 flex flex-col items-center text-center gap-5">
					<div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
						<AlertCircle className="w-6 h-6 text-destructive" />
					</div>
					<div className="space-y-1.5">
						<h3 className="text-base font-bold text-foreground">
							Unable to load dashboard
						</h3>
						<p className="text-[13px] text-muted-foreground">{error}</p>
					</div>
					<div className="flex gap-3 w-full">
						<Button
							variant="outline"
							className="flex-1 font-medium"
							onClick={() => navigate("/signup")}
						>
							Sign in
						</Button>
						<Button
							className="flex-1 font-medium"
							onClick={() => window.location.reload()}
						>
							Retry
						</Button>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 mt-14">
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-6">
					<div className="space-y-1">
						<h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">
							My Interviews
						</h1>
						<p className="text-[13px] text-muted-foreground">
							Your interview history, transcriptions, and AI evaluation scores.
						</p>
					</div>
					<Button
						onClick={() => navigate("/rehearsal")}
						className="font-semibold shadow-sm gap-2"
					>
						<Play className="w-3.5 h-3.5 fill-primary-foreground" />
						Start Interview
					</Button>
				</div>

				{/* Stats */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div className="border border-border/80 rounded-lg bg-card p-4 space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Average Score
							</span>
							<TrendingUp className="h-3.5 w-3.5 text-primary" />
						</div>
						<div className="flex items-baseline gap-1">
							<span className="text-2xl font-bold text-foreground">
								{averageScore}
							</span>
							<span className="text-[12px] text-muted-foreground">/ 10</span>
						</div>
					</div>
					<div className="border border-border/80 rounded-lg bg-card p-4 space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Total Sessions
							</span>
							<History className="h-3.5 w-3.5 text-primary" />
						</div>
						<span className="text-2xl font-bold text-foreground">
							{totalSessions}
						</span>
					</div>
					<div className="border border-border/80 rounded-lg bg-card p-4 space-y-3">
						<div className="flex items-center justify-between">
							<span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
								Peak Score
							</span>
							<Award className="h-3.5 w-3.5 text-primary" />
						</div>
						<div className="flex items-baseline gap-1">
							<span className="text-2xl font-bold text-foreground">
								{highestScore}
							</span>
							<span className="text-[12px] text-muted-foreground">/ 10</span>
						</div>
					</div>
				</div>

				{/* Tabs */}
				{(invitedInterviews.length > 0 || history.length > 0) && (
					<div className="flex gap-1 p-1 bg-surface rounded-lg border border-border/60">
						{[
							{
								key: "invited" as const,
								icon: Users,
								label: "Invited Interviews",
								count: invitedInterviews.length,
							},
							{
								key: "practice" as const,
								icon: Play,
								label: "Practice Sessions",
								count: history.length,
							},
						].map(({ key, icon: Icon, label, count }) => (
							<button
								key={key}
								onClick={() => {
									setActiveTab(key);
									const nextSessions =
										key === "invited" ? invitedSessions : practiceSessions;
									setSelectedId(nextSessions[0]?._id ?? null);
								}}
								className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-semibold transition-all ${
									activeTab === key
										? "bg-card text-foreground shadow-sm border border-border/60"
										: "text-muted-foreground hover:text-foreground"
								}`}
							>
								<Icon className="h-3.5 w-3.5" />
								{label}
								{count > 0 && (
									<span className="px-1.5 py-0.5 text-[10px] font-bold bg-primary/10 text-primary rounded-full">
										{count}
									</span>
								)}
							</button>
						))}
					</div>
				)}

				{/* Content */}
				{activeSessions.length === 0 ? (
					<div className="border-2 border-dashed border-border/60 rounded-xl p-16 text-center space-y-4 bg-surface/30">
						{activeTab === "invited" ? (
							<Users className="w-10 h-10 text-muted-foreground mx-auto" />
						) : (
							<div className="w-12 h-12 bg-surface border border-border rounded-full flex items-center justify-center mx-auto">
								<History className="w-5 h-5 text-muted-foreground" />
							</div>
						)}
						<div className="space-y-1">
							<h3 className="text-base font-bold text-foreground">
								{activeTab === "invited"
									? "No invited interviews"
									: "No practice sessions yet"}
							</h3>
							<p className="text-[13px] text-muted-foreground max-w-xs mx-auto">
								{activeTab === "invited"
									? "When a recruiter invites you to an interview, it will appear here."
									: "Complete your first practice interview to see your scores and feedback here."}
							</p>
						</div>
						{activeTab === "practice" && (
							<Button
								onClick={() => navigate("/rehearsal")}
								className="font-semibold w-full max-w-xs"
							>
								Start Practice
							</Button>
						)}
					</div>
				) : (
					<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
						{/* List */}
						<div className="lg:col-span-5 space-y-3">
							<h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
								{activeTab === "invited" ? "Your Interviews" : "History"}
							</h2>
							<div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
								{activeSessions.map((session) => (
									<SessionListItem
										key={session._id}
										session={session}
										isSelected={session._id === selectedId}
										onClick={() => setSelectedId(session._id)}
										showStatus={activeTab === "invited"}
									/>
								))}
							</div>
						</div>

						{/* Detail */}
						<div className="lg:col-span-7">
							{selectedSession && selectedSession.results.length > 0 ? (
								<ResultDetailPanel
									title={
										selectedSession.status
											? selectedSession.title
											: "Practice Results"
									}
									targetRole={selectedSession.targetRole}
									results={selectedSession.results}
								/>
							) : selectedSession ? (
								<div className="h-96 border border-border/80 rounded-xl bg-card flex flex-col items-center justify-center text-center p-6">
									<p className="text-[13px] text-muted-foreground">
										{activeTab === "invited"
											? "You haven't completed this interview yet."
											: "No results yet."}
									</p>
									{selectedSession.status && (
										<p className="text-[11px] text-muted-foreground/70 mt-1">
											Status: {selectedSession.status}
										</p>
									)}
								</div>
							) : (
								<div className="h-96 border border-border/80 rounded-xl bg-card flex flex-col items-center justify-center text-center p-6">
									<p className="text-[13px] text-muted-foreground">
										Select an interview to view results
									</p>
								</div>
							)}
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default Dashboard;
