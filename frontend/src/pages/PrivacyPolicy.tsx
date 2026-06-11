import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 font-medium text-muted-foreground gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>

        <div className="border border-border rounded-[20px] bg-card  overflow-hidden">
          <div className="p-8 sm:p-10 space-y-8">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">Privacy Policy</h1>
              <p className="text-[12px] text-muted-foreground">Last updated: June 9, 2026 | Version 1.0</p>
            </div>

            <div className="space-y-6 text-[13px] text-foreground/85 leading-relaxed">
              <section>
                <h2 className="text-base font-bold text-foreground mb-2">1. Introduction</h2>
                <p>
                  Rehearse.io ("we", "us", "our") is an enterprise interview platform that enables organizations to conduct
                  structured first-round interviews. We are committed to protecting your privacy and handling your data
                  in compliance with the General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">2. Data We Collect</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Account Data:</strong> Name, email address, password (bcrypt-hashed), and role.</li>
                  <li><strong>Profile Data (Candidates):</strong> Resume, profile photo, and voice sample submitted during onboarding.</li>
                  <li><strong>Interview Data:</strong> Responses, transcriptions, AI-generated scores and feedback, session metadata.</li>
                  <li><strong>Consent Records:</strong> Cookie and data processing consent choices with timestamps and version.</li>
                  <li><strong>Usage Data:</strong> Audit logs of actions with hashed IP addresses (SHA-256).</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">3. How We Use Your Data</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>To provide the interview platform service (question generation, speech-to-text, AI evaluation).</li>
                  <li>To authenticate users and secure platform access.</li>
                  <li>To maintain audit logs for security and compliance.</li>
                  <li>To comply with legal obligations and respond to lawful requests.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">4. Data Sharing</h2>
                <p>
                  We do not sell your personal data. We share data only with third-party AI services (Groq, OpenAI) strictly for
                  interview evaluation processing. These processors are bound by data processing agreements. We do not share
                  data with any other third parties unless required by law.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">5. Data Retention</h2>
                <p>
                  Account data is retained while your account is active. When you delete your account, all personal data,
                  interview sessions, and associated records are permanently deleted. Audit log entries are retained for
                  30 days for security purposes, after which hashed identifiers are anonymized.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">6. Your Rights (GDPR/CCPA)</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li><strong>Right of Access:</strong> Request a copy of all personal data (Account Settings, Export Data).</li>
                  <li><strong>Right to Deletion:</strong> Request permanent deletion (Account Settings, Delete Account).</li>
                  <li><strong>Right to Rectification:</strong> Update your personal information at any time.</li>
                  <li><strong>Right to Object:</strong> Object to data processing for specific purposes.</li>
                  <li><strong>Right to Withdraw Consent:</strong> Withdraw consent for optional processing at any time.</li>
                  <li><strong>Right to Portability:</strong> Receive your data in a structured, machine-readable format (JSON).</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">7. Data Security</h2>
                <p>
                  We implement industry-standard security measures including bcrypt password hashing (cost factor 12),
                  JWT authentication with expiration, HTTP security headers (Helmet.js), rate limiting on all endpoints,
                  CORS origin restrictions, and encrypted communications. However, no method of transmission over the
                  Internet is 100% secure.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">8. Cookies</h2>
                <p>
                  We use essential cookies for authentication and security. Optional cookies are used for analytics and
                  marketing purposes only with your explicit consent. You can manage preferences at any time
                  via the cookie banner or Account Settings.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">9. Changes to This Policy</h2>
                <p>
                  We may update this policy from time to time. Material changes will be communicated via email and a
                  prominent notice on the platform. Your continued use after changes constitutes acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">10. Contact Us</h2>
                <p>
                  For privacy-related questions or to exercise your data rights, contact us at privacy@rehearse.io or
                  through Account Settings.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
