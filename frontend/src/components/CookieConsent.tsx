import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ShieldCheck, X } from "lucide-react";

type ConsentLevel = "essential" | "analytics" | "marketing";

const CONSENT_KEY = "rehearse_cookie_consent";

const CookieConsent = () => {
  const [visible, setVisible] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setVisible(true);
  }, []);

  const handleAcceptAll = () => {
    setAnalytics(true);
    setMarketing(true);
    saveConsent("analytics", true);
    saveConsent("marketing", true);
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ essential: true, analytics: true, marketing: true, date: new Date().toISOString() }));
    setVisible(false);
  };

  const handleEssentialOnly = () => {
    setAnalytics(false);
    setMarketing(false);
    saveConsent("analytics", false);
    saveConsent("marketing", false);
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ essential: true, analytics: false, marketing: false, date: new Date().toISOString() }));
    setVisible(false);
  };

  const handleSavePreferences = () => {
    saveConsent("analytics", analytics);
    saveConsent("marketing", marketing);
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ essential: true, analytics, marketing, date: new Date().toISOString() }));
    setVisible(false);
  };

  const saveConsent = (_level: ConsentLevel, _granted: boolean) => {
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${import.meta.env.VITE_API_URL || "http://localhost:9000"}/api/auth/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ consentGiven: true, consentVersion: "1.0" }),
      }).catch(() => {});
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-3xl mx-auto bg-card border border-border/80 rounded-xl shadow-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 bg-primary/10 border border-primary/15 text-primary rounded-lg flex items-center justify-center shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-3.5">
            <div>
              <h3 className="text-[13px] font-bold text-foreground">Cookie Preferences</h3>
              <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
                Essential cookies are required for authentication and security.
                Optional cookies help us improve the platform. You can customize below.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <label className="flex items-center gap-2 p-2.5 bg-surface rounded-lg border border-border/60">
                <input type="checkbox" checked disabled className="accent-primary shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Essential</p>
                  <p className="text-[10px] text-muted-foreground">Required for login & security</p>
                </div>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-surface rounded-lg border border-border/60 cursor-pointer hover:border-primary/30 transition-colors">
                <input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} className="accent-primary shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Analytics</p>
                  <p className="text-[10px] text-muted-foreground">Usage patterns & performance</p>
                </div>
              </label>
              <label className="flex items-center gap-2 p-2.5 bg-surface rounded-lg border border-border/60 cursor-pointer hover:border-primary/30 transition-colors">
                <input type="checkbox" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} className="accent-primary shrink-0" />
                <div>
                  <p className="text-[12px] font-semibold text-foreground">Marketing</p>
                  <p className="text-[10px] text-muted-foreground">Personalized recommendations</p>
                </div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Button size="sm" className="font-semibold" onClick={handleAcceptAll}>Accept All</Button>
              <Button size="sm" variant="outline" className="font-semibold" onClick={handleEssentialOnly}>Essential Only</Button>
              <Button size="sm" variant="ghost" className="font-semibold" onClick={handleSavePreferences}>Save Preferences</Button>
            </div>
          </div>
          <button onClick={handleEssentialOnly} className="text-muted-foreground hover:text-foreground p-1 shrink-0 transition-colors" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
