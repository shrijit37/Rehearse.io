import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertCircle, BarChart3, MessageSquare, Calendar, Users } from "lucide-react";
import { api } from "@/lib/api";

const CandidateResults: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [interview, setInterview] = useState<any>(null);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { navigate("/recruiter"); return; }
    fetchData();
  }, [id]);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<{ interview: any; candidates: any[] }>(`/api/interviews/${id}`);
      setInterview(data.interview);
      setCandidates(data.candidates || []);
      if (data.candidates?.length > 0) setSelectedCandidate(data.candidates[0]);
    } catch (err: any) { setError(err.message); }
    finally { setIsLoading(false); }
  };

  if (isLoading) return (
    <div className="min-h-screen bg-background py-8 px-4 mt-14">
      <div className="max-w-5xl mx-auto space-y-8 animate-pulse">
        <div className="h-7 w-64 bg-secondary rounded-md" />
        <div className="h-96 bg-secondary/30 rounded-xl" />
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 mt-14">
      <div className="w-full max-w-sm border border-border/80 rounded-xl bg-card p-8 text-center space-y-4">
        <AlertCircle className="w-6 h-6 text-destructive mx-auto" />
        <p className="text-[13px] font-semibold">{error}</p>
        <Button onClick={fetchData} className="font-medium">Retry</Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8 mt-14">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-border/60 pb-6">
          <Button variant="ghost" size="sm" onClick={() => navigate("/recruiter")} className="text-muted-foreground font-medium gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-[-0.02em] text-foreground">{interview?.title}</h1>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
              <span>{interview?.targetRole}</span>
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(interview?.expiresAt).toLocaleDateString()}</span>
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{candidates.length} invited</span>
            </div>
          </div>
        </div>

        {candidates.length === 0 ? (
          <div className="border-2 border-dashed border-border/60 rounded-xl p-16 text-center space-y-4 bg-surface/30">
            <Users className="w-10 h-10 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-foreground">No candidates yet</h3>
              <p className="text-[13px] text-muted-foreground">Generate an invite link from the dashboard to get started.</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Candidate list */}
            <div className="lg:col-span-4 space-y-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">Candidates ({candidates.length})</h2>
              <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
                {candidates.map((c) => {
                  const isSelected = selectedCandidate?._id === c._id;
                  const avg = c.results?.length ? (c.results.reduce((a: number, r: any) => a + (r.score || 0), 0) / c.results.length).toFixed(1) : "—";
                  return (
                    <button key={c._id} onClick={() => setSelectedCandidate(c)}
                      className={`w-full text-left p-3.5 border rounded-lg transition-all ${
                        isSelected ? "bg-card border-primary/60 shadow-sm" : "bg-card border-border/60 hover:border-primary/30"
                      }`}>
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold text-foreground truncate">{c.candidate?.name || "Candidate"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{c.candidate?.email}</p>
                          <span className={`inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider ${
                            c.status === "completed" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                          }`}>{c.status}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">Avg</p>
                          <p className="text-lg font-bold text-foreground">{avg}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Results detail */}
            <div className="lg:col-span-8">
              {selectedCandidate?.results?.length > 0 ? (
                <div className="border border-border/80 rounded-xl bg-card overflow-hidden">
                  <div className="border-b border-border/60 bg-secondary/15 px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold flex items-center gap-1.5">
                        <BarChart3 className="h-4 w-4 text-primary" /> {selectedCandidate.candidate?.name}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{selectedCandidate.candidate?.email}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-muted-foreground uppercase block">Score</span>
                      <span className="text-xl font-bold">
                        {(selectedCandidate.results.reduce((a: number, r: any) => a + (r.score || 0), 0) / selectedCandidate.results.length).toFixed(1)}
                        <span className="text-[11px] text-muted-foreground">/10</span>
                      </span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4 max-h-[500px] overflow-y-auto">
                    {selectedCandidate.results.map((result: any, idx: number) => (
                      <div key={idx} className="border border-border/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-2.5">
                          <div className="flex items-start gap-2">
                            <span className="text-[11px] font-bold text-primary">{idx + 1}.</span>
                            <h4 className="text-[13px] font-semibold">{result.question}</h4>
                          </div>
                          <span className="shrink-0 px-2 py-0.5 bg-secondary text-[11px] font-bold rounded border border-border">{result.score}/10</span>
                        </div>
                        {result.transcription && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-semibold uppercase text-muted-foreground flex items-center gap-1">
                              <MessageSquare className="h-3 w-3" /> Transcription
                            </span>
                            <div className="bg-secondary/40 border-l-2 border-l-primary text-[12px] italic p-2.5 rounded-r-md">{result.transcription}</div>
                          </div>
                        )}
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold uppercase text-muted-foreground">AI Feedback</span>
                          <p className="text-[13px] leading-relaxed">{result.feedback}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : selectedCandidate ? (
                <div className="h-96 border border-border/80 rounded-xl bg-card flex flex-col items-center justify-center text-center p-6">
                  <p className="text-[13px] text-muted-foreground">This candidate has not completed the interview yet.</p>
                  <p className="text-[11px] text-muted-foreground/70 mt-1">Status: {selectedCandidate.status}</p>
                </div>
              ) : (
                <div className="h-96 border border-border/80 rounded-xl bg-card flex flex-col items-center justify-center text-center p-6">
                  <p className="text-[13px] text-muted-foreground">Select a candidate to view results</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateResults;
