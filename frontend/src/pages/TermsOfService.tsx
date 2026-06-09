import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pt-20 pb-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6 font-medium text-muted-foreground gap-1.5">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>

        <div className="border border-border/80 rounded-xl bg-card shadow-sm overflow-hidden">
          <div className="p-8 sm:p-10 space-y-8">
            <div className="space-y-1.5">
              <h1 className="text-2xl font-bold tracking-[-0.02em] text-foreground">Terms of Service</h1>
              <p className="text-[12px] text-muted-foreground">Last updated: June 9, 2026 | Version 1.0</p>
            </div>

            <div className="space-y-6 text-[13px] text-foreground/85 leading-relaxed">
              <section>
                <h2 className="text-base font-bold text-foreground mb-2">1. Acceptance of Terms</h2>
                <p>
                  By accessing or using Rehearse.io ("the Platform"), you agree to be bound by these Terms of Service.
                  If you do not agree, do not use the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">2. Description of Service</h2>
                <p>
                  Rehearse.io is an enterprise B2B platform for conducting automated first-round interviews. Organizations
                  ("Recruiters") create interview sessions, invite candidates, and review AI-evaluated responses. Candidates
                  complete asynchronous interviews by recording audio responses to structured questions.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">3. Account Responsibilities</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>You must provide accurate and complete information during registration.</li>
                  <li>You are responsible for maintaining the confidentiality of your password.</li>
                  <li>You must notify us immediately of any unauthorized use of your account.</li>
                  <li>You may not share your account credentials with others.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">4. Acceptable Use</h2>
                <ul className="list-disc pl-5 space-y-1.5">
                  <li>You may not use the Platform for any unlawful purpose.</li>
                  <li>You may not attempt to gain unauthorized access to any part of the Platform.</li>
                  <li>Recruiters may not use candidate interview data for purposes other than legitimate hiring evaluation.</li>
                  <li>You may not transmit harmful, offensive, or discriminatory content through the Platform.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">5. Intellectual Property</h2>
                <p>
                  The Platform, including its design, code, and content, is owned by Rehearse.io and protected by
                  intellectual property laws. Candidate interview responses and recordings remain the intellectual
                  property of the candidate, with a license granted to the organization for hiring evaluation purposes only.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">6. Data Processing</h2>
                <p>
                  We process personal data in accordance with our Privacy Policy. By using the Platform, you consent
                  to the processing of your data as described therein. Organizations are responsible for ensuring they
                  have lawful basis to share candidate data with the Platform.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">7. Limitation of Liability</h2>
                <p>
                  Rehearse.io provides the Platform "as is" without warranties. We are not liable for any indirect,
                  incidental, or consequential damages. Our total liability shall not exceed the fees paid by you in
                  the twelve months preceding the claim.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">8. Termination</h2>
                <p>
                  Either party may terminate this agreement at any time. Upon termination, your right to use the
                  Platform ceases. We may retain data as required by law or as described in our Privacy Policy.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">9. Changes to Terms</h2>
                <p>
                  We reserve the right to modify these terms at any time. Material changes will be notified via
                  email and prominent notice on the Platform. Continued use after changes constitutes acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-base font-bold text-foreground mb-2">10. Contact</h2>
                <p>
                  Questions about these Terms should be sent to legal@rehearse.io.
                </p>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
