# Design Task 3a — Onboarding & Home

Six screens: onboarding intro, four wizard steps, and the authenticated home screen.

Tokens from [`01-foundation.md`](./01-foundation.md). Visual reference:
`canvases/android-onboarding-home.canvas.tsx`.

Written against `CreateAvatarDto` in `apps/api/src/avatars/dto/create-avatar.dto.ts`, not the PRD.

---

## 1. The companion the database actually has

PRD Module 3 lists relationship type, age range, language, and backstory as companion fields. The
`Companion` model has five: `name`, `gender`, `status`, `systemPrompt`, `greeting`. Everything else
lives in three optional nested objects — `appearance`, `personality`, `voice`.

So the wizard cannot promise structured fields with nowhere to land. Two things get rehomed:

- **Relationship framing** → `personality.metadata.relationshipType`, and folded into the generated
  `systemPrompt`.
- **Backstory** → folded into `systemPrompt` directly.

Both still shape her behaviour, because `systemPrompt` is what the AI actually reads. They are just
not queryable later, which matters only if you later want to filter or report on them.

**`personality` has four numeric levels, not the PRD's eight traits:** `humorLevel`, `flirtLevel`,
`empathyLevel`, `romanceLevel`. The PRD's other four (confidence, intelligence, playfulness,
emotional support) have no columns. They become entries in the `traits` JSON array instead, which is
the right place for an open-ended list.

---

## 2. Wizard shape

Intro, then four steps, then the app. Progress is a four-segment bar; the intro is step zero and
shows none.

**Order: appearance → personality → voice and framing → name.**

Appearance goes first because choosing a face gives immediate visual feedback and builds investment.
Opening with abstract trait sliders feels like filling in a form, and the drop-off on step one of any
wizard is the highest of any step.

**Naming happens last, on the Finalize screen.** Naming an abstraction is hard; naming someone you
have just designed is easy and satisfying. It also gives the final button its line — "Meet Aria"
rather than a generic Finish, which is the emotional beat the brief asks for.

**Every step except the name is skippable.** Skip applies documented defaults and moves on. The
brief's own UX principle is to keep onboarding short, and someone who wants to start talking should
not be held up by a hair-colour picker.

### 2.1 Field mapping

| Step | Control | Writes to |
|---|---|---|
| 1 Appearance | Style chips | `appearance.metadata.style`, seeds `imagePrompt` |
| 1 Appearance | Hair / eye / skin swatches | `appearance.hairColor`, `eyeColor`, `skinTone` |
| 1 Appearance | "More options" sheet | `ethnicity`, `bodyType`, `height`, `clothingStyle`, `hairStyle` |
| 2 Personality | Trait chips, max 4 | `personality.traits[]` |
| 2 Personality | Four sliders | `empathyLevel`, `humorLevel`, `flirtLevel`, `romanceLevel` |
| 3 Voice | Voice card | `voice.voiceId`, `provider`, `language` |
| 3 Framing | Relationship chip | `personality.metadata.relationshipType` |
| 4 Finalize | Name field | `name` (2–100 chars, the only required field) |
| — | Not asked | `gender` — defaults to `FEMALE`, changeable later |
| — | Generated | `systemPrompt`, `greeting` — composed client-side from the answers |

**The voice step is not optional in practice.** `VoiceService.synthesize` and `respond` both fail if
the companion has no `CompanionVoice` row, so skipping the voice step must still write a default
rather than omitting the object.

### 2.2 One commit, at the end

`POST /avatars` accepts the entire nested structure in a single call, and there is no partial-save
endpoint. That is a gift: there is no half-created companion to reconcile, no draft resource to clean
up, and no ordering problem between the four sub-objects.

The consequences for the client:

- The whole draft lives in a wizard-scoped ViewModel, persisted through `SavedStateHandle` so it
  survives process death. Losing four steps of input to a backgrounded app would be unforgivable.
- **Finalize is the only screen that can fail.** Its error state must keep the draft intact and offer
  retry — never bounce the user back to step one.
- Back navigation between steps is free and lossless, because nothing has been sent.

### 2.3 Per-step detail

**Intro.** Three bullets naming what the user is about to choose: her personality, her look, her
memory. The memory bullet does double duty as an early privacy signal — "she keeps what matters, and
you can read and delete all of it" — which is worth saying before the user has invested anything.

**Step 1, Appearance.** A live 104dp avatar preview above the controls. Four primary choices (style,
hair, eyes, skin) with the remaining five behind a "More options" row. Progressive disclosure is
explicitly requested by the brief, and nine pickers on one screen at 360dp is unusable anyway.

**Step 2, Personality.** Trait chips capped at four — a cap forces a choice, and an uncapped list
produces companions who are every adjective at once and therefore none of them. Below, the four
sliders that map to real columns. Slider labels are human ("Warmth", not "empathyLevel").

**Step 3, Voice and framing.** Voice options are playable: tap to hear a two-second sample before
committing. Choosing a voice from a text label alone is guesswork. Relationship framing is four chips
below.

**Step 4, Finalize.** Preview card with avatar, chosen traits, and a voice/relationship summary, then
the name field, then "Meet [name]" which updates live as they type. Error state shown in the canvas.

---

## 3. Home

**Purpose.** Make it immediately obvious this is a relationship with a specific person, and get the
user into conversation in one tap.

**Layout, top to bottom.** A quiet greeting line with a settings affordance. The companion: 128dp
avatar, name in `displayMedium` Fraunces, presence line. Her most recent message in an incoming-shaped
bubble. `PrimaryButton` "Continue talking". A three-up quick-action row. A memory highlight card.
Bottom navigation.

**The companion occupies the top half and nothing competes with her.** The brief warns against
dashboard UI, and the failure mode here is a grid of stat cards. Everything below the fold is one row
tall.

**The memory highlight is the most valuable widget on this screen.** A single line — "She remembered
your sister's name this week" — does more to communicate the product's actual differentiator than any
amount of copy elsewhere. It uses `tertiaryContainer`, the memory colour, so the association is
consistent with the Memory tab.

### 3.1 Data

| Element | Source |
|---|---|
| Companion identity | `GET /avatars` (list; first ACTIVE) |
| Last message | `GET /conversations` then `GET /conversations/:id/messages` |
| Memory highlight | `GET /memories?limit=1` sorted by importance |
| Plan badge | `GET /subscriptions/current` |
| Usage strip | `GET /usage/summary` |

**Two of those five are unguarded.** `/subscriptions/current` and `/usage/summary` read `req.user`
with no `JwtAuthGuard` applied, so they currently throw or resolve against `undefined`. Home must
degrade gracefully: if either fails, hide the plan badge and usage strip rather than showing an error.
This is on the backend fix list in `ANDROID_PLAN.md` §3.

**Last message costs two requests** because `GET /conversations` returns no message preview. Home
fetches the newest conversation, then its messages. Worth flagging to the backend: including a
`lastMessage` snippet in the conversation list would remove a round trip from the app's most-visited
screen.

### 3.2 States

| State | Treatment |
|---|---|
| Loading, cold start | Skeleton mirroring the real layout so nothing jumps |
| Loading, warm start | Cached companion renders immediately; only the message refreshes |
| Loaded | As drawn |
| First run, no messages | Her greeting from `Companion.greeting`, CTA reads "Say hello", no memory card |
| Offline | Cached companion and last message; CTA still works, chat opens read-only |
| No companion | Should be impossible — Splash routes to Onboarding. If it happens, route there rather than rendering an empty Home |
| Near usage limit | A single amber strip above the quick actions, only above 80% |
| Companion archived | Route to Onboarding with an explanation |

**Greeting.** Time-of-day text ("Good evening, Vipin") is client-side from the device clock. Her
message bubble is real data, not generated copy.

---

## 4. Accessibility

The avatar is decorative when the name is adjacent — mark it
`contentDescription = null` rather than reading "Aria" twice.

The presence dot is colour plus the text "Active now"; the dot alone would be colour-only
communication.

Wizard steps announce progress: `Modifier.semantics { stateDescription = "Step 2 of 4" }` on the
stepper, so a screen-reader user knows where they are in a flow with no other landmark.

Slider values are announced as their human label plus value, not the raw field name.

Home is a single scroll with `heading()` semantics on section boundaries.

---

## 5. Decisions

Settled: appearance before personality; name last; every step skippable with defaults; one commit at
Finalize; four sliders rather than the PRD's eight traits; relationship framing into
`personality.metadata`.

Open:

**Gender is not asked.** It defaults to `FEMALE` and is changeable in Companion settings. The product
is named "AI girlfriend", so asking feels redundant at onboarding — but the enum supports `MALE` and
`OTHER`, and if the product intends to serve those users, the question belongs in step 1 rather than
buried in settings.

**Voice samples need audio assets.** Playing a two-second sample per voice requires either bundled
clips or a synthesis call during onboarding. Bundled is faster and works offline; synthesised is
accurate to what the user will actually hear. I would bundle four short clips and accept the small
mismatch.

**The avatar is a monogram, not an image.** There is no image generation, and `POST /avatars/:id/avatar`
only accepts a manual upload. Every mockup shows a lettered monogram on `primaryContainer`. It looks
deliberate rather than broken, but it is a placeholder for imagery the product eventually needs.
