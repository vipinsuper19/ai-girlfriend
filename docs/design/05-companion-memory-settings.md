# Design Task 3c — Companion, Memory, Settings & Subscription

Nine screens covering the surfaces where users manage the relationship rather than live in it.

Tokens from [`01-foundation.md`](./01-foundation.md). Visual reference:
`canvases/android-companion-memory-settings.canvas.tsx`.

---

## 1. Companion profile

**Purpose.** Present her as a character, not an entity in a database. This is a profile page for a
person, and it should feel closer to a contact card than a settings screen.

**Layout.** 112dp avatar, name in Fraunces `displayMedium`, a relationship line ("Your girlfriend ·
5 weeks together"). Trait chips. Four labelled meters for the personality levels. A grouped list of
appearance, voice, and memory count. Archive at the bottom.

The four meters are read-only bars here rather than sliders — this is a view screen, and the edit
affordance is the app-bar action. Making them draggable would mean every scroll risks changing her
personality.

**"5 weeks together"** is computed client-side from `Companion.createdAt`. It costs nothing and does
real work: it frames the companion as a relationship with duration rather than a configuration.

**Data:** `GET /avatars/:id`, which includes `appearance`, `personality`, and `voice`.

### 1.1 Archive, not delete

`DELETE /avatars/:id` sets `status = ARCHIVED`. It does not delete the record, and the service's own
success message says "Companion archived successfully".

**The button therefore says "Archive Aria".** Labelling it Delete would be a lie, and a discoverable
one — the user would archive her, expect the data gone, and find her recoverable. The confirmation
explains that conversations and memories are kept.

There is no un-archive endpoint. `GET /avatars` filters to non-archived, so an archived companion
becomes unreachable through the API despite still existing. That is a gap worth closing.

---

## 2. Edit companion

Name, trait chips, and the four sliders, with an app-bar Save.

**Changing personality warns rather than blocks.** An inline note in `tertiaryContainer`: "Changing
her personality affects how she talks from here on. Everything she already remembers stays." Without
it, a user who nudges a slider finds their companion talking differently with no explanation, which
reads as the product breaking rather than as their own change.

**Unsaved changes surface as a persistent bottom bar** — "2 unsaved changes · Discard · Save" — rather
than a dialog on back press. The bar is visible while editing, so nobody reaches the back gesture
unaware; a dialog only appears after the mistake.

**Data:** `PATCH /avatars/:id`, which accepts the same nested shape as create.

---

## 3. Memory

This is the most important screen in this set. It is the one place the product can *prove* it is
trustworthy rather than claim it, which is why it is a bottom-nav tab rather than a settings
sub-page.

### 3.1 List

A header line stating the count and what the user can do: "47 things Aria remembers about you. Edit
or delete anything here — she'll forget it immediately." Then filter chips by `MemoryType`, then
cards.

Each card: a coloured type badge, relative time, the memory content in plain language, and an
importance bar.

**Each `MemoryType` gets its own container colour** so the list is scannable without reading —
`PERSONAL` on primary, `PREFERENCE` on tertiary, `FACT` on secondary, `RELATIONSHIP` on success. The
enum is the natural grouping and colour makes it free to parse.

**Importance is shown as a bar with a number.** In detail view it also gets a plain-language reading
("92 — she'll bring this up unprompted"), because 0–100 means nothing on its own.

**Data:** `GET /memories?type=&companionId=&limit=`.

### 3.2 No "Add memory" button

`POST /memories` does not exist. The controller has list, get, patch, and delete only. Memories are
created by AI extraction during conversation.

Rather than a button that cannot work, the screen states the model plainly: memory comes from talking
to her. This is arguably the better product anyway — hand-authored memories are a chore, and the magic
is that she noticed. But if manual entry is wanted, it needs a backend endpoint first.

### 3.3 Detail and edit

Editable content field, type chips, importance slider, and a read-only provenance group: source,
first remembered, confidence.

**Confidence stays a raw number (0.94).** Unlike importance, it is diagnostic rather than actionable —
the user cannot change it and it does not affect behaviour they control. Dressing it in plain language
would imply it is a setting.

Delete calls `DELETE /memories/:id`, which returns `{ id, deleted: true }`.

### 3.4 Memory & privacy

An explanation card, three stat tiles, controls, and a destructive clear-all.

**The explanation says what she does *not* do first:** "She doesn't store your conversations as
memories." The most common fear is a transcript sitting on a server, and correcting it earns the right
to explain the rest.

"Pause new memories" is a switch backed by `PATCH /users/me { memoryPaused }`; while it is on, the
phone and the server both stop saving new memories. "Export my data" saves `GET /users/me/export`
as a JSON file the user picks a location for.

Clear-all requires typing DELETE. It is unrecoverable and there is no bulk endpoint — the client
iterates `DELETE /memories/:id`, which needs a progress state and partial-failure handling.

---

## 4. Settings

Grouped into Companion, Privacy, Subscription, App, with the profile card at the top and Log out
isolated at the bottom.

**Disabled rows, not hidden ones.** Where an endpoint is missing, the row stays visible and disabled
with a one-line reason. Users go looking for "change password"; not finding it reads as a broken app,
whereas finding it greyed out with "no endpoint yet" reads as an incomplete one. Gallery is the
exception — an entire tab of nothing is worse than no tab.

### 4.1 Account

Display name is editable. Email and password are not.

`PATCH /users/me` accepts `displayName` only — there is no email-change endpoint and no
change-password endpoint anywhere in the auth module. Both rows are shown disabled with the reason.
**Change password is the more serious gap:** an account system without it is not shippable, and it
also blocks the Forgot/Reset Password screens designed in
[`02-authentication.md`](./02-authentication.md).

Delete account calls `DELETE /users/me` and requires typing a confirmation word. The copy enumerates
what goes: the account, Aria, every conversation, everything she remembers.

### 4.2 App

Theme (light/dark/system) and screen privacy are client-only, stored in DataStore. Screen privacy
toggles `FLAG_SECURE` and defaults **on** for this product.

Notifications is disabled — there is no notifications module, no FCM registration endpoint, and no
device-token model.

---

## 5. Subscription

Current usage against the Free allowance, then three plan cards.

Limits are read from `usage-limits.ts`: Free is 100 messages, 10 voice minutes, 5 images; Premium is
unlimited messages, 300 voice minutes, 100 images; Premium Plus adds calls. Prices in the mockup are
placeholders — none are defined anywhere in the codebase.

**The screen is read-only. There is no upgrade CTA.**

`SubscriptionsController` exposes `current` and `latest` only. There is no create, no checkout, no
Play Billing integration, and no decision on whether billing goes through Google Play at all — which
it must, for a subscription in an Android app, at 15–30% commission. A prominent Upgrade button that
does nothing is worse than no button.

Both subscription endpoints are also missing `JwtAuthGuard`.

---

## 6. Gallery

Entirely blocked. There is no images controller, service, or route in `apps/api` — only an unused
`ImageGeneration` Prisma model.

The empty state and tile grid are designed so the module is ready when the backend exists, but
**the tab stays hidden behind a build flag.** Shipping a permanently empty tab in the bottom
navigation is a standing advertisement for an unfinished product.

This also settles the fifth-tab question from `ANDROID_PLAN.md`: four tabs, because the fifth has
nothing in it.

---

## 7. Destructive actions

Three tiers, matched to consequence:

| Action | Confirmation | Recoverable |
|---|---|---|
| Delete one memory | None — inline with undo snackbar | Yes, briefly |
| Delete a conversation | None — swipe with undo | Yes, briefly |
| Archive companion | Dialog | Not through the API |
| Clear all memories | Type DELETE | No |
| Delete account | Type DELETE | No |

Undo is only offered where it can actually be honoured. For memories, that means holding the delete
call for the snackbar duration rather than firing immediately and hoping.

---

## 8. Accessibility

Setting rows are single merged nodes reading label, value, and state — a disabled row announces its
reason, so a screen-reader user learns why rather than encountering silence.

Memory type badges have text content, not colour alone.

Meters use `progressSemantics` with the human label.

Destructive controls carry `Role.Button` and error-coloured text plus an explicit word ("Archive",
"Delete") — never colour alone.

The confirmation text field for irreversible actions is labelled with the exact word required, so it
is readable rather than only visible in a dialog body.

---

## 9. What must exist before this module ships

| Gap | Blocks | Severity |
|---|---|---|
| No change-password endpoint | Account settings, password reset | Blocker |
| No `JwtAuthGuard` on subscriptions/usage/voice | Everything paid | Blocker |
| No purchase flow or billing decision | Monetisation entirely | Blocker |
| No `POST /memories` | Manual memory entry | Deferrable |
| No un-archive endpoint | Archived companions unreachable | Should fix |
| No bulk memory delete | Clear-all is N requests | Should fix |
| No email change | Account settings | Deferrable |
| No notifications module | Re-engagement, a core retention lever | Deferrable for MVP |
| No images module | Gallery, image messages | Deferred by decision |
| No data export | GDPR posture | Should plan |
