import { ArrowRight, Mic, CheckCircle2, BarChart3, Shield, Code2 } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

const HeroSection = () => {
  const navigate = useNavigate();

  /* The one route every interview takes. Signage states the route, not a claim. */
  const route = [
    { label: "Behavioral", note: "voice round" },
    { label: "DSA", note: "coding round" },
    { label: "Done", note: "scored and recorded" },
  ];

  // A sign system sizes a band to its content, so the hero is capped: a tall
  // display must not stretch it into a void.
  return (
    <section className="min-h-[min(100svh,900px)] flex flex-col relative on-sign pt-14 overflow-hidden">
      {/* Route band — the world's next-decision band, showing the mechanism */}
      <div className="bg-sign-yellow text-sign-black">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-x-6 gap-y-1">
          <span className="text-[13px] font-semibold">Every interview runs one route</span>
          <div className="flex items-center gap-3 text-[13px] font-bold">
            {route.map((step, i) => (
              <span key={step.label} className="flex items-center gap-3">
                {i > 0 && <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>{step.label}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hero content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-14 lg:py-20 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-7">
            <h1 className="type-monument type-monument-tight text-[3.25rem] sm:text-7xl lg:text-[6.25rem] text-sign-white max-w-4xl mx-auto">
              Structured first rounds,
              <br />
              <span className="text-sign-yellow">scored on one rubric.</span>
            </h1>

            <p className="text-base sm:text-lg text-white/75 max-w-xl mx-auto leading-relaxed">
              Recruiters build behavioral, DSA, or mixed rounds in minutes. Candidates complete
              them on their own schedule. Every answer and code submission is scored against the
              same rubric, so candidates are compared on identical dimensions.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-1">
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
                className="bg-transparent text-sign-white border-sign-white hover:bg-sign-white hover:text-sign-black"
                asChild
              >
                <a href="#how-it-works">See how it works</a>
              </Button>
            </div>

            {/* What is true of the product — no commercial claims */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-7 text-[13px] text-white/70 border-t border-white/20 max-w-2xl mx-auto">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-sign-white/50" />
                <span>One rubric, every candidate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-sign-white/50" />
                <span>GDPR data export and deletion</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-sign-white/50" />
                <span>Async — no scheduling</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Product preview — synthetic sample content, labelled as such.
          Light ground nested in the sign layer, so it resets the text colour. */}
      <div id="how-it-works" className="scroll-mt-14 border-t-2 border-sign-black bg-background text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <span className="type-sign-label text-muted-foreground">
                Behavioral round — sample data, not a real candidate
              </span>
            </div>

            <div className="bg-card border-2 border-sign-black rounded-md overflow-hidden">
              {/* Title bar — the real live host, not a parked domain */}
              <div className="h-9 border-b border-border bg-sign-black flex items-center justify-between px-4">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
                </div>
                <div className="text-[10px] text-white/60 bg-white/10 border border-white/15 px-5 py-0.5 rounded-sm">
                  rehearse.io.shrijit.tech/recruiter
                </div>
                <div className="w-10" />
              </div>

              {/* Content area */}
              <div className="flex flex-col md:flex-row min-h-[340px]">
                {/* Question panel */}
                <div className="flex-1 p-6 flex flex-col gap-4">
                  <div className="space-y-1.5">
                    <span className="type-sign-label text-muted-foreground">Question 2 of 5</span>
                    <h3 className="text-sm font-semibold text-foreground leading-snug">
                      Describe your approach to designing a scalable microservices architecture.
                    </h3>
                  </div>

                  <div className="flex-1 min-h-[190px] bg-sign-black rounded-sm border border-sign-black flex flex-col items-center justify-center relative">
                    <div className="w-14 h-14 rounded-full border-2 border-white/25 flex items-center justify-center mb-2">
                      <Mic className="h-6 w-6 text-sign-white" />
                    </div>
                    <span className="text-[11px] font-medium text-white/70">Candidate recording</span>

                    {/* Elapsed time — a stopwatch, not a countdown */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/10 border border-white/20 px-2 py-0.5 rounded-sm">
                      <span className="w-1.5 h-1.5 bg-sign-red rounded-full" />
                      <span className="text-[10px] font-semibold text-sign-white">Recording</span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 h-7 bg-white/10 border border-white/20 rounded-sm p-1.5 flex items-center gap-px">
                      {[40, 65, 50, 85, 70, 55, 30, 60, 80, 75, 45].map((h, i) => (
                        <div key={i} className="flex-1 bg-white/40 rounded-[1px]" style={{ height: `${h}%` }} />
                      ))}
                      <span className="text-[10px] font-semibold text-white/70 ml-1">01:04</span>
                    </div>
                  </div>
                </div>

                {/* Evaluation panel — the artifact the product really returns */}
                <div className="w-full md:w-72 border-t md:border-t-0 md:border-l border-border p-5 flex flex-col gap-4 bg-surface-hover">
                  <span className="type-sign-label text-muted-foreground">Behavioral evaluation</span>

                  <div className="flex items-baseline gap-1.5">
                    <span className="type-score text-5xl" data-mag="high">8</span>
                    <span className="text-sm text-muted-foreground font-medium">/ 10</span>
                  </div>

                  <div className="space-y-1.5">
                    <span className="type-sign-label text-muted-foreground">Written feedback</span>
                    <p className="text-[13px] leading-relaxed text-foreground">
                      Clear service decomposition and a sensible boundary argument. Delivery was
                      steady; a few answers ran long before reaching the point.
                    </p>
                  </div>

                  <div className="mt-auto border-t border-border pt-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Code2 className="h-3 w-3 text-muted-foreground" />
                      <span className="type-sign-label text-muted-foreground">DSA round</span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      Overall, correctness and code quality are scored the same way.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Legend — the three properties, ruled apart as one panel rather than
          gapped as three cards. */}
      <div id="how-it-works" className="scroll-mt-14 border-t-2 border-sign-black bg-background text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 border-2 border-sign-black bg-card divide-y-2 md:divide-y-0 md:divide-x-2 divide-sign-black">
            <div className="p-6 space-y-3">
              <div className="w-9 h-9 rounded-sm bg-sign-black text-sign-white flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sign-white">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-foreground">Structured sessions</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Build role-specific rounds from your own questions. Every candidate is asked the same ones.
              </p>
            </div>
            <div className="p-6 space-y-3">
              <div className="w-9 h-9 rounded-sm bg-sign-black text-sign-white flex items-center justify-center">
                <Mic className="h-[18px] w-[18px] text-sign-white" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Async audio rounds</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Candidates record answers on their own schedule. No scheduling conflicts, no timezone arithmetic.
              </p>
            </div>
            <div className="p-6 space-y-3">
              <div className="w-9 h-9 rounded-sm bg-sign-black text-sign-white flex items-center justify-center">
                <BarChart3 className="h-[18px] w-[18px] text-sign-white" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">Scored against one rubric</h3>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Transcription, a 1–10 score, and written feedback for every answer. Code is reviewed statically, not executed.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
