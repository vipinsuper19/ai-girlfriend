<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

`db:migrate` applies the on-disk migrations (`prisma db migrate --no-interactive`). From an empty database it installs the `vector` extension, then creates the current schema, including `public."user"`. Point `DIRECT_URL` at the Supabase session pooler (port 5432). Enable `vector` in the Supabase dashboard before the first run so `CREATE EXTENSION` is allowed.

```bash
$ pnpm --filter @ai-girlfriend/api run db:migrate
```

Render runs this API as a native Node service, not the image from `apps/api/Dockerfile`. The service root is the repository root, and `render.yaml` sets Node 24. The build command installs devDependencies (production `NODE_ENV` would omit the TypeScript toolchain) and compiles:

```bash
pnpm install --frozen-lockfile --prod=false && pnpm --filter @ai-girlfriend/api build
```

The start command migrates, then listens:

```bash
pnpm --filter @ai-girlfriend/api run db:migrate && pnpm --filter @ai-girlfriend/api start:prod
```

## Configuration

Every feature below stays off until its variables are set. Unconfigured features answer `503` and the
clients hide the matching controls, so nothing is faked.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Postgres connection |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Session tokens |
| `JWT_RESET_SECRET` | Password reset tokens. Falls back to a value derived from `JWT_ACCESS_SECRET` |
| `APP_URL` | Web origin used in reset links, e.g. `https://app.example.com` |
| `SMTP_URL`, `MAIL_FROM` | Outgoing mail. Without `SMTP_URL`, development writes the message to the log and production does not send it. A deletion request emails a confirmation link to the account address. After that link is opened, a copy goes to `CONTACT_EMAIL` when that address is set |
| `CONTACT_EMAIL` | Address on `/privacy` and `/account-deletion`. Until it is set, the pages show `TODO`, and that placeholder is not emailed |
| `DEVELOPER_NAME` | Developer name on those pages. Until it is set, the pages show `TODO` |
| `GOOGLE_CLIENT_IDS` | Comma-separated OAuth client ids accepted by `POST /auth/google` (web) |
| `FIREBASE_PROJECT_ID` | Firebase ID tokens accepted by `POST /auth/google` (Android) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push notifications through FCM, and `auth.deleteUser` when `DELETE /users/me` removes a Firebase/Google account. Raw JSON or base64. A missing or invalid value does not block boot; production with `FIREBASE_PROJECT_ID` logs an error until it is set |
| `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_STT_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_IMAGE_MODEL` | Chat, voice, and images |
| `AGE_GATE_ENFORCED` | `false` (default). `true` returns `403` `AGE_REQUIRED` on chat and `POST /avatars` until `PATCH /users/me/age` with `{ "ageConfirmed": true }` sets `ageConfirmedAt`. Left off so current clients that never call that route keep working |
| `MODERATION_ENABLED` | `true` (default) scores chat input, model output, and companion persona text. `false` turns those checks off outside production. `NODE_ENV=production` refuses to boot when this is `false` |
| `MODERATION_PROVIDER` | `auto` (default), `openai`, `gemini`, or `local`. `auto` uses OpenAI's moderations endpoint when `OPENAI_API_KEY` is set, otherwise Gemini when `GEMINI_API_KEY` is set, otherwise local patterns |
| `MODERATION_MODEL` | Optional model override. OpenAI defaults to `omni-moderation-latest`. Gemini defaults to `GEMINI_CHAT_MODEL`, or `gemini-3.6-flash` |
| `MODERATION_FAIL_CLOSED` | `true` (default). A provider error withholds the reply instead of skipping the check |
| `OPENAI_API_KEY` | Key for the OpenAI moderations endpoint. Also used once as a fallback when Gemini moderation is rate-limited, returns 503, or times out |
| `CRISIS_HELPLINE_IN_NAME`, `CRISIS_HELPLINE_IN_CONTACT`, `CRISIS_HELPLINE_IN_DETAIL` | India crisis line. Defaults to Tele-MANAS, `14416`, 24/7 |
| `CRISIS_HELPLINE_INTL_NAME`, `CRISIS_HELPLINE_INTL_CONTACT`, `CRISIS_HELPLINE_INTL_DETAIL` | International pointer. Defaults to the IASP suicidal-thoughts page |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Android Publisher API access for verifying purchases. Raw JSON or base64 |
| `GOOGLE_PLAY_PACKAGE_NAME` | Android application id the subscriptions belong to |
| `GOOGLE_PLAY_PRODUCTS` | Product to plan map, e.g. `premium_monthly:PREMIUM,plus_monthly:PREMIUM_PLUS` |
| `CORS_ORIGIN`, `PORT` | HTTP server |
| `STORAGE_DRIVER` | `local` (default) or `s3` |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | Lifetime of a download URL. Default 3600, range 60–86400 |
| `STORAGE_LOCAL_DIR`, `STORAGE_SIGNING_SECRET` | Local driver. The signing secret falls back to `JWT_ACCESS_SECRET` |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | S3-compatible driver. Required together when `STORAGE_DRIVER=s3` |
| `TRUST_PROXY_HOPS` | Trusted proxy hops for client IP. Default `1` (Render). `0` uses the socket address |
| `FREE_TIER_LLM_PERIOD` | `day` (default) or `month`. Free-tier chat cap window, UTC |
| `FREE_TIER_LLM_MESSAGE_LIMIT` | Successful free-tier replies per window. Default `40`. `unlimited` removes it. `0` blocks new replies |
| `FREE_TIER_LLM_TOKEN_LIMIT` | Estimated tokens (user text + reply) per window. Default `50000` |
| `RATE_LIMIT_LOGIN_IP_MAX`, `RATE_LIMIT_LOGIN_IP_WINDOW_SEC` | Login attempts per IP. Default 20 / 15 minutes |
| `RATE_LIMIT_LOGIN_USER_MAX`, `RATE_LIMIT_LOGIN_USER_WINDOW_SEC` | Login attempts per email. Default 10 / 15 minutes |
| `RATE_LIMIT_REGISTER_IP_MAX`, `RATE_LIMIT_REGISTER_IP_WINDOW_SEC` | Registrations per IP. Default 10 / hour |
| `RATE_LIMIT_REGISTER_USER_MAX`, `RATE_LIMIT_REGISTER_USER_WINDOW_SEC` | Registrations per email. Default 5 / hour |
| `RATE_LIMIT_PASSWORD_RESET_IP_MAX`, `RATE_LIMIT_PASSWORD_RESET_IP_WINDOW_SEC` | Forgot/reset/check per IP. Default 10 / hour |
| `RATE_LIMIT_PASSWORD_RESET_USER_MAX`, `RATE_LIMIT_PASSWORD_RESET_USER_WINDOW_SEC` | Same routes per email or reset token. Default 5 / hour |
| `RATE_LIMIT_MESSAGES_IP_MAX`, `RATE_LIMIT_MESSAGES_IP_WINDOW_SEC` | Message send, stream, and regenerate per IP. Default 60 / minute |
| `RATE_LIMIT_MESSAGES_USER_MAX`, `RATE_LIMIT_MESSAGES_USER_WINDOW_SEC` | Those routes per account. Default 30 / minute |

Copy `.env.example` to `.env`. The Render service in `render.yaml` sets `STORAGE_DRIVER=s3` and reads the S3 settings from a private Supabase Storage bucket (`https://<project-ref>.storage.supabase.co/storage/v1/s3`). The same variables point at MinIO or Backblaze B2. Leave `S3_FORCE_PATH_STYLE=true` for those, and set it to `false` for AWS S3.

The bucket stays private. The database stores a stable `/uploads/...` key. JSON responses replace `audioUrl`, `imageUrl`, and `avatarUrl` with a short-lived signed URL. The local driver checks that signature before reading the file; the S3 driver returns a presigned GET. Avatar and generated-image uploads are stored only when the bytes are a real JPEG, PNG, or WebP. Deleting an account removes that user's objects before the user row. A delete that fails is written to `storageCleanup` and retried, because the Android client treats a later 404 from `DELETE /users/me` as success. After the user row is gone, a stored Firebase uid (or, for an older Google link, one lookup by email) is passed to Firebase Admin `deleteUser`. `auth/user-not-found` counts as success. Any other Auth failure is written to `authCleanup` and retried, and the HTTP deletion still succeeds. Password accounts skip that call.

A rate-limit max of `0` turns that dimension off. Invalid numbers keep the default.

`node dist/main` validates the environment before it listens. Production refuses to boot when a required secret is missing, when `MODERATION_ENABLED=false`, when `MODERATION_PROVIDER=local`, or when `STORAGE_DRIVER` is not `s3`.

Run the API as a single instance. The lock that stops a second assistant reply from generating for the same conversation is in-process, so another instance would not see it. The Render web service is one instance for that reason.

### Secret manager

Put these in the Render dashboard (Blueprint `sync: false` on the service). They are not in git. `sync: false` inside an env group does not prompt, so the secrets stay on the service and the non-secret defaults stay in the `ai-girlfriend-api-config` group.

| Secret | Required in production |
| --- | --- |
| `DATABASE_URL` | Yes. Supabase session pooler, port 5432 |
| `DIRECT_URL` | Yes. Same pooler, used by migrations |
| `JWT_ACCESS_SECRET` | Yes. At least 32 characters |
| `JWT_REFRESH_SECRET` | Yes. At least 32 characters |
| `GEMINI_API_KEY` | Yes. Chat, embeddings, images, and moderation unless OpenAI is set |
| `SMTP_URL` | Yes. Includes the mailbox password |
| `S3_ACCESS_KEY_ID` | Yes. Supabase Storage → S3 |
| `S3_SECRET_ACCESS_KEY` | Yes. Private bucket |
| `JWT_RESET_SECRET` | No. Falls back to a value derived from `JWT_ACCESS_SECRET` |
| `OPENAI_API_KEY` | No. Moderation when that provider is selected, and a one-shot fallback when Gemini moderation is unavailable |
| `STORAGE_SIGNING_SECRET` | No. Local downloads fall back to `JWT_ACCESS_SECRET` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | No. Push and Firebase Auth user deletion stay off until it is set. Production still boots, and logs an error, when `FIREBASE_PROJECT_ID` is set without a valid JSON key |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | No. Play billing stays off until it is set |

These are not credentials, but they differ per deploy, so they are `sync: false` as well: `CORS_ORIGIN`, `APP_URL`, `MAIL_FROM`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`.

Storage variables (`STORAGE_DRIVER`, `STORAGE_SIGNED_URL_TTL_SECONDS`, `STORAGE_LOCAL_DIR`, `S3_FORCE_PATH_STYLE`) are not secrets. Production sets `STORAGE_DRIVER=s3`. Account deletion retries `storageCleanup`, then `deleteAccountStorageFirst` calls `StorageService.removeUserFiles` and records any failures before `deleteAccountRecords` removes the user row. `FirebaseAuthDeletion` then calls `deleteUser` and records failures on `authCleanup`. The HTTP deletion still succeeds. `data.firebaseUserDeleted` is `true` only when each `deleteUser` for that account succeeded or returned `auth/user-not-found`, and `false` when there is no Firebase uid, Admin is not configured, or any other Auth call fails. A failure to queue that retry does not fail the request, because the user row is already gone.

### Google Play subscriptions

A plan changes only after `POST /api/v1/subscriptions/google-play` fetches the purchase from Google,
finds this user's obfuscated account id on it (from `GET /subscriptions/google-play`), and sees an
active, unexpired line item for the product. The server then acknowledges the purchase. Real-time
developer notifications are not wired yet, so renewals and cancellations reach the server when the app
re-sends owned purchases on the Plan screen; a lapsed `expiresAt` drops the user back to Free.

### Routes added for the clients

All under `/api/v1`, wrapped as `{ data }`.

`AGE_GATE_ENFORCED` defaults to `false`, and the age guard is then a no-op. Set it to `true` to close chat until `ageConfirmedAt` is set. While it is on, every conversation route, `POST /conversations/:id/messages`, `POST /conversations/:id/messages/stream`, `POST /conversations/:conversationId/messages/:userMessageId/reply/stream`, `POST /messages/:id/regenerate`, and `POST /avatars` return `403` with `code: "AGE_REQUIRED"`. Auth, `GET` and `PATCH /users/me`, `PATCH /users/me/age`, export, deletion, and the public pages stay open either way.

Age is an 18+ attestation. The server never receives or stores a date of birth. `PATCH /users/me/age` takes `{ "ageConfirmed": true }`, sets `ageConfirmedAt` to the server time, keeps that first timestamp on a later call, and returns `{ ageConfirmedAt }`. `false`, a missing field, or any other body is `400`. `dateOfBirth` is not a field: with `forbidNonWhitelisted`, sending it (or `ageConfirmedAt`) is `400`, and the date itself is not logged. `POST /auth/register` and `POST /auth/google` accept optional `ageConfirmed: true` and set `ageConfirmedAt` the same way; omitting it leaves the timestamp unset, and `false` is `400`. `GET /users/me` and the `user` object on register, login, refresh, and Google/Firebase session responses include `ageConfirmedAt` as an ISO string, or `null` when it has not been set.

`DELETE /users/me` returns `data.firebaseUserDeleted`: `true` when Firebase Admin `deleteUser` succeeded or returned `auth/user-not-found`, and `false` when the account has no Firebase uid, Admin is not configured, or the Auth call failed. The account row is still removed in every successful response. The Admin client reuses `FIREBASE_SERVICE_ACCOUNT_JSON` (already used for push). There is no new secret. Production with `FIREBASE_PROJECT_ID` logs if that JSON is missing or invalid and still boots.

Path ids are positive 32-bit integers (`1` through `2147483647`). Anything else, including `abc` and integers that overflow Postgres `integer`, is `400`. Auth runs before that check, so a missing token is still `401`. JSON and urlencoded bodies larger than 64kb are `413` in the JSON error envelope. Unknown routes use that same envelope with `404`, not an HTML page. `POST /account-deletion` with an empty form is `400` HTML that redisplays the form and the error.

| Route | Purpose |
| --- | --- |
| `POST /auth/google` | Exchange a Google or Firebase ID token for a session |
| `POST /auth/password/forgot` | Always `200` with the same body; mails a 30-minute reset link when the account exists |
| `POST /auth/password/reset/check` | `{ valid }` for a token without using it, so link scanners cannot spend it |
| `POST /auth/password/reset` | Set a new password; ends every session |
| `POST /auth/email` | Change the sign-in email (requires the current password) |
| `GET /users/me/export` | Everything stored for the account as JSON |
| `PATCH /users/me` | Also takes `memoryPaused` and `notificationsEnabled` |
| `POST /memories` | Add a memory by hand |
| `POST /messages/:id/regenerate` | Replace her newest reply |
| `POST /reports` | Flag an assistant reply. `201` with `{ id }` the first time, `200` with the same id if this person already reported that message. Ten reports per minute per user |
| `POST /images`, `GET /images`, `GET /images/:id`, `DELETE /images/:id` | Generated photo gallery |
| `GET /notifications/status`, `POST /notifications/devices`, `DELETE /notifications/devices/:token`, `POST /notifications/test` | Push devices |
| `GET /subscriptions/google-play`, `POST /subscriptions/google-play` | Play Billing config and purchase verification |

Play Store pages are outside `/api/v1`: `GET /privacy` and `GET /account-deletion`. The deletion form `POST`s to `/account-deletion` (5 requests per hour per client IP, kept in a capped in-memory map). The request is stored in Postgres (`deletionRequest`) and pruned after 30 days. A confirmation link is emailed to the account address; opening `GET /account-deletion/confirm` marks it confirmed. If that mail cannot be sent, the page says the developer verifies the request from the account's email address. Signed-in deletion in the app is `DELETE /api/v1/users/me`, which also deletes web deletion requests stored for that account email. Message reports belong to the user and are removed with that row (`ON DELETE CASCADE`).

`TRUST_PROXY_HOPS` is how many reverse-proxy hops to trust when reading that client IP. The default is 1. Set it to 0 to use the socket address.

Login, register, and the password-reset routes are rate limited in process memory (per IP and per email or reset token) and answer `429` with `Retry-After`. The free-tier chat cap is stored in Postgres, so it survives a Render restart. Redis is not used: the Render service does not provision it. The cap is checked before the model call and recorded only after a successful reply, so concurrent requests can finish slightly over the limit. That overshoot is accepted for the MVP; the following request is refused.

### Content safety

Chat input is scored before the model call, and the model reply is scored before it is saved. Streamed replies are scored in sentence-sized windows, so a safe sentence can arrive before a later window is replaced. The unsafe span is not written to the message row and is not sent as a stream delta.

Flirting, affection, and romance are allowed. Explicit sexual content (graphic acts, sexual body descriptions, and explicit roleplay) is blocked on input and output. That refusal is soft and in character (`code: "explicit_content"`). Sexual content involving minors stays a firm refusal. Both sides of that line live in `CONTENT_POLICY` in `src/moderation/safety-policy.ts`.

A flagged user message stays in the thread the person can read. It is marked with `metadata.safety` and left out of later model prompts. A refusal, crisis reply, or moderation-unavailable reply is returned on that response (and on a stream `done` event) so the client can show it once. It is not stored. `GET` messages omits those assistant rows, including any older assistant rows that already carry `metadata.safety`. They are also left out of the model prompt and out of memory extraction. A mixed stream stores only the safe prefix. Message usage is recorded only after a normal reply. A refusal, crisis reply, or moderation-unavailable turn is not charged.

Allowed turns are otherwise unchanged. A refusal or crisis turn adds `safety` on the response body (`POST /conversations/:id/messages`, `POST /messages/:id/regenerate`, voice respond, and the stream `done` event). Voice safety replies omit audio. The assistant `content` on that response is the notice text:

```json
{
  "action": "crisis",
  "code": "self_harm",
  "message": "I'm really glad you told me...",
  "helplines": [
    { "name": "Tele-MANAS", "contact": "14416", "region": "IN", "detail": "24/7 mental health support in India" }
  ]
}
```

`action` is `refuse` or `crisis`. `code` is `content_policy`, `explicit_content`, `self_harm`, or `moderation_unavailable`. The assistant `content` is the same `message`, so a client that only renders the bubble still shows it. Logs record the surface, action, code, categories, and ids — not the text. Text longer than a provider's limit is scored in overlapping chunks. A limit that cannot be applied is treated as a block. Providers do not silently truncate.

Each provider call is one attempt with a 4 second timeout. When the primary moderator returns 429 or 503, or times out, and `OPENAI_API_KEY` is set and the primary is not already OpenAI, one OpenAI moderations call runs before anything else. A 429 is logged as `provider quota exhausted`. Other outages are logged as `safety degraded` with the provider name and `reason` (`503`, `timeout`, or `unavailable`). The user text is not logged.

Creating or updating a companion rejects an unsafe persona with HTTP 400 and `code: "UNSAFE_PERSONA"`. The message depends on the category: minors and sexual content involving minors, graphic sexual content, or other blocked content. It does not mention minors unless the persona is under 18 or sexual content involving minors. An appearance age under 18 is rejected locally. If the provider is down, the local check still blocks those cases and allows a benign persona such as the name Mira. A provider failure is never `UNSAFE_PERSONA`. If that local check itself cannot run, the request is `503` with `code: "MODERATION_TEMPORARILY_UNAVAILABLE"` and `retryAfterSeconds`. Chat input and output stay fail-closed: the same outage returns the moderation-unavailable notice, which is shown and not stored.

When chat generation itself gets a Gemini 429, the API returns `503` with `code: "GENERATION_TEMPORARILY_UNAVAILABLE"` and `retryAfterSeconds` (30). A stream that has already flushed headers sends one SSE `error` event with that code instead. Nothing is stored and usage is not charged. The user line may already be saved, so a retry can generate again. Other generation errors stay `500`. The companion system prompt also ends with safety rules that the persona cannot override.

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
