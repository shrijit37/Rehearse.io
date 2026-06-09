import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mic, MicOff, ArrowRight, Loader2, AlertCircle, Volume2, ArrowLeft, Briefcase } from "lucide-react";

interface ResultItem {
  question: string;
  transcription: string;
  score: number;
  feedback: string;
}

const PRESET_ROLES = [
  "Software Engineer",
  "Senior Software Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "Full Stack Engineer",
  "Data Scientist",
  "Product Manager",
  "DevOps Engineer",
  "Engineering Manager",
  "UX Designer",
];

const RehearsalRoom: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"role-picker" | "interview">("role-picker");
  const [targetRole, setTargetRole] = useState<string>("");
  const [customRole, setCustomRole] = useState<string>("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<{ score: number; feedback: string } | null>(null);
  const [sessionResults, setSessionResults] = useState<ResultItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startInterview = async (role: string) => {
    setTargetRole(role);
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("You must be logged in to enter the interview room.");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000";
      const response = await fetch(`${apiUrl}/api/rehearsal/start?targetRole=${encodeURIComponent(role)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to fetch scenario.");
      if (data.questions?.length > 0) setQuestions(data.questions);
      else throw new Error("No interview questions were returned.");
      setStep("interview");
    } catch (err: any) {
      setError(err.message || "An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0);
      timerIntervalRef.current = setInterval(() => setRecordingSeconds((p) => p + 1), 1000);
    } else {
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    }
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [isRecording]);

  const formatTimer = (seconds: number) =>
    `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;

  const handleToggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    } else {
      try {
        setError(null);
        setEvaluation(null);
        audioChunksRef.current = [];
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mediaRecorder;
        mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
          await handleEvaluate(blob);
        };
        mediaRecorder.start();
        setIsRecording(true);
      } catch {
        setError("Could not access microphone. Check permissions and try again.");
      }
    }
  };

  const handleEvaluate = async (audioBlob: Blob) => {
    setIsEvaluating(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated.");
      const formData = new FormData();
      formData.append("audio", audioBlob, "answer.webm");
      formData.append("question", questions[currentQuestionIndex]);
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000";
      const response = await fetch(`${apiUrl}/api/rehearsal/evaluate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Failed to evaluate.");
      const newResult = {
        question: questions[currentQuestionIndex],
        transcription: data.transcription || "",
        score: data.score,
        feedback: data.feedback,
      };
      setSessionResults((prev) => { const u = [...prev]; u[currentQuestionIndex] = newResult; return u; });
      setEvaluation({ score: data.score, feedback: data.feedback });
    } catch (err: any) {
      setError(err.message || "Evaluation failed.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleFinishSession = async (resultsPayload: ResultItem[]) => {
    setIsEvaluating(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated.");
      const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:9000";
      const response = await fetch(`${apiUrl}/api/rehearsal/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ results: resultsPayload, targetRole }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to save session.");
      }
      navigate("/dashboard");
    } catch (err: any) {
      navigate("/dashboard");
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNext = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    }
    setEvaluation(null);
    setError(null);
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((p) => p + 1);
    } else {
      const answered = sessionResults.filter(Boolean);
      if (answered.length === 0) navigate("/dashboard");
      else await handleFinishSession(answered);
    }
  };

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  // Role picker step
  if (step === "role-picker") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 pt-14">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center mx-auto border border-primary/15">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Choose Your Target Role</h1>
            <p className="text-[13px] text-muted-foreground max-w-sm mx-auto">
              Select the role you're interviewing for. The AI will tailor practice questions to match.
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-lg border border-destructive/20 text-center">
              {error}
            </div>
          )}

          <div className="border border-border/80 rounded-xl bg-card p-4 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              {PRESET_ROLES.map((role) => (
                <button
                  key={role}
                  onClick={() => startInterview(role)}
                  disabled={isLoading}
                  className={`p-3 rounded-lg border text-left transition-all text-[13px] font-medium ${
                    targetRole === role
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/60 hover:border-primary/30 hover:bg-secondary/50 text-foreground"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-border/80 rounded-xl bg-card p-4 shadow-sm space-y-3">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Or type a custom role</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Staff ML Engineer"
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customRole.trim()) startInterview(customRole.trim());
                }}
                className="text-[13px]"
              />
              <Button
                onClick={() => { if (customRole.trim()) startInterview(customRole.trim()); }}
                disabled={!customRole.trim() || isLoading}
                className="font-semibold shrink-0"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Go"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-[13px] font-medium text-muted-foreground mt-3">Preparing interview room...</p>
      </div>
    );
  }

  if (error && !questions.length) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm border border-border/80 rounded-xl bg-card p-8 flex flex-col items-center text-center space-y-5">
          <div className="w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-destructive" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-bold text-foreground">Unable to start interview</h3>
            <p className="text-[13px] text-muted-foreground">{error}</p>
          </div>
          <Button onClick={() => { setStep("role-picker"); setQuestions([]); setError(null); }} className="w-full font-semibold">Try Again</Button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercent = (currentQuestionIndex / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  return (
    <div className="min-h-screen bg-background flex flex-col pt-14">
      {/* Progress bar */}
      <div className="border-b border-border/60 bg-surface/80 backdrop-blur-sm sticky top-14 z-30 py-3 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="h-4 w-px bg-border/60" />
            <span className="text-[12px] font-semibold text-foreground">Question {currentQuestionIndex + 1} of {questions.length}</span>
          </div>
          <div className="flex items-center gap-3 w-44 sm:w-56">
            <div className="flex-1 bg-secondary h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="text-[11px] font-bold text-muted-foreground">{Math.round(progressPercent)}%</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col md:grid md:grid-cols-12 gap-5">
        {/* Interviewer panel */}
        <div className="md:col-span-5 flex flex-col">
          <div className="border border-border/80 shadow-sm bg-card rounded-xl flex-1 flex flex-col overflow-hidden min-h-[280px]">
            {/* Header */}
            <div className="border-b border-border/60 px-5 py-3 bg-secondary/15 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[12px] font-semibold text-foreground">Elena &middot; AI Evaluator</span>
              </div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-background border border-border px-2 py-0.5 rounded">
                Practice
              </span>
            </div>

            {/* Viewport */}
            <div className="flex-1 bg-secondary/20 p-5 flex flex-col justify-center items-center relative select-none">
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/15 flex items-center justify-center relative mb-5">
                <span className="absolute inset-0 rounded-full border border-primary/20 animate-ping opacity-40" style={{ animationDuration: "3s" }} />
                <Volume2 className="h-7 w-7 text-primary" />
              </div>
              <p className="text-[12px] text-muted-foreground text-center max-w-xs leading-relaxed">
                Listen, think, and click record when ready.
              </p>
            </div>

            {/* Question */}
            <div className="border-t border-border/60 p-5 bg-background">
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Question</span>
              <h2 className="text-[14px] font-semibold text-foreground leading-snug pt-1">"{currentQuestion}"</h2>
            </div>
          </div>
        </div>

        {/* Recording panel */}
        <div className="md:col-span-7 flex flex-col relative">
          {error && (
            <div className="bg-destructive/10 text-destructive text-[13px] font-medium p-3 rounded-lg border border-destructive/20 mb-3 flex items-center gap-2 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="border border-border/80 shadow-sm bg-card rounded-xl flex-1 flex flex-col overflow-hidden relative min-h-[340px]">
            {/* Viewfinder */}
            <div className="flex-1 bg-black relative flex flex-col justify-center items-center overflow-hidden">
              {isEvaluating ? (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-20 flex flex-col items-center justify-center gap-3 animate-in fade-in duration-200">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  <div className="text-center space-y-1">
                    <p className="text-[13px] font-semibold text-foreground">AI Speech Evaluation</p>
                    <p className="text-[11px] text-muted-foreground max-w-xs">Transcribing, scoring, and analyzing...</p>
                  </div>
                </div>
              ) : evaluation ? (
                <div className="absolute inset-0 bg-background/95 backdrop-blur-md z-20 flex flex-col justify-between p-5 overflow-y-auto animate-in fade-in duration-200">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div>
                        <span className="text-[10px] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded uppercase tracking-wider">Ready</span>
                        <h3 className="text-base font-bold pt-1 flex items-center gap-1">
                          Elena's Review
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase block">Score</span>
                        <span className="text-xl font-bold">{evaluation.score}<span className="text-[11px] text-muted-foreground">/10</span></span>
                      </div>
                    </div>
                    <p className="text-[13px] text-foreground leading-relaxed">{evaluation.feedback}</p>
                  </div>
                  <div className="border-t border-border/60 pt-3 flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEvaluation(null)} className="font-medium">Re-record</Button>
                    <Button onClick={handleNext} size="sm" className="font-medium gap-1">
                      {isLastQuestion ? "Finish" : "Next"} <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ) : null}

              {/* Simulated viewfinder */}
              <div className="absolute inset-0 flex flex-col items-center justify-center p-5 select-none">
                <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-2">
                  <Mic className="h-6 w-6 text-white/30" />
                </div>
                <span className="text-[11px] text-white/40">Simulated feed</span>
              </div>

              <div className="absolute inset-4 border border-white/5 rounded-lg pointer-events-none" />

              {/* Live indicators */}
              {isRecording ? (
                <>
                  <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-destructive/10 border border-destructive/20 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white">Live</span>
                  </div>
                  <div className="absolute bottom-3 left-3 bg-black/50 border border-white/10 px-2.5 py-1 rounded-full text-white font-mono text-[11px]">{formatTimer(recordingSeconds)}</div>
                </>
              ) : (
                <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full select-none">
                  <span className="w-1.5 h-1.5 bg-white/20 rounded-full" />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/50">Standby</span>
                </div>
              )}
            </div>

            {/* Controls */}
            {!evaluation && (
              <div className="border-t border-border/60 p-4 bg-background flex flex-col sm:flex-row items-center justify-between gap-3">
                <p className="text-[12px] text-muted-foreground font-medium">
                  {isRecording ? "Speak clearly into your microphone." : "Click record to start your answer."}
                </p>
                <Button
                  variant={isRecording ? "destructive" : "default"}
                  onClick={handleToggleRecording}
                  disabled={isEvaluating}
                  className="w-full sm:w-40 font-semibold shrink-0 h-9 rounded-full gap-2"
                >
                  {isRecording ? <><MicOff className="h-3.5 w-3.5" /> Stop</> : <><Mic className="h-3.5 w-3.5" /> Record</>}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RehearsalRoom;
