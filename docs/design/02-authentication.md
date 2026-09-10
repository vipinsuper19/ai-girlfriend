# Design Task 2 — Module 1: Authentication

Six screens: Splash, Welcome, Login, Signup, Forgot Password, Reset Password.

Built from the tokens in [`01-foundation.md`](./01-foundation.md). Visual reference with every
screen and state rendered in both themes: `canvases/android-auth-screens.canvas.tsx`.

Endpoint behaviour below is quoted from `apps/api/src/auth/auth.service.ts` and the DTOs in
`apps/api/src/dto/`, not from the PRD.

---

## 1. Before anything else: two of these screens have no backend

`apps/api` implements exactly four auth endpoints: `register`, `login`, `refresh`, `logout`. There is
**no forgot-password endpoint, no reset-password endpoint, and no mail transport anywhere in the
repo**.

Screens 5 and 6 are fully specified and drawn so they are ready the day the backend lands, but they
cannot function in a shipping build. **The "Forgot password?" link on Login must sit behind a feature
flag that is off by default.** A link into a dead end is worse than no link — it teaches users the
app is broken at the exact moment they are already locked out and frustrated.

What the backend needs before these two screens can be enabled:

- `POST /auth/forgot-password` taking `{ email }`, always returning 202 regardless of whether the
  account exists.
- `POST /auth/reset-password` taking `{ token, password }`.
- A single-use, time-limited (30 min) reset token, stored hashed, invalidated on use and on password
  change.
- Mail transport, plus a deep link registered for `aicompanion://reset-password?token=…`.
- Rate limiting on both — these are the two endpoints most worth abusing.

Google sign-in is deferred (decision recorded in `ANDROID_PLAN.md` §9), so Welcome has no provider
buttons. The layout reserves vertical space for a provider row so adding it later is not a redesign.

---

## 2. Screen specifications

### 2.1 Splash

**Purpose.** Resolve the session and route. Nothing else. It is not a branding opportunity that
delays the user; it is a decision point that happens to be branded.

**Layout.** Vertically centred monogram (76dp, `primaryContainer`) above the wordmark in
`displayLarge` Fraunces. A progress indicator sits in reserved space near the bottom, and the whole
thing is edge-to-edge on `background`.

**Components.** `Avatar` (monogram variant), wordmark text, `LoadingIndicator`.

**Behaviour.** Use the AndroidX `core-splashscreen` system splash with `setKeepOnScreenCondition`
while the session resolves, then hand off to this composable. Doing it the other way produces a
visible double-splash, which is the single most common way this screen goes wrong.

**Do not show the spinner immediately.** Reading the token store takes under 100ms in the normal
case, and a spinner that flashes for 80ms reads as jank. Show it only after 600ms.

**States.**

| State | Treatment |
|---|---|
| Resolving (< 600ms) | Brand only, no indicator |
| Slow (> 600ms) | Indicator fades in |
| No token | Navigate to Welcome |
| Valid token, no companion | Navigate to Onboarding |
| Valid token, companion exists | Navigate to Home |
| Refresh rejected (401) | Clear the token store, navigate to Welcome, **show nothing** — the user did not do anything wrong and does not need an error |
| Offline with a cached session | Proceed to Home; the chat cache works offline, and blocking entry here would be gratuitous |
| Resolution fails > 8s | Fall through to Welcome rather than hanging |

**Navigation.** Popped from the back stack on exit, so back from Welcome leaves the app.

---

### 2.2 Welcome

**Purpose.** Communicate what the product is in one sentence and route to Signup or Login.

**Layout.** Companion imagery fills the top ~40% in a 20dp-radius container. Headline in
`displayLarge` Fraunces, two lines. Supporting sentence in `bodyLarge` `onSurfaceVariant`. Spacer.
`PrimaryButton` "Get started", `TextButton` "I already have an account", then a legal line in
`bodySmall`.

**Copy.** Headline: *"Someone who remembers."* Body: *"Create a companion with her own personality —
and a memory that grows with every conversation."*

That leans on memory rather than romance deliberately. Memory is the actual technical differentiator
(the PRD's own closing paragraph makes the same argument), and it is the one claim here that
competitors mostly cannot make. Romance-forward copy would put the product in a category where it
competes on imagery instead.

**Imagery.** A single portrait, warm low light, looking slightly off-camera rather than at the
viewer. A direct-to-camera gaze reads as a dating-app profile; an off-camera gaze reads as a person.
A flat scrim at ~14% `background` sits over the lower third for text legibility — this is the only
gradient permitted anywhere in the design system, and it is functional rather than decorative.

**States.** Normal; image loading (a `surfaceContainerHigh` block, never a spinner); image failed
(`primaryContainer` with the monogram — the screen must still work).

**Navigation.** Get started → Signup. Log in → Login. Terms and Privacy open a Custom Tab.

---

### 2.3 Login

**Purpose.** Authenticate an existing user in as few taps as possible.

**Layout.** Back arrow. `headlineMedium` "Welcome back" with a one-line subtitle. Email field.
Password field with visibility toggle. Right-aligned "Forgot password?" `TextButton`.
`PrimaryButton` "Log in". Centred footer: "New here? Create an account".

**Components.** `CompanionTextField`, `PasswordField`, `TextButton`, `PrimaryButton`, `Banner`.

**Key decision — a 401 is a banner, not a field error.** The server returns the same
`Invalid email or password` whether the address is unknown or the password is wrong, which is
correct: distinguishing them hands an attacker an account-enumeration oracle. Since the client
genuinely cannot know which field is wrong, marking either one red would be a lie. The banner reads
*"Email or password is incorrect."* On failure the password clears and the email is kept.

**States.**

| State | Treatment |
|---|---|
| Rest | Empty fields, CTA enabled |
| Validation error | Inline field errors, focus moves to the first, TalkBack announces it |
| Submitting | Fields disabled, button shows a spinner and keeps its width, back blocked |
| Credentials rejected (401) | Error banner above the form, password cleared |
| Server fault (5xx) | Banner with Retry, all input preserved |
| Offline | Persistent warning banner, CTA disabled, auto-retry on reconnect |
| Timeout (20s) | Banner: "That took too long." with Retry |
| Success | Navigate; no success toast — arriving is the confirmation |

**Navigation.** Success routes to Onboarding if the account has no companion, otherwise Home. The
auth graph is popped entirely, so back does not return to Login.

---

### 2.4 Signup

**Purpose.** Create an account with the minimum fields the API actually requires.

**Layout.** Back arrow. `headlineMedium` "Create your account". Name, Email, Password. Strength meter
plus a short requirement list. Terms checkbox, unchecked by default. `PrimaryButton` "Create
account". Footer: "Already have an account? Log in".

**No confirm-password field.** The visibility toggle solves the typo problem that confirm fields
exist for, at half the friction, and the backend has no `confirmPassword` in `RegisterDto` anyway.
Reset Password *does* keep its confirm field — see §2.6 for why the two differ.

**Password rules mirror the backend and nothing more.** `RegisterDto` enforces `@MinLength(8)` and
`@MaxLength(128)`. The client enforces the same. The strength meter is advisory and never blocks
submission. Demanding a symbol and a digit client-side would invent a rule the server does not share,
and the two would disagree the first time either changed.

**Terms** must be actively checked. Pre-checking a consent box is not consent, and in several
jurisdictions it is not lawful.

**States.** Rest; per-field validation; terms unchecked (error text under the checkbox on submit);
submitting; **email taken (409)** — field error on email plus a "Log in instead" action that carries
the address to Login pre-filled; server fault; offline; success → always Onboarding, because a new
account has no companion by definition.

**Note on enumeration.** The 409 does reveal that an address is registered. That is the standard
trade — a signup form that hides it becomes unusable — but it is worth stating explicitly rather than
discovering later.

---

### 2.5 Forgot Password — blocked, see §1

**Purpose.** Trigger a reset email.

**Layout.** Back arrow. `headlineMedium` "Reset your password" with an explanatory paragraph. Email
field. `PrimaryButton` "Send reset link". `TextButton` "Back to log in".

**The success state must not reveal whether the account exists.** Copy is identical either way: *"If
an account exists for that address, we've sent a link to reset your password. It expires in 30
minutes."* Any variation turns this screen into a free account-enumeration endpoint. This constrains
the backend too: it must return 202 in both cases, and in the same amount of time.

**States.** Rest; invalid email; submitting; **sent** (a terminal success screen with a mail icon, the
address echoed back, and a resend button on a 60-second cooldown); offline; server fault.

**Navigation.** Back to log in → Login. Success stays on the terminal state rather than auto-routing —
the user's next action is in their email client, not in the app.

---

### 2.6 Reset Password — blocked, see §1

**Purpose.** Set a new password from an emailed deep link.

**Entry.** `aicompanion://reset-password?token=…`. The token is validated on screen entry, before
anything is rendered, so an expired link never shows a form the user cannot submit.

**Layout.** `headlineMedium` "Choose a new password" with a subtitle. New password field. Confirm
field. Requirement checklist. `PrimaryButton` "Reset password".

**Here the confirm field earns its place**, unlike on Signup. The user is replacing something they
cannot see, they will not use it again until the next login, and a typo locks them out of the account
they are currently in the middle of recovering. That asymmetry, not consistency, is what should decide
whether a confirm field exists.

**States.** Validating token (brief, full-screen); **invalid or expired token** (a dedicated screen
with a clock icon, an explanation, and a "Request a new link" CTA — never a form); rest; mismatch;
too short; submitting; success; server fault.

**On success**, route to Login with a snackbar reading "Password updated. Log in with your new
password." Do **not** auto-login: the reset endpoint does not return tokens, and inventing a
session here would mean a second silent request that can fail after we have already claimed success.

**Security note for the backend.** Resetting a password must invalidate every existing session for
that user. `Session` rows are the source of truth for refresh tokens, so this is a delete-by-`userId`
— cheap to do, and the entire point of a password reset if the account was compromised.

---

## 3. Validation

Client rules mirror the backend DTOs exactly. Stricter is friction; looser trades a fast inline error
for a slow round trip.

| Field | Screens | Client rule | Backend | Message |
|---|---|---|---|---|
| Email | Login, Signup, Forgot | Non-empty, valid shape, trimmed + lowercased | `@IsEmail()` | "Enter a valid email address" |
| Password | Login | Non-empty | `@IsNotEmpty() @MaxLength(128)` | "Enter your password" |
| Password | Signup, Reset | 8–128 chars | `@MinLength(8) @MaxLength(128)` | "Use at least 8 characters" |
| Name | Signup | 2–100 chars after trim | `@MinLength(2) @MaxLength(100)` | "Your name needs at least 2 characters" |
| Terms | Signup | Must be checked | client-only | "Please accept the Terms to continue" |
| Confirm | Reset | Must equal password | client-only | "Both entries need to match" |

The service lowercases and trims email server-side, so the client should too — otherwise the same
person can type `Vipin@…` and see it echoed back as `vipin@…` after login, which looks like a bug.

**Timing.** Never validate while someone is first typing. Validate on blur once a field has been
touched; after an error is showing, re-validate on every keystroke so it clears the moment it is
fixed. On submit, validate everything, focus the first invalid field, and announce it.

**The submit button stays enabled while the form is invalid.** A greyed-out button that does not say
why is the most common accessibility failure in sign-up forms — a screen-reader user gets no signal at
all. Validate on tap instead. The single exception is offline, where the banner states plainly that
nothing will work until connectivity returns.

---

## 4. Error mapping

Every failure the client can receive, and the copy it becomes.

| Trigger | HTTP | Server message | UI |
|---|---|---|---|
| Wrong password / unknown email | 401 | `Invalid email or password` | Banner: "Email or password is incorrect." Password cleared. |
| Email already registered | 409 | `Email is already registered` | Field error on email + "Log in instead" |
| DTO validation failed | 400 | `string[]` | Should be unreachable. Fallback: banner with the first message. |
| Refresh invalid/expired | 401 | `Invalid or expired refresh token` | Silent at Splash — clear store, route to Welcome |
| Server fault | 5xx | varies | Banner: "Something went wrong on our end." + Retry |
| No connectivity | — | — | Persistent warning banner, CTA disabled |
| Timeout (20s) | — | — | Banner: "That took too long." + Retry |
| Rate limited | 429 | not implemented | Banner with cooldown. Designed, not reachable. |

**`message` can be a string or an array of strings.** Nest's `ValidationPipe` returns an array;
everything else returns a scalar. The response model must accept both or the first validation error
crashes deserialization.

**The error envelope drops the machine-readable code.** `HttpExceptionFilter` forwards only `message`
and `error`, so the client branches on HTTP status and an English sentence. For this module that is
survivable — on these endpoints 401 and 409 each mean exactly one thing. It stops being survivable as
soon as a second failure mode shares a status, which is why forwarding `code` is on the backend fix
list in `ANDROID_PLAN.md` §3. Do not build a habit of matching on message text.

---

## 5. State model

One shape for all four interactive screens, which keeps the ViewModels and their tests uniform.

```kotlin
data class AuthFormState(
    val values: Map<Field, String> = emptyMap(),
    val fieldErrors: Map<Field, String> = emptyMap(),
    val touched: Set<Field> = emptySet(),
    val formError: FormError? = null,
    val isSubmitting: Boolean = false,
    val isOffline: Boolean = false,
)

sealed interface FormError {
    data object InvalidCredentials : FormError          // 401
    data object Offline : FormError
    data object Timeout : FormError
    data class Server(val message: String) : FormError  // 5xx
    data class RateLimited(val retryAfter: Duration) : FormError
}

sealed interface AuthEvent {
    data class NavigateTo(val route: Any) : AuthEvent
    data class ShowSnackbar(val message: String) : AuthEvent
}
```

Navigation is emitted as a one-shot event through a `Channel`, never held in state — a navigation
flag in state re-fires on every configuration change and produces double navigation, which is the
classic bug in this exact screen set.

Field text survives process death via `SavedStateHandle`. **Passwords deliberately do not.**

---

## 6. Interaction details

**Autofill and password managers.** Email fields declare `ContentType.EmailAddress`. Login's password
declares `Password`; Signup and Reset declare `NewPassword`, which is what prompts a manager to offer
to *save* rather than to fill. Getting this wrong is why so many apps never trigger the save prompt.

**Keyboard.** Email keyboard type, no autocapitalisation, no autocorrect on email. IME actions chain
Next through the form with Done on the last field, and Done submits. `imePadding()` on the scroll
container so the focused field is never behind the keyboard.

**Back.** Blocked while a request is in flight; the 20s timeout guarantees it unblocks. Splash is
popped on exit. The whole auth graph is popped on successful login.

**No "keep me signed in" checkbox.** Refresh tokens last 30 days and rotate on every use, so sessions
already persist. A checkbox implying the user has a choice they do not have is worse than no checkbox.

**Edge-to-edge.** All six screens draw behind the system bars with transparent bars and
`safeDrawingPadding()` on content.

**`FLAG_SECURE`** is set on Signup, Login, and Reset so passwords do not appear in the recents
thumbnail.

---

## 7. Accessibility

Per-screen requirements, all of them cheap now and expensive later.

Every field has a visible persistent label — placeholder-only fields lose their label the moment
someone types. Errors use `Modifier.semantics { error(message) }` alongside the visible icon and text,
so they reach TalkBack as errors rather than as decorative text.

The password visibility toggle's `contentDescription` flips between "Show password" and "Hide
password"; a static label leaves a screen-reader user unable to tell the current state. The strength
meter is not colour-only — it carries a text label ("Strong") beside it.

Error banners set `liveRegion = LiveRegionMode.Assertive` so a 401 is announced rather than silently
appearing above a form the user is still looking down at.

Touch targets are 48dp minimum, including the "Forgot password?" text button, which is visually 40dp
tall and needs `minimumInteractiveComponentSize()`.

Test at 200% font scale with the largest display size. Signup is the screen that will break first —
it has the most vertical content — and it must scroll rather than clip.

---

## 8. Decisions

Settled here: no confirm-password on Signup but yes on Reset; password rules match the backend
exactly; submit stays enabled while invalid; 401 renders as a banner rather than a field error; no
"keep me signed in".

Open:

**Brand name.** "Lumen" is a placeholder in the mockups. The real name sets the wordmark, the app
label, the deep-link scheme, and the package id, so it wants deciding before Splash is built rather
than after.

**Welcome imagery.** The design calls for a single warm, off-camera portrait. Whether that is
licensed photography, commissioned illustration, or a rendered companion needs an answer — it is the
first thing a user sees and the strongest signal of whether the product reads as premium.

**Whether to build Forgot and Reset at all in this milestone.** They are specified and drawn. If the
backend work in §1 is not planned soon, the honest options are to build them behind a flag or to defer
them and ship Login without the link. I would build them behind the flag — the screens are done, and
discovering the deep-link plumbing is wrong is much cheaper now than during a password-reset incident.
