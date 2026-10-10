# Web Design Task 2 — Authentication

Six surfaces: the landing page, Log in, Sign up, Forgot password, Reset password, and the middleware
session resolution that replaces Android's splash screen.

Built on the tokens, shells, components, and BFF architecture in
[`01-foundation.md`](./01-foundation.md) — nothing here restates them. The Android equivalent is
[`docs/design/02-authentication.md`](../design/02-authentication.md); its settled decisions carry
forward unless a web-specific reason is given, and where one exists it is named. Endpoint behaviour
is quoted from `apps/api/src`, not from [`docs/PRD.md`](../PRD.md).

Visual reference: `canvases/web-auth-screens.canvas.tsx`.

---

## 1. Backend status

`apps/api` now serves the reset flow: `POST /auth/password/forgot` (always `200` with the same body,
mails a single-use 30-minute link when the account exists), `POST /auth/password/reset/check`
(reports whether a token is valid without using it), and `POST /auth/password/reset`. A token carries
a fingerprint of the password hash, so it stops working once the password changes, including by that
reset, and the reset ends every session. Mail goes through `SMTP_URL`; without it the message is
written to the API log, which is for development only. The "Forgot password?" link on Login is always
shown.

Still open on the backend: SPF, DKIM, and DMARC on the sending domain, and rate limiting on
`password/forgot` and `password/reset`, since `main.ts` registers no throttler.

**The web reset link changes the token-handling story.** On Android the link is
`aicompanion://reset-password?token=…`, delivered to a process nothing else can read. On web it is
`https://<host>/reset-password?token=…`, so the token now lands in browser history, in the
back-forward cache, in the `Referer` header of any outbound request the page makes, and — the
consequential one — in the fetch logs of every link scanner between sender and inbox. Outlook Safe
Links, corporate mail gateways, and chat unfurlers all GET a URL before a human clicks it. **So the
token must be validated on `GET` and burned only on `POST`.** If the backend invalidates on first
read, a large share of users will click a link a machine already spent. The reset page calls
`password/reset/check` on load and spends the token only on submit. §3.5 covers the client half.

`POST /auth/google` exchanges a Google ID token (checked against `GOOGLE_CLIENT_IDS`) or a Firebase ID
token (checked against `FIREBASE_PROJECT_ID`) for a session. Login and Sign up keep the vertical space
reserved for a provider row above the email field, so a web Google button fills that gap.

---

## 2. The BFF auth surface

The browser never talks to Nest and never holds a token (foundation §7.2). Every screen below posts
to a Next route handler, which is the only thing that sees `accessToken` or `refreshToken`.

| BFF route | Browser sends | Upstream | Browser receives |
|---|---|---|---|
| `POST /api/bff/auth/login` | `{ email, password }` | `POST {API}/api/v1/auth/login` | `{ user }` + `Set-Cookie` |
| `POST /api/bff/auth/register` | `{ email, password, displayName }` | `POST {API}/api/v1/auth/register` | `{ user }` + `Set-Cookie` |
| `POST /api/bff/auth/refresh` | *(nothing — reads `ag_rt`)* | `POST {API}/api/v1/auth/refresh` | `{ ok: true }` + rotated cookies |
| `POST /api/bff/auth/logout` | *(nothing — reads `ag_at`)* | `POST {API}/api/v1/auth/logout` | `{ ok: true }` + cleared cookies |
| `GET /api/bff/users/me` | *(nothing)* | `GET {API}/api/v1/users/me` | the user object |

Three facts about the wire format, none recorded in the foundation, each of which breaks the client
if guessed.

**Every successful response is wrapped in an envelope.** `ResponseInterceptor`
(`common/interceptors/response.interceptor.ts:20-33`) maps every 2xx body into
`{ success, statusCode, message: 'Request successful', data, timestamp, path }`. Tokens are therefore
at `data.accessToken` — foundation §7.1 shows `createAuthResponse`'s return value, which is the
interceptor's *input*. The BFF unwraps `.data` once, at the boundary, so nothing downstream knows the
envelope exists.

**An unexpected property is a 400, not an ignored field.** `main.ts:62-69` configures
`ValidationPipe` with `whitelist: true` **and** `forbidNonWhitelisted: true`, so `acceptTerms` and
`confirmPassword` — client-only, in no DTO — must never leave the BFF. Handlers pick fields
explicitly rather than spreading the parsed body; a spread is how "property acceptTerms should not
exist" becomes a signup that 400s for every user.

**`POST /auth/refresh` is unguarded by accident, not by decoration.** `register` and `login` carry
`@Public()` (`auth.controller.ts:25`, `:33`); `refresh` does not (`:57`), and neither does
`GET /auth/me` (`:50`). There is no `APP_GUARD` in `app.module.ts`, so `@Public()` is inert and the
undecorated routes are open regardless. The day a global guard is registered — the correct fix for
the unguarded voice, usage, and subscription endpoints in foundation §8 — `refresh` will demand the
very access token the caller is trying to replace, and every session in the field breaks at once.
**`@Public()` goes on `refresh` before the global guard goes on the app.**

All five routes set `Cache-Control: no-store` (§4.6) and require an `Origin` matching the app's own.

---

## 3. Screen specifications

### 3.1 Landing — `/`

**Purpose.** Answer "what is this" before asking for an email, and convert. The only surface with no
Android equivalent and the only one whose audience has never heard of us.

**The positioning is settled, and it is memory rather than romance.** Headline
*"Someone who remembers."*; body *"Create a companion with her own personality — and a memory that
grows with every conversation."* Carried unchanged from the Android Welcome screen for the reason
recorded there: memory is the actual technical differentiator and the one claim competitors mostly
cannot make. Romance-forward copy would put the product in a category where it competes on imagery,
against incumbents who have more of it.

**Layout.** The public shell's wide variant — a centred column at `max-width: 72rem`, gutters 20 / 32
/ 40px (foundation §4.1). The hero is the only full-bleed section. Five sections:

1. **Hero.** `display-hero` in Fraunces, the fluid size and the reason it exists (foundation §3.2).
   One portrait, warm low light, off-camera gaze — a direct gaze reads as a dating-app profile. One
   primary `Button` "Create your companion", one `link` "Log in". Above the fold at 1440×900 and
   390×844.
2. **How it works.** Three numbered steps — create her, talk, she remembers — stacked at base, three
   columns at `md`. Numbers rather than decorative icons; three icons here would be the first of the
   twelve-icon feature grid this page is deliberately not.
3. **Memory and trust.** The largest section, because trust is the objection. Two halves: what she
   remembers, as a real memory card on `--tertiary-container` matching the surface in
   [`05`](./05-companion-memory-account.md); and what you control — view, edit, delete any memory,
   which the API genuinely supports (`PATCH`/`DELETE /memories/*`, foundation §8). Showing the
   control beats promising it.
4. **Plan teaser.** Free and Premium side by side, four lines each, linking to `/signup` and not to a
   checkout, because there is none — `GET /subscriptions/{current,latest}` is read-only. A pricing
   page ending in a dead payment button is a worse first impression than no pricing.
5. **Footer.** Wordmark, Terms, Privacy, contact, explicit 18+ statement.

**What it leaves out.** No testimonials: we have no users, and fabricated ones are the fastest way to
lose a visitor on a product whose whole pitch is trust. No FAQ accordion — the three real objections
are memory, privacy, and price, and each has a section. No newsletter capture, because a second
capture competing with signup halves both. No autoplaying video of a companion talking, which is the
worst thing to put on a page someone might open at work. And **no "try her now" demo**: there is no
unauthenticated inference endpoint, and building one hands an unmetered LLM to the internet.

**Components.** `Button` (primary, link), `Card`, `Callout`, `Badge`, `CompanionAvatar`, `Separator`.

**Rendering.** Fully static — one of three static pages in the product (foundation §6), which holds
only if the header reads no cookie. So it does not: the header ships "Log in" in the prerendered HTML
and swaps to "Open Lumen" after hydration if a **non-`HttpOnly` `ag_hint=1` cookie** is present, set
alongside the session cookies at login. The hint carries a boolean, never a credential, so it does
not reintroduce the problem foundation §7.2 exists to solve. The alternative — making `/` dynamic to
personalise server-side — spends the CDN cache and the < 2.0s LCP budget on one nav label. Both
labels reserve the same width so the swap does not shift layout.

**An authenticated visitor at `/` sees the landing page, not a redirect.** Foundation §7.4 redirects a
valid session away from `/login` and `/signup`; `/` is deliberately not in that set, because people
navigate to the root on purpose to re-read the privacy story or the plans.

**States.** Rest; hero image loading (`--surface-container-high` block, never a spinner); hero image
failed (text on `--primary-container`, no broken frame); authenticated (label swapped); offline
(served from cache, no banner — a marketing page has nothing to degrade); **JS disabled, fully
readable**, which is a hard requirement here and the only place in this document where it is
achievable (§4.5).

Foundation §12 lists whether this page ships in the first milestone as open, and it genuinely is. The
design above assumes real imagery exists; if it does not, `/` should 307 to `/login` and this section
waits. A weak landing page is worse than none.

---

### 3.2 Log in — `/login`

**Purpose.** Authenticate an existing user in as few keystrokes as possible, and be somewhere a
middleware redirect can land without feeling like a punishment.

**Layout.** Public shell, `max-width: 26rem`, vertically centred at `md`+ and **top-aligned with a
32px offset below `md`**, because a centred form plus a virtual keyboard puts the fields underneath
it. Wordmark, `headline-md` "Welcome back" with a one-line subtitle, email, password with visibility
toggle, right-aligned "Forgot password?" (flag-gated, §1), primary `Button` "Log in", centred footer
"New here? Create an account".

**The auth headline is Jakarta `headline-md`, not Fraunces.** The foundation contradicts itself:
§3.1 lists the five permitted Fraunces instances and the auth headline is not among them, while the
`display-lg` row in §3.2 names it. §3.1 binds — the serif is scarce on purpose — so the only Fraunces
here is the wordmark, matching Android's `headlineMedium`.

**Components.** `TextField`, `PasswordField`, `Button` (primary, link), `Banner`.

**A 401 is a banner, not a field error.** `auth.service.ts:73-88` returns the identical
`Invalid email or password` for an unknown address and a wrong password, which is correct —
distinguishing them hands an attacker an enumeration oracle. The client therefore cannot know which
field is wrong, and colouring either one red would be a lie. The banner reads *"Email or password is
incorrect."* The password clears; the email is kept.

```ts
// POST /api/bff/auth/login   { "email": "vipin@example.com", "password": "…" }
// 200 — the only thing the browser gets
{ "user": { "id": "1", "email": "vipin@example.com", "displayName": "Vipin" } }
// Set-Cookie: ag_at=…; HttpOnly; Secure; SameSite=Lax;    Path=/
// Set-Cookie: ag_rt=…; HttpOnly; Secure; SameSite=Strict; Path=/api/bff/auth
// Set-Cookie: ag_hint=1;          Secure; SameSite=Lax;    Path=/
```

**Web interaction detail.** A real `<form>` with a real `<button type="submit">`, so Enter submits
from any field and so password managers recognise the form at all — a `<div>` with an `onClick` is
why Enter does nothing in half the login forms on the web. `autocomplete="email"` and
`autocomplete="current-password"`: these two values are the entire mechanism by which a manager
decides whether to fill or to offer to save, and omitting them is the most common reason a product
never triggers the save prompt. Email carries `type="email" inputMode="email" autoCapitalize="off"
autoCorrect="off" spellCheck={false}` — an autocapitalised first letter is a login failure the user
cannot see. Inputs are ≥16px at base width or iOS Safari zooms on focus and does not zoom back.

Tab order is DOM order and DOM order is visual order: email, password, show/hide toggle, "Forgot
password?", "Log in", "Create an account". The toggle sits after the field it acts on.

**Focus on failure goes to a field, never to the banner.** A validation error focuses the first
invalid field; a 401 focuses the password. Focusing a non-interactive banner needs `tabindex="-1"`,
leaves the user one Tab from the top of the page, and puts them somewhere other than the field they
are about to retype. The banner is `role="alert" aria-live="assertive"` so it is announced without
taking focus (§8).

| State | Treatment |
|---|---|
| Rest | Empty fields, submit enabled |
| Validating | Errors on blur once touched; reserved helper height, so no layout shift |
| Submitting | Fields `readOnly`, button spinner at preserved width, `aria-busy` |
| Credentials rejected (401) | Banner above the form, password cleared, focus to password |
| Arrived from signup 409 | Email prefilled from `?email=`, focus on password |
| Server fault (5xx) | Banner with Retry, input preserved |
| Offline | Persistent `Banner` (`role="status"`), submit disabled, retry on `online` |
| Timeout (20s) | Banner "That took too long." with Retry |
| Success | `router.replace(safeNext(next))`; no toast — arriving is the confirmation |

**`router.replace`, never `push`**, so Back from `/home` does not return to the login form. That is
the web equivalent of Android popping the auth graph.

**Success does not check for a companion here.** The `(app)` layout already loads her for the sidebar
and redirects to `/onboarding` when there is none (foundation §7.4); having the login handler call
`GET /avatars` would add a request to every login to save one redirect on the first. The button's
loading state must persist until the new route *commits*, not until the fetch resolves (§4.1).

**No "keep me signed in".** Refresh tokens last 30 days and rotate on use, so sessions already
persist; the only thing the checkbox could mean on web is session-cookie-versus-persistent-cookie, a
distinction no user models correctly. A control implying a choice that does not exist is worse than
no control.

---

### 3.3 Sign up — `/signup`

**Purpose.** Create an account with the three fields `RegisterDto` requires and nothing else.

**Layout.** Public shell, `26rem`, same centring rules as Login. `headline-md` "Create your account".
Name (label "Your name", helper "This is what she'll call you."), email, password with strength meter
and a one-line requirement note. Terms `Checkbox`, unchecked. Primary `Button` "Create account".
Footer "Already have an account? Log in".

**Components.** `TextField`, `PasswordField` (strength variant), `Checkbox`, `Button`, `Banner`.

**No confirm-password field.** The visibility toggle solves the typo problem confirm fields exist
for, at half the friction, and `RegisterDto` has no `confirmPassword` — sending one would 400 (§2).
Reset password does keep its confirm field; §3.5 explains why the asymmetry is right.

**Password rules mirror the DTO exactly.** `register.dto.ts:14-17` is `@MinLength(8) @MaxLength(128)`
and the client enforces precisely that. The strength meter is advisory and never blocks submission;
inventing a symbol-and-digit rule the server does not share guarantees the two disagree the first
time either changes. **The meter does not ship `zxcvbn`** — 400KB of dictionary for an advisory bar is
a bad trade on the page with the tightest first-load budget, and length plus character-class count is
enough for a hint that gates nothing. Bundle size is a constraint Android did not have.

**Terms must be actively checked.** Pre-checking a consent box is not consent and in several
jurisdictions is not lawful. `acceptTerms` is validated client-side and stripped before the request.

```ts
// POST /api/bff/auth/register
{ "email": "vipin@example.com", "password": "…", "displayName": "Vipin" }
// 200 — identical envelope and cookies to login
{ "user": { "id": "1", "email": "vipin@example.com", "displayName": "Vipin" } }
```

**Autocomplete: `name`, `email`, `new-password`.** `new-password` is what prompts a manager to
generate and save rather than search for an existing credential, and the email field must live in the
same `<form>` as the password or there is nothing to associate the entry with. There is deliberately
**no `maxLength` on the password input** despite the DTO's 128 cap: `maxLength` silently truncates a
pasted 130-character generated password, and the user then stores a credential that will never match.
An error beats silent corruption. `displayName` does get `maxLength={100}`.

**A 500 here may mean the account was created.** This is the concrete shape of the
`Session.refreshToken: ''` race in foundation §7.3, and it is worse than recorded there. `register()`
creates the `User` row (`auth.service.ts:51-56`) and *then* calls `createAuthResponse`, which inserts
a `Session` with `refreshToken: ''` (`:234-238`) into a `@unique` column. When two signups collide,
the second 500s **after** its user row is committed. The user retries, hits the `existingUser` check
at `:45`, and is told *"Email is already registered"* — concluding someone has stolen their address.

The response is two-part. The banner after a 500 on signup offers **both** Retry and "Try logging in
instead", never Retry alone. And the BFF's register handler, on a 5xx from upstream, attempts
`POST /auth/login` once with credentials it already holds; if that succeeds the signup succeeded from
the user's point of view, and the login path writes a clean session row. A workaround with a deletion
date: it goes when the backend generates the token before the insert.

**States.** Rest; per-field validation; terms unchecked (error under the checkbox, on submit only);
submitting; **email taken (409)** — field error on email plus "Log in instead" carrying the address to
`/login?email=…`; 500 as above; offline; timeout; success → `router.replace('/onboarding')` directly,
because a new account has no companion by definition and routing via `/home` would make the user
experience a redirect for no reason.

Prefilling from `?email=` is safe — it is the user's own address — but it is parsed with the same zod
schema before being written into the input and dropped if it fails; junk sitting in a field looks like
a bug in our form. The 409 does reveal that an address is registered, which is the standard trade
since a signup form that hides it becomes unusable, but it is worth stating rather than discovering.

**This is the screen that breaks first at 200% zoom** (§8).

---

### 3.4 Forgot password — `/forgot-password` · blocked, see §1

**Purpose.** Trigger a reset email. One field, one button, one terminal success state.

**Layout.** Public shell, `26rem`. `headline-md` "Reset your password" with a short explanatory
paragraph, email field, primary `Button` "Send reset link", `link` "Back to log in". Components:
`TextField`, `Button`, `Banner`, `EmptyState` for the sent state. Proposed shape, not existing:
`POST /api/bff/auth/forgot-password` with `{ email }`, answering `202 { ok: true }`.

**The success state must not reveal whether the account exists.** The copy is identical either way:
*"If an account exists for that address, we've sent a link to reset your password. It expires in 30
minutes."* Any variation turns this page into a free enumeration endpoint, which constrains the
backend as much as the client — 202 in both cases, in the same amount of time (§1).

**The resend cooldown is computed from a timestamp, not counted by an interval.** A 60-second
`setInterval` resets when the tab is backgrounded and throttled, or when the component remounts, so
the user gets a second link — or a cooldown that looks expired when the server disagrees. Store the
send time and derive the remainder on each tick. And be clear what the cooldown is: a courtesy that
survives exactly as long as it takes to open devtools. The real control is server-side rate limiting.

**States.** Rest; invalid email; submitting; **sent** — a terminal state with a mail icon, the address
echoed back, and a resend button on the cooldown; offline; server fault. Success stays on the terminal
state rather than auto-routing, because the user's next action is in their email client.

---

### 3.5 Reset password — `/reset-password` · blocked, see §1

**Purpose.** Set a new password from an emailed link. **Entry** is
`https://<host>/reset-password?token=…`, and being a URL rather than a deep link has four
consequences, all of them client work.

**The token is validated on the server, in the route, before the form exists.** A dynamic server
component reads `searchParams`, calls the verify endpoint, and passes
`tokenState: "valid" | "invalid"` as a prop. Android validates "on screen entry"; the web equivalent
cannot be a client effect, because that renders a form and then snatches it away. Doing it in the
server component also keeps the invalid-token branch out of the client bundle. While the flag is off,
this is hard-coded `"invalid"`.

**The token comes out of the address bar on mount.** `history.replaceState` to `/reset-password`
immediately after reading it, holding the value in memory for the submit. The email still has it, so
this is mitigation rather than a fix, but it stops a single-use credential being one Ctrl+H away on a
shared machine. **This route also sets `Referrer-Policy: no-referrer`** — any outbound request can
otherwise carry the full URL, token included. It is the one page in the product that needs the header.
And **the `GET` must not burn the token** (§1); scanners fetch before humans click.

**Layout.** Public shell, `26rem`. `headline-md` "Choose a new password" with a subtitle, new password
field, confirm field, a static requirement line, primary `Button` "Reset password". Both password
fields carry `autocomplete="new-password"`.

**Here the confirm field earns its place**, unlike on Signup. The user is replacing something they
cannot see, will not use again until the next login, and a typo locks them out of the account they are
in the middle of recovering. That asymmetry, not consistency, is what decides whether a confirm field
exists. `confirmPassword` is client-only and stripped before the request (§2).

**States.** Invalid or expired token (a dedicated state with a clock icon and a "Request a new link"
CTA — never a form); rest; mismatch; too short; submitting; success; server fault; offline. On
success, `router.replace('/login')` with a one-time toast: "Password updated. Log in with your new
password." Do **not** auto-login — the endpoint returns no tokens, and inventing a session means a
second silent request that can fail after we have claimed success.

**Two backend requirements, the second web-specific.** Resetting must delete every `Session` row for
the user; `Session` is the source of truth for refresh tokens (`auth.service.ts:107-121`), so this is
a delete-by-`userId` and it is the entire point of a reset if the account was compromised. But killing
sessions does not kill access tokens, and on web the stale token sits in another browser's cookie jar.
`generateTokensForSession` defaults `JWT_ACCESS_EXPIRES_IN` to `'30d'` (`auth.service.ts:253`), so **a
password reset currently fails to lock out a compromised session for up to thirty days.** The
foundation recommends setting that variable explicitly for tidiness; this makes it a security
requirement. Set it to `15m`.

---

## 4. Session resolution, and the things Android never had to consider

### 4.1 There is no splash screen

Android's Splash exists because the process is already in the foreground and something must occupy
the frame while the token store is read. On web there is no frame to occupy. `middleware.ts` runs
before any HTML is generated, verifies the `ag_at` signature with `jose`, and returns a 307
(foundation §7.4). **The user sees nothing** — no interstitial, no spinner, no flash of the wrong
screen. The address bar changes from `/chat/123` to `/login?next=/chat/123` and the first paint is
already the login page. Screen 32 in the foundation's inventory is a redirect, not a screen, and
Android's 600ms spinner threshold has no analogue and needs no replacement.

What it does have is a failure mode Android does not: if middleware is slow — a serverless cold start
— the user sees a blank tab with the browser's own loading indicator. That is unbrandable, and it is
why middleware makes no network calls and the companion check lives in the `(app)` layout.

**One transition does paint and therefore needs designing.** Returning from `/login?next=/chat/123` to
the thread is a client navigation. Keep `isSubmitting` true across it by calling `router.replace`
inside a `startTransition` and reading `isPending`; otherwise the button returns to rest the instant
the fetch resolves and the user watches a finished-looking form for the few hundred milliseconds the
next route takes to stream in.

### 4.2 The `?next=` return path

Middleware sets it when an unauthenticated request hits an `(app)` route: `next = pathname + search`.
It is not set when someone navigates to `/login` deliberately, and it is dropped after a *failed*
login so it does not accumulate through retries.

**An unvalidated `next` is an open redirect, and login pages are where they are always found.**
Validation is a prefix allowlist, not a blocklist of dangerous shapes — a blocklist loses to the next
encoding trick, whereas an allowlist can only ever send the user to a page this app owns.

```ts
const APP_PREFIXES = ["/home", "/chat", "/memory", "/companion", "/account", "/onboarding"];

export function safeNext(raw: string | null): string {
  if (!raw) return "/home";
  // Not a same-origin path: absolute URLs, protocol-relative "//evil.com",
  // and the "/\evil.com" form browsers normalise to the same thing.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return "/home";
  const path = raw.split(/[?#]/)[0]!;
  return APP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) ? raw : "/home";
}
```

**Validate on both sides** — middleware when it writes the parameter, the login page when it reads it.
The attack is a hand-crafted `/login?next=https://…` link sent to a victim, and middleware never saw
that request at all.

### 4.3 Login and logout across tabs

Two tabs, both authenticated; the user logs out in tab A. The cookies are gone, but **tab B still
shows the sidebar, the companion, and an open conversation**, and its Query cache still holds the
messages. Nothing tells it anything until its next request 401s, refresh fails, and it bounces to
`/login` mid-sentence. The first two symptoms are annoying; the third is the reason to build the fix,
because an explicitly logged-out user's private conversation is still legible on screen — the precise
case the logout button exists for.

**Broadcast the transition.** A `BroadcastChannel("ag_auth")` carrying `{ type: "logout" }` and
`{ type: "login"; userId }`. On `logout`, every other tab calls `queryClient.clear()` and
`router.replace("/login")`. On `login` with a *different* `userId`, the same — otherwise tab B renders
the previous account's cached data under the new account's session, which is §4.6's account-crossing
bug reproduced inside one browser.

`BroadcastChannel` is unavailable on Safari before 15.4; the fallback is a `storage` event fired by
writing a timestamp to a throwaway `localStorage` key, which other tabs receive and the writer does
not. It carries a number, not a credential, so it does not reintroduce the problem the BFF exists to
solve. A `visibilitychange` revalidation is not a substitute: a background tab can sit untouched for
hours with the stale UI on screen the whole time.

### 4.4 Living with the two API bugs

**The access-token TTL inconsistency means no proactive refresh anywhere.**
`generateTokensForSession` defaults `JWT_ACCESS_EXPIRES_IN` to `'30d'` (`auth.service.ts:253`) while
`refresh()` defaults the same variable to `'15m'` (`:137`), so a token's lifetime depends on whether
it was the first one issued, and any scheduler reading `exp` behaves differently before and after the
first refresh. So refresh **reactively**: on a 401 from any BFF route, once, behind a single-flight
lock, retry the original request once, and on a second failure clear both cookies and route to
`/login`. No countdown, no "your session expires in…", no background timer.

The honest user-visible cost is that the first request after a long idle period is one round trip
slower and there is no way to hide that without knowing the TTL. The operational cost is that the
`ag_at` cookie's `Max-Age` cannot be derived from the token, so the BFF reads the same explicit
`JWT_ACCESS_EXPIRES_IN` the API does — a cookie outliving its token produces a guaranteed 401 on every
load, and one under-living it throws away a working credential.

**The `refreshToken: ''` unique-constraint race means signup can 500 under concurrency**, and §3.3
specifies the response: never a bare Retry, plus a login attempt inside the BFF handler. Neither is a
fix. Both are honest about a backend defect rather than pretending the 500 was transient.

### 4.5 Server rendering, and the fact that these forms need JavaScript

Each auth page is a server component with a client form island: shell, wordmark, headline, legal copy,
and footer links render on the server, while `<LoginForm>` and `<SignupForm>` are `"use client"`.
`/login` and `/signup` read no cookies — middleware handles the authenticated case — so they
prerender; `/reset-password` reads `searchParams` and is dynamic.

**These forms require JavaScript, and it is a choice rather than a limitation.** A Server Action could
set cookies, return field errors, and `redirect()` with no client JS, so progressive enhancement is
achievable in principle. It loses on two counts. The submit's useful output is a `user` object the
client needs to seed the Query cache plus a route decision it makes with `next`; a redirecting action
gives up rendering a 401 in place, costing a full document load per wrong password. And foundation §1
settles react-hook-form plus zod for roughly thirty other forms — running a second form architecture
for five surfaces that approximately no real user reaches with JS off is not a good trade.

So state it plainly rather than implying graceful degradation. Every auth page carries a `<noscript>`
`Banner` in the form's place saying that signing in requires JavaScript, with a link to the landing
page, which **does** work without it (§3.1). A form that renders and then silently ignores Enter is
strictly worse than a sentence explaining why. One further rule: never echo a submitted email back
into server-rendered HTML — the prefill in §3.3 happens client-side, from a validated query parameter.

### 4.6 `Cache-Control: no-store`

Every BFF response that depends on the session sets `Cache-Control: no-store`, plus `Vary: Cookie`
for intermediaries that ignore it. `GET /api/bff/users/me` is the illustration: a GET on a stable URL
whose body differs entirely by cookie. A shared corporate proxy, a CDN with a permissive default, or
a service worker that caches by URL will serve one user's `me` to the next person on the network.
**On this product that is an account-crossing bug**, and given what the data is, it is the worst class
of bug available.

`no-store` specifically, not `no-cache` and not `private`: `private` still permits the browser's own
cache to hold the response and hand it back after a logout on a shared machine, which is most of the
threat model the logout button exists for. Two related requirements — every `fetch` from a BFF handler
to Nest uses `cache: "no-store"`, because Next's fetch cache is per-deployment rather than per-user;
and if a service worker is added for offline chat, `/api/bff/*` needs an explicit deny-list entry,
since the default "cache what you can" recipe is the bug above running on the user's own disk.

---

## 5. Validation

Client rules mirror the backend DTOs exactly. Stricter is friction; looser trades a fast inline error
for a slow round trip.

| Field | Screens | Client zod rule | Backend DTO | Message |
|---|---|---|---|---|
| Email | Login, Signup, Forgot | `.trim().toLowerCase().min(1).email()` | `@IsEmail() @IsNotEmpty()` — `login.dto.ts:9-11`, `register.dto.ts:10-12` | "Enter a valid email address" |
| Password | Login | `.min(1).max(128)` | `@IsString() @IsNotEmpty() @MaxLength(128)` — `login.dto.ts:13-16` | "Enter your password" |
| Password | Signup, Reset | `.min(8).max(128)` | `@IsString() @MinLength(8) @MaxLength(128)` — `register.dto.ts:14-17` | "Use at least 8 characters" |
| Name | Signup | `.trim().min(2).max(100)` | `@IsString() @MinLength(2) @MaxLength(100)` — `register.dto.ts:19-22` | "Your name needs at least 2 characters" |
| Terms | Signup | `z.literal(true)` | client-only, stripped before send | "Please accept the Terms to continue" |
| Confirm | Reset | `.refine` equality | client-only, stripped before send | "Both entries need to match" |

**Trim and lowercase on the client, for a sharper reason than the echo.** The service normalises with
`dto.email.toLowerCase().trim()` (`auth.service.ts:37`, `:65`), so an untrimmed address comes back
altered and reads as a bug. But the ordering matters more: `ValidationPipe` runs *before* the service
and `@IsEmail()` rejects surrounding whitespace, so `"vipin@example.com "` — the shape a copy-paste
produces — returns a **400 with a message array**, not a 401 and not a successful login. A client that
does not trim converts a routine paste into an error nobody can explain. The same ordering bites
`displayName`: `@MinLength(2)` sees the untrimmed value and the service trims afterwards, so `"  a "`
passes the DTO and stores a one-character name. zod's `.trim()` and `.toLowerCase()` are transforms,
so they belong on the schema rather than in the submit handler — that way the normalised value is both
what gets validated and what gets sent.

**Timing.** `mode: "onTouched"` and `reValidateMode: "onChange"`, which is exactly the Android rule
(validate on blur once touched, then on every keystroke while an error shows) expressed as the two
react-hook-form options it was chosen for. On submit, `handleSubmit` validates everything and focuses
the first invalid field via `shouldFocusError` — note this works through the field's `ref`, so a field
that does not register its ref silently fails to receive focus.

**Submit stays enabled while the form is invalid.** Carried from Android, and the web reason is
stronger: `disabled` also removes the button from the tab order, so a keyboard user who tabs to the
end of the form finds nothing there, and the button can no longer carry an `aria-describedby`
explaining itself. Validate on click and move focus to the problem. The one exception is offline,
where a `Banner` states plainly that nothing will work until connectivity returns.

---

## 6. Error mapping

| Trigger | HTTP | Server message | UI |
|---|---|---|---|
| Wrong password or unknown email | 401 | `Invalid email or password` (`auth.service.ts:74`, `:85`) | Banner "Email or password is incorrect."; password cleared; focus to password |
| Email already registered | 409 | `Email is already registered` (`:46`) | Field error on email + "Log in instead" |
| DTO failed, or an extra field was sent | 400 | `string[]` from `ValidationPipe` | Map to a field when the string begins with a known field name, else banner with the first entry |
| Access token missing or invalid | 401 | `Authorization token is required` / `Invalid authorization header` / `Invalid or expired access token` (`jwt-auth.guard.ts:43`, `:52`, `:65`) | Never surfaced. BFF refreshes once, retries once, then clears cookies and returns 401 |
| Refresh rejected | 401 | `Invalid or expired refresh token` / `Invalid refresh token` / `Refresh token has expired` / `User not found` (`auth.service.ts:103`, `:113`, `:121`, `:133`) | Clear both cookies, `router.replace("/login")`, **show nothing** — the user did nothing wrong |
| Session insert race on signup | 500 | `Internal server error` | §3.3 — BFF retries as login; banner offers Retry *and* "Try logging in" |
| Server fault | 5xx | varies | Banner "Something went wrong on our end." + Retry |
| No connectivity | — | — | Persistent `Banner` (`role="status"`), submit disabled, retry on `online` |
| Timeout | — | — | `AbortSignal.timeout(20_000)` → banner "That took too long." + Retry |
| Rate limited | 429 | not implemented | Banner with a cooldown from `Retry-After`. Designed, currently unreachable |

One failure looks like the others and is not: `getExpiryDate` (`auth.service.ts:295-302`) throws on
any `JWT_REFRESH_EXPIRES_IN` that does not match `/^(\d+)([smhd])$/`, and it is called on the login,
register, *and* refresh paths. A value like `4w` is therefore a total auth outage presenting as a 500
for every user, not an intermittent one; the giveaway is that all three paths fail together. It wants
a startup assertion in the API, not client handling.

**The envelope carries no machine-readable code.** `HttpExceptionFilter`
(`common/filters/http-exception.filter.ts:61-68`) emits
`{ success, statusCode, message, error?, timestamp, path }` and forwards only `message` and `error`
from the exception. `error` is whatever Nest put there — `"Unauthorized"`, `"Conflict"` — the status
name, not an application code. So the client branches on HTTP status and an English sentence. For this
module that is survivable, because 401 and 409 each mean exactly one thing on these endpoints. It
stops being survivable the moment a second failure mode shares a status, which is why forwarding a
`code` is on the backend fix list. **Do not build the habit of matching on message text.**

**`message` is `string | string[]`** — typed that way at `http-exception.filter.ts:14`, with
`ValidationPipe` producing the array. A response type of `string` alone means the first validation
error crashes deserialisation, a failure that happens in production and never in development, because
in development the client and the DTO were written the same afternoon. The BFF normalises it once, so
no component handles both shapes.

```ts
export type ApiErrorBody = {
  success: false;
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path: string;
};

export type BffError = { status: number; messages: string[] };
```

---

## 7. State model

```ts
export type AuthFormError =
  | { kind: "credentials" }                      // 401 on login
  | { kind: "emailTaken"; email: string }        // 409 on register
  | { kind: "maybeCreated" }                     // 500 on register — see §3.3
  | { kind: "offline" }
  | { kind: "timeout" }
  | { kind: "rateLimited"; retryAfterSeconds: number }
  | { kind: "server"; message: string };         // 5xx, and 400s we cannot place

export interface AuthFormState {
  status: "idle" | "submitting" | "succeeded";
  formError: AuthFormError | null;
  isOffline: boolean;
}
```

**Field values, per-field errors, and touched state are deliberately absent.** react-hook-form owns
them, and mirroring them into a second store is how a field ends up displaying a stale error after it
has been corrected. This is the one place the web state model diverges structurally from Android's
`AuthFormState`, which had to hold `values`, `fieldErrors`, and `touched` because Compose has no form
library. Everything left in the shape is form-level and genuinely ours.

```ts
import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email address")
  .email("Enter a valid email address");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128, "Use 128 characters or fewer"),
});

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Your name needs at least 2 characters")
    .max(100, "Use 100 characters or fewer"),
  email,
  password: z.string().min(8, "Use at least 8 characters").max(128, "Use 128 characters or fewer"),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: "Please accept the Terms to continue" }),
  }),
});

export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
```

Both schemas live in `src/features/auth/schemas.ts` and are imported by the form component *and* by
the BFF route handler, so the same rules run in the browser and on the Next server and the handler
cannot forward a shape the DTO will reject. The Nest DTOs remain the authority; these mirror them
(foundation §1). `acceptTerms` is in the schema and never in the request (§2).

**Navigation is never held in state.** Android used a one-shot `Channel` because a flag in state
re-fires on configuration change. Web has no configuration change, but it has Strict Mode's double
invocation and a re-render on every `searchParams` change, which produce the same double-navigation
bug by a different route. So `router.replace` is called imperatively in the submit handler's success
path and never derived from state inside an effect.

---

## 8. Accessibility

Per surface, targeting WCAG 2.1 AA (foundation §9).

**Landing.** One `h1` (the hero), `h2` per section, no skipped levels — real headings rather than
styled `div`s, because this is the page a screen-reader user navigates by heading list. The hero
portrait's `alt` describes the person, not the brand; the legibility scrim is a CSS layer, not an
image. The plan teaser must not signal "recommended" by colour alone: that card carries a `Badge` with
text.

**All four form pages.** Every field has a visible persistent `<label>` wired with `htmlFor` —
placeholder-as-label loses the label the instant someone types and truncates at 200% zoom. Invalid
fields get `aria-invalid="true"` and an `aria-describedby` listing **both** the helper-text id and the
error id; dropping the helper id when an error appears removes the password requirements from the
accessible description at the exact moment they are needed.

**The error banner is the one justified `aria-live="assertive"` in the product.** `role="alert"` plus
assertive, because a 401 is inserted above a form the user's eyes and cursor are below, and a polite
announcement queued behind nothing still arrives after they have started retyping. The container
exists in the DOM from first render and is filled on error rather than being inserted, since an
injected live region is missed by some screen-reader and browser pairings. Its height is reserved for
a different reason: **the banner appearing must not push the submit button under a cursor that is
mid-click.**

**The password toggle is `<button type="button">`.** A bare `<button>` inside a `<form>` defaults to
`type="submit"`, so revealing the password submits the form — invisible in a Storybook story and
immediate in the real page. Its accessible name flips between "Show password" and "Hide password"; a
static name leaves a screen-reader user unable to tell the current state.

**The strength meter carries a text label and is not a live region.** `role="meter"` with
`aria-valuetext="Strong"` beside the visible word, because colour alone communicates nothing to a
significant fraction of users and nothing at all in forced-colours mode. It deliberately does not
announce — a meter updating on every keystroke makes the field unusable — so the static requirement
line is what a screen-reader user relies on, and it is in the field's description.

**Keyboard and focus.** A real `<form>` means Enter submits from any field. Tab order is DOM order,
with no `tabindex` above 0. Focus after failure goes to the first invalid field, or on a form-level
error to the field most likely to be at fault — password on a 401, email on a 409 — never to the
banner. "Forgot password?" is visually about 20px tall and needs padding to a 44px target at base.

**Autofill contrast.** Chrome paints its own autofill background and ignores `background-color`; the
inset-shadow override in foundation §2.5 is what keeps a filled field legible in dark mode. That is a
contrast requirement, not a cosmetic one.

**Zoom.** Inputs never below 16px at base width, or iOS Safari zooms and does not return.
**Signup breaks first at 200%** — name, email, password, meter, requirement line, terms row, button,
and footer link stacked — and at 320px CSS width the terms row is the failure point, where a checkbox
with two inline links wraps to four lines and the links' hit targets begin to overlap. The fix is that
the links become block-level at that width and the checkbox keeps a 44px padded target that does not
grow with its label.

**Forced colours.** The error banner is background-driven, so it needs a 1px border to survive Windows
high contrast, where `--error-container` is discarded entirely.

---

## 9. Decisions

**Settled.** Carried from Android unchanged: no confirm-password on Signup but yes on Reset; password
rules mirror the DTOs exactly and nothing more; the submit button stays enabled while the form is
invalid; a 401 is a banner and not a field error; no "keep me signed in". Decided here: the landing
page leads on memory rather than romance, in five sections, static, with an `ag_hint` cookie for the
header label and no testimonials, video, or live demo; the auth headline is Jakarta `headline-md`
rather than Fraunces, resolving the foundation's internal conflict; the reset link is an `https` URL
whose token is burned on `POST` and never on `GET`; `?next=` is validated against a prefix allowlist on
both the writing and the reading side; cross-tab logout is synced over `BroadcastChannel` with a
`storage`-event fallback; the auth forms require JavaScript and say so in `<noscript>`; refresh is
reactive and single-flight with no scheduling from `exp`; every session-dependent BFF response is
`no-store`; the BFF unwraps the response envelope and picks request fields explicitly; and a 500 on
signup is retried as a login before it is reported.

**Open.**

**Brand name.** "Lumen" is the placeholder. On web it sets the domain, the wordmark, the page titles,
the OG image, and — new here — the From name on the reset email, which is the one place a placeholder
becomes a deliverability problem rather than a cosmetic one.

**Landing imagery.** Foundation §12 records this as the largest unresolved visual decision, and §3.1
assumes it is resolved. Licensed photography, commissioned illustration, or rendered companions: it is
the first thing every visitor sees and it cannot be derived from the tokens.

**Whether the landing page ships in the first milestone.** My position: if real imagery is not ready,
`/` should 307 to `/login` and §3.1 waits. A weak landing page is worse than none, and the positioning
work holds either way.

**Google sign-in.** Foundation §12 reopens the Android deferral, and if it lands it changes this
document more than any other: the BFF gains an OAuth callback route, Login and Sign up gain the
provider row whose space is already reserved (§1), and "an account with no password" becomes a real
state that account security has to handle. Only `POST /auth/google` is missing from the backend.

**Whether to build Forgot and Reset now, behind the flag.** Same answer as Android: build them.
Discovering that the token, referrer, and link-scanner plumbing in §3.5 is wrong is far cheaper now
than during a password-reset incident.

**Who owns email deliverability.** No transport has been chosen, and the reset flow's real failure mode
is not a missing endpoint but a link that lands in spam. Whoever owns the transport also owns SPF,
DKIM, and DMARC on the sending domain, and that is a prerequisite rather than a follow-up.
