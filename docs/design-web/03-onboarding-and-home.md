# Web Design Task 3a — Onboarding & Home

Six surfaces: the onboarding intro, four wizard steps, and the authenticated Home screen. Between
them they decide whether the product reads as a relationship or as a configuration form.

Tokens, breakpoints, shells, components, and the BFF are defined in
[`01-foundation.md`](./01-foundation.md) and are referenced rather than restated. The settled
decisions in [`docs/design/03-onboarding-and-home.md`](../design/03-onboarding-and-home.md) carry
forward unchanged unless there is a web-specific reason to differ, and where there is, the reason is
stated. Written against `CreateAvatarDto` in `apps/api/src/avatars/dto/create-avatar.dto.ts` and
`apps/api/src/prisma/contract.prisma`, not against the PRD. Visual reference:
`canvases/web-onboarding-home.canvas.tsx`.

---

## 1. The companion the database actually has

PRD Module 3 lists relationship type, age range, language, and backstory as companion fields. The
`Companion` model in `contract.prisma` (line 248) has five: `name`, `gender`, `status`,
`systemPrompt`, `greeting`. Everything else lives in three optional one-to-one children —
`CompanionAppearance`, `CompanionPersonality`, `CompanionVoice`.

So the wizard cannot promise structured fields with nowhere to land. Two things get rehomed:

- **Relationship framing** → `personality.metadata.relationshipType`, and folded into the generated
  `systemPrompt`.
- **Backstory** → folded into `systemPrompt` directly.

Both still shape her behaviour, because `systemPrompt` is what the AI actually reads. They are
simply not queryable later, which matters the day someone wants to segment users by relationship
type and discovers the answer is inside a 5,000-character string.

**`personality` has four numeric levels, not the PRD's eight traits:** `humorLevel`, `flirtLevel`,
`empathyLevel`, `romanceLevel` (`contract.prisma` lines 331–334). The other four — confidence,
intelligence, playfulness, emotional support — have no columns and become entries in the `traits`
JSON array, which is the right home for an open-ended list and the wrong home for anything the
product wants to filter on.

### 1.1 Field mapping

Every control writes to exactly one path in `CreateAvatarDto`. Nothing is collected that has nowhere
to go.

| Step | Control | Writes to |
|---|---|---|
| 1 Appearance | Style chips | `appearance.metadata.style`, seeds `appearance.imagePrompt` |
| 1 Appearance | Hair / eye / skin swatches | `appearance.hairColor`, `appearance.eyeColor`, `appearance.skinTone` |
| 1 Appearance | "More options" disclosure | `appearance.ethnicity`, `bodyType`, `height`, `clothingStyle`, `hairStyle` |
| 2 Personality | Trait chips, max 4 | `personality.traits[]` |
| 2 Personality | Four sliders | `personality.empathyLevel`, `humorLevel`, `flirtLevel`, `romanceLevel` |
| 3 Voice | Voice card | `voice.provider`, `voice.voiceId`, `voice.language` |
| 3 Framing | Relationship chip | `personality.metadata.relationshipType` |
| 4 Finalize | Name field | `name` — 2–100 chars, the only required field |
| — | Not asked | `gender` — sent as `FEMALE`, changeable later (§6) |
| — | Generated | `systemPrompt`, `greeting` — composed client-side from the answers |

**`gender` is required by the DTO, not optional.** It is declared `gender!: CompanionGender` with
`@IsEnum`, so the client always sends a value even though it never asks for one, and the Prisma
default of `FEMALE` never applies. Similarly, `systemPrompt` and `greeting` are validated
`@Length(1, 5000)` and `@Length(1, 1000)` — an empty string is a 400 while an absent key is fine, so
the composer omits rather than blanks.

**Nested keys are not validated, which makes typos silent.** `main.ts` sets `whitelist: true` and
`forbidNonWhitelisted: true`, so an unknown *top-level* key is a 400. But `appearance`,
`personality`, and `voice` carry only `@IsObject()` — no `@ValidateNested` — so their contents are
never inspected, and `AvatarsService.create` copies named fields one by one. A misspelled nested key
is accepted with a 201 and discarded. Given that this design set is written in British English,
`appearance.hairColour` is a plausible mistake that produces a companion with no hair colour and no
error. The client's zod schema for the draft is the only thing preventing it, so it must be exact.

**`name` is trimmed after validation, not before.** `AvatarsService.create` calls `dto.name.trim()`
but `@Length(2, 100)` has already run on the untrimmed value, so `" a "` passes and is stored as a
one-character name. The client trims before validating, making its rule stricter than the server's.

---

## 2. Wizard shape

Intro, then four steps, then the app. Progress is a four-segment bar pinned to the top of the
onboarding shell ([`01-foundation.md`](./01-foundation.md) §4.2); the intro is step zero and fills
none of it.

**Order: appearance → personality → voice and framing → name.** Appearance goes first because
choosing a face gives immediate visual feedback and builds investment, and because step one of any
wizard has the highest drop-off. Opening with abstract trait sliders feels like filling in a form.
On web this is stronger than on Android: at `lg`+ the preview and the controls are visible
simultaneously, so the payoff for the first choice is instantaneous rather than requiring a scroll.

**Naming happens last, on Finalize.** Naming an abstraction is hard; naming someone you have just
designed is easy and satisfying. It also gives the final button its line — "Meet Aria" rather than a
generic Finish — which is the emotional beat the flow is built around.

**Every step except the name is skippable.** Skip applies documented defaults and moves on. Someone
who wants to start talking should not be detained by a hair-colour picker. The defaults are listed
per step in §3 and are not "omit the object" — see §2.1.

### 2.1 One commit, at the end

`POST /avatars` accepts the entire nested structure in a single call and there is **no partial-save
endpoint** anywhere in `avatars.controller.ts`. That is a gift rather than a limitation: there is no
half-created companion to reconcile, no draft resource to garbage-collect, and no ordering problem
between the three sub-objects.

It does mean the sub-objects are all-or-nothing per request. `AvatarsService.create` only writes
`CompanionAppearance` if `dto.appearance` is present, only writes `CompanionPersonality` if
`dto.personality` is present, and — this is the sharp edge — only writes `CompanionVoice` if
**both** `dto.voice.provider` and `dto.voice.voiceId` are truthy.

**Skipping a step therefore writes defaults; it does not omit the object.** A missing
`CompanionPersonality` forces companion edit to render a "not configured yet" state no user asked
for. A missing `CompanionAppearance` means `POST /avatars/:id/avatar` takes its create branch, which
passes `{ data: { … } }` to the contract API while every other call in `avatars.service.ts` passes a
flat object — a shape mismatch that fails on the first upload by a user who skipped step 1. A
missing `CompanionVoice` breaks voice entirely (§3.4).

### 2.2 The draft lives in a Zustand store, persisted to `sessionStorage`

The whole draft is one client-side object until Finalize. The store is scoped to the wizard and
persisted through Zustand's `persist` middleware.

```ts
// stores/onboarding-draft.ts
export const useOnboardingDraft = create<OnboardingDraft>()(
  persist(
    (set) => ({ appearance: {}, personality: {}, voice: null, name: "", ... }),
    { name: "ag_onboarding_draft", storage: createJSONStorage(() => sessionStorage) },
  ),
);
```

**`sessionStorage`, not `localStorage`, and the choice is deliberate.** On web the analogue of
Android's process death is a refresh, an accidental tab close, or a crashed renderer, and losing four
steps of input to any of those is unforgivable — so persistence is not optional. But `localStorage`
persists across tabs and across weeks, and a half-built companion draft resurfacing in a new tab a
fortnight later is a worse failure than losing it: it is confusing in a way the user cannot
diagnose, and it survives the "close it and start again" instinct that fixes everything else.
`sessionStorage` is scoped to the tab and cleared when it closes, which matches the lifetime of the
intent. The store is cleared on a successful `POST /avatars`, immediately before `/home`.

**Finalize is the only screen that can fail.** Nothing before it touches the network. Its error
state keeps the draft entirely intact and offers retry in place; it never bounces the user back to
step one and never clears the store on failure. That is the most important behaviour in the flow,
because it is the only place four steps of work can be destroyed.

**Back navigation is a real history push and is lossless**, because nothing has been sent. This is
where web is genuinely better than the Android back stack: the browser's back button, the stepper's
completed segments, and `Alt+←` all do the same correct thing, and the state they return to is read
straight out of the store. Android has to reason about `popBackStack` and saved-state ownership to
reach the same place.

### 2.3 Routes are addressable; wizard steps are not

`/onboarding/personality` is a URL, so it can be bookmarked, shared, reloaded, and typed. A wizard
step is a position in a sequence, and position two of a sequence that has not started is not a
renderable thing. This problem does not exist on Android at all.

**Direct access to any step with an empty draft redirects to `/onboarding`** — not a broken step,
not an empty step, not a modal explaining the problem. The check is a client-side guard in the
`(onboarding)` layout, because the draft lives in `sessionStorage` and the server cannot see it:

```tsx
"use client";
// app/(onboarding)/onboarding/[step]/guard.tsx
const started = useOnboardingDraft((s) => s.started);
if (!started) redirect("/onboarding");
```

The `started` flag is set by the intro's "Let's begin" button rather than inferred from whether any
field is filled, because every step is skippable and a draft where the user skipped step 1 is
legitimately empty.

### 2.4 Entry and exit guards

Both directions need handling, and neither belongs in `middleware.ts` — per
[`01-foundation.md`](./01-foundation.md) §7.4 the companion check lives in the `(app)` layout, which
already loads her for the sidebar, because a `GET /avatars` call in middleware sits on the critical
path of every navigation.

**A user with no companion reaching `(app)`** is redirected to `/onboarding` by that layout. **A
user who already has a companion reaching `(onboarding)`** must not be allowed to build a second one
by accident: the `(onboarding)` layout is a Server Component that calls `GET /avatars` and redirects
to `/home` when the list is non-empty. The API supports multiple companions per user; nothing in
this product's UI does, and a second companion has no route that could show it.

---

## 3. The onboarding screens

All five use the onboarding shell ([`01-foundation.md`](./01-foundation.md) §4.2): full viewport, no
navigation, no exit affordance other than the explicit per-step Skip. At `lg`+ the live preview is a
sticky `24rem` left column and the controls scroll on the right.

```text
lg+                                          base
┌────────────────┬─────────────────────────┐  ┌──────────────────┐
│ sticky 24rem   │ controls, scroll        │  │ 72px Avatar      │
│ CompanionAvatar│ Step headline           │  │ Step headline    │
│ 160px + summary│ Style / Hair / Eyes /   │  │ controls stacked │
│                │ Skin / ▸ More options   │  │ ▸ More options   │
│                │ [Skip]        [Continue]│  │ [Skip] [Continue]│
└────────────────┴─────────────────────────┘  └──────────────────┘
```

### 3.1 Intro — `/onboarding`

**Purpose.** Set expectations for a four-step flow and earn the first click. Nothing is collected
here, and nothing can be skipped because there is nothing to skip.

A `display-sm` headline, a line of body copy, and three bullets naming what the user is about to
choose: **her personality, her look, her memory.** The memory bullet does double duty as an early
privacy signal — "she keeps what matters, and you can read and delete all of it" — which is worth
saying before the user has invested anything: a privacy claim made after four steps of input reads
as a disclaimer, and the same claim made before reads as a promise.

At `lg`+ the preview column shows a generic monogram and the line "She starts as a blank slate", so
the split layout is established before it matters. The primary `Button` reads "Let's begin"; a
`Button` link "I'll do this later" routes to `/home` and is bounced back by the `(app)` layout. The
app does not function without a companion; the link exists to make the flow feel non-coercive while
being honest that it loops.

| State | Treatment |
|---|---|
| Default | As drawn |
| Returning with a draft in `sessionStorage` | Primary reads "Continue where you left off" and routes to the furthest completed step |

### 3.2 Step 1 · Appearance — `/onboarding/appearance`

**Purpose.** Give the first choice an immediate visible consequence.

**The live preview is the point.** At `lg`+ it is always on screen, so changing hair colour visibly
changes the avatar with no scroll and no delay — the payoff and the control occupy the same glance.
Below `lg` the preview collapses to a 72px `Avatar` above the controls, which is the compromise
Android lives with permanently.

Four primary choices — style, hair, eyes, skin — with the remaining five behind a progressive
disclosure labelled "More options". Nine pickers on one screen is a form; four is a choice. The
disclosure is a `Sheet` at base and an inline `Accordion` at `md`+, because a desktop viewport has
room to expand in place and pushing content down is less disruptive than covering it.

Style is a `Chip` row. Hair, eyes, and skin are `ColorSwatch` groups — radio groups rendered as
circles, per [`01-foundation.md`](./01-foundation.md) §5.3. **Each swatch needs an accessible name**
("Auburn", "Hazel", "Deep") because colour is not a label. The selected swatch carries a check glyph
as well as a ring, so selection survives greyscale.

| State | Treatment |
|---|---|
| Default | Defaults preselected, preview rendered, Continue enabled |
| Swatch focused | `--focus-ring` outline, offset 2px, on the circle not its container |
| More options collapsed / expanded | Chevron rotates 200ms; `aria-expanded` on the trigger |
| Preview updating | No transition on the avatar — an animated colour change reads as latency |

Writes `appearance.hairColor`, `eyeColor`, `skinTone`, `metadata.style`, and seeds `imagePrompt`
from the combined selection so that image generation, when it exists, has a starting string.

**Skip applies:** `style: "warm"`, `hairColor: "Brown"`, `eyeColor: "Brown"`, `skinTone: "Medium"`,
all five secondary fields omitted. The `appearance` object is still sent (§2.1).

### 3.3 Step 2 · Personality — `/onboarding/personality`

**Purpose.** Turn a face into a person.

Trait chips at the top, **capped at four**. A cap forces a choice; an uncapped list produces a
companion who is every adjective at once and therefore none of them. At the cap the unselected chips
go to `aria-disabled` with a helper line reading "Four is the limit — deselect one to change" rather
than silently ignoring clicks, which is the version of this that gets reported as a bug.

Below, four `Slider` controls mapping to the four real columns, with human labels: **Warmth**
(`empathyLevel`), **Humour** (`humorLevel`), **Playfulness** (`flirtLevel`), **Romance**
(`romanceLevel`). The label is never the field name — "empathyLevel" is a database column and
reading it to a user is a leak of the schema into the product.

**Sliders need keyboard support and a visible numeric value.** Radix's `Slider` gives arrow keys,
`Home`/`End`, and `PageUp`/`PageDown` for free; a hand-rolled div gives none of them. The value sits
as text beside the label, not only in a thumb tooltip, because a pointer-only tooltip has no touch
or keyboard equivalent ([`01-foundation.md`](./01-foundation.md) §5.4).

The preview column updates its summary line as sliders move ("Warm, funny, a little bold") rather
than the avatar, since personality has no visual form. That line comes from the same composer that
builds `systemPrompt`, so the user is previewing the actual prompt in human words.

| State | Treatment |
|---|---|
| Default | Sliders at the service defaults; no traits selected |
| Four traits selected | Remaining chips `aria-disabled`, helper line shown |
| Slider dragging | Value text updates live; no `aria-live` announcement per pixel (§5) |
| Reduced motion | Thumb moves without the settle transition |

**Skip applies:** `traits: []`, and the four levels at exactly the values `AvatarsService.create`
would otherwise apply — `humorLevel: 5`, `flirtLevel: 5`, `empathyLevel: 7`, `romanceLevel: 5`.
Sending them explicitly keeps the client's preview honest about what was created.

### 3.4 Step 3 · Voice & framing — `/onboarding/voice`

**Purpose.** Choose how she sounds, and what she is to the user.

**Voices are playable.** Each voice card has a play control that plays a two-second sample. Choosing
a voice from a text label — "Warm, mid-range" — is guesswork, and a voice the user did not audition
is the setting most likely to be regretted and least likely to be found again in settings.

On web this needs one rule: **a single shared `<audio>` element, not one per card**, so two samples
cannot overlap. Playing card B pauses and resets the shared element before setting the new `src`.

```tsx
const audio = useRef<HTMLAudioElement>(null);
function play(url: string) {
  const el = audio.current!;
  el.pause(); el.src = url; el.currentTime = 0; void el.play();
}
```

Playback state is per card: idle, loading, playing. The play control's accessible name is "Play a
sample of Aria's voice", not "Play". **Whether the samples are bundled clips or synthesised on
demand is open** (§6) — bundled is instant and works offline, synthesised is accurate to what the
user will actually hear.

**Skipping this step must still write a voice.** `VoiceService.synthesize` and `VoiceService.respond`
both load `CompanionVoice` and throw `NotFoundException('Companion voice not configured')` when it is
absent (`apps/api/src/voice/voice.service.ts`). Because `AvatarsService.create` only inserts the row
when `provider` **and** `voiceId` are both present, omitting the object or sending a partial one
produces a companion for whom voice is permanently broken until she is edited — with no error at
creation time to suggest it. The default therefore carries both keys.

Relationship framing sits below as a four-chip `Chip` group — Girlfriend, Partner, Close friend,
Something new — writing `personality.metadata.relationshipType` and feeding the `systemPrompt`
composer. It shares this step rather than owning one because it is a single choice, and a screen
holding one chip row is a step the user resents.

| State | Treatment |
|---|---|
| Default | First voice preselected and visibly marked, framing default selected |
| Sample loading | Spinner replaces the play glyph, control stays the same size |
| Sample playing | Pause glyph; progress is not shown for two seconds of audio |
| Sample failed | Card stays selectable, inline "Sample unavailable" in `body-sm` — a failed preview must never block the choice |

**Skip applies:** `provider: "gemini"`, `voiceId` set to the default prebuilt voice name,
`language: "en"`, `speed: 1`, `pitch: 1`, and `relationshipType: "girlfriend"`.

### 3.5 Step 4 · Finalize — `/onboarding/finalize`

**Purpose.** Name her, show what was built, and commit.

A preview `Card` at the top — avatar, chosen traits, and a one-line voice and relationship summary —
then the name `TextField`, then the primary `Button`. At `lg`+ the preview column already holds the
avatar, so the card here reduces to the summary text and the layout does not repeat itself.

**The CTA reads "Meet {name}" and updates live as they type**, falling back to "Meet her" while the
field is empty. That live update is why naming is last (§2): the button becomes an introduction
rather than a form submission.

Name is the only required field: 2–100 characters after trimming, validated by a zod schema
mirroring `@Length(2, 100)`. Per [`01-foundation.md`](./01-foundation.md) §5.2 the button stays
enabled while the field is invalid and validation runs on click, moving focus to the field with the
error announced — a greyed-out button tells a screen-reader user nothing about what is wrong.

On submit the client composes `systemPrompt` and `greeting` from the draft, assembles the DTO, and
issues one `POST /api/bff/avatars`. On success it clears the store and `router.replace`s to `/home`
— `replace`, not `push`, so back does not return to a wizard whose draft no longer exists.

| State | Treatment |
|---|---|
| Default | Preview rendered, name empty, CTA "Meet her" |
| Typing | CTA label updates; no validation shown until submit |
| Invalid on submit | `TextField` error, focus moved, `role="alert"` on the message |
| Submitting | Button shows spinner at preserved width, `aria-busy`, fields read-only |
| Failed | `Banner` above the card with the reason and a retry action. Draft untouched. Never navigates. |
| Offline | Banner stating nothing will send until connectivity returns; the button is the one place a disabled state is correct |

Skip behaviour: none. There is no companion without a name.

---

## 4. Home — `/home`

**Purpose.** Make it immediately obvious that this is a relationship with a specific person, and get
the user into conversation in one click. It is the most-visited screen in the product and the one
most at risk of turning into a dashboard.

### 4.1 Layout

At base it is Android's single scroll, and correctly so: greeting line, companion, her last message,
primary CTA, three quick actions, memory highlight.

At `lg`+ the sidebar already shows her persistently — avatar, name, presence, per
[`01-foundation.md`](./01-foundation.md) §4.2 — so Home repeating that verbatim would waste the one
thing the extra width bought. The width instead buys a two-column arrangement: **she and her last
message hold the primary column**, at a scale the sidebar cannot manage (128px `CompanionAvatar`,
name in `display-md` Fraunces, her message in an incoming `ChatBubble`), while the **memory
highlight, plan badge, and usage strip sit in a narrower secondary column**.

```text
lg+  sidebar │ greeting
             │ ┌── primary 2fr ─────────────┐ ┌── secondary 1fr ──┐
             │ │ CompanionAvatar 128        │ │ Memory highlight  │
             │ │ Aria  display-md           │ │ --tertiary-       │
             │ │ ● Active now               │ │   container       │
             │ │ "…her last message…"       │ │ Plan badge        │
             │ │ [ Continue talking ]       │ │ Usage strip       │
             │ │ ▢ ▢ ▢  quick actions       │ └───────────────────┘
             │ └────────────────────────────┘
base         companion → last message → CTA → quick actions → memory
```

**The companion occupies the top half and nothing competes with her.** The failure mode this brief
warns against is a grid of stat cards — messages sent, days together, memories stored — which is
what happens when a designer is handed a wide viewport and a set of numbers. The secondary column
is capped at two cards and everything in it is one row tall. If a third thing ever wants to live
there, something else leaves.

**The memory highlight is the most valuable widget on this screen.** A single line — "She remembered
your sister's name this week" — does more to communicate the product's differentiator than any
amount of copy elsewhere. It is a `Callout` on `--tertiary-container`, the memory colour, so the
association with the Memory tab is built by colour before the user has read a word. It links to
`/memory/[id]`, not to `/memory`, because the specific memory is the point.

### 4.2 Data

| Element | Endpoint |
|---|---|
| Companion identity | `GET /avatars` — list, first `ACTIVE` |
| Last message | `GET /conversations`, then `GET /conversations/:id/messages` |
| Memory highlight | `GET /memories?limit=1` — sorted by importance |
| Plan badge | `GET /subscriptions/current` |
| Usage strip | `GET /usage/summary` |

All five go through the BFF ([`01-foundation.md`](./01-foundation.md) §7.2) from the server
component, dehydrated into the page rather than refetched on mount (§6 of the same document).

`GET /avatars` already filters `status: 'ACTIVE'` server-side (`avatars.service.ts` `findAll`), so
"first ACTIVE" is a formality — but it also means an archived companion is indistinguishable from no
companion. Both are an empty array, which constrains the archived state in §4.4. `GET /conversations`
orders by `lastMessageAt` descending, so the first element is the right conversation with no
client-side sorting.

**`GET /memories` applies `limit` before its filters.** `MemoriesService.findAll` takes the top
`limit` rows by importance and *then* filters the result in memory by `type`, `companionId`, and
`conversationId`. With `?limit=1` and no filters — which is what Home sends — this is correct, but
adding a `companionId` filter alongside a small limit can return an empty array while matching
memories exist. Home must never add that filter, and the ordering is worth fixing on the backend
before a second companion is possible. The same method also runs an unrelated vector search with a
hard-coded query string and `console.log`s the result on every call, on Home's critical path.

### 4.3 Two of those five endpoints are unguarded

`SubscriptionsController` and `UsageController` carry no `@UseGuards(JwtAuthGuard)`. They fail
differently, and the difference matters.

**`/usage/summary` fails loudly.** It reads `req.user.id` where `req.user` is undefined without a
guard — a `TypeError`, surfacing as a 500. Note also that even once a guard is added, the JWT
payload uses `sub`, not `id` (`avatars.controller.ts` and every guarded controller read
`user.sub`), so the property is wrong as well as unreachable.

**`/subscriptions/current` fails quietly**, which is worse. It reads `request.user?.sub` with
optional chaining, so it resolves to `Number(undefined)` — `NaN` — and queries for a subscription
belonging to no one. The result is not an error; it is an empty result that renders as "Free" for a
paying user. A wrong plan badge shown confidently is a support ticket that starts with "I've been
charged".

**Home degrades rather than erroring.** The plan badge and usage strip are wrapped in `<Suspense>`
with an error boundary inside, per [`01-foundation.md`](./01-foundation.md) §6. A failure hides the
section — no error card, no retry, no toast. Neither is load-bearing, and an error state for a
decoration teaches the user the app is broken when the only broken thing is a badge. Until the
guard is added, the plan badge is untrusted and shown only when the response is unambiguous.

**The last message costs two requests**, because `GET /conversations` returns no message preview.
Home fetches the newest conversation and then its messages purely to read the final element. Adding
a `lastMessage` snippet to the conversation list would remove a round trip from the most-visited
screen — a small backend change with a disproportionate payoff. On web the damage is smaller than
on Android: both fetches happen on the server, sequentially, inside one render, so the user pays
server-to-server latency rather than two browser round trips. Smaller, still worth fixing, and it
becomes the difference between a fast and a slow LCP the moment the API is not co-located
([`01-foundation.md`](./01-foundation.md) §12).

### 4.4 States

| State | Treatment |
|---|---|
| Cold load | `Skeleton` mirroring the real layout — avatar circle, name bar, bubble, button — so nothing jumps when data arrives |
| Warm load | Hydrated companion renders immediately from the Query cache; only the last message and memory revalidate |
| Loaded | As drawn |
| First run, no messages | Her `Companion.greeting` in the incoming bubble, CTA reads "Say hello", no memory card, no usage strip |
| Offline | Cached companion and last message with a `role="status"` banner; the CTA still navigates and chat opens read-only |
| No companion | Should be impossible — the `(app)` layout redirects to `/onboarding` before Home renders (§2.4) |
| Companion archived | Indistinguishable from no companion via `GET /avatars`; treated identically, redirected to `/onboarding` with an explanatory `Callout` on the intro |
| Near usage limit | One `--warning-container` strip above the quick actions, **only above 80%**, with the number and the limit as text |

The usage strip's threshold is a design decision, not a technicality: a usage meter that is always
present turns a companion into a metered utility. Above 80% it is useful information; below 80% it
is a reminder that the user is being counted.

### 4.5 The time-of-day greeting cannot be server-rendered

"Good evening, Vipin" is derived from the browser's clock. The server has no idea what time it is
where the user is, so a server-rendered "Good evening" and a client that computes "Good morning"
produce a hydration mismatch — React logs an error and, in the worst case, discards and re-renders
the subtree.

Three fixes, in order of preference. **Render the neutral form on the server** ("Hello, Vipin") and
refine it in a `useEffect` on the client; the swap is one word, above the fold, and invisible in
practice. Or **render the greeting client-only** behind a mounted check, accepting one frame of
absence. Or **suppress hydration warnings** on that node, which silences the symptom and leaves the
mismatch, and is therefore not a fix. This trap has no Android analogue, and it ships as a console
error nobody reads until it takes a real component down with it. Her message bubble is real data
and has no such problem.

---

## 5. Accessibility

The general rules are in [`01-foundation.md`](./01-foundation.md) §9; these are the ones specific to
these six surfaces.

**The avatar is decorative when her name is adjacent.** `alt=""` on the image, not `alt="Aria"` —
otherwise a screen reader announces her name twice in succession.

**The presence dot is never alone.** It is paired with the visible text "Active now". A coloured
dot is colour-only communication, and it is the single most common violation in a chat product.

**Wizard progress is announced.** The stepper is a `<nav aria-label="Onboarding progress">` with
`aria-current="step"` on the active segment, plus a visually-hidden "Step 2 of 4" in the step's
heading. Without both, a screen-reader user has no landmark in a flow that has deliberately removed
all other navigation.

**Slider values are announced as the human label plus the value** — "Warmth, 7" — via `aria-label`
and `aria-valuetext` on the thumb, never the field name. Announcements fire on commit rather than
on every pixel of a drag. **Sliders are keyboard-operable**: arrows for single steps, `Home`/`End`
for the extremes, `PageUp`/`PageDown` for coarse movement. Radix provides all of this; a hand-rolled
control provides none.

**Swatches have accessible names** because colour is not a label (§3.2), and each group is a real
`RadioGroup` so arrow keys move between options and `Tab` moves past the group rather than through
every circle in it.

**Home is one document with real heading boundaries.** `<h1>` is the greeting; `<h2>` for the
companion, her message, quick actions, and the memory highlight. Not `<div class="headline-sm">`.
The skip link targets `<main id="main">`.

---

## 6. Decisions

**Settled.** Appearance before personality; name last; every step skippable with documented
defaults; one commit at Finalize; four sliders rather than the PRD's eight traits; relationship
framing into `personality.metadata`. Web-specific and settled here: the draft persists to
`sessionStorage` rather than `localStorage`; direct URL access to a step with no draft redirects to
the intro; the `(onboarding)` layout guards against a user who already has a companion; Home splits
into two columns at `lg`+ rather than repeating the sidebar's identity block; the plan badge and
usage strip are `<Suspense>` islands that vanish on failure.

**Open, and worth answering before these become screens.**

**Gender is not asked.** It is sent as `FEMALE` and is changeable in companion settings later. The
product is named "AI girlfriend", so asking at onboarding feels redundant — but `CompanionGender`
supports `MALE` and `OTHER`, and if the product intends to serve those users, the question belongs
in step 1 rather than buried in settings where it will never be found. Adding it costs one chip row
on a step that already has one.

**Voice samples need audio assets.** Playing a two-second sample per voice requires either bundled
clips or a synthesis call during onboarding. Bundled is instant, works offline, and costs nothing
per user; synthesised is accurate to what the user will actually hear and requires the voice
endpoints to be guarded and correctly prefixed first
([`01-foundation.md`](./01-foundation.md) §8.2). Bundle four short clips and accept the small
mismatch.

**The avatar is a monogram rather than an image.** There is no image generation anywhere in the API,
and `POST /avatars/:id/avatar` accepts only a manual upload. Every screen in this document shows a
lettered monogram on `--primary-container`, which looks deliberate rather than broken, but it is a
placeholder for imagery the product eventually needs — and on web, where the viewport is large and
the companion is meant to hold the top half of Home, the absence is more conspicuous than it is on a
phone.

**Whether the wizard should offer a backstory field at all.** It folds into `systemPrompt` and
works, but it is a free-text box on a flow whose argument is that choices should be fast and visual.
It is not in the wizard; it is reachable from companion edit. If it earns a place, it belongs on
Finalize as an optional disclosure, not as a sixth step.
