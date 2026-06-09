import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Download, Trash2, ShieldCheck, ArrowLeft } from "lucide-react";

const AccountSettings: React.FC = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [consent, setConsent] = useState({ consentGiven: false, consentDate: "", consentVersion: "" });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (!stored || !token) { navigate("/signup"); return; }
    setUser(JSON.parse(stored));
    fetch(`${import.meta.env.VITE_API_URL || "http://localhost:9000"}/api/auth/consent`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setConsent)
      .catch(() => {});
  }, [navigate]);

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:9000"}/api/auth/export-data`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
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
    if (!deletePassword) { setDeleteError("Password is required"); return; }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:9000"}/api/auth/delete-account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      navigate("/");
    } catch (err: any) {
      setDeleteError(err.message || "Failed to delete account");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleConsentToggle = async (given: boolean) => {
    const token = localStorage.getItem("token");
    const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:9000"}/api/auth/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ consentGiven: given, consentVersion: "1.0" }),
    });
    const data = await response.json();
    setConsent(data.consent);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Back + header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-muted-foreground font-medium gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.02em] text-foreground">Account Settings</h1>
            <p className="text-[13px] text-muted-foreground">Manage your data, consent, and account.</p>
          </div>
        </div>

        {/* Profile */}
        <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-[14px] font-bold text-foreground">Profile</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input value={user.name || ""} disabled className="bg-surface text-[13px]" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Email</Label>
              <Input value={user.email || ""} disabled className="bg-surface text-[13px]" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Role</Label>
            <Input value={user.role === "recruiter" ? "Recruiter" : "Candidate"} disabled className="bg-surface text-[13px] capitalize" />
          </div>
        </div>

        {/* Data Export */}
        <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" /> Export Your Data
            </h2>
            <p className="text-[12px] text-muted-foreground">GDPR Article 20: download a copy of all your personal data as JSON.</p>
          </div>
          <Button variant="outline" onClick={handleExportData} disabled={exportLoading} className="font-medium gap-2">
            {exportLoading ? "Exporting..." : "Download Data Export"}
          </Button>
        </div>

        {/* Consent */}
        <div className="border border-border/80 rounded-xl bg-card p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="text-[14px] font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" /> Consent Management
            </h2>
            <p className="text-[12px] text-muted-foreground">Control your data processing consent preferences.</p>
          </div>
          <div className="flex items-center justify-between p-4 bg-surface rounded-lg border border-border/60">
            <div>
              <p className="text-[13px] font-semibold text-foreground">Data Processing Consent</p>
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
            Essential data processing (authentication, security) is always active. Revoking consent stops optional processing such as analytics. Your platform functionality is unaffected.
          </p>
        </div>

        {/* Delete Account */}
        <div className="border border-destructive/20 rounded-xl bg-card p-6 shadow-sm space-y-4">
          <div className="space-y-1">
            <h2 className="text-[14px] font-bold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Delete Account
            </h2>
            <p className="text-[12px] text-muted-foreground">Permanently delete your account and all data. This cannot be undone.</p>
          </div>
          {!showDeleteConfirm ? (
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="font-medium">
              Delete My Account
            </Button>
          ) : (
            <div className="space-y-4 p-4 bg-destructive/5 border border-destructive/15 rounded-lg">
              <p className="text-[13px] text-foreground font-medium">
                This will permanently delete your account, all interview sessions, and all personal data. Enter your password to confirm.
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
                <Button variant="destructive" onClick={handleDeleteAccount} disabled={deleteLoading || !deletePassword} className="font-medium">
                  {deleteLoading ? "Deleting..." : "Confirm Delete"}
                </Button>
                <Button variant="ghost" onClick={() => { setShowDeleteConfirm(false); setDeletePassword(""); setDeleteError(null); }} className="font-medium">
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
