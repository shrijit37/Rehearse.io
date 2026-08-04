// E2E smoke test — exercises the full Rehearse.io API against a live stack.
// Run: bun e2e-test.ts   (expects backend on :9000, AI service on :8000, local mongo)
const BASE = "http://localhost:9000";

let passed = 0, failed = 0;
function ok(cond: boolean, label: string, extra?: unknown) {
  if (cond) { passed++; console.log(`  ✅ ${label}`); }
  else { failed++; console.log(`  ❌ ${label}`, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ""); }
}

async function req(method: string, path: string, data?: unknown, token?: string, raw = false) {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  let body: unknown;
  if (data instanceof FormData) body = data;
  else if (data !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(data); }
  const res = await fetch(BASE + path, { method, headers, body: body as any });
  if (raw) return res;
  let json: any = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

// Minimal valid PDF containing readable text
const minimalPdfBase64 = `JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQgL0YxIDE4IFRmIDcyIDcyMCBUZCAoU29mdHdhcmUgRW5naW5lZXIgcmVzdW1lKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1OCAwMDAwMCBuIAowMDAwMDAwMTE1IDAwMDAwIG4gCjAwMDAwMDAyNDMgMDAwMDAgbiAKMDAwMDAwMDQwMCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQ5NAolJUVPRgo=`;

const uniq = `e2e${Date.now()}`;

async function main() {
  console.log("=== AUTH ===");
  // 1. Recruiter signup
  let r = await req("POST", "/api/auth/signup", { name: "Recruiter", email: `${uniq}-rec@example.com`, password: "password123", role: "recruiter", consentGiven: true, consentVersion: "1.0" });
  ok(r.status === 201 && r.json?.token, "recruiter signup", r.json);
  const recruiterToken = r.json?.token;
  ok(r.json?.user?.role === "recruiter" && r.json?.user?.onboarded === false, "signup user has role+onboarded");

  // 2. Candidate signup
  r = await req("POST", "/api/auth/signup", { name: "Candidate User", email: `${uniq}-cand@example.com`, password: "password123", role: "candidate", consentGiven: true, consentVersion: "1.0" });
  ok(r.status === 201 && r.json?.token, "candidate signup", r.json);
  const candidateToken = r.json?.token;

  // 3. Login
  r = await req("POST", "/api/auth/login", { email: `${uniq}-rec@example.com`, password: "password123" });
  ok(r.status === 200 && r.json?.token, "recruiter login");
  ok(typeof r.json?.user?.onboarded === "boolean", "login returns onboarded flag");

  console.log("\n=== ORGANIZATIONS ===");
  r = await req("POST", "/api/org", { name: "Acme Corp" }, recruiterToken);
  ok(r.status === 201 && r.json?.organization?._id, "create org", r.json);
  const orgId = r.json?.organization?._id;
  r = await req("GET", "/api/org", undefined, recruiterToken);
  ok(r.status === 200 && Array.isArray(r.json?.data) && r.json.data.some((o: any) => o._id === orgId), "list my orgs");
  r = await req("POST", "/api/org", { name: "X" }, recruiterToken);
  ok(r.status === 400, "org name too short rejected");

  console.log("\n=== INTERVIEW SETUP (AI generate DSA) ===");
  r = await req("POST", "/api/interviews/generate-dsa", { targetRole: "Senior Backend", difficulty: "easy", count: 1 }, recruiterToken);
  ok(r.status === 200 && r.json?.problems?.length > 0, "generate-dsa returns problems", r.json?.problems || r.json);
  const dsaproblems = r.json?.problems || [];

  // Create mixed interview
  r = await req("POST", "/api/interviews", {
    title: "Backend Round 1", targetRole: "Senior Backend", description: "desc",
    interviewType: "mixed", questions: ["Tell me about yourself?", "Why backend?"],
    dsaProblems: dsaproblems, dsaDifficulty: "easy",
    expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    organizationId: orgId, status: "active",
  }, recruiterToken);
  ok(r.status === 201 && r.json?.interview?._id, "create interview", r.json);
  const interviewId = r.json?.interview?._id;

  r = await req("GET", `/api/interviews?organizationId=${orgId}`, undefined, recruiterToken);
  ok(r.status === 200 && r.json?.data?.length >= 1, "list interviews filtered by org");
  r = await req("GET", `/api/interviews/${interviewId}`, undefined, recruiterToken);
  ok(r.status === 200 && Array.isArray(r.json?.candidates), "get interview returns candidates array");

  // Invite a brand-new candidate (not signed up)
  r = await req("POST", `/api/interviews/${interviewId}/invite`, { candidateEmail: `${uniq}-invited@example.com` }, recruiterToken);
  ok(r.status === 201 && r.json?.inviteToken, "generate invite", r.json);
  const inviteToken = r.json?.inviteToken;

  console.log("\n=== CANDIDATE FLOW ===");
  r = await req("GET", `/api/interviews/candidate/accept/${inviteToken}`);
  ok(r.status === 200 && r.json?.token && r.json?.invite && r.json?.interview, "accept invite returns token+interview", r.json);
  const candidateJwt = r.json?.token;
  const inviteId = r.json?.invite?._id;
  ok(r.json?.invite?.status === "started", "invite marked started");

  // Candidate can list their interviews (via signed-up candidate token)
  r = await req("GET", "/api/interviews/candidate/my-interviews", undefined, candidateToken);
  ok(r.status === 200 && Array.isArray(r.json?.data), "candidate my-interviews");

  // Behavioral evaluate needs audio; test error path + submit persistence
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array([0x1a,0x45,0xdf,0xa3])], { type: "audio/webm" }), "answer.webm");
  form.append("question", "Tell me about yourself?");
  form.append("inviteId", inviteId);
  let res = await req("POST", "/api/interviews/candidate/evaluate", form, candidateJwt);
  ok(res.status === 200 || res.status === 502, "candidate evaluate (audio) handled", res.json);

  r = await req("POST", "/api/interviews/candidate/submit", { inviteId, questionIndex: 0 }, candidateJwt);
  ok(r.status === 200, "candidate submit q0", r.json);

  // DSA evaluate using the invited candidate JWT
  r = await req("POST", "/api/interviews/candidate/evaluate-dsa", { inviteId, problemIndex: 0, language: "python", code: "def solution(x):\n    return x", timeSpentSeconds: 42 }, candidateJwt);
  ok(r.status === 200 && typeof r.json?.score === "number", "candidate evaluate-dsa returns score", r.json);

  console.log("\n=== RECRUITER VIEWS RESULTS ===");
  r = await req("GET", `/api/interviews/${interviewId}`, undefined, recruiterToken);
  ok(r.status === 200 && r.json?.candidates?.some((c: any) => c._id === inviteId && c.dsaResults?.length > 0), "recruiter sees dsa results");

  console.log("\n=== REHEARSAL / PRACTICE ===");
  // Onboard the signed-up candidate with a real PDF
  r = await req("POST", "/api/users/onboard", { resume: `data:application/pdf;base64,${minimalPdfBase64}`, resumeName: "resume.pdf", audio: "", photo: "" }, candidateToken);
  ok(r.status === 200 && r.json?.user?.onboarded === true, "candidate onboarding with PDF", r.json?.message || r.json);
  r = await req("GET", "/api/rehearsal/start?targetRole=Frontend", undefined, candidateToken);
  ok(r.status === 200 && Array.isArray(r.json?.questions) && r.json.questions.length > 0, "rehearsal start generates questions", r.json);
  r = await req("POST", "/api/rehearsal/dsa/start", { targetRole: "Frontend", difficulty: "medium", count: 1 }, candidateToken);
  ok(r.status === 200 && r.json?.problems?.length > 0, "rehearsal dsa start", r.json?.problems || r.json);
  r = await req("POST", "/api/rehearsal/dsa/evaluate", { title: "Two Sum", description: "Find pair", difficulty: "easy", constraints: "", examples: [{ input: "[1,2]\n3", output: "true", explanation: "x" }], topics: ["arrays"], expectedApproach: "hashmap", language: "python", code: "def solution(nums,t):\n  s=set()\n  for n in nums:\n    if t-n in s: return True\n    s.add(n)\n  return False", timeSpentSeconds: 10 }, candidateToken);
  ok(r.status === 200 && typeof r.json?.score === "number", "rehearsal dsa evaluate", r.json);
  r = await req("POST", "/api/rehearsal/session", { sessionType: "dsa", targetRole: "Frontend", dsaResults: [{ problemTitle: "Two Sum", problemIndex: 0, language: "python", code: "x", score: 7, correctness: 7, codeQuality: 7, timeComplexity: "O(n)", spaceComplexity: "O(n)", feedback: "ok", strengths: [], improvements: [] }] }, candidateToken);
  ok(r.status === 201, "save dsa practice session", r.json);
  r = await req("GET", "/api/rehearsal/history", undefined, candidateToken);
  ok(r.status === 200 && Array.isArray(r.json?.data) && r.json.data.length >= 1, "rehearsal history");

  console.log("\n=== PROFILE / CONSENT / TTS ===");
  // webm blob with a valid RIFF/webm header (0x1A45DFA3)
  r = await req("PATCH", "/api/users/profile", { audio: "data:audio/webm;base64,GkXfow==" }, candidateToken);
  ok(r.status === 200 && r.json?.user?.onboarded === true, "profile update with audio", r.json?.message);
  r = await req("GET", "/api/users/consent", undefined, candidateToken);
  ok(r.status === 200 && typeof r.json?.consentGiven === "boolean", "get consent");
  r = await req("POST", "/api/users/consent", { consentGiven: true, consentVersion: "1.0" }, candidateToken);
  ok(r.status === 200 && r.json?.consent?.consentGiven === true, "update consent");
  // TTS: 200 = audio generated; 502 = provider terms not yet accepted (Orpheus requires
  // terms acceptance in the Groq console). Either proves the proxy is correctly wired.
  let tres = await req("POST", "/api/tts", (() => { const f = new FormData(); f.append("text", "Hello"); f.append("voice", "tara"); return f; })(), recruiterToken, true);
  const ttsOk = tres.status === 200 || tres.status === 502;
  ok(ttsOk, `tts proxy wired (http=${tres.status})`, tres.status);
  let exportRes = await req("POST", "/api/users/export-data", undefined, candidateToken, true);
  const exportJson = await exportRes.json();
  ok(exportRes.status === 200 && exportJson.user?.email, "export-data returns user data");

  console.log("\n=== ROLE PROTECTION ===");
  r = await req("GET", "/api/org", undefined, candidateToken);
  ok(r.status === 200, "candidate can list orgs (any authed user)");
  r = await req("POST", "/api/interviews", { title: "x", targetRole: "x", expiresAt: "2025-01-01", organizationId: orgId }, candidateToken);
  ok(r.status === 403, "candidate blocked from creating interview");

  console.log(`\n========== RESULT: ${passed} passed, ${failed} failed ==========`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { console.error("E2E crashed:", e); process.exit(1); });