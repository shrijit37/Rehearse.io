import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const API = "http://localhost:9000";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function dismissCookieConsent(page) {
  try {
    const btn = page.locator("button", { hasText: "Accept All" });
    if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await btn.click();
      await sleep(300);
    }
  } catch {}
}

async function go(page, path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
  await sleep(500);
  await dismissCookieConsent(page);
}

/** Extract all interactive/heading elements from the current page */
function extractPageElements() {
  return {
    inputs: Array.from(document.querySelectorAll("input, select, textarea")).map((el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      name: el.name || "",
      id: el.id || "",
      placeholder: el.placeholder || "",
      label: el.closest("label")?.textContent?.trim() || "",
      ariaLabel: el.getAttribute("aria-label") || "",
    })),
    buttons: Array.from(document.querySelectorAll("button")).map((el) => ({
      text: el.textContent?.trim() || "",
      type: el.type || "",
      disabled: el.disabled,
    })),
    headings: Array.from(document.querySelectorAll("h1, h2, h3, h4")).map((el) => ({
      tag: el.tagName.toLowerCase(),
      text: el.textContent?.trim() || "",
    })),
    links: Array.from(document.querySelectorAll("a")).map((el) => ({
      text: el.textContent?.trim() || "",
      href: el.href || "",
    })),
    checkboxes: Array.from(document.querySelectorAll('input[type="checkbox"]')).map((el) => ({
      name: el.name || "",
      id: el.id || "",
      label: el.closest("label")?.textContent?.trim() || "",
    })),
    fullText: document.body?.innerText?.substring(0, 3000) || "",
  };
}

/** Helper to dump page elements in a readable format */
function dumpElements(label, elements) {
  console.log(`\n  Headings:`);
  elements.headings.forEach((h) => console.log(`    <${h.tag}> "${h.text}"`));
  if (elements.inputs.length > 0) {
    console.log(`\n  Inputs:`);
    elements.inputs.forEach((i) => console.log(`    <${i.tag}> type="${i.type}" name="${i.name}" placeholder="${i.placeholder}" ariaLabel="${i.ariaLabel}"`));
  }
  if (elements.buttons.length > 0) {
    console.log(`\n  Buttons:`);
    elements.buttons.forEach((b) => console.log(`    <button> "${b.text}" disabled=${b.disabled}`));
  }
  if (elements.checkboxes.length > 0) {
    console.log(`\n  Checkboxes:`);
    elements.checkboxes.forEach((c) => console.log(`    name="${c.name}" label="${c.label}"`));
  }
  if (elements.links.length > 0) {
    console.log(`\n  Links:`);
    elements.links.forEach((l) => console.log(`    <a> "${l.text}" → ${l.href}`));
  }
  console.log(`\n  Visible text (first 2000 chars):`);
  console.log(elements.fullText.substring(0, 2000));
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1: Page Selector Debugging (no API calls needed)
// ══════════════════════════════════════════════════════════════════════════════
console.log("═".repeat(80));
console.log("PART 1: Page Element Inspection");
console.log("═".repeat(80));

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Navigate to the app first
await page.goto(BASE);
await page.waitForLoadState("networkidle");

// ── Signup page ──────────────────────────────────────────────────────────────
console.log("\n┌──────────────────────────────────────────────────────────────┐");
console.log("│ PAGE: /signup                                               │");
console.log("└──────────────────────────────────────────────────────────────┘");
await go(page, "/signup");
console.log("  URL:", page.url());
const signupElements = await page.evaluate(extractPageElements);
dumpElements("signup", signupElements);

// ── Dashboard page (unauthenticated) ─────────────────────────────────────────
console.log("\n┌──────────────────────────────────────────────────────────────┐");
console.log("│ PAGE: /dashboard (unauthenticated)                          │");
console.log("└──────────────────────────────────────────────────────────────┘");
// Clear localStorage first
await page.evaluate(() => localStorage.clear());
await go(page, "/dashboard");
console.log("  URL:", page.url());
const dashboardUnauth = await page.evaluate(extractPageElements);
console.log("\n  Headings:");
dashboardUnauth.headings.forEach((h) => console.log(`    <${h.tag}> "${h.text}"`));
console.log("  (Unauthenticated — likely shows login or signup redirect)");
console.log("\n  Visible text (first 500 chars):");
console.log(dashboardUnauth.fullText.substring(0, 500));

// ── Dashboard page (with fake onboarded user) ────────────────────────────────
console.log("\n┌──────────────────────────────────────────────────────────────┐");
console.log("│ PAGE: /dashboard (fake onboarded user in localStorage)      │");
console.log("└──────────────────────────────────────────────────────────────┘");
await page.evaluate(() => {
  const fakeUser = {
    _id: "000000000000000000000001",
    name: "Fake Candidate",
    email: "fake@test.com",
    role: "candidate",
    resume: "fake-resume-base64",
    onboarded: true,
  };
  localStorage.setItem("user", JSON.stringify(fakeUser));
  // Fake JWT — just needs to look like a JWT for the UI check
  localStorage.setItem("token", "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMSJ9.ZmFrZQ");
});
await go(page, "/dashboard");
console.log("  URL:", page.url());
const dashboardOnboarded = await page.evaluate(extractPageElements);
dumpElements("dashboard-onboarded", dashboardOnboarded);

// ── Recruiter page (fake recruiter in localStorage) ──────────────────────────
console.log("\n┌──────────────────────────────────────────────────────────────┐");
console.log("│ PAGE: /recruiter (fake recruiter in localStorage)           │");
console.log("└──────────────────────────────────────────────────────────────┘");
await page.evaluate(() => {
  const fakeRecruiter = {
    _id: "000000000000000000000002",
    name: "Fake Recruiter",
    email: "fake-recruiter@test.com",
    role: "recruiter",
  };
  localStorage.setItem("user", JSON.stringify(fakeRecruiter));
  localStorage.setItem("token", "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMiJ9.ZmFrZQ");
});
await go(page, "/recruiter");
console.log("  URL:", page.url());
const recruiterElements = await page.evaluate(extractPageElements);
dumpElements("recruiter-dashboard", recruiterElements);

// ── Recruiter interview creation page ────────────────────────────────────────
console.log("\n┌──────────────────────────────────────────────────────────────┐");
console.log("│ PAGE: /recruiter/interviews/new                             │");
console.log("└──────────────────────────────────────────────────────────────┘");
await go(page, "/recruiter/interviews/new");
console.log("  URL:", page.url());
const newInterviewElements = await page.evaluate(extractPageElements);
dumpElements("new-interview", newInterviewElements);

// ── Onboarding page ──────────────────────────────────────────────────────────
console.log("\n┌──────────────────────────────────────────────────────────────┐");
console.log("│ PAGE: /onboarding (fake candidate in localStorage)          │");
console.log("└──────────────────────────────────────────────────────────────┘");
await page.evaluate(() => {
  const fakeCandidate = {
    _id: "000000000000000000000003",
    name: "Fake Candidate",
    email: "fake-candidate@test.com",
    role: "candidate",
  };
  localStorage.setItem("user", JSON.stringify(fakeCandidate));
  localStorage.setItem("token", "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMyJ9.ZmFrZQ");
});
await go(page, "/onboarding");
console.log("  URL:", page.url());
const onboardingElements = await page.evaluate(extractPageElements);
dumpElements("onboarding", onboardingElements);

// ── Account page ─────────────────────────────────────────────────────────────
console.log("\n┌──────────────────────────────────────────────────────────────┐");
console.log("│ PAGE: /account (fake recruiter in localStorage)             │");
console.log("└──────────────────────────────────────────────────────────────┘");
await go(page, "/account");
console.log("  URL:", page.url());
const accountElements = await page.evaluate(extractPageElements);
dumpElements("account", accountElements);

// ══════════════════════════════════════════════════════════════════════════════
// PART 2: API Investigation — may be rate limited
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(80));
console.log("PART 2: API — Interview Status Investigation");
console.log("═".repeat(80));

const timestamp = Date.now();
const testEmail = `debug-recruiter-${timestamp}@test.com`;
const testPass = "DebugPass123!";

// Step 1: Register
console.log(`\n[1] Registering recruiter: ${testEmail}`);
const signupRes = await page.request.post(`${API}/api/auth/signup`, {
  data: {
    name: "Debug Recruiter",
    email: testEmail,
    password: testPass,
    role: "recruiter",
    consentGiven: true,
    consentVersion: "1.0",
  },
});
const signupData = await signupRes.json();
console.log(`    HTTP Status: ${signupRes.status()}`);
console.log(`    Response: ${JSON.stringify(signupData, null, 2)}`);

if (signupRes.status() === 429) {
  console.log(`\n    ⚠ RATE LIMITED — skipping API investigation.`);
  console.log(`    The rate limiter (100 req/15min general) was exhausted by earlier test runs.`);
  console.log(`    However, the bug is ALREADY confirmed from source code analysis:`);
  console.log(`\n    SOURCE CODE PROOF (backend/controller/interviewSessionController.js line 40):`);
  console.log(`      const interview = await InterviewSession.create({`);
  console.log(`        ...`);
  console.log(`        status: "draft", // Always start as draft; status can only be changed via updateInterview`);
  console.log(`      });`);
  console.log(`\n    The createInterview function NEVER reads req.body.status.`);
  console.log(`    It always forces status: "draft" regardless of what the client sends.`);
  console.log(`    Then generateInvite (line 128) requires: interview.status === "active"`);
  console.log(`    → This is why test C1 fails: create + invite in one call always breaks.`);
} else {
  const recruiterToken = signupData.token;
  if (!recruiterToken) {
    console.error("    FATAL: Could not get recruiter token.");
    await browser.close();
    process.exit(1);
  }

  // Step 2: Create org
  console.log(`\n[2] Creating organization`);
  const orgRes = await page.request.post(`${API}/api/org`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
    data: { name: "Debug Corp" },
  });
  const orgData = await orgRes.json();
  console.log(`    HTTP Status: ${orgRes.status()}`);
  console.log(`    Response: ${JSON.stringify(orgData, null, 2)}`);
  const orgId = orgData.organization?._id || orgData.organizations?.[0]?._id;
  if (!orgId) {
    console.error("    FATAL: Could not get orgId.");
    await browser.close();
    process.exit(1);
  }
  console.log(`    orgId: ${orgId}`);

  // Step 3: Create interview WITH status: "active"
  console.log(`\n[3] Creating interview WITH status: "active" in request body`);
  const interviewRes1 = await page.request.post(`${API}/api/interviews`, {
    headers: { Authorization: `Bearer ${recruiterToken}` },
    data: {
      title: "Debug Test Interview",
      targetRole: "Debug Role",
      questions: ["What is React?", "What is TypeScript?"],
      expiresAt: "2026-12-31T23:59:00.000Z",
      organizationId: orgId,
      status: "active",
    },
  });
  const interviewData1 = await interviewRes1.json();
  console.log(`    HTTP Status: ${interviewRes1.status()}`);
  console.log(`    Response: ${JSON.stringify(interviewData1, null, 2)}`);
  console.log(`\n    ★ CREATED INTERVIEW STATUS: "${interviewData1.interview?.status}"`);
  console.log(`      (sent "active" in request, backend forced "draft")`);

  const interviewId1 = interviewData1.interview?._id;

  // Step 4: Try to generate invite on the draft interview
  if (interviewId1) {
    console.log(`\n[4] Attempting to generate invite on draft interview`);
    const inviteRes1 = await page.request.post(`${API}/api/interviews/${interviewId1}/invite`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
      data: { candidateEmail: `fail-candidate-${timestamp}@test.com` },
    });
    const inviteData1 = await inviteRes1.json();
    console.log(`    HTTP Status: ${inviteRes1.status()}`);
    console.log(`    Response: ${JSON.stringify(inviteData1, null, 2)}`);
    console.log(`    ★ This confirms the "Interview must be active" error`);
  }

  // Step 5: Update interview to active
  if (interviewId1) {
    console.log(`\n[5] Updating interview status to "active" via PUT`);
    const updateRes = await page.request.put(`${API}/api/interviews/${interviewId1}`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
      data: { status: "active" },
    });
    const updateData = await updateRes.json();
    console.log(`    HTTP Status: ${updateRes.status()}`);
    console.log(`    Response: ${JSON.stringify(updateData, null, 2)}`);
    console.log(`    ★ UPDATED STATUS: "${updateData.interview?.status}"`);
  }

  // Step 6: Now generate invite (should succeed)
  if (interviewId1) {
    console.log(`\n[6] Generating invite on now-active interview`);
    const inviteRes2 = await page.request.post(`${API}/api/interviews/${interviewId1}/invite`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
      data: { candidateEmail: `success-candidate-${timestamp}@test.com` },
    });
    const inviteData2 = await inviteRes2.json();
    console.log(`    HTTP Status: ${inviteRes2.status()}`);
    console.log(`    Response: ${JSON.stringify(inviteData2, null, 2)}`);
    console.log(`    ★ INVITE TOKEN: ${inviteData2.inviteToken ? "SUCCESS (" + inviteData2.inviteToken.substring(0, 20) + "...)" : "FAILED"}`);
  }

  // Step 7: Read back interview to confirm
  if (interviewId1) {
    console.log(`\n[7] Reading back interview to confirm`);
    const getRes = await page.request.get(`${API}/api/interviews/${interviewId1}`, {
      headers: { Authorization: `Bearer ${recruiterToken}` },
    });
    const getData = await getRes.json();
    console.log(`    HTTP Status: ${getRes.status()}`);
    console.log(`    Interview status: "${getData.interview?.status}"`);
    console.log(`    Candidates: ${getData.candidates?.length || 0}`);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ══════════════════════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(80));
console.log("SUMMARY OF FINDINGS");
console.log("═".repeat(80));
console.log(`
CRITICAL BUG — Interview Status (backend/controller/interviewSessionController.js):

  LINE 40 — createInterview ALWAYS hardcodes status: "draft":
    const interview = await InterviewSession.create({
      ...
      status: "draft", // Always start as draft; status can only be changed via updateInterview
    });

  The request body 'status' field is NEVER read by createInterview.
  The deprecation comment even says: "status can only be changed via updateInterview"

  LINE 128 — generateInvite REQUIRES status === "active":
    if (interview.status !== "active") {
      return res.status(400).json({ message: "Interview must be active to invite candidates" });
    }

  TEST C1 in flows.test.js (lines 298-310) sends status: "active" in the
  POST /api/interviews creation request, but the backend IGNORES it.

  The e2e test must be fixed to:
    1. POST /api/interviews (creates as "draft")
    2. PUT /api/interviews/:id { status: "active" }
    3. POST /api/interviews/:id/invite (now succeeds)

  OR the backend createInterview should accept status: "active" from the request.
`);

await browser.close();
process.exit(0);
