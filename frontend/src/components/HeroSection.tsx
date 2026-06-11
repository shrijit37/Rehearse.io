import { ArrowRight, Mic, CheckCircle2, BarChart3, Shield } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="min-h-screen flex flex-col relative bg-[#131313] pt-14 overflow-hidden">
      {/* Hero content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-20 lg:py-28 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Badge — mono uppercase */}
            <div className="inline-flex items-center gap-2 border border-border bg-[#2d2d2d] px-3.5 py-1.5 rounded-[20px] font-mono text-xs uppercase tracking-[1.5px] text-muted-foreground select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              Enterprise async interviews
            </div>

            {/* Whisper-vs-shout: thin weight eyebrow above the hero shout */}
            <div className="space-y-4">
              <p className="type-whisper text-muted-foreground">
                First-round interviews, reimagined
              </p>

              {/* Hero headline — display font (Anton substitute for Manuka) */}
              <h1 className="type-hero text-5xl sm:text-6xl lg:text-[5rem] text-foreground max-w-2xl mx-auto">
                Structured first rounds,
                <br />
                <span className="text-primary">evaluated by AI.</span>
              </h1>
            </div>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Recruiters build sessions in minutes. Candidates interview on their schedule. Every answer scored consistently, with full transcription and feedback.
            </p>

            {/* CTAs — Verge pill buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
              <Button
                size="pill"
                onClick={() => navigate("/signup")}
              >
                Create your account
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="pill"
                onClick={() => navigate("/signup")}
              >
                See how it works
              </Button>
            </div>

            {/* Trust signals */}
            <div className="flex items-center justify-center gap-6 pt-6 text-[13px] text-muted-foreground border-t border-border max-w-md mx-auto">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#309875]" />
                <span>No setup fees</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#309875]" />
                <span>14-day trial</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#309875]" />
                <span>GDPR</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product preview */}
      <div className="border-t border-border bg-surface/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-5xl mx-auto">
            {/* Mock browser chrome — flat, no shadow */}
            <div className="bg-card border border-border rounded-[20px] overflow-hidden">
              {/* Title bar */}
              <div className="h-9 border-b border-border bg-[#2d2d2d] flex items-center justify-between px-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/20" />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground/70 bg-[#131313] border border-border px-5 py-0.5 rounded-[4px]">
                  rehearse.io/recruiter
                </div>
                <div className="w-10" />
              </div>

              {/* Content area */}
              <div className="flex flex-col md:flex-row min-h-[340px]">
                {/* Interview question panel */}
                <div className="flex-1 p-6 flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary">Question 2 of 5</span>
                    <h3 className="text-sm font-semibold text-foreground leading-snug">
                      Describe your approach to designing a scalable microservices architecture.
                    </h3>
                  </div>

                  <div className="flex-1 bg-[#2d2d2d]/30 rounded-[4px] border border-border flex flex-col items-center justify-center relative">
                    <div className="w-14 h-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
                      <Mic className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground">Candidate recording</span>

                    {/* Live indicator — no backdrop-blur */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-[#131313]/80 border border-border px-2 py-0.5 rounded-[20px]">
                      <span className="w-1.5 h-1.5 bg-destructive rounded-full animate-pulse" />
                      <span className="font-mono text-[8px] font-bold uppercase tracking-wider text-foreground">Live</span>
                    </div>

                    {/* Waveform — no backdrop-blur */}
                    <div className="absolute bottom-3 left-3 right-3 h-7 bg-[#131313]/80 border border-border rounded-[4px] p-1.5 flex items-center gap-px">
                      {[40, 65, 50, 85, 70, 55, 30, 60, 80, 75, 45].map((h, i) => (
                        <div key={i} className="flex-1 bg-primary/50 rounded-full" style={{ height: `${h}%` }} />
                      ))}
                      <span className="font-mono text-[8px] font-medium text-muted-foreground ml-1">01:04</span>
                    </div>
                  </div>
                </div>

                {/* AI evaluation sidebar */}
                <div className="w-full md:w-52 border-t md:border-t-0 md:border-l border-border p-5 flex flex-col gap-4 bg-[#2d2d2d]/10">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-foreground">AI Evaluator</span>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-success/10 text-success px-1.5 py-0.5 rounded-[4px] border border-success/20">
                      Active
                    </span>
                  </div>

                  <div className="flex flex-col items-center py-2">
                    <div className="relative w-16 h-16 rounded-full border-[3px] border-secondary flex items-center justify-center">
                      <div className="absolute inset-0 rounded-full border-[3px] border-t-primary border-r-primary border-l-transparent border-b-transparent rotate-45" />
                      <span className="text-xl font-bold text-foreground">8.2</span>
                    </div>
                    <span className="font-mono text-[9px] text-muted-foreground uppercase font-bold tracking-wider mt-1">Score</span>
                  </div>

                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[10px] font-semibold">
                        <span className="text-muted-foreground">Content</span>
                        <span className="text-foreground">85%</span>
                      </div>
                      <div className="h-1.5 bg-[#2d2d2d] rounded-[2px] overflow-hidden">
                        <div className="h-full bg-primary rounded-[2px]" style={{ width: "85%" }} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between font-mono text-[10px] font-semibold">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="text-foreground">78%</span>
                      </div>
                      <div className="h-1.5 bg-[#2d2d2d] rounded-[2px] overflow-hidden">
                        <div className="h-full bg-primary rounded-[2px]" style={{ width: "78%" }} />
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary/[0.05] border border-primary/15 rounded-[4px] p-2.5 space-y-1 mt-auto">
                    <div className="flex items-center gap-1">
                      <BarChart3 className="h-3 w-3 text-primary" />
                      <span className="text-[9px] font-bold text-foreground">Strong answer</span>
                    </div>
                    <p className="text-[9px] leading-relaxed text-muted-foreground">
                      Excellent service decomposition. Consider reducing pauses for better pacing.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features strip */}
      <div className="border-t border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-[20px] bg-primary/10 border border-primary/15 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Structured sessions</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Create role-specific interview templates with custom questions. Every candidate gets the same evaluation.
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-[20px] bg-primary/10 border border-primary/15 flex items-center justify-center">
                <Mic className="h-[18px] w-[18px] text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Async audio responses</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Candidates record answers on their own time. No scheduling conflicts. No timezone headaches.
              </p>
            </div>
            <div className="space-y-2.5">
              <div className="w-9 h-9 rounded-[20px] bg-primary/10 border border-primary/15 flex items-center justify-center">
                <BarChart3 className="h-[18px] w-[18px] text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">AI evaluation at scale</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Transcription, scoring, and detailed feedback for every answer. Consistent rubric, no interviewer bias.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
