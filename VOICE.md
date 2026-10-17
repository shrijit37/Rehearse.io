# VOICE.md — spoken conversation provider

**Decision (2026-10-17):** the two-way spoken interview uses the Google AI
Studio **Live API** with model **`gemini-3.8-live`**, default voice **`Kore`**,
over the `BidiGenerateContent` WebSocket.

**Status:** decided; the transport is implemented on `feat/live-voice-proxy`
(backend proxy + browser audio/socket primitives). The product flows are **not**
wired to it yet — that step is blocked on the open decision of who scores an
answer, because nothing can be persisted as a `ResultItem` without a score. Every
number below was measured on a Free-Tier AI Studio project (no billing); raw
evidence and scripts live in `~/tmp/gemini-poc/` (`RESULTS.md` is the full
write-up). Nothing in this file is from vendor documentation unless it says so.

## Why this model

One socket does both halves of the conversation — it transcribes the candidate
and speaks the coach's reply — which is why it replaces two REST services.

| Option | Measured behaviour | Verdict |
|---|---|---|
| **`gemini-3.8-live`** | first audio **0.76 s**, per-turn TTFB **0.4–0.6 s**, transcription on the same socket, **no RPM/RPD limit hit** in ~50 sessions | **adopted** |
| `gemini-3.1-flash-live-preview` ("Gemini 3 Flash Live") | first audio **14.3 s** | too slow to converse |
| REST `gemini-3.8-flash-tts` | **7.6–9.0 s** latency, **10 requests/day** | unusable interactively |
| REST `gemini-3.8-flash-lite-tts` | 3 req/min, **10 requests/day** | unusable interactively |
| REST `gemini-3.5-transcribe` | **3 req/min, 25 req/day**, 10 k input tokens/min | cannot serve one interview; batch only |
| Groq Orpheus (today's `ai-service`) | synchronous request/response TTS, no streaming conversation loop | keep for non-interactive synthesis, not for the interview turn |

The free-tier REST quotas were exhausted in a single sitting of testing. At
25 transcriptions/day, a per-turn REST design breaks after one or two answers.

## Working configuration

Connection:

```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=<API_KEY>
```

First frame (verified accepted):

```json
{ "setup": {
    "model": "models/gemini-3.8-live",
    "generationConfig": {
      "responseModalities": ["AUDIO"],
      "speechConfig": { "voiceConfig": { "prebuiltVoiceConfig": { "voiceName": "Kore" } } }
    },
    "systemInstruction": { "parts": [{ "text": "…" }] },
    "inputAudioTranscription": {},
    "outputAudioTranscription": {},
    "sessionResumption": {}
} }
```

Audio in — 16 kHz mono PCM, s16le, 100 ms per frame (3200 bytes):

```json
{ "realtimeInput": { "audio": { "data": "<base64>", "mimeType": "audio/pcm;rate=16000" } } }
```

Text turn, and turn end:

```json
{ "realtimeInput": { "text": "…" } }
{ "realtimeInput": { "audioStreamEnd": true } }
```

Reading the server: frames are **binary** (set `binaryType = 'arraybuffer'`,
decode UTF-8, then `JSON.parse`).

| Field | Meaning |
|---|---|
| `setupComplete` | handshake done; expect ~350–700 ms after the socket opens |
| `serverContent.modelTurn.parts[].inlineData.data` | model audio, base64, **24 kHz** mono PCM |
| `serverContent.inputTranscription.text` | final transcript of what the candidate said |
| `serverContent.interimInputTranscription.text` | in-flight transcript (`languageCode` on the final) |
| `serverContent.outputTranscription.text` | transcript of the coach's speech |
| `serverContent.interrupted` | the model's turn was cut — flush queued playback |
| `serverContent.turnComplete` | end of a model turn |
| `sessionResumptionUpdate.newHandle` / `.resumable` | handle for reconnecting into the same session |
| `goAway.timeLeft` | the server will close this session in N seconds |

## Client requirements

- **Secure context.** `http://localhost` (or https). A LAN IP will not get mic access.
- **16 kHz mono PCM in, 100 ms frames.** `AudioContext({sampleRate: 16000})` plus
  an `AudioWorklet` (or `ScriptProcessorNode`) tap; resample if the device rate differs.
- **24 kHz PCM playback out**, scheduled on an `AudioContext({sampleRate: 24000})`.
- **Trailing silence ends a turn.** `gemini-3.8-live` answers only after server-side
  VAD sees silence; `audioStreamEnd` on its own is ignored. A live mic produces that
  silence naturally; a file or an abrupt stop must send ~1.2 s of explicit silence.
- **Half-duplex on speakers.** Stop sending mic audio while the model speaks, or it
  hears itself and interrupts. Headphones allow full duplex with barge-in.

## Limits to design around

These are the constraints that shape the architecture — the binding one is
concurrency, not request rate.

| Limit | Measured | Consequence |
|---|---|---|
| **Concurrent sessions** | **6 maximum** (x5 → 5/5, x8 → 6/8, x10 → 6/10); an earlier run saw only 4 | caps concurrent interviews per project; **plan for 4**. The 5th+ is refused at setup with WebSocket close **`1011` "You exceeded your current quota"** — *not* an HTTP 429, so retry-on-429 logic never sees it |
| Session length, audio | documented 15 min; **17 min survived** with `sessionResumption:{}` | a 20-minute interview needs a mid-session reconnect |
| Reconnect | handle issued immediately; resume restored a working session in ~0.2 s | keep the handle, reconnect on `goAway` **before** the forced close |
| Cost if billing is enabled | `$0.005/min` audio in + `$0.018/min` audio out | a 20-min interview with ~20 min in, ~5 min out ≈ **$0.19** |
| Not available on Live | diarization, word-level timestamps | anything needing word timings is REST-only |

## Traps (all verified the hard way)

- `responseModalities` belongs **under `generationConfig`**. At the top level of
  `setup` it fails with close `1007`.
- `speechConfig` on Live is **nested**:
  `generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName`.
  The array form `speechConfig: [{voice: …}]` (correct for REST TTS) → `1007`.
- **Invalid voice names are silently ignored on Live** — no error, some other voice
  speaks. The only proof a voice took effect is listening. (REST returns 400.)
- `gemini-3.5-transcribe-live` **rejects `responseModalities: ["AUDIO"]`** (close
  `1007`); a transcription-only setup must omit it.
- `word_info.start_offset` / `end_offset` are **strings** (`"0.200s"`), not numbers.
- `gemini-3.8-live-extended-thinking` requires
  `generationConfig.thinkingConfig.thinkingLevel` (`MINIMAL` is rejected).
- Idle `gemini-3.5-transcribe-live` sockets are closed by the server every **~61 s**
  with `1008` and no `goAway` — an unexpected `1008` there is normal, not a cap.
- Unreachable under this API version: `gemini-3-flash-live`, `gemini-3.8-flash-live`
  (close `1008`); the "Gemini 3 Flash Live" row maps to `gemini-3.1-flash-live-preview`.

## Scope

- **This decides the interactive spoken path only.** It does not change the
  existing `ai-service` Groq endpoints (`/api/stt`, `/api/tts`) or the LLM
  evaluation flow; browser `SpeechSynthesis` remains a fallback.
- **Batch transcription stays REST** (`gemini-3.5-transcribe`) for anything needing
  word timings or diarization — that is 25 requests/day on the free tier, so it needs
  paid billing to exist for real users.
- **Key handling (measured 2026-10-17).** Google's ephemeral `auth_tokens`
  endpoint exists and mints on both `v1alpha` and `v1beta`
  (`POST /<v>/auth_tokens` with `{uses, expireTime}`; `liveConnectConstraints`
  is **rejected** as an unknown field on this version). But the token does **not**
  authenticate the Live socket on its own — all three variants fail:

  | Attempt | Result |
  |---|---|
  | `?access_token=<ephemeral>` | close `1008` "Method doesn't allow unregistered callers" |
  | `?key=<ephemeral>` | close `1007` "API key not valid" |
  | `Authorization: Bearer <ephemeral>` | close `1008` "invalid authentication credentials" |
  | **`?access_token=<ephemeral>&key=<real key>`** | **works — `setupComplete`** |

  The real API key is still required, so **ephemeral tokens do not reduce key
  exposure here**. The browser cannot hold the key, therefore production needs a
  **backend WebSocket proxy** (browser ↔ our backend ↔ Google), authenticating the
  browser with the app's own session and keeping the key server-side. The PoC pages
  call Google directly and are acceptable only as local scratch tools.

## Verifying a change

Two harnesses in `~/tmp/gemini-poc/`, served over localhost:

```bash
cd ~/tmp/gemini-poc && python3 -m http.server 8765
```

- `simple-voice-chat.html` — minimal two-way voice loop: mic in, spoken reply out,
  live transcripts. The fastest way to answer "is voice working right now".
- `gemini-live-lab.html` — full bench: six Live models, voice picker, file streaming,
  turn-end controls, meters, event log with every frame and close code.

Serve on `http://localhost:8765` so the browser grants microphone access.

## Not yet verified

- **Real microphone capture** in target browsers. Headless Chromium has no mic, so the
  capture path was proven with synthetic audio through the same framing and socket
  code. Whether a real `getUserMedia` device feeds it is untested by machine.
- **Concurrency under real multi-user load.** The 4–6 ceiling was measured from one
  machine opening parallel sockets; the number moved between runs, so treat 4 as the
  planning figure.
- **Sessions beyond 17 minutes**, and resume across a genuine network drop.
- **Non-US voice quality.** The catalogue holds 120 en-IN voices and only a handful
  were exercised on Live.

## Migration plan — conversation onto `gemini-3.8-live`

Written 2026-10-17 from a read-only map of the current code. Every path and symbol
below was read in the repo; anything unverified is marked **must verify**.

### Where we are today

The spoken flow is strictly request/response and buffered — there is no streaming
anywhere in the repo (zero matches for `WebSocket`, `EventSource`, `event-stream`,
`getReader`, `AudioContext`, `AudioWorklet` across `frontend/src`).

```
GET /api/rehearsal/start ──► LLM generates 3 questions (not persisted, lost on reload)
  │
  ├─ useSpeak(text)          browser SpeechSynthesis   (the Groq /api/tts branch is dead:
  │                                                     useGroqTts is never passed true)
  ├─ MediaRecorder(webm)  ──► POST /api/rehearsal/evaluate  (multipart `audio` + `question`)
  │                             multer memory → aiClient.evaluateAudio
  │                               → ai-service POST /api/evaluate-audio
  │                                 Groq whisper-large-v3 (STT) + llama-3.3-70b (rubric)
  │                               → {score, feedback, transcription}
  │                             held in React state only
  └─ POST /api/rehearsal/session {results}  ──► rehearsal_sessions.results jsonb
                                                (the practice flow's only DB write)
```

The invited-interview flow (`CandidateInterview.tsx`) is the same shape but writes
**per turn** through `updateInvite({results})` into `candidate_invites.results`.

Two facts that shape the plan:

- **Prod has no Groq key** (`REHEARSE_GROQ_API_KEY` is deliberately uncreated —
  `DEPLOY.md:139`), and **no Google credential exists anywhere in the repo**. So the
  spoken path errors in production *today*, and this migration is also the work that
  makes it work. Nothing about the current voice feature is worth preserving on trust.
- **ai-service is not deployed by any workflow in this repo** (`DEPLOY.md:80`). The
  prod compose stack runs only `app`. Touch ai-service and you are editing a service
  whose deploy path this repo does not control — so the migration stays inside
  `backend/` and `frontend/`.

### Target architecture

```
browser ── wss://api.<…>/ws/live?session=… (subprotocol bearer <ticket>) ──► backend proxy
   │                                                                          │
   │ 16 kHz PCM frames up  ◄──── relay ────►                                  │  wss://generativelanguage…
   │ 24 kHz PCM frames down                    (API key stays server-side)    │  ?key=<server key>
   │                                                                          │
   └── live transcripts ──► existing UI                       3.8-live speaks + transcribes
                                          │
                    per turn end ─────────┴──► persist {question, transcription}
                                                └─► score via LLM ──► {score, feedback}
```

One socket per candidate session, terminated by the **backend**, not the browser:
ephemeral tokens cannot authenticate the socket on their own (measured — see
*Key handling* above), so the key must stay server-side.

### Decisions the plan makes

| Decision | Choice | Why |
|---|---|---|
| Socket terminator | **backend proxy** | ephemeral tokens don't work standalone; keeps the key out of the browser |
| Proxy attach point | `server.on("upgrade")` on the existing `app.listen` server | **verified**: a WS upgrade + handshake works on this Express server under Bun, no framework change |
| Browser auth at upgrade | `new WebSocket(url, ["bearer", ticket])` — read `sec-websocket-protocol` | a browser cannot set an `Authorization` header on `WebSocket`; a subprotocol is a header, so it stays out of access logs (unlike `?token=`) |
| Ticket | short-lived (60 s) signed token minted by an authenticated REST call, scoped to one session + user/invite | reuses the existing JWT machinery; never the 2-day invite JWT or the session cookie |
| Turn persistence | **server-side, per turn**, through the service functions that already exist | authoritative, survives reload, and stops trusting client-posted scores |
| `ResultItem` shape | **unchanged** — `{question, transcription, score, feedback}` (`rehearsal.validation.ts:22-27`) | `Dashboard`/`Results`/`CandidateResults` keep working |
| Scoring | still an LLM call after each turn — **provider is an open decision**, see below | the coach's spoken reply is not a score |
| Old MediaRecorder path | deleted at cutover, not kept behind a flag forever | dual paths rot; the cutover phase below is explicit |
| ai-service | **untouched** | no deploy path from this repo |

### Phases

Each phase ends with something runnable and verifiable. Do not start the next until
the "done when" is actually observed.

**Progress (2026-10-17, `feat/live-voice-proxy`):** Phases 1–3 are implemented.
`backend/src/modules/live/` (proxy, ticket, relay with resumption, slot cap,
turn scoring, persistence) carries a 47-assertion behavioural test that runs
offline in CI (`bun tests/live-proxy.ts`, wired into `./scripts/test`).

Verified against the **real** services, not just the fakes: the relay drove
Google's Live API with a real key (`setupComplete` ~1.1 s, the candidate's audio
transcribed, the coach speaking its reply, ~9 s of audio relayed back), and the
**real rubric ran inside the relay** — a question-only recording scored 1 with
correct reasoning ("you repeated the interview prompt instead of sharing an
actual personal experience"), which is what that input deserves. The browser
handshake (subprotocol, `setupComplete`, 24 kHz frames) was confirmed in real
Chromium. The product flows are wired: both the practice room and the invited
interview run the conversation over the socket, render the candidate's live
transcript, and take their score from the relay.

Answer scoring is one provider: `gemini-3.8-flash` on the REST text endpoint
(6.8 s measured, so it runs *after* the turn, never inside it) replaces the batch
path's Groq re-transcription. The relay writes each interview answer onto the
invite exactly as `evaluateCandidateAnswer` does, and writes a practice session
once when the socket closes; a client can no longer post its own results.

**Not verified**: a real microphone (headless has no mic — capture is exercised
with synthetic audio through the same framing and socket code); long-lived
upgrades through Traefik (nothing has ever held a WebSocket through this proxy);
and concurrency under real multi-user load. Phase 0's secret is **not**
provisioned: while `GEMINI_API_KEY` is missing, `POST /api/live/session` answers
503 and nothing else changes.

The relay's database writes **were** verified against a real Postgres (throwaway
cluster, the repo's own migrations, a deterministic rubric so the only variable
was the write): a practice session lands on socket close with the right row shape
and role; an interview answer lands on the invite in the same shape the batch path
writes; re-answering replaces rather than appends; round and status stay
untouched; and a completed invite is refused.

Phase 4 (deleting the batch endpoints, `aiClient.evaluateAudio` and the multer
audio config) is deliberately **not** done: it is the irreversible step and waits
until a live session has been verified in production.

#### Phase 0 — unblock the dependency (S)

- Create the Gemini API key and put it in Infisical `prod` as `REHEARSE_GEMINI_API_KEY`.
- Add it to the Dokploy compose app env as `${{vault.infisical-prod.REHEARSE_GEMINI_API_KEY}}`
  (the env block is asserted on every deploy — `DEPLOY.md:54-65`) and to
  `backend/src/config/env.ts` + `.env.example`.
- **Must verify:** a WebSocket survives Traefik for ≥5 minutes through
  `wss://api.rehearse.io.shrijit.tech/…`. `deploy/compose.prod.yml` carries no upgrade
  or timeout annotations today, so nothing has ever proven a long-lived upgrade
  traverses the proxy. A read/idle timeout here kills 20-minute interviews.
- **Must verify:** which provider scores an answer (see *Open decisions*) — that choice
  decides whether `REHEARSE_GROQ_API_KEY` also has to be provisioned.

**Done when:** `/health` reports this run's SHA with the new env present, and a
throwaway socket through the public domain has stayed open past 5 minutes.

#### Phase 1 — backend Live proxy (M)

- New module `backend/src/modules/live/` — `live.routes.ts` (mint a ticket),
  `live.proxy.ts` (the upgrade handler + relay), mirroring the
  `{status, message, data}` service convention.
- `backend/src/server.ts:124` — attach `server.on("upgrade")` beside the existing app.
  Route only `/ws/live`; destroy every other upgrade.
- Relay: browser frames → Google verbatim; Google frames → browser verbatim. The
  backend must **not** re-encode audio; it does parse frames for session bookkeeping
  (`setupComplete`, `inputTranscription`, `turnComplete`, `goAway`,
  `sessionResumptionUpdate`).
- Enforce the ceiling: **max 4 concurrent Live sessions per process** (measured
  ceiling 6, planning figure 4). A 5th request gets a clean `1011`-style refusal with a
  human message, not a mystery close.
- Reconnect: on `goAway`, open a replacement socket with the `sessionResumption` handle
  and keep the browser-side socket alive. Cap retries; surface failure.
- Audit: emit the already-defined-but-never-used `interview_start` action
  (`repositories/audit.ts:13`, `middleware/auditLog.ts:19`) on socket open/close.
- **Delete `backend/src/app.ts`** — it is empty and dead; do not leave two entrypoints.

**Done when:** a script can connect to the local socket, stream a WAV, and receive
transcript + audio frames through the proxy, with the API key absent from every
client-visible payload.

#### Phase 2 — frontend audio primitives (M)

- New `frontend/src/lib/pcm.ts` — `getUserMedia` → `AudioContext({sampleRate:16000})` →
  `AudioWorklet` tap → 100 ms s16le frames, and a 24 kHz playback queue built on
  scheduled `AudioBufferSourceNode`s with a `stop()` that clears it. This is the repo's
  first `AudioContext`; the proven implementation is in `~/tmp/gemini-poc/gemini-live-lab.html`
  (`submitFloats`, `playPcm`, `stopPlayback`) — port it, don't reinvent it.
- Turn state enum `connecting | listening | thinking | speaking` to replace the
  `isRecording` / `isEvaluating` booleans that `BehavioralRound` consumes today
  (`BehavioralRound.tsx:14-33`).
- **Half-duplex** (mute the mic while the model speaks) for the first cut: on laptop
  speakers the model otherwise hears itself and interrupts. Barge-in is a later toggle.

**Done when:** a scratch page in the app connects, streams mic audio, and plays the
reply with the transcript appearing live.

#### Phase 3 — wire the two flows (M)

- `RehearsalRoom.tsx` / `CandidateInterview.tsx`: replace
  `handleToggleRecording` (`:108-153` / `:205-248`) and `handleEvaluate`
  (`:155-184` / `:250-282`) with the socket; delete the `audioChunksRef` blob assembly
  (`:56`, `:134-142`) and the 1-second `setInterval` timers once the socket reports
  turn state.
- `BehavioralRound.tsx`: render the live transcript in the answer panel (today nothing
  is shown until after the session) and drive the mic button off the state enum.
- Persistence per turn, server-side:
  - interview → `updateInvite({results})` (`interviews.ts:135-142`)
  - practice → keep `POST /api/rehearsal/session` for the final write, or give the
    proxy the same `saveSession` call per turn; **pick one, don't do both**
- Scoring after each turn: feed the **live transcript** to the rubric LLM instead of
  re-transcribing audio — this is what retires the Groq STT dependency.
- `useSpeak` stays for non-conversational speech; the dead `useGroqTts` branch
  (`useSpeak.ts:158-204`, never passed `true`) gets deleted.

**Done when:** a full practice session and a full invited interview run end to end with
turns persisted, and the resulting rows match today's `ResultItem` shape.

#### Phase 4 — cutover and cleanup (S)

- Delete the batch path in one commit: `POST /api/rehearsal/evaluate` and
  `POST /api/interviews/candidate/evaluate` (+ their controllers, multer config,
  `aiClient.evaluateAudio`, `MAX_AUDIO_SIZE` if nothing else uses it) and the
  `ResultDetailPanel` assumption that a transcript only exists post-session.
- Leave ai-service's now-unused `evaluate_audio` / `text_to_speech` endpoints alone
  (owned outside this repo) and note them as retired in `VOICE.md`.
- Update `DEPLOY.md` (new secret, WS route), `AGENTS.md` (this is no longer "not yet
  implemented"), and `STATE.md` once it is deployed and verified.

**Done when:** no code path uploads answer audio, and the repo has one conversation
transport.

### Risks

| Risk | Mitigation |
|---|---|
| Traefik kills long-lived upgrades (nothing has ever proven one traverses this proxy) | Phase 0 probe with a ≥5-minute socket; raise idle/read timeouts in the Dokploy domain config if it fails |
| 4–6 session ceiling is per *project*, and the backend is one container | hard client-facing limit + queue; a 5th candidate gets "all coaches are busy", never a raw close |
| Live sessions end mid-interview (15 min cap, idle closes) | `sessionResumption` handle reuse in the proxy; the browser socket never sees the churn |
| Cost if billing is enabled (~$0.19 per 20-min interview) | acceptable per session, but it is unbounded-per-user — rate-limit sessions per user before launch |
| Candidate-speech privacy: audio now flows through our backend | it already did; keep the "audio is never stored" property (transcript only) |
| Mic capture unverified in the product's browsers | Phase 2 is a real browser test before any UI wiring |

### Rollback

Phases 1–3 are additive: the batch endpoints still exist and still work, so
`deploy-backend`/`deploy-frontend` of the previous SHA restores today's behaviour.
Phase 4 is the only irreversible step — take it after a session has been verified in
production, and revert by re-pushing the commit that removes the batch path.

Deploy mechanics: `backend/**` pushes run the full backend pipeline (test → build →
Trivy → Dokploy → SHA gate); `frontend/**` pushes deploy Pages; **`.md`-only pushes
deploy nothing**, so this document can land without touching production.
Deploy truth is `DEPLOY.md`; `.github/workflows/deploy-*.yml` outranks any doc.

### Open decisions (owner)

1. **Who scores the answer.** Keeping Groq means provisioning the key that was
   deliberately never created; moving the rubric to a Gemini text call means one
   provider and one secret. Recommendation: **one provider — Gemini** — since the
   conversation half already depends on it, and the Groq key is absent by choice.
2. **Does the coach speak per turn, or only score?** A spoken reply per answer (what
   `gemini-3.8-live` is good at) is a different product from "answer, get a score".
   Recommendation: spoken coach replies, score in the UI, since that is what the
   model makes cheap.
3. **Practice-mode reload resume.** Questions are generated per request and lost on
   reload today. With a live session in flight, either persist them at start or accept
   that a reload ends the session.
4. **Retire ai-service STT/TTS entirely?** They become dead once this lands, but that
   service deploys outside this repo.

### Not in this plan

- DSA rounds (text/code, no audio) — untouched.
- The recruiter authoring/analysis views — they consume the same `ResultItem` shape and
  need no change.
- Multi-user scaling beyond one backend container.
