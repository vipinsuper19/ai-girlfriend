# Android App — Implementation Plan

Companion document to `docs/PRD.md`. Where the two disagree, this document reflects **what the backend in `apps/api` actually does today**, which is not always what the PRD specifies.

---

## 1. Ground truth: the API as it exists today

Base URL is `http://localhost:3001/api/v1` (global prefix set in `apps/api/src/main.ts`). There is no Swagger/OpenAPI spec, so the contract below was read directly from the controllers.

### 1.1 Response envelope

Every non-streaming JSON response is wrapped by `ResponseInterceptor`:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Request successful",
  "data": { },
  "timestamp": "2026-09-09T08:00:00.000Z",
  "path": "/api/v1/users/me"
}
```

Errors come from `HttpExceptionFilter`:

```json
{
  "success": false,
  "statusCode": 403,
  "message": "Usage limit exceeded for MESSAGES",
  "error": "Forbidden",
  "timestamp": "...",
  "path": "..."
}
```

Two consequences for the client:

- `message` is `string` **or** `string[]` (validation errors arrive as an array). The Kotlin model must tolerate both.
- There is **no machine-readable `error.code`**. The filter drops custom fields, so `USAGE_LIMIT_EXCEEDED` never reaches the client. Today the app can only match on HTTP status plus a message substring, which is fragile. See §3.

There is no `meta` object, so the PRD's pagination envelope does not exist yet.

### 1.2 Endpoints the Android app can call

| Method | Path | Guarded | Notes |
|---|---|---|---|
| POST | `/auth/register` | public | returns user + both tokens |
| POST | `/auth/login` | public | returns user + both tokens |
| POST | `/auth/refresh` | public | **rotates** the refresh token |
| POST | `/auth/logout` | Bearer | deletes the session row |
| GET | `/users/me` | Bearer | prefer this over `/auth/me` |
| PATCH | `/users/me` | Bearer | `displayName` only |
| DELETE | `/users/me` | Bearer | |
| POST/GET | `/avatars` | Bearer | companion create / list |
| GET/PATCH/DELETE | `/avatars/:id` | Bearer | GET includes nested appearance, personality, voice |
| POST | `/avatars/:id/avatar` | Bearer | multipart field `file`, ≤5 MB, jpeg/png/webp |
| GET/POST | `/conversations` | Bearer | |
| GET/DELETE | `/conversations/:id` | Bearer | |
| GET/POST | `/conversations/:id/messages` | Bearer | |
| POST | `/conversations/:id/messages/stream` | Bearer | SSE, see §5.2 |
| DELETE | `/messages/:id` | Bearer | |
| GET | `/memories` | Bearer | filters: `type`, `companionId`, `conversationId`, `limit` |
| GET/PATCH/DELETE | `/memories/:id` | Bearer | |
| GET | `/usage/summary` | **none** | reads `req.user.id`, which is undefined |
| POST | `/usage/check`, `/usage` | **none** | |
| GET | `/subscriptions/current`, `/subscriptions/latest` | **none** | reads `req.user?.sub` |
| POST | `/api/v1/voice/{transcribe,synthesize,respond}` | **none** | double-prefixed, see §3 |
| GET | `/uploads/**` | static | media files, no auth |

The companion resource is called **`avatars`** in the backend but **`companions`** everywhere in the PRD. I have kept the backend name in the network layer and used the PRD name in the UI/domain layer, with the mapping isolated to the API service interface.

### 1.3 Enums (from `apps/api/src/prisma/contract.prisma`)

These serialize as strings and map one-to-one to Kotlin enums:

- `CompanionGender`: `FEMALE`, `MALE`, `OTHER`
- `CompanionStatus`: `ACTIVE`, `ARCHIVED`
- `MessageRole`: `USER`, `ASSISTANT`, `SYSTEM`
- `MessageType`: `TEXT`, `AUDIO`, `IMAGE`, `SYSTEM`
- `MemoryType`: `PROFILE`, `PREFERENCE`, `RELATIONSHIP`, `CONVERSATION`, `FACT`
- `SubscriptionPlan`: `FREE`, `PREMIUM`, `PREMIUM_PLUS`
- `SubscriptionStatus`: `ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`, `EXPIRED`
- `UsageFeature`: `TEXT_TOKENS`, `MESSAGES`, `IMAGE_GENERATIONS`, `VOICE_MINUTES`, `AUDIO_CALL_MINUTES`, `VIDEO_CALL_MINUTES`

Every enum gets an `UNKNOWN` fallback variant on the client so a future backend value cannot crash deserialization.

IDs are `Int` autoincrement and arrive as JSON numbers, not strings. Timestamps are ISO-8601 strings, not epoch millis.

---

## 2. What the PRD promises that the backend does not have

These are not Android work items, but they cap what the app can ship. Listed in the order they will hurt.

**AI image generation does not exist.** The PRD lists it as P0 and specifies five endpoints under `/images`. The `ImageGeneration` Prisma model is defined, but there is no controller, no service, and no route. The only image write path is uploading a companion avatar by hand. This blocks PRD Module 7 and Module 11 (gallery) entirely.

**No Google login, no forgot/reset password.** Auth is email plus password only. The `AuthProvider` enum has `GOOGLE` and `APPLE` and there is an `Account` table, but no OAuth endpoint exists. The PRD's onboarding flow assumes Google sign-in on the Welcome screen.

**No push notification infrastructure.** No FCM integration, no device-token registration endpoint, no notification preferences. PRD Module 12 is not startable from the client side.

**No pagination anywhere.** `GET /conversations/:id/messages` returns every message in the conversation, ascending, in one array. `GET /conversations` returns all conversations. This is fine for a demo and will fall over on a real account. Cursor pagination (`?before=<id>&limit=`) is the fix.

**Usage limits are defined but not enforced.** `UsageService.consume()` exists and `usage-limits.ts` has the full plan matrix, but nothing in `MessagesService`, `AiService`, or `VoiceService` calls it. So a Free user is currently unlimited, and the app cannot rely on the backend to stop them.

**No subscription purchase flow.** `SubscriptionsService.create/update/activateProviderSubscription` exist as service methods with DTOs, but none are exposed over HTTP. There is no Play Billing verification endpoint.

Calls, admin, and moderation are also absent, but those are Phase 2/3 in the PRD, so they are correctly out of MVP scope.

---

## 3. Backend fixes needed before or alongside Android work

Small changes, high leverage. I would do these first — most are a few lines each.

**Fix the voice route prefix.** `apps/api/src/voice/voice.controller.ts` declares `@Controller('api/v1/voice')` while `main.ts` already sets a global `api/v1` prefix, so the live routes are `/api/v1/api/v1/voice/transcribe`. Change the decorator to `@Controller('voice')`.

**Add `@UseGuards(JwtAuthGuard)` to the voice, usage, and subscriptions controllers.** All three read `req.user` but no guard populates it, so those handlers currently throw on `request.user.id` or silently operate on `undefined`. Voice and usage are also the paid endpoints, so they are exactly the ones that must not be open.

**Forward the error code.** `HttpExceptionFilter` extracts only `message` and `error` from the exception response, which discards the `code` that `UsageLimitExceededException` sets. Passing through a `code` field lets the app show "You're out of messages this month" and deep-link to the paywall instead of string-matching an English sentence.

**Reconcile the access-token TTL.** `generateTokensForSession()` defaults to `30d` while `refresh()` defaults to `15m`, both reading `JWT_ACCESS_EXPIRES_IN`. A token minted at login therefore outlives one minted by a refresh by a factor of 2,880. Pick one — I'd suggest a short access token (15m) and rely on rotation.

**Guard `GET /auth/me` or delete it.** It duplicates `/users/me` and has no guard. The app will use `/users/me`.

**Send SSE keepalive comments.** The stream writes nothing between the user-message event and the first AI delta. If the model takes a while, an intermediate proxy or a dozing radio can drop an idle connection. A `: ping\n\n` every 15s prevents that.

Lower priority, but worth queueing: return absolute media URLs (or a configured public base) instead of relative `/uploads/...` paths, and emit TTS as compressed audio rather than WAV — see §5.3.

---

## 4. Stack and project setup

### 4.1 Toolchain

Versions verified current as of September 2026; pin them in a Gradle version catalog and bump deliberately.

| Component | Version | Note |
|---|---|---|
| Android Gradle Plugin | 9.4.0 | requires Gradle 9.6.0, JDK 17 |
| Kotlin | 2.3.21 | with `org.jetbrains.kotlin.plugin.compose` at the same version |
| Compose BOM | 2026.06.00 | |
| `compileSdk` | 37 | required by Compose 1.12+ / AGP 9 |
| `targetSdk` | 36 | Play requires API 36 for new apps as of 31 Aug 2026 |
| `minSdk` | 26 | covers effectively the whole active install base and avoids desugaring friction |

### 4.2 Libraries

- **UI** — Jetpack Compose, Material 3, Navigation Compose with type-safe routes, Coil 3 for images
- **DI** — Hilt
- **Network** — Retrofit + OkHttp + `kotlinx.serialization`, plus `okhttp-sse` for chat streaming
- **Local** — Room for the conversation/message cache, DataStore (Preferences) for settings, DataStore + an Android Keystore AES/GCM key for tokens
- **Async** — Coroutines and Flow throughout; `StateFlow` for UI state
- **Media** — `MediaRecorder` for capture, Media3 ExoPlayer for playback
- **Test** — JUnit5, Turbine, MockK, `okhttp-mockwebserver`, Compose UI tests, Paparazzi or Roborazzi for screenshot tests

On token storage: `androidx.security:security-crypto` (`EncryptedSharedPreferences`) is the obvious choice but is deprecated, so I plan to hold a Keystore-backed AES/GCM key and store the ciphertext in DataStore. It is roughly 60 lines and has no deprecation cliff.

### 4.3 Module layout

A standalone Gradle build at `apps/android`, not wired into Turborepo initially — Turbo has nothing useful to add to a Gradle build, and keeping them separate avoids a class of CI confusion. It can be wrapped later if we want one `pnpm build` entry point.

```
apps/android/
├── settings.gradle.kts
├── gradle/libs.versions.toml          # single source of dependency versions
├── build-logic/                        # convention plugins, so 15 modules don't repeat config
├── app/                                # Application, MainActivity, nav host, DI wiring
├── core/
│   ├── model/                          # pure Kotlin domain models, no Android deps
│   ├── common/                         # Result type, dispatchers, error mapping
│   ├── network/                        # Retrofit services, DTOs, interceptors, SSE client
│   ├── database/                       # Room entities, DAOs
│   ├── datastore/                      # token store, settings store
│   ├── data/                           # repositories: the only place network and DB meet
│   ├── designsystem/                   # theme, colors, typography, shared components
│   └── ui/                             # shared stateful composables
└── feature/
    ├── auth/  onboarding/  companion/  chat/
    ├── memory/  gallery/  voice/  subscription/  settings/
```

Feature modules depend on `core/*` and never on each other. Navigation between features is resolved in `app` so the graph stays acyclic.

**Deliberate deviation from the PRD (decided).** The PRD prescribes `UI → ViewModel → UseCase → Repository`. A mandatory use-case layer across ~24 screens buys mostly single-method passthrough classes, so ViewModels call repositories directly. Use cases are introduced only where logic genuinely spans repositories — sending a message, for instance, touches messages, usage, and memory. This supersedes §11 of the PRD.

---

## 5. The three hard parts

Everything else is CRUD against a REST API. These three are where the design actually matters.

### 5.1 Auth and token refresh

Login and register both return `{ user, accessToken, refreshToken }`. Refresh **rotates**: the response carries a new refresh token and the old one stops working, so a dropped response means the session is dead and the user is logged out.

Design:

- An OkHttp `Interceptor` attaches `Authorization: Bearer <accessToken>` to every request except the auth endpoints.
- An OkHttp `Authenticator` handles 401 by refreshing once and retrying. `Authenticator` is the right hook rather than an interceptor because OkHttp gives it built-in retry semantics and a `responseCount` guard against infinite loops.
- Refresh runs inside a `Mutex`. Without it, a screen firing five parallel requests on a cold start produces five concurrent refreshes, four of which rotate against a token that has already been consumed and fail — logging the user out at random. This is the single most common bug in this pattern.
- The mutex holder re-reads the stored token after acquiring the lock, so callers queued behind a successful refresh use the new token instead of refreshing again.
- On refresh failure, clear the token store and emit a global `SessionExpired` event that the nav host observes to route back to Login.

### 5.2 Streaming chat over SSE

`POST /conversations/:id/messages/stream` writes a raw event stream, bypassing the response envelope. The wire format from `messages.controller.ts` is:

```
event: message
data: {"type":"message","message":{...}}

event: delta
data: {"type":"delta","content":"Hey"}

event: done
data: {"type":"done","message":{...}}
```

with `event: error` and `data: {"message":"..."}` on failure.

Implementation notes:

- `EventSources.createFactory(client)` from `okhttp-sse` accepts a POST request with a body, so the JSON message payload rides along normally.
- **Use a separate OkHttp client with `readTimeout(0)`.** The default 10s read timeout will kill the stream during any model pause. This is the most likely first bug.
- Wrap the whole thing in `callbackFlow` and emit a sealed `ChatStreamEvent` so the ViewModel consumes a normal Flow.
- The stream is not the only failure mode: if the guard rejects the request, the response is JSON, not `text/event-stream`, and `okhttp-sse` reports it through `onFailure` with the response attached. Parse that body for the real error rather than showing a generic "connection lost".
- Accumulate deltas into a local buffer and replace it with the authoritative message from the `done` event, so the persisted server ID and timestamp win.
- Cancelling the coroutine (user leaves the screen) must cancel the `EventSource`; the backend has no resume, so a partial response is discarded.

Since there is no resumable stream, dropping the connection mid-response loses the reply. For MVP that's acceptable if the UI says so plainly and offers retry.

### 5.3 Voice

Round-trip is `POST /voice/respond` with a multipart `audio` file plus a `conversationId` form field, returning the transcript, both persisted messages, and a URL to the generated audio.

- **Capture** with `MediaRecorder` using the MPEG-4 container and AAC encoder, uploaded as `audio/mp4`. The backend's Gemini STT provider accepts that MIME type, and MediaRecorder is far less work than hand-rolling PCM-to-WAV from `AudioRecord`. If transcription quality disappoints, switching to raw PCM/WAV is a contained change behind the recorder interface.
- **Permissions** — `RECORD_AUDIO` requested at first use with a clear rationale, not at launch.
- **Playback** via Media3 ExoPlayer against the returned URL, prefixed with the server origin because the backend returns relative `/uploads/...` paths.
- **Note for the backend:** TTS output is uncompressed WAV. A 30-second reply is roughly 1 MB, versus about 60 KB as Opus. On mobile data this is the difference between snappy and unusable, and it is a provider-config change, not an architectural one.

### 5.4 Offline and optimistic sending

Room caches conversations and messages so the chat list opens instantly and history survives going offline.

The wrinkle is that message IDs are server-assigned autoincrement integers, but an optimistically-rendered outgoing message needs an identity before the server has seen it. So the entity uses a client-generated UUID as its primary key, with a nullable `serverId` and a `status` of `SENDING`, `SENT`, or `FAILED`. Reconciliation on `done` fills in `serverId`. Repositories expose Room as the single source of truth and the network layer only ever writes into it.

---

## 6. Screens

Roughly 24 screens across nine feature modules. Grouped by flow, with the endpoints each one needs:

**Onboarding and auth** — Splash (token check), Welcome, Login, Register. Forgot/Reset Password are designed but stubbed until the backend supports them; Google sign-in is omitted from the first build for the same reason.

**Companion creation** — a five-step wizard (Basics → Appearance → Personality → Voice → Review) writing to `POST /avatars`, then an optional avatar upload. State lives in a wizard-scoped ViewModel so back-navigation doesn't lose input.

**Chat** — conversation list, the chat screen itself (streaming, typing indicator, message actions), and a new-conversation sheet.

**Voice** — a record/hold-to-talk overlay on the chat screen plus an audio message bubble with a scrubber, rather than a separate destination.

**Memory** — list with type filters, detail/edit, and a delete confirmation. This is a genuine differentiator and cheap to build since the API is complete.

**Profile and settings** — profile, edit profile, preferences, subscription/usage, delete account.

**Gallery and paywall** — designed but blocked on the backend (§2). Building the shells early means enabling them later is a data-layer change, not a UI rewrite.

---

## 7. Phasing

Sequenced so something runnable exists at the end of each phase. Estimates assume one developer.

| Phase | Scope | Output | Est. |
|---|---|---|---|
| 0 | Backend fixes from §3 | voice reachable, paid endpoints guarded, stable error codes | 1–2 d |
| 1 | Gradle skeleton, version catalog, convention plugins, Hilt, theme, nav host, network layer with auth interceptor + refresh mutex | app boots, hits `/users/me`, CI builds a debug APK | 4–5 d |
| 2 | Auth: splash, welcome, login, register, secure token store, session-expiry routing | real login against a local API | 3–4 d |
| 3 | Companion: creation wizard, list, detail, edit, avatar upload | user can create a companion | 5–6 d |
| 4 | Chat: conversation list, chat screen, SSE streaming, Room cache, optimistic send | **the core product loop works** | 7–8 d |
| 5 | Memory browser and editor; profile and settings | MVP feature-complete against today's backend | 4–5 d |
| 6 | Voice: record, upload, playback, permissions | voice messages work end to end | 4–5 d |
| 7 | Subscription and usage display, paywall shell, error/empty/offline states, polish | release candidate | 4–5 d |

Roughly 6–7 weeks to a testable MVP. Gallery, image generation, Google sign-in, and push notifications sit outside this and unblock as the backend lands them.

Phase 4 is the one to protect. It carries the streaming, the caching, and the optimistic-send reconciliation — the three places where this app is more than a REST form — and it is where schedule pressure will do the most damage.

---

## 8. Cross-cutting details worth deciding early

**Local dev networking.** The emulator reaches the host at `10.0.2.2`, so the debug build points at `http://10.0.2.2:3001/api/v1` and needs a network security config permitting cleartext for that host only. Release builds stay HTTPS-only. Make the base URL a build-config field so a physical device on the LAN can be pointed at a workstation IP.

**Serialization against a strict backend.** The API's `ValidationPipe` sets `forbidNonWhitelisted: true`, so any unexpected property in a request body returns 400. Configure `kotlinx.serialization` with `encodeDefaults = false` and `explicitNulls = false` so absent optional fields are omitted rather than sent as `null`, and `ignoreUnknownKeys = true` on the response side so a backend addition never crashes the app.

**Envelope unwrapping.** A single Retrofit `CallAdapter` (or a `Converter.Factory`) unwraps `data` and turns non-2xx envelopes into a typed error, so no repository ever touches `ApiResponse<T>` directly.

**Media URLs.** Every `avatarUrl`, `audioUrl`, and `imageUrl` is relative. Resolve them through one helper that prepends the configured origin — doing it ad hoc at each call site guarantees one gets missed.

**Content sensitivity.** This is an adult-adjacent product, so plan for screenshot blocking (`FLAG_SECURE`) as a user setting, optional biometric app lock, and a neutral app icon and notification style. Play policy compliance for the store listing is a separate track that should start well before submission.

---

## 9. Decisions and open questions

### Decided

**Use-case layer — pragmatic.** ViewModels call repositories directly; use cases only for cross-repository logic. See §4.3.

**Image generation — deferred.** Out of the Android MVP. The gallery and paywall UI shells still get built (§6) so that enabling them later is a data-layer change rather than a UI rewrite, but no backend images module is being built for this milestone. This is the largest known gap against the PRD and should be the first post-MVP backend workstream.

**Google sign-in — deferred.** Email and password only for MVP. The Welcome screen is laid out with room for a provider button so adding it later does not force a redesign, and the token store is provider-agnostic.

### Still open

**Offline depth.** The plan assumes a read-only Room cache plus optimistic send for messages composed while online. The alternative is a full outbox that queues messages written offline and flushes them on reconnect. The outbox is maybe two extra days and mostly affects Phase 4.

**Monetization.** Play Billing or web checkout. Play is mandatory for in-app digital goods and takes a cut; the choice dictates the shape of the subscription verification endpoint the backend will need, so it should be settled before Phase 7.
