import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ShieldCheck } from "lucide-react";

const CONSENT_KEY = "rehearse_cookie_consent";
const CONSENT_VERSION = "2026-10";

/* This site stores only what keeps a session working. There is no analytics,
   advertising, or third-party code to consent to, so the notice states what is
   stored and asks for nothing it cannot honour. */
const CookieConsent = () => {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		try {
			if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
		} catch {
			// Storage blocked (private mode, disabled cookies) — the notice cannot be
			// remembered, but it should still be shown.
			setVisible(true);
		}
	}, []);

	const acknowledge = () => {
		try {
			localStorage.setItem(
				CONSENT_KEY,
				JSON.stringify({
					essential: true,
					version: CONSENT_VERSION,
					date: new Date().toISOString(),
				}),
			);
		} catch {
			// Quota or blocked storage: the acknowledgement still counts for this
			// session, so carry on rather than failing the whole flow.
		}
		// Record the same acknowledgement against the account, when signed in
		if (localStorage.getItem("user")) {
			api
				.post("/api/users/consent", {
					consentGiven: true,
					consentVersion: CONSENT_VERSION,
				})
				.catch((err) => console.error("Failed to record consent:", err));
		}
		setVisible(false);
	};

	if (!visible) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
			<div className="max-w-3xl mx-auto bg-card border-2 border-sign-black rounded-md p-5">
				<div className="flex items-start gap-4">
					<div className="w-9 h-9 bg-sign-black text-sign-yellow rounded-md flex items-center justify-center shrink-0">
						<ShieldCheck className="h-4 w-4" />
					</div>
					<div className="flex-1 space-y-3">
						<h3 className="text-[13px] font-bold text-foreground">
							What this site stores
						</h3>
						<p className="text-[12.5px] text-muted-foreground leading-relaxed">
							Your session is held in a cookie set by our sign-in service, and
							this site caches your name and email in your browser. That is
							everything it stores. There is no analytics, no advertising, and
							no third-party tracking here.
						</p>
						<Button size="sm" className="font-semibold" onClick={acknowledge}>
							Got it
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default CookieConsent;
