import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
	Plus,
	Users,
	FileText,
	Calendar,
	ExternalLink,
	AlertCircle,
	BarChart3,
	Power,
	PowerOff,
} from "lucide-react";
import { api } from "@/lib/api";

const RecruiterDashboard: React.FC = () => {
	const navigate = useNavigate();
	const [organizations, setOrganizations] = useState<any[]>([]);
	const [selectedOrg, setSelectedOrg] = useState<any>(null);
	const [interviews, setInterviews] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [newOrgName, setNewOrgName] = useState("");
	const [showNewOrgModal, setShowNewOrgModal] = useState(false);
	const [inviteEmail, setInviteEmail] = useState("");
	const [inviteInterviewId, setInviteInterviewId] = useState<string | null>(
		null,
	);
	const [showInviteModal, setShowInviteModal] = useState(false);
	const [generatedLink, setGeneratedLink] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		fetchData();
	}, []);

	const fetchData = async () => {
		setIsLoading(true);
		setError(null);
		try {
			const orgData = await api.get<{ data: any[]; total: number }>("/api/org");
			setOrganizations(orgData.data || []);
			if (orgData.data?.length > 0) {
				setSelectedOrg(orgData.data[0]);
				const interviewData = await api.get<{ data: any[]; total: number }>(
					`/api/interviews?organizationId=${orgData.data[0]._id}`,
				);
				setInterviews(interviewData.data || []);
			}
		} catch (err: any) {
			setError(err.message || "An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const handleCreateOrg = async () => {
		if (!newOrgName.trim()) return;
		try {
			await api.post("/api/org", { name: newOrgName.trim() });
			setNewOrgName("");
			setShowNewOrgModal(false);
			fetchData();
		} catch (err: any) {
			setError(err.message || "Failed to create organization");
		}
	};

	const handleGenerateInvite = async () => {
		if (!inviteEmail.trim() || !inviteInterviewId) return;
		try {
			const data = await api.post<{ inviteToken: string }>(
				`/api/interviews/${inviteInterviewId}/invite`,
				{ candidateEmail: inviteEmail.trim() },
			);
			const link = `${window.location.origin}/interview/accept/${data.inviteToken}`;
			setGeneratedLink(link);
			setCopied(false);
			// Try clipboard silently — if unavailable or rejected, the modal still shows the link
			try {
				if (navigator.clipboard) {
					await navigator.clipboard.writeText(link);
					setCopied(true);
				}
			} catch {
				// Clipboard unavailable or permission denied — link is shown in modal
			}
			setInviteEmail("");
			fetchData();
		} catch (err: any) {
			setError(err.message || "Failed to generate invite");
		}
	};

	const handleCopyLink = async () => {
		if (!generatedLink) return;
		try {
			if (navigator.clipboard) {
				await navigator.clipboard.writeText(generatedLink);
				setCopied(true);
				setTimeout(() => setCopied(false), 2000);
			}
		} catch {
			// Fallback: select the input text for manual copy
			const input = document.getElementById("invite-link-input") as HTMLInputElement;
			if (input) {
				input.select();
				input.setSelectionRange(0, 99999);
			}
		}
	};

	const handleUpdateStatus = async (interviewId: string, newStatus: string) => {
		try {
			await api.put(`/api/interviews/${interviewId}`, { status: newStatus });
			fetchData();
		} catch (err: any) {
			alert(err.message || "Failed to update status");
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background py-8 px-4 mt-14">
				<div className="max-w-5xl mx-auto space-y-8 animate-pulse">
					<div className="h-7 w-64 bg-secondary rounded-md" />
					<div className="grid grid-cols-3 gap-4">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-24 bg-secondary/50 rounded-[20px]" />
						))}
					</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-background p-4 mt-14">
				<div className="w-full max-w-sm border border-border rounded-[20px] bg-card p-8 text-center space-y-4">
					<AlertCircle className="w-6 h-6 text-destructive mx-auto" />
					<p className="text-[13px] font-semibold">{error}</p>
					<Button onClick={fetchData} className="font-medium">
						Retry
					</Button>
				</div>
			</div>
		);
	}

	return (
		<>
			<div className="max-w-5xl mx-auto space-y-6">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
					<div className="space-y-1">
						<h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">
							Recruiter Dashboard
						</h1>
						<p className="text-[13px] text-muted-foreground">
							Manage interviews, invite candidates, review results.
						</p>
					</div>
					<div className="flex gap-2">
						{!selectedOrg && (
							<Button
								onClick={() => setShowNewOrgModal(true)}
								className="font-semibold gap-1.5"
							>
								<Plus className="w-3.5 h-3.5" /> New Organization
							</Button>
						)}
						{selectedOrg && (
							<Button
								onClick={() => navigate("/recruiter/interviews/new")}
								className="font-semibold gap-1.5"
							>
								<Plus className="w-3.5 h-3.5" /> New Interview
							</Button>
						)}
					</div>
				</div>

				{/* Org info bar */}
				{selectedOrg && (
					<div className="border border-border rounded-[20px] bg-card px-5 py-3.5 flex items-center justify-between">
						<div>
							<p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
								Organization
							</p>
							<p className="text-[15px] font-bold text-foreground">
								{selectedOrg.name}
							</p>
						</div>
						<div className="text-right">
							<p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
								Members
							</p>
							<p className="text-[15px] font-bold text-foreground">
								{selectedOrg.members?.length || 1}
							</p>
						</div>
					</div>
				)}

				{/* No org state */}
				{organizations.length === 0 && (
					<div className="border-2 border-dashed border-border rounded-[20px] p-16 text-center space-y-4 bg-surface/30">
						<Users className="w-10 h-10 text-muted-foreground mx-auto" />
						<div className="space-y-1">
							<h3 className="text-base font-bold text-foreground">
								Create your organization
							</h3>
							<p className="text-[13px] text-muted-foreground max-w-xs mx-auto">
								Set up your company to start creating interview sessions.
							</p>
						</div>
						<Button
							onClick={() => setShowNewOrgModal(true)}
							className="font-semibold gap-1.5"
						>
							<Plus className="w-3.5 h-3.5" /> Create Organization
						</Button>
					</div>
				)}

				{/* No interviews state */}
				{selectedOrg && interviews.length === 0 && (
					<div className="border-2 border-dashed border-border rounded-[20px] p-16 text-center space-y-4 bg-surface/30">
						<FileText className="w-10 h-10 text-muted-foreground mx-auto" />
						<div className="space-y-1">
							<h3 className="text-base font-bold text-foreground">
								No interview sessions
							</h3>
							<p className="text-[13px] text-muted-foreground max-w-xs mx-auto">
								Create a structured interview and invite candidates to complete
								it.
							</p>
						</div>
						<Button
							onClick={() => navigate("/recruiter/interviews/new")}
							className="font-semibold gap-1.5"
						>
							<Plus className="w-3.5 h-3.5" /> Create Interview
						</Button>
					</div>
				)}

				{/* Interview list */}
				{selectedOrg && interviews.length > 0 && (
					<div className="space-y-3">
						<h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
							Interview Sessions
						</h2>
						<div className="space-y-2">
							{interviews.map((interview) => (
								<div
									key={interview._id}
									className="border border-border rounded-[20px] bg-card p-4 hover:border-primary/20 transition-colors"
								>
									<div className="flex items-start justify-between gap-4">
										<div className="space-y-1 min-w-0 flex-1">
											<div className="flex items-center gap-2">
												<h3 className="text-[14px] font-bold text-foreground">
													{interview.title}
												</h3>
												<span
													className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
														interview.status === "active"
															? "bg-success/10 text-success border border-success/20"
															: interview.status === "draft"
																? "bg-warning/10 text-warning border border-warning/20"
																: "bg-secondary text-muted-foreground border border-border"
													}`}
												>
													{interview.status}
												</span>
											</div>
											<p className="text-[12px] text-muted-foreground">
												Role: {interview.targetRole}
											</p>
											<div className="flex items-center gap-3 text-[11px] text-muted-foreground">
												<span className="flex items-center gap-1">
													<FileText className="h-3 w-3" />
													{interview.questions?.length || 0} questions
												</span>
												<span className="flex items-center gap-1">
													<Calendar className="h-3 w-3" />
													Expires{" "}
													{new Date(interview.expiresAt).toLocaleDateString()}
												</span>
											</div>
										</div>
										<div className="flex gap-2 shrink-0">
											{interview.status === "active" && (
												<Button
													size="sm"
													variant="outline"
													className="font-medium"
													onClick={() => {
														setInviteInterviewId(interview._id);
														setShowInviteModal(true);
													}}
												>
													<ExternalLink className="h-3.5 w-3.5 mr-1" /> Invite
												</Button>
											)}
											{interview.status === "draft" && (
												<Button
													size="sm"
													variant="outline"
													className="font-medium text-success border-success/30 hover:bg-success/10"
													onClick={() =>
														handleUpdateStatus(interview._id, "active")
													}
												>
													<Power className="h-3.5 w-3.5 mr-1" /> Activate
												</Button>
											)}
											{interview.status === "active" && (
												<Button
													size="sm"
													variant="outline"
													className="font-medium text-destructive border-destructive/30 hover:bg-destructive/10"
													onClick={() =>
														handleUpdateStatus(interview._id, "closed")
													}
												>
													<PowerOff className="h-3.5 w-3.5 mr-1" /> Close
												</Button>
											)}
											<Button
												size="sm"
												variant="ghost"
												className="font-medium"
												onClick={() =>
													navigate(`/recruiter/interviews/${interview._id}`)
												}
											>
												<BarChart3 className="h-3.5 w-3.5 mr-1" /> View
											</Button>
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			{/* New Organization Modal */}
			{showNewOrgModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="bg-card border border-border rounded-[20px]  p-6 w-full max-w-sm space-y-4">
						<h3 className="text-[14px] font-bold text-foreground">
							Create Organization
						</h3>
						<input
							type="text"
							placeholder="Organization name"
							value={newOrgName}
							onChange={(e) => setNewOrgName(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCreateOrg();
							}}
							className="w-full h-9 px-3 rounded-[20px] border border-border bg-background text-[13px] focus:border-primary/50 focus:outline-none"
							autoFocus
						/>
						<div className="flex gap-2 justify-end">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									setShowNewOrgModal(false);
									setNewOrgName("");
								}}
								className="font-medium"
							>
								Cancel
							</Button>
							<Button
								size="sm"
								onClick={handleCreateOrg}
								disabled={!newOrgName.trim()}
								className="font-medium"
							>
								Create
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Invite Modal */}
			{showInviteModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="bg-card border border-border rounded-[20px]  p-6 w-full max-w-sm space-y-4">
						{generatedLink ? (
							<>
								<h3 className="text-[14px] font-bold text-foreground">
									Invite Generated
								</h3>
								<p className="text-[12px] text-muted-foreground">
									Share this link with the candidate to start their interview.
								</p>
								<div className="flex gap-2">
									<input
										id="invite-link-input"
										type="text"
										readOnly
										value={generatedLink}
										className="flex-1 h-9 px-3 rounded-[20px] border border-border bg-background text-[12px] focus:border-primary/50 focus:outline-none cursor-text"
										onClick={(e) => e.currentTarget.select()}
									/>
									<Button
										size="sm"
										variant="outline"
										onClick={handleCopyLink}
										className="font-medium shrink-0"
									>
										{copied ? "Copied!" : "Copy"}
									</Button>
								</div>
								<div className="flex gap-2 justify-end">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setShowInviteModal(false);
											setInviteEmail("");
											setInviteInterviewId(null);
											setGeneratedLink(null);
											setCopied(false);
										}}
										className="font-medium"
									>
										Done
									</Button>
								</div>
							</>
						) : (
							<>
								<h3 className="text-[14px] font-bold text-foreground">
									Invite Candidate
								</h3>
								<input
									type="email"
									placeholder="candidate@example.com"
									value={inviteEmail}
									onChange={(e) => setInviteEmail(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleGenerateInvite();
									}}
									className="w-full h-9 px-3 rounded-[20px] border border-border bg-background text-[13px] focus:border-primary/50 focus:outline-none"
									autoFocus
								/>
								<div className="flex gap-2 justify-end">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => {
											setShowInviteModal(false);
											setInviteEmail("");
											setInviteInterviewId(null);
										}}
										className="font-medium"
									>
										Cancel
									</Button>
									<Button
										size="sm"
										onClick={handleGenerateInvite}
										disabled={!inviteEmail.trim()}
										className="font-medium"
									>
										Send Invite
									</Button>
								</div>
							</>
						)}
					</div>
				</div>
			)}
		</>
	);
};

export default RecruiterDashboard;
