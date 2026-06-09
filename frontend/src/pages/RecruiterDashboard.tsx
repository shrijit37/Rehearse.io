import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Plus, Users, FileText, Calendar, ExternalLink, AlertCircle, BarChart3, Power, PowerOff } from "lucide-react";

const RecruiterDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000";
      const orgRes = await fetch(`${apiUrl}/api/org`, { headers: { Authorization: `Bearer ${token}` } });
      const orgData = await orgRes.json();
      if (!orgRes.ok) throw new Error(orgData.message || "Failed to fetch organizations");
      setOrganizations(orgData.organizations || []);
      if (orgData.organizations?.length > 0) {
        setSelectedOrg(orgData.organizations[0]);
        const interviewRes = await fetch(`${apiUrl}/api/interviews?organizationId=${orgData.organizations[0]._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const interviewData = await interviewRes.json();
        setInterviews(interviewData.interviews || []);
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrg = async () => {
    const name = prompt("Enter your organization name:");
    if (!name) return;
    const token = localStorage.getItem("token");
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000";
    const res = await fetch(`${apiUrl}/api/org`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (res.ok) fetchData();
    else alert(data.message || "Failed to create organization");
  };

  const handleGenerateInvite = async (interviewId: string) => {
    const email = prompt("Enter candidate email address:");
    if (!email) return;
    const token = localStorage.getItem("token");
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000";
    const res = await fetch(`${apiUrl}/api/interviews/${interviewId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ candidateEmail: email }),
    });
    const data = await res.json();
    if (res.ok) {
      const link = `${window.location.origin}/interview/accept/${data.inviteToken}`;
      navigator.clipboard.writeText(link);
      alert(`Invite link copied to clipboard:\n${link}`);
      fetchData();
    } else {
      alert(data.message || "Failed to generate invite");
    }
  };

  const handleUpdateStatus = async (interviewId: string, newStatus: string) => {
    const token = localStorage.getItem("token");
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000";
    const res = await fetch(`${apiUrl}/api/interviews/${interviewId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) fetchData();
    else {
      const data = await res.json();
      alert(data.message || "Failed to update status");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background py-8 px-4 mt-14">
        <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
          <div className="h-7 w-64 bg-secondary rounded-md" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-secondary/50 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4 mt-14">
        <div className="w-full max-w-sm border border-border/80 rounded-xl bg-card p-8 text-center space-y-4">
          <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
          <p className="text-[13px] font-semibold">{error}</p>
          <Button onClick={fetchData} className="font-medium">Retry</Button>
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
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">Recruiter Dashboard</h1>
            <p className="text-[13px] text-muted-foreground">Manage interviews, invite candidates, review results.</p>
          </div>
          <div className="flex gap-2">
            {!selectedOrg && (
              <Button onClick={handleCreateOrg} className="font-semibold gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Organization
              </Button>
            )}
            {selectedOrg && (
              <Button onClick={() => navigate("/recruiter/interviews/new")} className="font-semibold gap-1.5">
                <Plus className="w-3.5 h-3.5" /> New Interview
              </Button>
            )}
          </div>
        </div>

        {/* Org info bar */}
        {selectedOrg && (
          <div className="border border-border/80 rounded-lg bg-card px-5 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Organization</p>
              <p className="text-[15px] font-bold text-foreground">{selectedOrg.name}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Members</p>
              <p className="text-[15px] font-bold text-foreground">{selectedOrg.members?.length || 1}</p>
            </div>
          </div>
        )}

        {/* No org state */}
        {organizations.length === 0 && (
          <div className="border-2 border-dashed border-border/60 rounded-xl p-16 text-center space-y-4 bg-surface/30">
            <Users className="w-10 h-10 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">Create your organization</h3>
              <p className="text-[13px] text-muted-foreground max-w-xs mx-auto">
                Set up your company to start creating interview sessions.
              </p>
            </div>
            <Button onClick={handleCreateOrg} className="font-semibold gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create Organization
            </Button>
          </div>
        )}

        {/* No interviews state */}
        {selectedOrg && interviews.length === 0 && (
          <div className="border-2 border-dashed border-border/60 rounded-xl p-16 text-center space-y-4 bg-surface/30">
            <FileText className="w-10 h-10 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No interview sessions</h3>
              <p className="text-[13px] text-muted-foreground max-w-xs mx-auto">
                Create a structured interview and invite candidates to complete it.
              </p>
            </div>
            <Button onClick={() => navigate("/recruiter/interviews/new")} className="font-semibold gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create Interview
            </Button>
          </div>
        )}

        {/* Interview list */}
        {selectedOrg && interviews.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Interview Sessions</h2>
            <div className="space-y-2">
              {interviews.map((interview) => (
                <div key={interview._id} className="border border-border/80 rounded-lg bg-card p-4 hover:border-primary/20 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[14px] font-bold text-foreground">{interview.title}</h3>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${
                          interview.status === "active" ? "bg-success/10 text-success border border-success/20" :
                          interview.status === "draft" ? "bg-warning/10 text-warning border border-warning/20" :
                          "bg-secondary text-muted-foreground border border-border"
                        }`}>
                          {interview.status}
                        </span>
                      </div>
                      <p className="text-[12px] text-muted-foreground">Role: {interview.targetRole}</p>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{interview.questions?.length || 0} questions</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />Expires {new Date(interview.expiresAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {interview.status === "active" && (
                        <Button size="sm" variant="outline" className="font-medium" onClick={() => handleGenerateInvite(interview._id)}>
                          <ExternalLink className="h-3.5 w-3.5 mr-1" /> Invite
                        </Button>
                      )}
                      {interview.status === "draft" && (
                        <Button size="sm" variant="outline" className="font-medium text-success border-success/30 hover:bg-success/10" onClick={() => handleUpdateStatus(interview._id, "active")}>
                          <Power className="h-3.5 w-3.5 mr-1" /> Activate
                        </Button>
                      )}
                      {interview.status === "active" && (
                        <Button size="sm" variant="outline" className="font-medium text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleUpdateStatus(interview._id, "closed")}>
                          <PowerOff className="h-3.5 w-3.5 mr-1" /> Close
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="font-medium" onClick={() => navigate(`/recruiter/interviews/${interview._id}`)}>
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
    </div>
  );
};

export default RecruiterDashboard;
