import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	AlertCircle,
	Download,
	Trash2,
	ShieldCheck,
	ArrowLeft,
	UserRound,
} from "lucide-react";
import { api } from "@/lib/api";
import { CONSENT_VERSION } from "@/lib/consent";
import { clearStoredUser, readStoredUser } from "@/lib/session";
import type { User } from "@/types";

/**
 * What is account-level: the sign-in account, the data export, the consent
 * record, and the deletion of the account itself. Who the candidate *is* — name,
 * resume, headshot, voice sample — is the profile page's job, and this page
 * points there rather than repeating it.
 */
const AccountSettings: React.FC = () => {
	const navigate = useNavigate();
	const [user, setUser] = useState<User | null>(null);
	const [consent, setConsent] = useState({
		consentGiven: false,
		consentDate: "",
		consentVersion: "",
	});
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [deletePassword, setDeletePassword] = useState("");
	const [deleteError, setDeleteError] = useState<string | null>(null);
	const [deleteLoading, setDeleteLoading] = useState(false);
	const [exportLoading, setExportLoading] = useState(false);
	const [consentError, setConsentError] = useState<string | null>(null);

	useEffect(() => {
		const stored = readStoredUser();
		if (!stored) {
			navigate("/signup");
			return;
		}
		setUser(stored);
		api
			.get<{
				consentGiven: boolean;
				consentDate: string;
				consentVersion: string;
			}>("/api/users/consent")
			.then(setConsent)
			.catch((err) => console.error("Failed to fetch consent status:", err));
	}, [navigate]);

	const handleExportData = async () => {
		setExportLoading(true);
		try {
			const response = await api.post<Response>(
				"/api/users/export-data",
				undefined,
				{ raw: true },
			);
			const blob = await response.blob();
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = "rehearse-data-export.json";
			a.click();
			URL.revokeObjectURL(url);
		} catch (err) {
			console.error("Export failed:", err);
		} finally {
			setExportLoading(false);
		}
	};

	const handleDeleteAccount = async () => {
		if (!deletePassword) {
			setDeleteError("Password is required");
			return;
		}
		setDeleteLoading(true);
		setDeleteError(null);
		try {
			await api.delete("/api/users/delete-account", {
				password: deletePassword,
			});
			// The pre-cookie build kept its credential here; drop it on the way out.
			localStorage.removeItem("token");
			clearStoredUser();
			navigate("/");
		} catch (err: unknown) {
			setDeleteError(err instanceof Error ? err.message : "Failed to delete account");
		} finally {
			setDeleteLoading(false);
		}
	};

	const handleConsentToggle = async (given: boolean) => {
		try {
			setConsentError(null);
			const data = await api.post<Record<string, unknown>>(
				"/api/users/consent",
				{ consentGiven: given, consentVersion: CONSENT_VERSION },
			);
			if (data && typeof data === "object" && "consent" in data) {
				setConsent(data.consent as typeof consent);
			}
		} catch (err) {
			console.error("Failed to update consent:", err);
			setConsentError(err instanceof Error ? err.message : "Failed to update consent settings");
		}
	};

	if (!user) return null;

	return (
		<div className="min-h-screen bg-background pt-20 pb-12">
			<div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
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
							Account settings
						</h1>
						<p className="text-[13px] text-muted-foreground">
							Your data, your consent, and this account.
						</p>
					</div>
				</div>

				{/* The sign-in account, read-only, plus the door to the profile */}
				<div className="border border-border rounded-md bg-card p-6  space-y-4">
					<h2 className="text-[14px] font-bold text-foreground">Sign-in account</h2>
					<dl className="space-y-1.5 text-[13px]">
						{[
							["Name", user.name],
							["Email", user.email],
							["Role", user.role === "recruiter" ? "Recruiter" : "Candidate"],
						].map(([term, value]) => (
							<div key={term} className="flex gap-3">
								<dt className="type-sign-label w-20 shrink-0 pt-0.5 text-muted-foreground">
									{term}
								</dt>
								<dd className="min-w-0 break-words text-foreground">{value}</dd>
							</div>
						))}
					</dl>
					<p className="text-[11.5px] text-muted-foreground leading-relaxed">
						Your sign-in account lives on the shared auth service, so its credentials are
						changed there and nowhere else.
					</p>
					{user.role === "candidate" && (
						<>
							<Button
								variant="outline"
								onClick={() => navigate("/profile")}
								className="font-semibold gap-2"
							>
								<UserRound className="h-4 w-4" />
								Your profile
							</Button>
							<p className="text-[11.5px] text-muted-foreground leading-relaxed">
								Your name, resume, headshot and voice sample are maintained on your
								profile page.
							</p>
						</>
					)}
				</div>

				{/* Data Export */}
				<div className="border border-border rounded-md bg-card p-6  space-y-4">
					<div className="space-y-1">
						<h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
							<Download className="h-4 w-4 text-foreground" /> Export Your Data
						</h2>
						<p className="text-[12px] text-muted-foreground">
							GDPR Article 20: download a copy of all your personal data as
							JSON.
						</p>
					</div>
					<Button
						variant="outline"
						onClick={handleExportData}
						disabled={exportLoading}
						className="font-medium gap-2"
					>
						{exportLoading ? "Exporting..." : "Download Data Export"}
					</Button>
				</div>

				{/* Consent */}
				<div className="border border-border rounded-md bg-card p-6  space-y-4">
					<div className="space-y-1">
						<h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
							<ShieldCheck className="h-4 w-4 text-foreground" /> Consent
							Management
						</h2>
						<p className="text-[12px] text-muted-foreground">
							Control your data processing consent preferences.
						</p>
					</div>
					{consentError && (
						<div className="bg-destructive/10 text-destructive text-[12px] font-medium p-2.5 rounded-md border border-destructive/20 flex items-center gap-2">
							<AlertCircle className="h-3.5 w-3.5 shrink-0" /> {consentError}
						</div>
					)}
					<div className="flex items-center justify-between p-4 bg-surface rounded-md border border-border">
						<div>
							<p className="text-[13px] font-semibold text-foreground">
								Data Processing Consent
							</p>
							<p className="text-[11px] text-muted-foreground mt-0.5">
								{consent.consentGiven
									? `Granted on ${new Date(consent.consentDate).toLocaleDateString()} (v${consent.consentVersion})`
									: "Not yet granted"}
							</p>
						</div>
						<Button
							variant={consent.consentGiven ? "outline" : "default"}
							size="sm"
							className="font-medium"
							onClick={() => handleConsentToggle(!consent.consentGiven)}
						>
							{consent.consentGiven ? "Revoke" : "Grant"}
						</Button>
					</div>
					<p className="text-[11px] text-muted-foreground leading-relaxed">
						Essential data processing (authentication, security) is always
						active. Revoking consent stops optional processing such as
						analytics. Your platform functionality is unaffected.
					</p>
				</div>

				{/* Delete Account */}
				<div className="border border-destructive/20 rounded-md bg-card p-6  space-y-4">
					<div className="space-y-1">
						<h2 className="text-[14px] font-bold text-destructive flex items-center gap-2">
							<Trash2 className="h-4 w-4" /> Delete Account
						</h2>
						<p className="text-[12px] text-muted-foreground">
							Permanently delete your account and all data. This cannot be
							undone.
						</p>
					</div>
					{!showDeleteConfirm ? (
						<Button
							variant="destructive"
							onClick={() => setShowDeleteConfirm(true)}
							className="font-medium"
						>
							Delete My Account
						</Button>
					) : (
						<div className="space-y-4 p-4 bg-destructive/5 border border-destructive/15 rounded-md">
							<p className="text-[13px] text-foreground font-medium">
								This will permanently delete your account, all interview
								sessions, and all personal data. Enter your password to confirm.
							</p>
							{deleteError && (
								<div className="bg-destructive/10 text-destructive text-[12px] font-medium p-2.5 rounded-md border border-destructive/20 flex items-center gap-2">
									<AlertCircle className="h-3.5 w-3.5 shrink-0" /> {deleteError}
								</div>
							)}
							<div className="flex gap-3">
								<Input
									type="password"
									placeholder="Enter your password"
									value={deletePassword}
									onChange={(e) => setDeletePassword(e.target.value)}
									className="max-w-xs text-[13px]"
								/>
								<Button
									variant="destructive"
									onClick={handleDeleteAccount}
									disabled={deleteLoading || !deletePassword}
									className="font-medium"
								>
									{deleteLoading ? "Deleting..." : "Confirm Delete"}
								</Button>
								<Button
									variant="ghost"
									onClick={() => {
										setShowDeleteConfirm(false);
										setDeletePassword("");
										setDeleteError(null);
									}}
									className="font-medium"
								>
									Cancel
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default AccountSettings;
