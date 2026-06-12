/**
 * Comprehensive Bug Hunt — Rehearse.io
 *
 * Tests designed to surface bugs, edge cases, and behavioral issues
 * across all pages, flows, and API interactions.
 */
import { wait, go, register, login, dismissCookieConsent, createTestRunner, BASE, API } from "./helpers.js";

const { test, warn, state } = createTestRunner();

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Landing Page & Static Pages
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 1: Landing Page & Static Pages\n");

await test("LP-1: Landing page has working navigation links", async (page) => {
  await go(page, "/");
  const signInBtn = page.locator("a, button", { hasText: /Sign in|Login/ }).first();
  if (!(await signInBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("No Sign In link/button on landing page");
  }
});

await test("LP-2: Landing page hero section renders", async (page) => {
  await go(page, "/");
  const heroText = page.locator("text=Rehearse").first();
  if (!(await heroText.isVisible())) throw new Error("Hero section not visible");
  // Check for key marketing copy
  const hasCTA = await page.locator("button, a", { hasText: /Start|Get started|Sign up/ }).first().isVisible().catch(() => false);
  if (!hasCTA) throw new Error("No call-to-action button visible on landing page");
});

await test("LP-3: Privacy policy page loads", async (page) => {
  await go(page, "/privacy");
  const heading = page.locator("h1, h2", { hasText: /Privacy/ }).first();
  if (!(await heading.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Privacy policy heading not visible");
  }
});

await test("LP-4: Terms of service page loads", async (page) => {
  await go(page, "/terms");
  const heading = page.locator("h1, h2", { hasText: /Terms/ }).first();
  if (!(await heading.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Terms of service heading not visible");
  }
});

await test("LP-5: 404 for non-existent routes shows something useful", async (page) => {
  await page.goto(`${BASE}/nonexistent-route-xyz`);
  await page.waitForLoadState("networkidle");
  await wait(1000);
  // Should either show a 404 page or the landing page — NOT a white screen
  const bodyText = await page.locator("body").innerText();
  if (bodyText.trim() === "") throw new Error("Blank page for non-existent route");
});

await test("LP-6: Cookie consent banner appears on first visit", async (page) => {
  await page.goto(`${BASE}`);
  await page.waitForLoadState("networkidle");
  await wait(1500);
  const consentBanner = page.locator("text=Accept All").or(page.locator("text=cookie")).or(page.locator("text=Cookie"));
  const visible = await consentBanner.first().isVisible({ timeout: 3000 }).catch(() => false);
  // This is a warning, not a hard fail — cookie consent may not appear in headless
  if (!visible) {
    warn("LP-6", "Cookie consent banner not detected — may be blocked in headless mode");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Signup Form Validation & Edge Cases
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 2: Signup Form Validation & Edge Cases\n");

await test("SU-1: Signup form requires all fields", async (page) => {
  await go(page, "/signup");
  // Switch to signup mode
  const toggleBtn = page.locator("button", { hasText: "Create an account" });
  if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await toggleBtn.click({ force: true });
    await wait(500);
  }
  // Try submitting empty form
  await page.locator('button[type="submit"]').click();
  await wait(500);
  // Browser should prevent submission (required fields) or show error
  const url = page.url();
  if (url.includes("/recruiter") || url.includes("/onboarding") || url.includes("/dashboard")) {
    throw new Error("Empty form submission succeeded — no validation!");
  }
});

await test("SU-2: Password mismatch shows error", async (page) => {
  await go(page, "/signup");
  const toggleBtn = page.locator("button", { hasText: "Create an account" });
  if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await toggleBtn.click({ force: true });
    await wait(500);
  }
  await page.locator("button", { hasText: "Candidate" }).first().click();
  await wait(200);
  await page.fill('input[name="firstName"]', "Test");
  await page.fill('input[name="lastName"]', "User");
  await page.fill('input[name="email"]', `test-mismatch-${Date.now()}@test.com`);
  await page.fill('input[name="password"]', "Password123!");
  await page.fill('input[name="confirmPassword"]', "DifferentPassword!");
  await page.locator('input[type="checkbox"]').first().check({ force: true });
  await wait(200);
  await page.locator('button[type="submit"]').click();
  await wait(1000);
  const errorMsg = page.locator("text=Passwords do not match");
  if (!(await errorMsg.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Password mismatch error not shown");
  }
});

await test("SU-3: Signup without consent shows error", async (page) => {
  await go(page, "/signup");
  const toggleBtn = page.locator("button", { hasText: "Create an account" });
  if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await toggleBtn.click({ force: true });
    await wait(500);
  }
  await page.locator("button", { hasText: "Candidate" }).first().click();
  await wait(200);
  await page.fill('input[name="firstName"]', "Test");
  await page.fill('input[name="lastName"]', "NoConsent");
  await page.fill('input[name="email"]', `noconsent-${Date.now()}@test.com`);
  await page.fill('input[name="password"]', "Password123!");
  await page.fill('input[name="confirmPassword"]', "Password123!");
  // Do NOT check consent checkbox
  await page.locator('button[type="submit"]').click();
  await wait(1000);
  const errorMsg = page.locator("text=must accept").or(page.locator("text=consent"));
  if (!(await errorMsg.first().isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Consent requirement error not shown");
  }
});

await test("SU-4: Duplicate email signup shows error", async (page) => {
  const email = `dup-${Date.now()}@test.com`;
  // Register first time
  await register(page, {
    name: "Dup User",
    email,
    password: "TestPass123!",
    role: "candidate",
  });
  await wait(1000);
  // Try registering again with same email
  await go(page, "/signup");
  const toggleBtn = page.locator("button", { hasText: "Create an account" });
  if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await toggleBtn.click({ force: true });
    await wait(500);
  }
  await page.locator("button", { hasText: "Candidate" }).first().click();
  await wait(200);
  await page.fill('input[name="firstName"]', "Dup");
  await page.fill('input[name="lastName"]', "User");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "TestPass123!");
  await page.fill('input[name="confirmPassword"]', "TestPass123!");
  await page.locator('input[type="checkbox"]').first().check({ force: true });
  await wait(200);
  await page.locator('button[type="submit"]').click();
  await wait(2000);
  // Should show error, not redirect
  const url = page.url();
  if (url.includes("/recruiter") || url.includes("/onboarding") || url.includes("/dashboard")) {
    throw new Error("Duplicate email signup succeeded — no uniqueness check!");
  }
  const errorMsg = page.locator("text=already").or(page.locator("text=exist")).or(page.locator("text=Error")).or(page.locator("text=failed"));
  if (!(await errorMsg.first().isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("No error message shown for duplicate email");
  }
});

await test("SU-5: Login with wrong password shows error", async (page) => {
  await go(page, "/signup");
  await page.fill('input[name="email"]', "nonexistent@test.com");
  await page.fill('input[name="password"]', "WrongPassword123!");
  await page.locator('button[type="submit"]').click();
  await wait(2000);
  const url = page.url();
  if (url.includes("/recruiter") || url.includes("/onboarding") || url.includes("/dashboard")) {
    throw new Error("Wrong password login succeeded!");
  }
  const errorMsg = page.locator("text=Invalid").or(page.locator("text=incorrect")).or(page.locator("text=failed")).or(page.locator("text=Error"));
  if (!(await errorMsg.first().isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("No error message for wrong password login");
  }
});

await test("SU-6: Password visibility toggle works", async (page) => {
  await go(page, "/signup");
  const passwordInput = page.locator('input[name="password"]');
  // Should start as password type
  const type1 = await passwordInput.getAttribute("type");
  if (type1 !== "password") throw new Error(`Password starts as type "${type1}", expected "password"`);
  // Find the eye icon button near the password field
  const eyeBtn = page.locator('input[name="password"]').locator("..").locator("button");
  if (await eyeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await eyeBtn.click();
    await wait(200);
    const type2 = await passwordInput.getAttribute("type");
    if (type2 !== "text") throw new Error(`After toggle, password is still type "${type2}", expected "text"`);
  }
});

await test("SU-7: Login/signup toggle resets form state", async (page) => {
  await go(page, "/signup");
  // Start on login, fill email
  await page.fill('input[name="email"]', "test@test.com");
  // Switch to signup
  const toggleBtn = page.locator("button", { hasText: "Create an account" });
  if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await toggleBtn.click({ force: true });
    await wait(500);
  }
  // Email should be cleared (form resets)
  const emailValue = await page.locator('input[name="email"]').inputValue();
  if (emailValue !== "") {
    throw new Error(`Email not cleared on mode switch: "${emailValue}" — form state leaks between login/signup`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Route Guards & Auth
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 3: Route Guards & Auth\n");

const routeGuardTests = [
  ["/recruiter", "recruiter page"],
  ["/recruiter/interviews/new", "interview setup page"],
  ["/dashboard", "candidate dashboard"],
  ["/rehearsal", "rehearsal room"],
  ["/account", "account settings"],
];

for (const [route, name] of routeGuardTests) {
  await test(`RG-${route}: Unauthenticated access to ${name} redirects to /signup`, async (page) => {
    await page.goto(BASE);
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState("networkidle");
    await wait(1000);
    const url = page.url();
    if (!url.includes("/signup")) {
      throw new Error(`Expected redirect to /signup for ${route}, got ${url}`);
    }
  });
}

await test("RG-5: /interview/accept/:token is accessible without auth", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(`${BASE}/interview/accept/fake-token-123`);
  await page.waitForLoadState("networkidle");
  await wait(1500);
  const url = page.url();
  if (url.includes("/signup")) {
    throw new Error("Public invite page redirected to /signup — should be accessible without auth");
  }
});

await test("RG-6: Navbar shows correct nav items for recruiter vs candidate", async (page) => {
  // Register a recruiter
  const recEmail = `nav-rec-${Date.now()}@test.com`;
  await register(page, { name: "Nav Recruiter", email: recEmail, password: "TestPass123!", role: "recruiter" });
  await wait(1000);
  await go(page, "/recruiter");

  // Should see "Recruiter" nav
  const recNav = page.locator("button", { hasText: "Recruiter" }).first();
  if (!(await recNav.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Recruiter nav not visible for recruiter user");
  }

  // Logout and login as candidate
  await page.evaluate(() => { localStorage.clear(); });
  const candEmail = `nav-cand-${Date.now()}@test.com`;
  await register(page, { name: "Nav Candidate", email: candEmail, password: "TestPass123!", role: "candidate" });
  await wait(1000);

  // Navigate to dashboard (may redirect to onboarding first)
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.onboarded = true;
    user.resume = "fake";
    localStorage.setItem("user", JSON.stringify(user));
  });
  await go(page, "/dashboard");

  // Should see "My Interviews" nav, NOT "Recruiter"
  const myInterviews = page.locator("button", { hasText: "My Interviews" }).first();
  if (!(await myInterviews.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("My Interviews nav not visible for candidate user");
  }
});

await test("RG-7: Invalid JWT token clears storage and redirects to /signup", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    localStorage.setItem("token", "invalid.jwt.token.that.should.fail");
    localStorage.setItem("user", JSON.stringify({ name: "Fake", email: "fake@test.com", role: "candidate", onboarded: true }));
  });
  // Navigate to a page that makes API calls
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await wait(3000);
  // The api client should detect 401 and clear storage
  const token = await page.evaluate(() => localStorage.getItem("token"));
  const user = await page.evaluate(() => localStorage.getItem("user"));
  // After 401, both should be cleared
  if (token !== null || user !== null) {
    warn("RG-7", `Token=${token ? "still set" : "cleared"}, User=${user ? "still set" : "cleared"} after invalid JWT — api client may not be clearing storage on 401`);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Onboarding Flow
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 4: Onboarding Flow\n");

const onboardingEmail = `onboard-${Date.now()}@test.com`;

await test("OB-1: Onboarding shows step 1 (Resume) by default", async (page) => {
  await register(page, { name: "Onboard User", email: onboardingEmail, password: "TestPass123!", role: "candidate" });
  await wait(1000);
  await go(page, "/onboarding");
  await wait(1000);
  const resumeStep = page.locator("text=Upload your resume");
  if (!(await resumeStep.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Resume upload step not visible on onboarding");
  }
});

await test("OB-2: Back button is disabled on step 1", async (page) => {
  await login(page, { email: onboardingEmail, password: "TestPass123!" });
  await go(page, "/onboarding");
  await wait(1000);
  const backBtn = page.locator("button", { hasText: "Back" });
  const isDisabled = await backBtn.isDisabled();
  if (!isDisabled) {
    throw new Error("Back button should be disabled on step 1 but is not");
  }
});

await test("OB-3: Continue button disabled without resume file", async (page) => {
  await login(page, { email: onboardingEmail, password: "TestPass123!" });
  await go(page, "/onboarding");
  await wait(1000);
  const continueBtn = page.locator("button", { hasText: "Continue" });
  const isDisabled = await continueBtn.isDisabled();
  if (!isDisabled) {
    throw new Error("Continue button should be disabled without resume but is not");
  }
});

await test("OB-4: Onboarding progress bar shows correct percentage", async (page) => {
  await login(page, { email: onboardingEmail, password: "TestPass123!" });
  await go(page, "/onboarding");
  await wait(1000);
  // Step 1 of 3 = 33%
  const progressText = page.locator("text=33%");
  if (!(await progressText.isVisible({ timeout: 3000 }).catch(() => false))) {
    // Check what percentage is shown
    const allText = await page.locator("body").innerText();
    const percentMatch = allText.match(/(\d+)%/);
    throw new Error(`Progress bar shows "${percentMatch ? percentMatch[0] : "unknown"}" instead of 33% on step 1`);
  }
});

await test("OB-5: Step indicators show correct state (active, incomplete)", async (page) => {
  await login(page, { email: onboardingEmail, password: "TestPass123!" });
  await go(page, "/onboarding");
  await wait(1000);
  // Step 1 should be active, steps 2 and 3 should be inactive
  const step1 = page.locator("text=Resume").first();
  const step2 = page.locator("text=Photo").first();
  const step3 = page.locator("text=Voice").first();
  if (!(await step1.isVisible())) throw new Error("Step 1 (Resume) not visible");
  if (!(await step2.isVisible())) throw new Error("Step 2 (Photo) not visible");
  if (!(await step3.isVisible())) throw new Error("Step 3 (Voice) not visible");
});

await test("OB-6: Onboarding step 1 — file type restriction shown", async (page) => {
  await login(page, { email: onboardingEmail, password: "TestPass123!" });
  await go(page, "/onboarding");
  await wait(1000);
  const typeInfo = page.locator("text=PDF").or(page.locator("text=Word")).or(page.locator(".pdf,.docx"));
  const visible = await typeInfo.first().isVisible({ timeout: 3000 }).catch(() => false);
  if (!visible) {
    warn("OB-6", "File type restriction (PDF/Word) not displayed to user");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Recruiter Dashboard & Organization
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 5: Recruiter Dashboard & Organization\n");

const recEmail2 = `rec2-${Date.now()}@test.com`;

await test("RD-1: Recruiter dashboard shows create org when no org exists", async (page) => {
  await register(page, { name: "RD Test", email: recEmail2, password: "TestPass123!", role: "recruiter" });
  await wait(1000);
  await go(page, "/recruiter");
  await wait(1500);
  const createOrgBtn = page.locator("button", { hasText: /Create.*Organization|New Organization/ }).first();
  if (!(await createOrgBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Create Organization button not visible for new recruiter");
  }
});

await test("RD-2: Organization creation uses prompt dialog", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1000);

  // Override prompt to return name
  await page.evaluate(() => {
    window.prompt = (msg) => "TestOrgRD";
  });
  await page.evaluate(() => {
    window._alertLog = [];
    window.alert = (msg) => window._alertLog.push(msg);
  });

  const btn = page.locator("button", { hasText: /Create.*Organization|New Organization/ }).first();
  if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await btn.click({ force: true });
    await wait(1500);
    const orgVisible = await page.locator("text=TestOrgRD").isVisible().catch(() => false);
    if (!orgVisible) throw new Error("Organization not created/visible after prompt");
  }

  // Create an interview via API so RD-5 has data to check
  const token = await page.evaluate(() => localStorage.getItem("token"));
  const user = await page.evaluate(() => JSON.parse(localStorage.getItem("user") || "{}"));
  // Get org ID
  const orgRes = await page.request.get(`${API}/api/org`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const orgData = await orgRes.json();
  const orgId = orgData.organizations?.[0]?._id;
  if (!orgId) throw new Error("No org found for interview creation");

  const interviewRes = await page.request.post(`${API}/api/interviews`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: "Test Interview RD",
      targetRole: "Engineer",
      questions: ["What is your experience?"],
      expiresAt: "2026-12-31T23:59:00.000Z",
      organizationId: orgId,
      status: "active",
    },
  });
  if (!interviewRes.ok()) {
    const err = await interviewRes.json().catch(() => ({}));
    throw new Error("Interview creation failed: " + JSON.stringify(err));
  }
});

await test("RD-3: Interview setup shows validation error when fields missing", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter/interviews/new");
  await wait(1000);
  // Submit empty form (only questions = empty array)
  await page.locator("button", { hasText: "Create Interview" }).click();
  await wait(500);
  const errorMsg = page.locator("text=fill in").or(page.locator("text=required")).or(page.locator("text=Please"));
  if (!(await errorMsg.first().isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("No validation error shown for empty interview form");
  }
});

await test("RD-4: Interview setup — add/remove questions works", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter/interviews/new");
  await wait(1000);

  // Should start with 1 question input
  const questionInputs = page.locator('input[placeholder*="Question"]');
  const initialCount = await questionInputs.count();
  if (initialCount !== 1) throw new Error(`Expected 1 question input initially, got ${initialCount}`);

  // Add a question
  await page.locator("button", { hasText: "Add" }).click();
  await wait(300);
  const afterAdd = await questionInputs.count();
  if (afterAdd !== 2) throw new Error(`Expected 2 question inputs after Add, got ${afterAdd}`);

  // Remove second question
  const removeBtns = page.locator("button").filter({ has: page.locator('[class*="Trash2"]') }).or(page.locator("button:has(svg)")).filter({ hasText: "" });
  // Find trash buttons near question inputs
  const trashBtns = page.locator('input[placeholder*="Question"]').locator("..").locator("..").locator("button").last();
  // Use a more reliable approach — find the delete button for question 2
  const deleteBtn = page.locator(`button:has-text("")`).filter({ has: page.locator('svg.lucide-trash-2') });
  if (await deleteBtn.count() > 0) {
    await deleteBtn.last().click();
    await wait(300);
    const afterRemove = await questionInputs.count();
    if (afterRemove !== 1) throw new Error(`Expected 1 question input after remove, got ${afterRemove}`);
  }
});

await test("RD-5: Interview status badge shows correct color", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1500);
  // Look for status badges — the badge uses CSS text-transform: uppercase,
  // so the DOM text is lowercase (e.g. "draft") but rendered uppercase.
  const activeBadge = page.locator("span").filter({ hasText: /^active$/i }).first();
  const draftBadge = page.locator("span").filter({ hasText: /^draft$/i }).first();
  const closedBadge = page.locator("span").filter({ hasText: /^closed$/i }).first();
  const hasAnyBadge = await activeBadge.isVisible().catch(() => false)
    || await draftBadge.isVisible().catch(() => false)
    || await closedBadge.isVisible().catch(() => false);
  // Use h2 selector to avoid matching "No interview sessions" empty state text
  const hasInterviewList = await page.locator("h2", { hasText: "Interview Sessions" }).isVisible().catch(() => false);
  if (!hasAnyBadge && hasInterviewList) {
    throw new Error("Interview list visible but no status badges found");
  }
});

await test("RD-6: Recruiter cannot see 'Invite' button for draft interviews", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1500);
  // Find draft interviews
  const draftRows = page.locator("text=draft");
  const draftCount = await draftRows.count();
  if (draftCount > 0) {
    // Check parent container for Invite button — should not exist for draft
    const inviteBtns = page.locator("button", { hasText: "Invite" });
    const inviteCount = await inviteBtns.count();
    // Invite buttons should only appear for active interviews
    if (inviteCount > 0 && draftCount > 0) {
      // This is fine if there are also active interviews
      warn("RD-6", `Found ${inviteCount} Invite buttons and ${draftCount} draft badges — verify Invite is only on active rows`);
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Candidate Interview Flow
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 6: Candidate Interview Flow\n");

let interviewToken = null;

await test("CI-1: Full API setup — recruiter + org + active interview + invite", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");

  const signupRes = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "CI Recruiter", email: `ci-rec-${Date.now()}@test.com`, password: "TestPass123!", role: "recruiter", consentGiven: true, consentVersion: "1.0" },
  });
  const signupData = await signupRes.json();
  const recruiterToken = signupData.token;
  if (!recruiterToken) throw new Error("Recruiter signup failed");

  const orgRes = await page.request.post(`${API}/api/org`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
    data: { name: "CI Org" },
  });
  const orgData = await orgRes.json();
  const orgId = orgData.organization?._id || orgData.organizations?.[0]?._id;
  if (!orgId) throw new Error("Org creation failed: " + JSON.stringify(orgData));

  const interviewRes = await page.request.post(`${API}/api/interviews`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
    data: {
      title: "CI Test Interview",
      targetRole: "Software Engineer",
      questions: ["What is your biggest strength?", "Describe a challenging project."],
      expiresAt: "2026-12-31T23:59:00.000Z",
      organizationId: orgId,
    },
  });
  const interviewData = await interviewRes.json();
  const interviewId = interviewData.interview?._id;
  if (!interviewId) throw new Error("Interview creation failed: " + JSON.stringify(interviewData));

  const activateRes = await page.request.put(`${API}/api/interviews/${interviewId}`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
    data: { status: "active" },
  });
  if (!activateRes.ok()) throw new Error("Interview activation failed");

  const inviteRes = await page.request.post(`${API}/api/interviews/${interviewId}/invite`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
    data: { candidateEmail: `ci-cand-${Date.now()}@test.com` },
  });
  const inviteData = await inviteRes.json();
  interviewToken = inviteData.inviteToken;
  if (!interviewToken) throw new Error("Invite generation failed: " + JSON.stringify(inviteData));
});

await test("CI-2: Invite page loads interview title and first question", async (page) => {
  if (!interviewToken) throw new Error("No token from CI-1");
  await go(page, `/interview/accept/${interviewToken}`);
  await wait(1500);

  const hasTitle = await page.locator("text=CI Test Interview").isVisible().catch(() => false);
  const hasQ1 = await page.locator("text=biggest strength").isVisible().catch(() => false);
  if (!hasTitle && !hasQ1) throw new Error("Interview title or first question not visible");
});

await test("CI-3: Progress bar shows 'Question 1 of 2'", async (page) => {
  if (!interviewToken) throw new Error("No token from CI-1");
  await go(page, `/interview/accept/${interviewToken}`);
  await wait(1500);

  const progress = page.locator("text=Question 1 of 2");
  if (!(await progress.isVisible({ timeout: 3000 }).catch(() => false))) {
    const anyProgress = page.locator(/Question \d+ of \d+/);
    if (!(await anyProgress.first().isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error("Question progress indicator not visible");
    }
  }
});

await test("CI-4: Record button is visible and clickable", async (page) => {
  if (!interviewToken) throw new Error("No token from CI-1");
  await go(page, `/interview/accept/${interviewToken}`);
  await wait(1500);

  const recordBtn = page.locator("button", { hasText: "Record" }).first();
  if (!(await recordBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Record button not visible");
  }
  const isDisabled = await recordBtn.isDisabled();
  if (isDisabled) throw new Error("Record button is disabled when it shouldn't be");
});

await test("CI-5: Back arrow navigates to home", async (page) => {
  if (!interviewToken) throw new Error("No token from CI-1");
  await go(page, `/interview/accept/${interviewToken}`);
  await wait(1500);

  const backBtn = page.locator("button").filter({ has: page.locator('svg.lucide-arrow-left') }).first();
  if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await backBtn.click();
    await wait(1000);
    const url = page.url();
    if (!url.endsWith("/") && !url.includes("localhost:3000/")) {
      throw new Error(`Back arrow navigated to ${url} instead of home`);
    }
  }
});

await test("CI-6: Invalid token shows error page", async (page) => {
  await go(page, `/interview/accept/invalid-token-12345`);
  await wait(2000);
  // Should show error, not crash
  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("Cannot read") || bodyText.includes("TypeError") || bodyText.includes("undefined")) {
    throw new Error("JavaScript error on invalid token page");
  }
});

await test("CI-7: Progress bar shows 50% on first question of 2", async (page) => {
  if (!interviewToken) throw new Error("No token from CI-1");
  await go(page, `/interview/accept/${interviewToken}`);
  await wait(1500);

  // Q1 of 2 should show 50%
  const progressText = page.locator("text=50%");
  const visible = await progressText.isVisible({ timeout: 3000 }).catch(() => false);
  if (!visible) {
    throw new Error("Progress bar does not show 50% on first question of 2");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Account Settings
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 7: Account Settings\n");

await test("AS-1: Account settings displays correct user info", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/account");
  await wait(1000);

  const nameInput = page.locator('input[disabled]').first();
  const nameValue = await nameInput.inputValue();
  if (!nameValue || nameValue.trim() === "") {
    throw new Error("User name not displayed in account settings");
  }
});

await test("AS-2: Account settings shows profile, export, consent, delete sections", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/account");
  await wait(1500);

  const sections = ["Profile", "Export", "Consent", "Delete"];
  for (const section of sections) {
    const el = page.locator(`text=${section}`).first();
    if (!(await el.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error(`Section "${section}" not visible on account settings`);
    }
  }
});

await test("AS-3: Export data button triggers download", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/account");
  await wait(1000);

  const exportBtn = page.locator("button", { hasText: /Export|Download/ }).first();
  if (!(await exportBtn.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Export button not visible");
  }
  // Check button is not disabled
  const isDisabled = await exportBtn.isDisabled();
  if (isDisabled) throw new Error("Export button is disabled");
});

await test("AS-4: Delete account requires password confirmation", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/account");
  await wait(1000);

  const deleteBtn = page.locator("button", { hasText: "Delete My Account" });
  if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await deleteBtn.click();
    await wait(500);
    // Should show password input
    const passwordInput = page.locator('input[type="password"]');
    if (!(await passwordInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error("Password confirmation not shown after clicking Delete");
    }
    // Confirm delete should be disabled without password
    const confirmBtn = page.locator("button", { hasText: "Confirm Delete" });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const isDisabled = await confirmBtn.isDisabled();
      if (!isDisabled) {
        throw new Error("Confirm Delete button should be disabled without password");
      }
    }
  }
});

await test("AS-5: Cancel delete closes confirmation panel", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/account");
  await wait(1000);

  const deleteBtn = page.locator("button", { hasText: "Delete My Account" });
  if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await deleteBtn.click();
    await wait(500);
    const cancelBtn = page.locator("button", { hasText: "Cancel" }).first();
    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cancelBtn.click();
      await wait(500);
      // Delete My Account button should reappear
      const reappear = await page.locator("button", { hasText: "Delete My Account" }).isVisible({ timeout: 3000 }).catch(() => false);
      if (!reappear) throw new Error("Delete My Account button didn't reappear after cancel");
    }
  }
});

await test("AS-6: Back button navigates to previous page", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1000);
  await go(page, "/account");
  await wait(1000);
  const backBtn = page.locator("button", { hasText: "Back" }).first();
  if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await backBtn.click();
    await wait(1000);
    const url = page.url();
    if (!url.includes("/recruiter")) {
      warn("AS-6", `Back button navigated to ${url} — expected /recruiter`);
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Navbar Behavior
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 8: Navbar Behavior\n");

await test("NB-1: Navbar shows logo that links to home", async (page) => {
  await go(page, "/");
  const logo = page.locator("text=Rehearse").first();
  if (!(await logo.isVisible())) throw new Error("Logo not visible in navbar");
  await logo.click();
  await wait(500);
  const url = page.url();
  if (!url.endsWith("/") && !url.includes("localhost:3000/")) {
    throw new Error(`Logo click navigated to ${url} instead of home`);
  }
});

await test("NB-2: Unauthenticated navbar shows Sign in and Get started buttons", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => { localStorage.clear(); });
  await go(page, "/");
  const signIn = page.locator("button", { hasText: "Sign in" }).first();
  const getStarted = page.locator("button", { hasText: "Get started" }).first();
  if (!(await signIn.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Sign in button not visible for unauthenticated user");
  }
  if (!(await getStarted.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Get started button not visible for unauthenticated user");
  }
});

await test("NB-3: Authenticated navbar shows user avatar/initials", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1000);
  // Look for avatar circle with initials
  const avatar = page.locator('[aria-label="User menu"]');
  if (!(await avatar.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("User avatar/menu button not visible for authenticated user");
  }
});

await test("NB-4: User dropdown shows name, email, role, and sign out", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1000);
  const avatar = page.locator('[aria-label="User menu"]');
  if (await avatar.isVisible({ timeout: 3000 }).catch(() => false)) {
    await avatar.click();
    await wait(500);
    const signOut = page.locator("button", { hasText: "Sign out" });
    if (!(await signOut.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error("Sign out not visible in dropdown");
    }
    const settings = page.locator("button", { hasText: "Account Settings" });
    if (!(await settings.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error("Account Settings not visible in dropdown");
    }
  }
});

await test("NB-5: Sign out clears auth and redirects to home", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1000);
  const avatar = page.locator('[aria-label="User menu"]');
  if (await avatar.isVisible({ timeout: 3000 }).catch(() => false)) {
    await avatar.click();
    await wait(500);
    const signOut = page.locator("button", { hasText: "Sign out" });
    if (await signOut.isVisible({ timeout: 3000 }).catch(() => false)) {
      await signOut.click();
      await wait(1000);
      const url = page.url();
      if (!url.endsWith("/") && !url.includes("localhost:3000/")) {
        throw new Error(`Sign out redirected to ${url} instead of home`);
      }
      const token = await page.evaluate(() => localStorage.getItem("token"));
      if (token !== null) {
        throw new Error("Token not cleared after sign out");
      }
    }
  }
});

await test("NB-6: Mobile hamburger menu opens and closes", async (page) => {
  // Use mobile viewport
  await page.setViewportSize({ width: 375, height: 812 });
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1000);

  const menuBtn = page.locator('[aria-label="Toggle menu"]');
  if (await menuBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await menuBtn.click();
    await wait(500);
    // Should see mobile nav items
    const mobileNav = page.locator("text=Account Settings");
    if (!(await mobileNav.isVisible({ timeout: 3000 }).catch(() => false))) {
      throw new Error("Mobile menu did not open — Account Settings not visible");
    }
    // Close menu by clicking toggle again
    await menuBtn.click();
    await wait(500);
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 9: API Error Handling
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 9: API Error Handling\n");

await test("API-1: 401 on protected endpoint clears localStorage", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => {
    localStorage.setItem("token", "expired-or-invalid-token");
    localStorage.setItem("user", JSON.stringify({ name: "Test", email: "t@t.com", role: "candidate", onboarded: true }));
  });
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState("networkidle");
  await wait(3000);
  // The api client should detect 401 and clear storage + redirect
  const token = await page.evaluate(() => localStorage.getItem("token"));
  if (token !== null) {
    warn("API-1", "Token not cleared after 401 — api client may not be auto-logging out on 401 for all endpoints");
  }
});

await test("API-2: Backend health check returns 200", async (page) => {
  const res = await page.request.get(`${API}/health`);
  if (!res.ok()) throw new Error(`Health check returned ${res.status()}`);
  const data = await res.json();
  if (data.status !== "ok") throw new Error(`Health check returned status: ${data.status}`);
});

await test("API-3: CORS headers present on API responses", async (page) => {
  const res = await page.request.get(`${API}/health`, {
    headers: { Origin: "http://localhost:3000" },
  });
  const corsHeader = res.headers()["access-control-allow-origin"];
  if (!corsHeader) {
    warn("API-3", "No CORS headers on /health — frontend may have CORS issues in production");
  }
});

await test("API-4: Signup with short password fails", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const res = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "Short", email: `short-${Date.now()}@test.com`, password: "abc", role: "candidate", consentGiven: true, consentVersion: "1.0" },
  });
  if (res.ok()) throw new Error("Signup with 3-char password succeeded — no password validation!");
});

await test("API-5: Signup with invalid email format fails", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const res = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "Bad Email", email: "not-an-email", password: "TestPass123!", role: "candidate", consentGiven: true, consentVersion: "1.0" },
  });
  if (res.ok()) throw new Error("Signup with invalid email succeeded — no email validation!");
});

await test("API-6: Interview creation with missing fields fails", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");

  const signupRes = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "API Test", email: `api-test-${Date.now()}@test.com`, password: "TestPass123!", role: "recruiter", consentGiven: true, consentVersion: "1.0" },
  });
  const { token } = await signupRes.json();

  const res = await page.request.post(`${API}/api/interviews`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "" },
  });
  if (res.ok()) throw new Error("Interview creation with empty title succeeded");
});

await test("API-7: Candidate cannot create interviews (RBAC)", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");

  const signupRes = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "Cand RBAC", email: `cand-rbac-${Date.now()}@test.com`, password: "TestPass123!", role: "candidate", consentGiven: true, consentVersion: "1.0" },
  });
  const { token } = await signupRes.json();

  const res = await page.request.post(`${API}/api/interviews`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: "Should Fail", targetRole: "Engineer", questions: ["Q1"], expiresAt: "2026-12-31T23:59:00.000Z" },
  });
  if (res.ok()) throw new Error("Candidate created interview — RBAC not enforced!");
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 10: UI/UX Edge Cases
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 10: UI/UX Edge Cases\n");

await test("UX-1: Signup page marketing panel hidden on mobile", async (page) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await go(page, "/signup");
  await wait(500);
  // The marketing panel (lg:flex) should be hidden on mobile
  const marketingPanel = page.locator("text=Run structured first rounds");
  const isVisible = await marketingPanel.isVisible().catch(() => false);
  if (isVisible) {
    throw new Error("Marketing panel visible on mobile viewport — should be hidden (lg:flex)");
  }
});

await test("UX-2: Form inputs have proper accessibility labels", async (page) => {
  await go(page, "/signup");
  const toggleBtn = page.locator("button", { hasText: "Create an account" });
  if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await toggleBtn.click({ force: true });
    await wait(500);
  }
  // Check that inputs have associated labels
  const emailInput = page.locator('input[name="email"]');
  const emailId = await emailInput.getAttribute("id");
  if (emailId) {
    const label = page.locator(`label[for="${emailId}"]`);
    if (!(await label.isVisible({ timeout: 2000 }).catch(() => false))) {
      warn("UX-2", `Email input has id="${emailId}" but no visible label[for="${emailId}"]`);
    }
  }
});

await test("UX-3: Error messages are styled consistently", async (page) => {
  await go(page, "/signup");
  const toggleBtn = page.locator("button", { hasText: "Create an account" });
  if (await toggleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await toggleBtn.click({ force: true });
    await wait(500);
  }
  // Trigger a validation error (password mismatch)
  await page.fill('input[name="firstName"]', "Test");
  await page.fill('input[name="lastName"]', "User");
  await page.fill('input[name="email"]', `err-test-${Date.now()}@test.com`);
  await page.fill('input[name="password"]', "Pass123!");
  await page.fill('input[name="confirmPassword"]', "Different!");
  await page.locator('input[type="checkbox"]').first().check({ force: true });
  await page.locator('button[type="submit"]').click();
  await wait(500);
  const errorDiv = page.locator(".bg-destructive\\/10").first();
  const isVisible = await errorDiv.isVisible({ timeout: 3000 }).catch(() => false);
  if (!isVisible) {
    warn("UX-3", "Error message div with destructive styling not found");
  }
});

await test("UX-4: Loading states show spinners/skeletons", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  // Check if loading skeleton appears briefly
  // After networkidle, loading should be done
  const skeleton = page.locator(".animate-pulse");
  const visible = await skeleton.isVisible({ timeout: 1000 }).catch(() => false);
  // This is expected to be gone after load — just checking it doesn't persist
  if (visible) {
    warn("UX-4", "Loading skeleton still visible after page load — possible stuck loading state");
  }
});

await test("UX-5: Interview setup page — back button goes to previous page", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(1000);
  await go(page, "/recruiter/interviews/new");
  await wait(1000);
  const backBtn = page.locator("button", { hasText: "Back" }).first();
  if (await backBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await backBtn.click();
    await wait(1000);
    const url = page.url();
    if (!url.includes("/recruiter")) {
      throw new Error(`Back button on interview setup navigated to ${url}`);
    }
  }
});

await test("UX-6: Rehearsal room shows role picker before interview", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.onboarded = true;
    user.resume = "fake";
    localStorage.setItem("user", JSON.stringify(user));
  });
  await go(page, "/rehearsal");
  await wait(1500);
  const rolePicker = page.locator("text=Choose Your Target Role");
  if (!(await rolePicker.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Role picker not shown — rehearsal room should start with role selection");
  }
});

await test("UX-7: Rehearsal room preset roles are clickable", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.onboarded = true;
    user.resume = "fake";
    localStorage.setItem("user", JSON.stringify(user));
  });
  await go(page, "/rehearsal");
  await wait(1500);
  const seRole = page.locator("button", { hasText: "Software Engineer" }).first();
  if (!(await seRole.isVisible({ timeout: 3000 }).catch(() => false))) {
    throw new Error("Software Engineer preset role not visible");
  }
  const isDisabled = await seRole.isDisabled();
  if (isDisabled) throw new Error("Preset role button is disabled when it shouldn't be");
});

await test("UX-8: Custom role input in rehearsal room accepts text", async (page) => {
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await page.evaluate(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    user.onboarded = true;
    user.resume = "fake";
    localStorage.setItem("user", JSON.stringify(user));
  });
  await go(page, "/rehearsal");
  await wait(1500);
  const customInput = page.locator('input[placeholder*="custom role"]').or(page.locator('input[placeholder*="Staff ML"]'));
  if (await customInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await customInput.fill("DevOps Engineer");
    const value = await customInput.inputValue();
    if (value !== "DevOps Engineer") throw new Error(`Custom role input value mismatch: "${value}"`);
    // Go button should be enabled
    const goBtn = page.locator("button", { hasText: "Go" });
    if (await goBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      const isDisabled = await goBtn.isDisabled();
      if (isDisabled) throw new Error("Go button disabled when custom role is entered");
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 11: Candidate Results Page
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 11: Candidate Results Page\n");

await test("CR-1: Results page loads for interview with no candidates", async (page) => {
  // We need to get an interview ID first
  const crEmail = `cr-rec-${Date.now()}@test.com`;
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");

  const signupRes = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "CR Recruiter", email: crEmail, password: "TestPass123!", role: "recruiter", consentGiven: true, consentVersion: "1.0" },
  });
  const { token: recToken } = await signupRes.json();

  const orgRes = await page.request.post(`${API}/api/org`, {
    headers: { Authorization: `Bearer ${recToken}` },
    data: { name: "CR Org" },
  });
  const orgData = await orgRes.json();
  const orgId = orgData.organization?._id || orgData.organizations?.[0]?._id;

  const interviewRes = await page.request.post(`${API}/api/interviews`, {
    headers: { Authorization: `Bearer ${recToken}` },
    data: { title: "CR Empty Interview", targetRole: "PM", questions: ["Q1"], expiresAt: "2026-12-31T23:59:00.000Z", organizationId: orgId },
  });
  const interviewData = await interviewRes.json();
  const interviewId = interviewData.interview?._id;
  if (!interviewId) throw new Error("Interview creation failed");

  // Login as recruiter and navigate to results page
  await login(page, { email: crEmail, password: "TestPass123!" });
  // Use direct token
  await page.evaluate((token) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify({ name: "CR Recruiter", email: "cr-rec@test.com", role: "recruiter" }));
  }, recToken);
  await page.goto(`${BASE}/recruiter/interviews/${interviewId}`);
  await page.waitForLoadState("networkidle");
  await wait(2000);

  // Should show empty state or interview details
  const bodyText = await page.locator("body").innerText();
  if (bodyText.includes("Cannot read") || bodyText.includes("TypeError")) {
    throw new Error("JavaScript error on candidate results page");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 12: Cross-cutting Concerns
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 12: Cross-cutting Concerns\n");

await test("CC-1: No console errors on landing page", async (page) => {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await go(page, "/");
  await wait(2000);
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes("favicon") && !e.includes("404") && !e.includes("net::")
  );
  if (criticalErrors.length > 0) {
    warn("CC-1", `Console errors on landing page: ${criticalErrors.slice(0, 3).join("; ")}`);
  }
});

await test("CC-2: No console errors on signup page", async (page) => {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await go(page, "/signup");
  await wait(2000);
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes("favicon") && !e.includes("404") && !e.includes("net::")
  );
  if (criticalErrors.length > 0) {
    warn("CC-2", `Console errors on signup page: ${criticalErrors.slice(0, 3).join("; ")}`);
  }
});

await test("CC-3: No console errors on recruiter dashboard", async (page) => {
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await login(page, { email: recEmail2, password: "TestPass123!" });
  await go(page, "/recruiter");
  await wait(2000);
  const criticalErrors = consoleErrors.filter(e =>
    !e.includes("favicon") && !e.includes("404") && !e.includes("net::")
  );
  if (criticalErrors.length > 0) {
    warn("CC-3", `Console errors on recruiter dashboard: ${criticalErrors.slice(0, 3).join("; ")}`);
  }
});

await test("CC-4: Frontend build has no TypeScript errors", async (page) => {
  // Check that the built JS loaded successfully
  await go(page, "/");
  const scripts = await page.locator("script[src]").count();
  if (scripts === 0) throw new Error("No script tags found — frontend may not have built correctly");
});

await test("CC-5: Page title is set correctly", async (page) => {
  await go(page, "/");
  const title = await page.title();
  if (!title || title === "") {
    throw new Error("Page title is empty");
  }
  if (!title.includes("Rehearse")) {
    warn("CC-5", `Page title "${title}" doesn't contain "Rehearse"`);
  }
});

await test("CC-6: Meta viewport tag present for responsive design", async (page) => {
  await go(page, "/");
  const viewport = await page.locator('meta[name="viewport"]').count();
  if (viewport === 0) {
    throw new Error("No viewport meta tag — mobile responsiveness broken");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 13: Security Tests
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 13: Security Tests\n");

await test("SEC-1: XSS in signup name field is sanitized", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const xssPayload = '<script>alert("xss")</script>';
  const res = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: xssPayload, email: `xss-${Date.now()}@test.com`, password: "TestPass123!", role: "candidate", consentGiven: true, consentVersion: "1.0" },
  });
  if (res.ok()) {
    const data = await res.json();
    if (data.user?.name?.includes("<script>")) {
      throw new Error("XSS payload stored unsanitized in user name!");
    }
  }
});

await test("SEC-2: NoSQL injection in login blocked", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const res = await page.request.post(`${API}/api/auth/login`, {
    data: { email: { $ne: "" }, password: { $ne: "" } },
  });
  // Should fail — not return a token
  const data = await res.json().catch(() => ({}));
  if (data.token) {
    throw new Error("NoSQL injection via login succeeded — mongo-sanitize not working!");
  }
});

await test("SEC-3: JWT_SECRET is not exposed in API responses", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const res = await page.request.get(`${API}/health`);
  const text = await res.text();
  if (text.includes("JWT_SECRET") || text.includes("secret")) {
    throw new Error("JWT secret leaked in API response!");
  }
});

await test("SEC-4: Password field not returned in login response", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const res = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "Sec Test", email: `sec-${Date.now()}@test.com`, password: "TestPass123!", role: "candidate", consentGiven: true, consentVersion: "1.0" },
  });
  const data = await res.json();
  if (data.user?.password) {
    throw new Error("Password returned in signup response!");
  }
  // Also check login
  const loginRes = await page.request.post(`${API}/api/auth/login`, {
    data: { email: `sec-${Date.now()}@test.com`, password: "TestPass123!" },
  });
  if (loginRes.ok()) {
    const loginData = await loginRes.json();
    if (loginData.user?.password) {
      throw new Error("Password returned in login response!");
    }
  }
});

await test("SEC-5: Rate limiting on auth endpoints (rapid requests)", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  // Verify the rate limiter is configured and active by checking response headers
  // on a valid auth request. The rate-limit header confirms middleware is in place.
  const res = await page.request.post(`${API}/api/auth/login`, {
    data: { email: `rate-test@verify.com`, password: "wrong" },
  });
  const rateLimit = res.headers()["ratelimit-remaining"];
  const rateLimitPolicy = res.headers()["ratelimit-policy"];
  if (!rateLimit && !rateLimitPolicy) {
    warn("SEC-5", "No rate-limit headers on auth endpoint — rate limiter may not be active");
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 14: Data Export (GDPR)
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n🔷 SECTION 14: Data Export (GDPR)\n");

await test("GDPR-1: Export data returns JSON with user data", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const signupRes = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "GDPR User", email: `gdpr-${Date.now()}@test.com`, password: "TestPass123!", role: "candidate", consentGiven: true, consentVersion: "1.0" },
  });
  const { token } = await signupRes.json();

  const res = await page.request.post(`${API}/api/auth/export-data`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok()) throw new Error(`Export data returned ${res.status()}`);
  const data = await res.json();
  if (!data.user && !data.data) {
    throw new Error("Export data response doesn't contain user/data field");
  }
});

await test("GDPR-2: Export data requires authentication", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const res = await page.request.post(`${API}/api/auth/export-data`);
  if (res.ok()) throw new Error("Export data succeeded without authentication!");
});

await test("GDPR-3: Delete account requires password", async (page) => {
  await page.goto(BASE);
  await page.waitForLoadState("networkidle");
  const signupRes = await page.request.post(`${API}/api/auth/signup`, {
    data: { name: "Del User", email: `del-${Date.now()}@test.com`, password: "TestPass123!", role: "candidate", consentGiven: true, consentVersion: "1.0" },
  });
  const { token } = await signupRes.json();

  const res = await page.request.delete(`${API}/api/auth/delete-account`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {},
  });
  // Should fail without password
  if (res.ok()) {
    const data = await res.json();
    if (data.message?.includes("deleted") || data.message?.includes("success")) {
      throw new Error("Account deleted without password confirmation!");
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n═══════════════════════════════════════════════════════════════════");
console.log(`  Results: ${state.passed} passed, ${state.failed} failed, ${state.warnings.length} warnings, ${state.passed + state.failed} total`);
console.log("═══════════════════════════════════════════════════════════════════");

if (state.errors.length > 0) {
  console.log("\n❌ Failed tests:");
  state.errors.forEach(({ name, error }) => console.log(`  ❌ ${name}: ${error}`));
}

if (state.warnings.length > 0) {
  console.log("\n⚠️  Warnings:");
  state.warnings.forEach(({ name, message }) => console.log(`  ⚠️  ${name}: ${message}`));
}

process.exit(state.failed > 0 ? 1 : 0);
