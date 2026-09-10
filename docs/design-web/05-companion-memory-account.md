# Web Design Task 3c — Companion, Memory, Account & System

Fifteen surfaces covering the parts of the product where users manage the relationship rather than
live in it, plus the four system screens the web client needs and Android does not. Screens #16–30 of
the inventory in [`01-foundation.md`](./01-foundation.md) §11.

Tokens, breakpoints, shells, and the component vocabulary come from
[`01-foundation.md`](./01-foundation.md) and are referenced rather than restated. The settled product
decisions are ported from the Android equivalent,
[`docs/design/05-companion-memory-settings.md`](../design/05-companion-memory-settings.md), and this
document differs from it only where the web has a reason to. Visual reference:
`canvases/web-companion-memory-account.canvas.tsx`.

Everything asserted here about the API was read from `apps/api/src`. Where a thing is broken rather
than merely missing, it is described as broken.

---

## 1. Companion profile

`/companion/[companionId]` — a Server Component, since it reads cookies and renders no interactive
state beyond two buttons.

**Purpose: present her as a character, not a row in a table.** This is a profile page for a person and
should read closer to a contact card than a settings screen. The distinction is not decorative — it is
the difference between a user who feels they have someone and a user who feels they have configured
something, and the layout is most of what carries it.

**Layout.** A 128px `CompanionAvatar` (§5.5), her name in Fraunces `display-md` — one of the five
places Fraunces is permitted at all (§3.1) — and beneath it a relationship line: "Your girlfriend ·
5 weeks together". Then trait chips, four labelled `Meter`s for the personality levels, a
`SectionCard` grouping appearance, voice, and memory count, and archive at the bottom.

**The four meters are read-only bars here rather than sliders.** This is a view screen and the edit
affordance is a separate action; making the meters draggable would mean every scroll gesture on a
touch device, and every stray wheel event under a pointer, risks changing her personality. A slider
that silently commits is worse than a bar that requires one extra click to reach.

**"5 weeks together" is computed client-side from `Companion.createdAt`.** It costs one date
subtraction and no endpoint, and it does real work: it frames the companion as a relationship with
duration rather than a configuration with a modified date. `Companion.createdAt` is present on the
model (`apps/api/src/prisma/contract.prisma`) and comes back on `GET /avatars/:id`, so this is free.

**Responsive behaviour.** At base width everything stacks in one column inside the 20px gutter:
avatar, name, relationship line, traits, meters, groups, archive. At `lg` and above the extra width
buys a genuine improvement rather than a wider column — the identity block (avatar, name, relationship
line, traits) becomes a sticky left column of `20rem`, and appearance, voice, and personality sit as
three `SectionCard`s in a two-column grid beside it rather than stacking. Her face stays visible while
the reader scrolls her details, which is the whole point of a profile page and is impossible on a
phone. Content caps at `64rem`; past that the grid centres rather than growing.

**Data.** `GET /avatars/:id`. `AvatarsService.findOne` (`apps/api/src/avatars/avatars.service.ts`)
fetches the companion and then the `CompanionAppearance`, `CompanionPersonality`, and `CompanionVoice`
rows separately and returns them as nested objects, so one request populates the entire screen. Each
nested object may be `null` — `create` only writes them when the corresponding DTO block was supplied
— so every field on this screen needs a null branch, and a missing personality row means four meters
with no values rather than four meters at zero. Render the group as "Not set" with a link to edit.

### 1.1 Archive, not delete

`DELETE /avatars/:id` does not delete. `AvatarsService.remove` sets `status = 'ARCHIVED'` and returns
`{ message: 'Companion archived successfully' }`.

**The button therefore says "Archive Aria".** Labelling it Delete would be a lie, and a discoverable
one: the user would archive her expecting the data gone, and later find her recoverable. The
confirmation `Dialog` says so explicitly — conversations and memories are kept — because a
confirmation that describes the wrong consequence is worse than no confirmation.

**Then the honest part, which is worse than the Android doc records.** There is no un-archive
endpoint: `AvatarsController` exposes create, list, get, patch, delete, and avatar upload only. Both
`findAll` and `findOne` filter on `status: 'ACTIVE'`, so an archived companion 404s on `GET
/avatars/:id` as well as vanishing from `GET /avatars`. And `update` calls `findOne` before writing,
so `PATCH /avatars/:id` cannot be used to flip the status back either. An archived companion is
unreachable through the API in every direction while still existing in the database. The dialog copy
must not promise reversibility, and the gap table below carries this as a should-fix.

---

## 2. Companion edit

`/companion/[companionId]/edit` — a client island, because it is a form.

Name, trait chips, the four personality `Slider`s, the appearance fields, and voice. At `md` and above
these are `Tabs` (Appearance · Personality · Voice), which matches the onboarding wizard's grouping and
keeps any single view short enough to see whole. Below `md` the tabs collapse to one scroll with `<h2>`
section headings, because a tab bar on a 360px screen either truncates its labels or steals a third of
the vertical space above the fold.

**Data.** `PATCH /avatars/:id` accepts the same nested shape as create — `UpdateAvatarDto` mirrors
`CreateAvatarDto` with everything optional — and `AvatarsService.update` upserts each nested block, so
a partial patch containing only `{ personality: { flirtLevel: 7 } }` is valid and safe. Send only the
dirty blocks; react-hook-form's `dirtyFields` gives this for free.

**Changing personality warns rather than blocks.** An inline `Callout` on `--tertiary-container`
above the sliders: "Changing her personality affects how she talks from here on. Everything she
already remembers stays." The alternative — a confirmation dialog on save — treats an intended edit as
a mistake. Without any note at all, a user who nudges a slider finds their companion talking
differently later with no visible cause, and reads that as the product breaking rather than as their
own change. Warning is cheap; blocking is patronising; silence is the only option that produces a
support ticket.

**Unsaved changes surface as a persistent bottom bar, not a dialog on navigation.** The bar sits above
the composer-free bottom edge on `--surface-container-high` and reads "2 unsaved changes · Discard ·
Save". A dialog only appears after the mistake; the bar is visible the entire time the mistake is
possible.

**On web the bar is doing more work than its Android counterpart.** Android can intercept the back
gesture and show a dialog as a backstop. App Router cannot reliably intercept client-side navigation —
there is no supported route-change guard, and the community workarounds all involve patching the
router or hijacking link clicks, which breaks in ways that are hard to test and worse than the problem.
So the bar is not a nicer alternative to an interception dialog; it is the only mechanism available for
in-app navigation. A `beforeunload` handler covers the two cases the browser does surface — tab close
and refresh — and nothing else:

```tsx
useEffect(() => {
  if (!isDirty) return;
  const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
  window.addEventListener("beforeunload", onBeforeUnload);
  return () => window.removeEventListener("beforeunload", onBeforeUnload);
}, [isDirty]);
```

Register it only while dirty. A permanently attached handler disables the back/forward cache for the
whole page, which makes every back navigation a full reload.

### 2.1 Avatar upload

`POST /avatars/:id/avatar` takes a multipart `file` field and enforces ≤5MB and
`image/(jpeg|png|webp)` through `ParseFilePipe` in `avatars.controller.ts`.

On web this is a drop zone with a visible `<input type="file">` inside it, not a drop zone alone — a
drop target with no click affordance is invisible to keyboard users and unusable on a touch device
with no filesystem to drag from. The zone shows a dashed `--outline` border, switching to
`--primary-container` fill on `dragover`.

**Validate size and type client-side before uploading.** The `File` object carries `size` and `type`,
so both server-side rules can be checked for free, and a rejected 5MB upload otherwise costs the user
their entire bandwidth budget to be told no. Show the failure inline against the drop zone with the
actual limit ("That image is 8.2MB. The limit is 5MB."), then a preview from `URL.createObjectURL`
before commit and `revokeObjectURL` after.

One backend caveat found while reading the handler: in `AvatarsService.uploadAvatar` the branch that
runs when no `CompanionAppearance` row exists yet calls
`CompanionAppearance.create({ data: { … } })`, wrapping the fields in `data` where every other call in
the file passes them directly. If the contract client does not accept that shape, the first-ever
avatar upload for a companion created without an appearance block fails while every subsequent upload
succeeds. Worth a backend test; the client should surface the error honestly rather than optimistically
swapping the image.

---

## 3. Memory

`/memory` is a top-level destination, not a settings sub-page. That placement is the argument: user
control over what she remembers is the product's trust story, and this is the one screen where the
product can *prove* it is trustworthy instead of claiming it in a privacy policy. Everything below
follows from treating it as a first-class surface.

### 3.1 List

A header line that states both the count and the permission: "47 things Aria remembers about you. Edit
or delete anything here — she'll forget it immediately." Then a filter chip row by `MemoryType`, then
memory cards.

Each card carries a coloured type badge, a relative time from `createdAt`, the content in plain
language at `body-lg`, and an importance bar. Cards are `--surface-container-low`, 20px radius, with a
`--state-hover` lift and the whole card as one link to the detail route.

**Each `MemoryType` gets its own container colour**, so the list is scannable by shape and colour
before it is read. The enum is the natural grouping and colour makes it free to parse. The real enum,
from `contract.prisma` and duplicated in both memory DTOs, has five members — the Android doc names a
`PERSONAL` category that does not exist. Use the enum:

| `MemoryType` | Badge container | Text token | Reads as |
|---|---|---|---|
| `PROFILE` | `--primary-container` | `--on-primary-container` | Profile |
| `PREFERENCE` | `--tertiary-container` | `--on-tertiary-container` | Preference |
| `RELATIONSHIP` | `--success-container` | `--on-success-container` | Relationship |
| `FACT` | `--secondary-container` | `--on-secondary-container` | Fact |
| `CONVERSATION` | `--surface-container-highest` | `--on-surface-variant` | From a chat |

`CONVERSATION` gets the neutral surface deliberately. It is the most incidental category and the one
least likely to be acted on, and giving it a fifth saturated colour would put five competing accents in
a scrolling list, which defeats the reason for colouring them at all.

**Importance is 1–10, not 0–100, and the Android doc has this wrong.** Three sources agree on the real
scale: the schema comments `// 1-10 importance score.` with `@default(5)`;
`MemoryImportanceService.normalizeScore` clamps to `Math.max(1, Math.min(10, …))`; and the extraction
prompt in `memory-extractor.service.ts` defines the bands as 1–3 Low, 4–6 Medium, 7–8 High, 9–10
Critical. The same service refuses to store anything below 4 (`minimumStoreScore = 4`), so live values
occupy 4–10 in practice. Meanwhile `UpdateMemoryDto` validates `@Min(0) @Max(100)`. That mismatch is a
bug, not a scale choice, and it matters to this screen twice over: a client that PATCHes 92 writes a
value nothing else in the system understands, and because the list is ordered `importance desc`, that
one memory sorts permanently above every memory the extractor ever produced. **The importance slider is
therefore bounded 1–10 with integer steps**, and the gap table carries the DTO bound as a should-fix.

**Importance gets a bar plus a number; in detail view it also gets a plain-language reading**, because
a bare integer means nothing on its own. The readings map onto the extractor's own bands rather than
being invented here — 9–10 "she'll bring this up unprompted", 7–8 "she'll remember this in context",
4–6 "she knows this" — which keeps the copy and the model's behaviour describing the same thing.

**Confidence stays a raw number (0.94).** Unlike importance it is diagnostic rather than actionable:
the user cannot change it, and it does not affect any behaviour they control. Dressing it in plain
language would imply it is a setting, and users adjust things that look like settings.

**Data, and two problems with it.** `GET /memories?type=&companionId=&conversationId=&limit=`, with
`limit` defaulting to 50 and capped at 100 by `ListMemoriesDto`.

The first problem is the one the Android doc flags: **there is no pagination beyond `limit`.** No
cursor, no offset, no total count. A user with 300 memories cannot reach all of them through this
endpoint at all, and the header line's count is the length of the returned array rather than a true
total. Write the header against what is actually known ("47 things Aria remembers") only while the
result is shorter than the limit; at the limit it has to read "Showing your 100 most important
memories", which is honest and also a standing argument for fixing the endpoint.

The second problem is worse and is not recorded anywhere else. **`MemoriesService.findAll` applies
`limit` in the database and then applies the `type`, `companionId`, and `conversationId` filters in
JavaScript afterwards.** The query fetches the top *N* by importance and only then filters the array.
So `?type=FACT&limit=50` does not mean "50 facts" — it means "whichever of your 50 most important
memories happen to be facts". A user whose top 50 contains no `FACT` rows sees an empty `FACT` filter
while facts exist. Until that is fixed, the filter chips must not display per-type counts, and an empty
filtered result needs copy that does not assert emptiness: "No facts in your most important memories"
rather than "She hasn't learned any facts about you". Server-side filtering before the limit is a
one-line backend fix and is in the gap table.

While reading that method: it also calls `memorySearchService.searchRelevantMemories(userId,
query.companionId ?? 1, 'Where should I travel for a mountain vacation?')` and `console.log`s the
result on every request. That is leftover debug code. It costs an embedding round-trip on every load
of the memory list, and the `?? 1` fallback runs a similarity search against companion 1 — which for
most users is somebody else's companion. It must be deleted before this screen is put in front of
anyone.

**Filters live in the URL as search params, not in component state.** `/memory?type=PREFERENCE` is a
real, shareable, refreshable address, it works with the back button, and it survives the tab being
restored. Component state gets none of that: a user who filters, opens a memory, and presses back
lands on an unfiltered list and has to filter again. This is the web-native form of what Android does
with a chip row — the chips are still chips, they are just reading and writing `useSearchParams` and
`router.replace` instead of `useState`. It also means the list can stay a Server Component that reads
`searchParams` and fetches the filtered set on the server, with only the chip row hydrated.

### 3.2 No "Add memory" button

`POST /memories` does not exist. `MemoriesController` has exactly four handlers — list, get, patch,
delete — and there is no create anywhere in the module.

Rather than a button that cannot work, the screen states the model plainly where the button would be:
memory comes from talking to her. She notices things and writes them down; there is nothing to fill in.

**This is arguably the better product anyway.** Hand-authored memories are a chore, and the magic is
precisely that she noticed without being told. But that is a rationalisation of a constraint, not the
reason for it, and it should be recorded as such: manual entry needs a backend endpoint before it can
be designed. The schema is already half-expecting one — `MemorySource` includes a `USER_INPUT` member
that nothing in `apps/api/src` ever writes.

### 3.3 Detail and edit

`/memory/[memoryId]` — an editable content `TextArea`, type `Chip`s, an importance `Slider` bounded
1–10, and a read-only provenance `SectionCard`: source (`MemorySource`), first remembered
(`createdAt`), and confidence.

Provenance stops there deliberately. `Memory.accessCount` and `Memory.lastAccessedAt` exist on the
model and would make excellent provenance — "recalled 12 times" is exactly the kind of detail that
makes a memory system feel real — but nothing in the codebase ever increments them. The extractor
writes `accessCount: 0, lastAccessedAt: null` at creation and no retrieval path updates either.
Displaying them would show every memory as never recalled, which is a confident lie. They are omitted
until something writes them.

**The detail is a route, not local state**, rendered as a `Sheet` at base width and as a split pane
beside the list at `xl` and above, per [`01-foundation.md`](./01-foundation.md) §4.1. It is the one
overlay in the app that is a route rather than component state (§4.3), and the reason is specific to
what a memory is: a discrete thing a user might want to link to, bookmark, return to, or send to
support. Everything else that opens over a page in this product — dialogs, menus, the voice composer —
is a transient mode with nothing worth addressing.

`PATCH /memories/:id` accepts `content`, `type`, `importance`, `confidence`, and `expiresAt`. Only the
first three are exposed; `confidence` is the model's own reading and offering it as an input would
invite users to overwrite a diagnostic, and `expiresAt` has no place in a UI that has never explained
that memories can expire. `DELETE /memories/:id` returns `{ id, deleted: true }`.

**One honesty note about deletion.** `MemoriesService.remove` is a soft delete: it sets
`status = 'DELETED'` and stamps `deletedAt`, leaving the row in place. Behaviourally the header line's
promise holds — every read path filters on `status: 'ACTIVE'` and `deletedAt: null`, so she genuinely
stops knowing it immediately — and that is what the UI should say, because it is what the user cares
about. But the copy must not extend to "erased" or "gone from our servers", because that is false, and
the difference becomes a legal question the moment anyone files a data request. Hard deletion, or a
retention job, belongs on the backend list.

### 3.4 Memory & privacy

`/memory/privacy` — an explanation card, three stat tiles, controls, and a destructive clear-all.

**The explanation says what she does *not* do, first.** "She doesn't store your conversations as
memories. She writes down individual things she learns about you — and you can read and delete every
one." The most common fear about a product like this is a transcript sitting on a server, and a page
that opens by explaining how helpful memory is answers a question nobody asked. Correcting the fear
first earns the right to explain the rest.

Three stat tiles: total memories, most common type, and the date of the earliest memory. All three are
derived from the same list response, so the page costs no additional request.

**Two controls are shown disabled with their reason.** "Pause new memories" would need a flag on the
extraction path and there is none. "Export my data" has no endpoint. Both stay visible per the
disabled-not-hidden principle in §4, each with a one-line reason beneath the label.

**Clear-all requires typing DELETE, is unrecoverable, and has no bulk endpoint.** The client iterates
`DELETE /memories/:id`, which turns one button into N requests and makes progress and partial failure
part of the design rather than an implementation detail. Concretely: the button enters a busy state and
is replaced in place by a determinate `Meter` reading "Deleting 23 of 47", driven by a small
concurrency-limited queue — four at a time, not 47 in parallel, because 47 simultaneous requests
through the BFF is a self-inflicted rate limit. The list behind it does not optimistically empty;
rows disappear as their deletes resolve, so what the user sees is what has actually happened. On
completion with failures, the state becomes a `Banner` on `--error-container`: "Deleted 44 of 47. 3
couldn't be deleted." with a Retry that runs only the failures. Cancel is available throughout and
stops the queue after the in-flight request, leaving a partially cleared list — which is why the
confirmation dialog says "clear" rather than "clear everything", since an interrupted run cannot
promise everything. The whole progress region is a live region (§9).

---

## 4. Account

`/account` — the You tab. A profile card at the top (display name, email, plan badge), then four
`SectionCard` groups — Companion, Privacy, Subscription, App — and Log out isolated at the bottom with
a gap above it. Log out is separated because it is the one row in the list whose effect is immediate
and total, and a row that logs you out should not sit adjacent to a row that opens a settings page.

At `md` and above the groups sit in a two-column masonry-free grid; at `lg` the content caps at `56rem`
rather than filling the shell, because a settings list at 1400px wide is a row of labels with a metre
of empty space between them and their values.

**Disabled rows, not hidden ones.** Where an endpoint is missing, the row stays visible, is disabled,
and carries a one-line reason. Users go looking for "change password"; not finding it at all reads as a
broken app, whereas finding it greyed out with a reason reads as an incomplete one — and an incomplete
app that knows what it is missing is a much better impression than a complete-looking app with a hole
in it. Disabled rows use `aria-disabled` and stay focusable, per [`01-foundation.md`](./01-foundation.md)
§5, precisely so the reason can be read.

**The gallery is the exception.** A whole destination containing nothing is worse than no destination,
because the reason cannot be attached to it — a navigation item cannot carry an explanatory subtitle.
See §6.

### 4.1 Account & security

`/account/security`.

**Display name is editable.** `PATCH /users/me` accepts `displayName` and nothing else —
`UpdateUserDto` has one property, `@Length(2, 100)` — and `UsersService.updateMe` explicitly builds an
update object containing only that field. Inline edit with the same 2–100 validation client-side.

**Email and password are not editable, and both rows are shown disabled.** There is no email-change
endpoint. There is no change-password endpoint anywhere in the auth module: `auth.controller.ts`
exposes `register`, `login`, `logout`, `me`, and `refresh`, and that is the complete list.

**Change password is the more serious of the two, and it is a genuine blocker.** An account system
without it is not shippable — a user who suspects their password is compromised has no action
available except deleting the account. It also blocks the forgot-password and reset-password screens
designed in [`02-authentication.md`](./02-authentication.md), which are already flagged off in the
inventory for the same missing backend work, and it compounds a problem
[`01-foundation.md`](./01-foundation.md) §7.1 already records: nothing currently invalidates existing
sessions, so even once a password change exists it will need to revoke sessions to mean anything.

**Web adds a third disabled row.** This is where a session list belongs — "Sign out of all devices",
and ideally a list of active sessions with their creation dates. The `Session` model exists in
`contract.prisma` with `userId`, `expiresAt`, `createdAt`, and a `metadata` JSON column that is
presumably meant for a user agent string. There is no endpoint to list sessions and none to revoke
one. On web this matters more than on Android: a browser session is far more likely to have been left
open on a shared or public machine, and "sign out everywhere" is the only remedy a user has for that.
Show the row disabled. It is worth showing precisely because its absence is a real security gap rather
than a missing convenience.

### 4.2 Delete account

A `Dialog` from `/account/security`, calling `DELETE /users/me`. Requires typing a confirmation word;
the field is labelled with the exact word required rather than only mentioning it in the body text.

The copy enumerates what goes, in the order the user will care: the account, her, every conversation,
and everything she remembers. `UsersService.deleteMe` deletes the user's `Session` rows and then the
`User`, and the schema's `onDelete: Cascade` on `Companion`, `Memory`, and `Session` carries the rest —
so unlike archiving a companion, this one really is a deletion and the copy can say so plainly.

Note that `deleteMe` does not require a password. The typed confirmation is therefore the only barrier
between a hijacked session and permanent data loss, which is another reason the session-revocation gap
above is not cosmetic.

### 4.3 Appearance & theme

`/account/appearance` — light, dark, system, as a `RadioGroup` of three preview cards rather than a
select, because the choice is visual and a preview is worth more than a label.

Entirely client-side and persisted to `localStorage`; there is no user-preferences endpoint and this
does not need one. The cross-cutting requirement is in [`01-foundation.md`](./01-foundation.md) §2.6:
the class must be on `<html>` before first paint via a blocking inline script, so switching here must
write the same `localStorage` key that script reads, and it must also set `color-scheme` or native
form controls and scrollbars stay light inside a dark app. The theme therefore cannot be persisted
server-side without reintroducing the flash for the first paint of every session.

### 4.4 Privacy & data

`/account/privacy` — three prose blocks and one disabled row. What is stored: the account, the
companion's configuration, conversation history, and extracted memories. What is not: payment details
(there is no payment integration at all — §5), and no third-party analytics as of this design. Then
links to `/memory/privacy` for the controls that do exist.

"Download my data" is a disabled row with its reason. **The GDPR posture gap is real and should be
named here rather than discovered later.** The product has no export endpoint, so it cannot satisfy a
data-portability request without a manual database query; deletion is covered by `DELETE /users/me` for
the account as a whole but memory deletion is soft (§3.3), so a right-to-erasure request is not
actually satisfied by the button the UI offers. Neither is a design problem, but both are
launch-blocking legal problems in the EU and UK, and the design cannot pretend otherwise by shipping an
export button that does nothing.

### 4.5 Notifications

Disabled, with the reason. There is no notifications module in `apps/api/src` — the thirteen modules
are auth, users, avatars, conversations, messages, memories, ai, voice, storage, subscriptions, usage,
prisma, and common — no push registration endpoint, and no device-token model in the schema.

**Worth noting that the backend work here is not shared between the two clients.** Web notifications
mean the Web Push API with a service worker, a VAPID key pair, and a `PushSubscription` endpoint URL
per browser; Android means FCM tokens. The stored credential is a different shape, the delivery path is
a different service, and the permission model is different — browsers require the request to follow a
user gesture and penalise sites that ask on load. So "add notifications" is two backend features that
share a scheduling layer and nothing else. That changes the estimate, which is why it belongs in the
design rather than being discovered during implementation.

---

## 5. Subscription

`/account/subscription` — current usage against the allowance as a stack of `UsageBar`s, then three
plan cards.

The limits are read from `apps/api/src/usage/usage-limits.ts`, whose own comment says the PRD defines
the plans qualitatively and these numbers are explicit product defaults. `null` means unlimited:

| Feature | Free | Premium | Premium Plus |
|---|---|---|---|
| Messages | 100 | Unlimited | Unlimited |
| Text tokens | 100,000 | 1,000,000 | Unlimited |
| Image generations | 5 | 100 | 300 |
| Voice minutes | 10 | 300 | 1,000 |
| Audio-call minutes | 0 | 1,200 | 1,200 |
| Video-call minutes | 0 | 0 | 1,200 |

Two of these rows describe features that do not exist. Image generations are metered against a module
with no controller (§6), and call minutes are metered against a feature the endpoint table in
[`01-foundation.md`](./01-foundation.md) §8 marks as Phase 2/3. Both rows are still worth showing on
the plan cards, because they are what the plan will include; neither should appear in the usage bars at
the top, because a usage bar for something you cannot do reads as a bug. Text tokens should not appear
in the usage bars either — it is an implementation unit, and asking a user to care about 100,000 of
something they cannot count is the opposite of a clear allowance.

**Prices are placeholders and are defined nowhere in the codebase.** No amount, no currency, no
interval, and no `Price` or `Plan` model. Whatever numbers appear in the mockup are illustrative, and
the design should not be read as having chosen them.

**The screen is read-only. There is no upgrade CTA.** `SubscriptionsController` exposes exactly two
handlers, `GET current` and `GET latest`. There is no create endpoint, no checkout, and no payment
provider integration. A prominent Upgrade button that does nothing is worse than no button — it
converts a user's intent to pay into a broken interaction, which is the single most expensive kind of
disappointment this product can produce. The plan cards instead show the current plan with a
`--secondary-container` badge and the others as descriptions with no action, plus one honest line:
paid plans aren't available yet.

Worth recording that the plumbing is further along than the surface suggests.
`SubscriptionsService` already has `create`, `update`, and an `activateProviderSubscription` helper
that upserts on `providerSubscriptionId` — with a comment explaining it deliberately keeps
provider details out of client-facing APIs. So the service layer for billing largely exists and what
is missing is a checkout route, a webhook handler, and a payment provider. That is a smaller gap than
"no monetisation", and it is worth knowing before anyone estimates it.

**This is the one place where web is structurally better positioned than Android**, and it is a
strategic point rather than a design one. An Android subscription must go through Google Play billing,
at 15–30% commission. A web checkout — Stripe, or any card processor — does not. On a subscription
product with thin per-user margins after inference costs, that commission is a large fraction of the
contribution margin, which makes the web app the natural place to sell and the Android app the natural
place to use what you bought. That reframes this screen from a port of the Android one into the more
commercially important of the two, and it argues for building the web checkout first rather than in
parity with mobile.

**Both endpoints on this screen are broken today, not merely unguarded.** Neither
`SubscriptionsController` nor `UsageController` has `@UseGuards(JwtAuthGuard)`, so `req.user` is never
populated. The two failure modes differ, and both are verifiable by reading the handlers:

- `SubscriptionsController` reads `request.user?.sub`, so `Number(undefined)` is `NaN`, and
  `assertUserId` throws `BadRequestException('Invalid user id')`. Every call returns 400.
- `UsageController` reads `req.user.id` — the wrong property, since the JWT payload uses `sub` — on an
  undefined object, so every call throws a `TypeError` and returns 500.

Both need the guard, and `usage.controller.ts` additionally needs `req.user.sub`. Until then this
screen has no data at all, which also means Home's usage strip
([`03-onboarding-and-home.md`](./03-onboarding-and-home.md)) is degrading on a guaranteed failure
rather than an occasional one — exactly the case the Suspense boundary in
[`01-foundation.md`](./01-foundation.md) §6 exists to contain.

---

## 6. Gallery

`/gallery` — entirely blocked. There is no images controller, service, or module in `apps/api/src`,
only an unused `ImageGeneration` Prisma model with its `ImageGenerationType` and
`ImageGenerationStatus` enums. Nothing writes to it.

The surface is designed so the module is ready when the backend exists: a responsive tile grid
(2 columns at base, 3 at `md`, 4 at `lg`, square aspect-ratio boxes with `next/image` and blur
placeholders), a lightbox on click, and an `EmptyState` whose action leads to chat, because that is
where an image would be requested.

**The destination stays behind a build flag.** Shipping a permanently empty item in the primary
navigation is a standing advertisement for an unfinished product, and unlike a disabled settings row it
cannot explain itself — there is nowhere on a nav item to put a reason. This is the one place the
disabled-not-hidden principle inverts, and the asymmetry is the whole justification: a disabled row is
an admission, an empty destination is a disappointment. With the flag off, `/gallery` is not registered
and falls through to the 404 in §7.1.

---

## 7. System screens

Four surfaces with no Android analogue worth porting, because they are artefacts of the browser rather
than of the product.

### 7.1 404

`app/not-found.tsx` — static, per the rendering table in [`01-foundation.md`](./01-foundation.md) §6.

Fraunces is not used here; a lost page is not one of the five display moments. `headline-lg` title,
`body-md` explanation, and no illustration of a sad robot.

**It must offer a route back into the app, not only to the landing page.** Most 404s in this product
will be authenticated users following a stale link — an old `/chat/[id]` for a deleted conversation, a
`/memory/[id]` that was cleared, a bookmarked `/gallery` from before the flag flipped. Sending them to
`/` is sending a logged-in user to a marketing page, which reads as having been logged out. The screen
therefore offers Home, Chat, and Memory as primary actions. Because the file is static it cannot know
whether the visitor is authenticated, which is fine: an unauthenticated visitor clicking Home hits
`middleware.ts` and is redirected to `/login?next=/home`, which is the correct outcome anyway.

### 7.2 Error boundary

`app/error.tsx` at the root, plus one per route group. The grouping is the point: an error in
`(app)/memory` should render inside the app shell with the sidebar intact, so the user can navigate
away, whereas a root error replaces everything. See [`01-foundation.md`](./01-foundation.md) §6 on
Suspense and error boundaries, and note that a `<Suspense>` boundary without an error boundary inside
it turns a failed section into a failed page — which is exactly the degradation Home's usage strip must
not do.

The screen is an `ErrorState` (§5.6): `--error` icon, `headline-sm` title, one sentence of explanation
in ordinary language, and a mandatory retry wired to the `reset()` prop React passes in. Retry first,
because a transient fetch failure is the most likely cause and re-rendering the segment fixes it
without losing the user's place. A secondary link goes Home for when it does not.

**It must never render a stack trace in production.** Next.js already strips server error messages
from the client `error` object in production builds and substitutes a digest, but a boundary that
renders `error.message` unconditionally will happily print a client-side exception's message and a
`digest` string, neither of which means anything to a user and the first of which can leak internals.
Render the digest only behind a "Details" disclosure for support, log the real error to the reporting
service, and show prose to the user. In development, print everything.

### 7.3 Offline

A persistent `Banner`, not a screen. Replacing the app with an offline page throws away everything the
user could still be reading, which on a connection that drops for four seconds is a hostile
overreaction. The banner is in-flow at the top of the content area on `--warning-container`, is
`role="status"` rather than `role="alert"` because it is ambient (§9), and is driven by `navigator.onLine`
plus the `online`/`offline` events — with the caveat that `navigator.onLine` reports link state rather
than reachability, so a failed BFF fetch is the more reliable signal and both should feed the same
state.

What still works: every conversation, memory, and account page already in TanStack Query's cache
renders normally, and the companion in the sidebar persists because it came from the same cache.
What does not: sending a message, streaming, voice, and every mutation on these screens. Mutating
controls are disabled while offline with the banner as the explanation — the one sanctioned exception
to "disabled submit buttons stay enabled" in [`01-foundation.md`](./01-foundation.md) §5.2, because
here the reason is stated globally and permanently rather than hidden in a validation message. The
composer keeps its draft in Zustand, so text typed offline survives.

### 7.4 Loading

There is no `loading.tsx`-shaped design work beyond the skeletons already specified per screen, which
is worth stating so nobody goes looking for it. Each screen's skeleton is defined where the screen is —
memory cards, companion profile blocks, settings rows — and a route-level `loading.tsx` is simply the
right place to *mount* that skeleton, because it is what App Router shows while a Server Component
awaits its data, and it does so without the screen needing a loading state of its own. Two rules carry
over from [`01-foundation.md`](./01-foundation.md) §10: the skeleton must be shaped like the content it
replaces, or the CLS budget is spent on the transition, and it must be static under
`prefers-reduced-motion`.

---

## 8. Destructive actions

Three tiers of friction, matched to consequence rather than applied uniformly. A confirmation dialog on
everything trains users to dismiss dialogs, which is how the one that mattered gets dismissed too.

| Action | Friction | Recoverable | Endpoint |
|---|---|---|---|
| Delete one memory | None — inline undo for 6s | Yes, within the window | `DELETE /memories/:id` |
| Delete a conversation | Row action, undo toast | Yes, within the window | `DELETE /conversations/:id` |
| Archive companion | `Dialog`, explicit "Archive" | No — not through the API (§1.1) | `DELETE /avatars/:id` |
| Clear all memories | Type DELETE | No | N × `DELETE /memories/:id` |
| Delete account | Type DELETE | No | `DELETE /users/me` |

**Undo is only offered where it can actually be honoured.** For a memory that means holding the
`DELETE` call for the undo window and firing it when the window closes — not firing immediately and
hoping the user does not click undo, which is a lie dressed as a feature. The row animates out, the
mutation sits in a timer, and undo cancels the timer and animates the row back. The cost is one edge
case worth handling explicitly: a pending delete must be flushed on navigation and on `beforeunload`,
or a user who deletes a memory and immediately closes the tab finds it still there next time. Flush on
unmount, and accept that a hard tab close during the window may lose the delete — which fails in the
safe direction.

The two type-DELETE tiers use the same pattern: a `Dialog` whose confirm button stays disabled until
the field matches exactly, the field labelled with the required word (§9), and the enumeration of
consequences above the field rather than below it, where it would be read after the decision.

---

## 9. Accessibility

Requirements against the WCAG 2.1 AA target in [`01-foundation.md`](./01-foundation.md) §9.

**Setting rows are single accessible nodes.** A row reads as one thing — label, current value, and
state — rather than as three unrelated fragments a screen-reader user has to assemble. Grouped rows
inside a `SectionCard` sit in a `<ul>` with the group's `<h2>` as its accessible name, so the structure
is navigable by heading.

**A disabled row announces its reason.** This is the accessibility half of the disabled-not-hidden
decision and the reason those rows use `aria-disabled` with a real `tabindex` rather than the `disabled`
attribute: a `disabled` control is removed from the tab order, so a keyboard user encounters silence
where a sighted user sees a greyed row with an explanation. The reason text is wired via
`aria-describedby`, so focusing the row reads "Change password, unavailable, no endpoint yet".

**Memory type badges carry text, not colour alone.** The badge's colour is redundant encoding for
scanability; the label is the information. This is the rule most easily broken on this screen, because
five colours look like enough of a system to omit the words.

**Meters use `role="meter"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, and a human label**
— "Flirtiness, 7 of 10", "Importance, 9 of 10" — never a styled `div` with a width percentage, which
is invisible. `aria-valuetext` carries the plain-language reading in memory detail so the band is
announced along with the number.

**Destructive controls carry an explicit word.** "Archive Aria", "Delete account", "Clear all
memories" — never an icon alone and never `--error` colour as the only signal. Colour is not available
in forced-colours mode, which [`01-foundation.md`](./01-foundation.md) §9 puts in the test matrix.

**The confirmation field for an irreversible action is labelled with the exact word required**, so it
is readable by a screen reader rather than only visible in the dialog body: `<label>Type DELETE to
confirm</label>`. A field labelled "Confirm" whose requirement lives in a paragraph above it is a dead
end for anyone navigating by form control.

Two additions specific to this document's screens:

**The unsaved-changes bar must be announced when it appears.** It is a `role="status"` region, so its
arrival is read politely — "2 unsaved changes" — without stealing focus from the field being edited.
An unannounced bar is the same failure as an unannounced validation error: a state change nobody was
told about. Its Discard and Save buttons are in the tab order immediately after the form, not
appended at the end of the document.

**The clear-all progress needs a live region.** The determinate meter's text is
`aria-live="polite"` and updates on a throttle — every few items, not on every one of 47 deletes —
because a live region that fires forty-seven times is a denial-of-service on a screen reader. The
terminal state, success or partial failure, is announced once and in full.

---

## 10. What must exist before this module ships

| Gap | Blocks | Severity |
|---|---|---|
| No change-password endpoint | Account security; forgot/reset password ([`02`](./02-authentication.md)) | Blocker |
| No `JwtAuthGuard` on subscriptions, usage, or voice | Subscription screen returns 400, usage returns 500, voice is open | Blocker |
| `usage.controller.ts` reads `req.user.id`, payload uses `sub` | Usage summary, Home's usage strip | Blocker |
| No checkout or payment integration | Monetisation entirely; the plan cards have no action | Blocker for revenue |
| Debug call and `console.log` in `MemoriesService.findAll` | An embedding round-trip and a cross-user search on every memory-list load | Blocker |
| `limit` applied before the `type` filter in `findAll` | Filter chips return misleading and sometimes empty results (§3.1) | Should fix |
| `UpdateMemoryDto` allows importance 0–100; the real scale is 1–10 | A patched memory outranks every extracted one (§3.1) | Should fix |
| No un-archive endpoint, and archived companions 404 on read | An archived companion is unreachable in every direction (§1.1) | Should fix |
| No bulk memory delete | Clear-all is N requests with partial-failure handling | Should fix |
| No memory pagination beyond `limit` | Users past 100 memories cannot reach all of them | Should fix |
| No session list or revoke endpoint | "Sign out of all devices"; the only remedy for a shared machine | Should fix |
| Memory delete is soft; no hard-delete or retention job | Right-to-erasure claims the UI implies (§3.3) | Should fix |
| No data export endpoint | GDPR data portability | Should plan |
| No `POST /memories` | Manual memory entry; `MemorySource.USER_INPUT` is unwritten | Deferrable |
| No email-change endpoint | Account settings completeness | Deferrable |
| No notifications module | Re-engagement — and web needs its own Web Push path (§4.5) | Deferrable for MVP |
| No images module | Gallery, image messages | Deferred by decision |
