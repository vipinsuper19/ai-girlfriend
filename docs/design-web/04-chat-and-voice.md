# Web Design Task 3b — Chat & Voice

The conversation screen and everything around it: the thread, conversation history, streaming,
failure, message actions, voice capture, scroll behaviour, and the usage wall.

Tokens, breakpoints, components, and the transport facts this builds on are in
[`01-foundation.md`](./01-foundation.md) — particularly §3.3 (measure), §5.5 (chat components), §6
(chat as a client island), §8.1 (SSE on the web) and §10 (budgets). None of it is restated here.
Visual reference: `canvases/web-chat-voice.canvas.tsx`.

---

## 1. The Chat destination opens the conversation, not a list

With one companion there is one ongoing relationship. Making the destination root a list of threads
puts a speed bump in front of the only thing most sessions are for.

**`/chat` redirects to `/chat/[latestId]`** — the newest conversation by `lastMessageAt`, which is
the order `ConversationsService.findAll` already returns. History moves behind a clock affordance in
the app bar. This is how messaging a single person works in every other product. Where the user has
no conversation yet, the redirect target is created on demand via `POST /conversations`.

### 1.1 At `lg`+ the trade-off disappears

The Android decision is a trade-off: the list is genuinely useful for separating topics, and hiding
it behind an icon costs something. At 390px that cost is unavoidable, because the thread and the
list cannot both be on screen.

**At `lg` and above they can, so they are.** The list becomes a persistent 20rem column between the
sidebar and the thread, and the clock affordance disappears at that width because what it reveals is
already visible. This is the rare case where the desktop layout dissolves a mobile compromise
entirely rather than merely relaxing it: direct entry into the conversation *and* the list, with no
mode and no navigation.

**`/chat/history` stays a real route rather than becoming an `lg`-only component.** Below `lg` it is
the full-screen list, which keeps the list addressable, deep-linkable, and reachable by a screen
reader as a page with its own title. Rendering it only as a column inside `/chat/[id]` would make it
furniture that exists at one viewport width and nowhere else. At `lg`+ a direct visit renders the
column with an empty pane inviting a selection.

| Viewport | Arrangement |
|---|---|
| `< lg` | `/chat/[id]` is the thread, full width. `/chat/history` is a separate screen behind the clock. |
| `lg` – `xl` | 20rem conversation column, then the thread. No clock affordance. |
| `≥ xl` | Adds the right context panel ([`01`](./01-foundation.md) §4.1) — memories she drew on, current mood. |

The thread column keeps its `44rem` cap in all three. Extra width goes to the panels, never to the
bubbles.

---

## 2. What the API supports

Read from `messages.controller.ts`, `voice.controller.ts`, `conversations.controller.ts` and
`usage.service.ts` — not from the PRD.

| Capability | Endpoint | Status |
|---|---|---|
| Send, streamed | `POST /conversations/:id/messages/stream` | Works — SSE `message` / `delta` / `done` / `error` |
| Send, blocking | `POST /conversations/:id/messages` | Works. The fallback when SSE cannot be established |
| Load history | `GET /conversations/:id/messages` | Works. **No pagination** — returns the full thread |
| Delete a message | `DELETE /messages/:id` | Works — soft delete, sets `deletedAt` |
| Voice round trip | `POST /voice/respond` | Built, but **double-prefixed, unguarded, and currently throws** (§8.5) |
| Regenerate a reply | — | **No endpoint.** The PRD lists it |
| Edit a sent message | — | **No endpoint.** The PRD lists it |
| Image in a message | `Message.imageUrl` | Field exists; nothing in the API produces one |
| Last-message preview | `GET /conversations` | **Not returned.** `id`, `title`, `lastMessageAt` only |
| Enforce message limits | `UsageService.consume()` | Exists, **never called from `MessagesService`** |

Four PRD chat features have no implementation, and two are handled differently on purpose.
**Regenerate appears in the action menu disabled rather than omitted:** its absence is temporary, and
anyone who has used another AI product will look for it, so a greyed control reads as "not yet"
where a missing one reads as "this product cannot do that". It carries `aria-disabled` and a tooltip
per [`01`](./01-foundation.md) §5.2, so it stays focusable and can explain itself. **Edit is omitted
entirely** — a message you sent to a person is not normally editable, so its absence reads as
intentional, and showing it disabled would advertise a gap nobody was looking for.

### 2.1 Three API facts the foundation document does not record

**Every successful JSON response is wrapped.** `ResponseInterceptor` is registered globally in
`main.ts` and maps every handler return into `{ success, statusCode, message, data, timestamp, path
}`, so `GET /conversations/:id/messages` resolves to an object with the array under `data`.
`HttpExceptionFilter` produces the matching error envelope. The BFF unwraps `data` and normalises
errors, so no component sees either; SSE frames bypass both, because the streaming handler writes to
the `Response` directly.

**The streaming endpoint answers 200 for almost every failure.** `createAndStream` calls
`response.flushHeaders()` *before* its `try` block, so anything thrown downstream — including the
`NotFoundException` for a conversation the user does not own — arrives as an `error` frame on a 200
`text/event-stream` response. The only genuine non-200 is a guard rejection (§3.7). Status codes are
not a usable signal here; frames are.

**`CreateMessageDto.audioUrl` and `imageUrl` are validated with `@IsUrl()`.** A relative
`/uploads/voice/…` path — the only kind `StorageService.save` returns — fails that validator, and the
global `ValidationPipe` runs with `forbidNonWhitelisted: true`. Text sends are unaffected, but any
future "send this voice note as a message" flow is blocked until the DTO relaxes or the API returns
absolute URLs.

---

## 3. Streaming

The technical core of this screen, and where the web client diverges most from Android. The wire
format is in [`01`](./01-foundation.md) §8.1; this is the client implementation.

### 3.1 The transport, and the frame parser

`EventSource` is GET-only, cannot send a body, and cannot set headers. The endpoint is a `POST`
carrying `CreateMessageDto`, so the browser's SSE client is unusable: the transport is `fetch` plus a
`ReadableStream` reader, a `TextDecoderStream`, and a hand-written parser. Forty lines, preferable to
a dependency, and it makes everything `EventSource` gives free our responsibility instead.

**A network chunk has no relationship to a frame boundary.** One `read()` can deliver half a `data:`
line, or three frames plus the first four characters of a fourth. The bug is to parse what arrived
and drop the remainder; it surfaces as occasional missing words mid-reply, on slow connections only,
and is close to impossible to reproduce locally. Keep an explicit buffer, and consume only up to the
last complete frame.

```ts
type SseFrame = { event: string; data: string };

async function* readFrames(body: ReadableStream<Uint8Array>) {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += value.replace(/\r\n?/g, "\n");

    // A frame ends at a blank line. Everything after the final
    // "\n\n" is an incomplete frame and must survive this iteration.
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const frame = parseFrame(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (frame) yield frame;
      boundary = buffer.indexOf("\n\n");
    }
  }
}

function parseFrame(raw: string): SseFrame | null {
  let event = "message";
  const data: string[] = [];

  for (const line of raw.split("\n")) {
    if (line.startsWith(":")) continue;                       // comment / keepalive
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }

  return data.length ? { event, data: data.join("\n") } : null;
}
```

Line endings are normalised before any boundary search — the grammar permits `\r\n`, `\n` and `\r`,
Express writes `\n`, and a proxy in between may rewrite them. Comment lines are skipped rather than
treated as data, so the parser is already correct when the backend adds the keepalive it lacks.

### 3.2 Key on the `event:` line, never on `data.type`

The obvious model is a discriminated union on the payload's `type` field, since `message`, `delta`
and `done` all carry one. It fails on exactly the case that matters: `messages.controller.ts` writes
its catch block as `data: { "message": … }` with **no `type` field**. A union keyed on `data.type`
silently fails to match the error event, and the symptom is not a crash — it is a stream that stops
producing deltas and leaves a spinner running forever, because the branch that would have surfaced
the failure never ran. The `event:` line is written for every frame including the error.

```ts
for await (const frame of readFrames(response.body!)) {
  const payload = JSON.parse(frame.data);

  switch (frame.event) {
    case "message": reconcileOptimistic(payload.message); break;
    case "delta":   pushDelta(payload.content); break;
    case "done":    commit(payload.message); return;
    case "error":   fail(payload.message); return;
  }
}
```

### 3.3 `done` replaces the buffer; it does not confirm it

**Always render the `done` payload's `message.content`, discarding the accumulated deltas.** A
dropped or duplicated delta is invisible until the thread reloads and the text silently differs from
what the user read. `ai.service.ts` builds `fullResponse` from the same chunks it yields, so in the
normal case the two agree and the swap is imperceptible — which is the point: free when nothing went
wrong, correct when something did.

**An `error` frame after deltas means nothing was persisted.** `streamResponse` creates the assistant
`Message` only after the provider stream completes and passes a non-empty check, so an error before
that leaves no row, and keeping the partial would show text no reload could reproduce. Deltas
received before an error are discarded, exactly as on Stop. This corrects the Android document's
"keep whatever text arrived", written before `ai.service.ts` was read; the correction applies to both
clients.

### 3.4 The inactivity watchdog

There is no keepalive, so a stalled connection is indistinguishable from a slow model and TCP will
hold a dead stream open for minutes. **No `delta` for 30 seconds is a failure.** The timer resets on
every delta and starts on the first byte rather than on send, since the first token legitimately
takes a second or two behind the model. Thirty seconds clears a slow first token while staying
inside the window where someone is still watching; a comment frame every fifteen seconds on the
backend would let it drop much tighter.

### 3.5 Abort: Stop, and the route change

One `AbortController` per send, aborted from three places: Stop, the watchdog, and the effect
cleanup — `useEffect(() => () => controller.current?.abort(), [])`. **The cleanup is the one that
gets forgotten.** A route change unmounts the thread while a stream is open; without an abort the
reader keeps resolving into a component that no longer exists, and navigating away and back three
times during long replies leaves three live streams.

**Stop discards the partial reply rather than saving it.** The backend has no resume and no way to
persist a half-generated message, so truncated text in the thread would leave something that looks
like a bug forever and that no reload could reproduce. The streaming bubble is removed; the user's
message stays.

**But the server does not stop.** There is no `request.on('close')` handler in
`messages.controller.ts`, and the generator in `ai.service.ts` is not cancelled by the socket
closing. Generation runs to completion, the assistant `Message` is created, and `lastMessageAt` is
updated — so the reply the user chose not to see is persisted and appears on the next history load.
No client change fixes this; it is a backend prerequisite (§11.2), and until it lands Stop is honest
only about the current session.

### 3.6 React render discipline

Appending each delta to component state re-renders the thread on every token — sixty renders a second
of a list holding hundreds of bubbles, which is the risk named against the INP budget in
[`01`](./01-foundation.md) §10. Two measures, both required. **Accumulate in a ref and flush on
`requestAnimationFrame`,** so React learns about the buffer once per frame, which is the fastest rate
the screen can show anyway.

```tsx
const buffered = useRef("");
const pending = useRef<number | null>(null);

const pushDelta = (chunk: string) => {
  buffered.current += chunk;
  pending.current ??= requestAnimationFrame(() => {
    pending.current = null;
    setStreamingText(buffered.current);
  });
};
```

**Keep the streaming bubble in its own component.** `<StreamingBubble />` owns `streamingText` and
sits as the last child of the list; the list renders from the message array and does not change
while a reply streams. Without this, ref-and-flush only reduces the render *count* — each remaining
render still reconciles every bubble on screen. Cancel the pending frame in the cleanup, or the
flush fires into an unmounted tree.

### 3.7 Through the BFF, and the 401 that is not SSE

The route handler configuration is in [`01`](./01-foundation.md) §8.1: `runtime = "nodejs"`,
`dynamic = "force-dynamic"`, the body passed through, `new Response(upstream.body)` rather than
anything that reads it, and `X-Accel-Buffering: no` on the way back.

**The web-only failure this causes is that it works in `next dev` and breaks in production.** The dev
server has no proxy in front of it, so a stream being silently buffered downstream looks perfect
locally. Behind Nginx, or on a platform whose edge buffers `text/event-stream` by default, the same
code produces one long pause and then the whole reply at once — indistinguishable from a slow model,
and reported weeks after the code was signed off. `X-Accel-Buffering: no` handles Nginx; anything
else needs checking against the real deployment target, which is why the time-to-first-delta budget
must be measured on a deployed environment rather than a laptop.

**A 401 arrives as JSON, not as SSE.** `JwtAuthGuard` runs before the handler, so it throws before
`flushHeaders()` and `HttpExceptionFilter` responds with `application/json`. Handed to the frame
parser, that envelope yields nothing — a stream that ends immediately with no error and no reply. So
check `content-type` before parsing, and route anything else through the standard error path, which
for a 401 means the single-flight refresh and one retry from [`01`](./01-foundation.md) §7.3.

```ts
if (!response.headers.get("content-type")?.includes("text/event-stream")) {
  throw await toApiError(response);
}
```

### 3.8 Optimistic send, reconciliation, and the fallback

**The user's bubble appears the instant they press Enter,** with a client-generated ID and the
`sending` state at 0.55 alpha, and the composer clears. Waiting for the round trip makes a fast
connection feel slow and a slow one feel broken.

The `message` frame carries the persisted row. Reconciliation replaces the optimistic entry in place,
matching on the client ID held in a `Map` rather than on content — two identical messages are
entirely possible — and swaps in the real `id` and `createdAt`. Because the replacement is
positional the bubble does not move and only its opacity changes. The real `createdAt` can differ
enough to cross a five-minute gap boundary, so timestamp grouping (§4.1) is computed from the
reconciled list rather than cached per bubble.

**If the request fails before the `message` frame,** the optimistic bubble stays where it is and
moves to `failed` (§5); nothing was persisted, so Retry re-sends the same content. **If it fails
after the `message` frame,** the user's message *is* persisted and Retry must not re-send it — the
retry would need to request a reply for an existing message, which no endpoint supports. So the
user's bubble is left as sent, the streaming bubble is dropped, and the failure is shown against the
missing reply instead. This is the one asymmetry in the failure model, and it exists because the two
halves of a send are one request with two persistence points.

If the stream cannot be established at all — a non-SSE content type that is not a 401, an immediate
network error, or a watchdog expiry before the first delta — the client falls back once to
`POST /conversations/:id/messages`, which returns `{ userMessage, assistantMessage }` and gives a
reply with no streaming. Better than an error, and visibly different; whether the transition is
silent or announced is deliberately open (§11.2).

---

## 4. Message rendering

`ChatBubble` and its states are in [`01`](./01-foundation.md) §5.5: `--bubble-outgoing` /
`--on-bubble-outgoing` outgoing, `--bubble-incoming` / `--on-bubble-incoming` incoming, 20px on
three corners with a 6px tail corner nearest the sender, text in `body-lg`.

**Measure, not percentage.** Android caps bubbles at 78% of the viewport, which is right on a phone
and wrong on a monitor: 78% of 1600px is a 1250px line of 16px text, roughly 200 characters, and
losing your place on the way back to the left margin is what that produces. **Bubbles cap at `68ch`
inside a `44rem` centred column** ([`01`](./01-foundation.md) §3.3). Capping by measure expresses the
constraint in the unit that governs reading speed and holds at every width without a breakpoint, and
the column is what stops two bubbles being lonely objects at opposite edges of a widescreen display.
At `lg`+ it centres within the space left by the conversation list, so it does not shift when the
list appears.

### 4.1 Timestamps only on gaps

A timestamp under every bubble is noise in a fast exchange, competing with the message text for the
same eye movement. **One appears when more than five minutes separate two messages,** plus a centred
day marker on a date change. That maps to how the conversation reads: a burst is one moment, and the
interesting information is the pause between bursts.

The exact time is available on hover, and `title` alone is not sufficient — it never appears for a
keyboard user and is inconsistently exposed by screen readers, so the exact timestamp also goes into
the bubble's accessible name (§10). The hover treatment and the accessible name are two presentations
of one fact, not a fallback for a missing one.

### 4.2 Long messages, voice notes, images, system markers

**Long messages never truncate.** No "read more", no `line-clamp`. Her long replies are the product,
and a clamp on the thing the user came for signals an interface that does not understand its own
content.

**Voice notes** render through `AudioMessage`: a play control, a duration, and a **fixed** decorative
waveform. `VoiceService` returns `audioUrl`, `mimeType`, `provider` and `voiceId` and no amplitude
data anywhere, so a randomised waveform would imply information that does not exist. A fixed pattern
reads as an icon; a random one reads as a visualisation, and is a lie.

**Image bubbles** are designed at the same `68ch` cap with the same corners, and are unreachable:
`Message.imageUrl` exists in the contract and nothing writes to it. Keep the component, keep the
branch guarded on a non-null `imageUrl`, add no entry point. A rendering path with no producer costs
nothing; an entry point with no backend costs a support ticket.

**System messages** are centred `body-sm` in `--on-surface-variant` with no bubble — "Aria's
personality was updated". They are client-generated markers rather than `Message` rows: nothing in
the API creates a `SYSTEM` message, and `AiService` would feed one straight into the model's context
if it did.

One consequence of `ai.service.ts` belongs here because it shapes what users experience as memory:
**only the last 20 messages are sent as conversation context** (`.limit(20)` in both
`generateResponse` and `streamResponse`). Everything older reaches her only through retrieved
`Memory` rows. That is the actual mechanism behind the memory feature, and it is why a long thread
does not by itself make her more consistent.

---

## 5. Failure handling

**A failed send stays exactly where it is,** at 0.55 alpha, with "Not sent · Retry" beneath it. Retry
is a real `<button>` — focusable, in tab order, with an accessible name identifying which message it
retries, because "Retry" alone is meaningless out of context and a thread can hold several failures.

**Never a toast.** Two independent reasons, both fatal. A toast is anchored to the viewport, so it
scrolls away from the message it describes and leaves the user with an error about something they can
no longer see. And it disappears in four seconds — likely before someone reading a long reply notices
it at all. The error belongs attached to the thing that failed, which is also the only place the
retry action makes sense. This is the general rule in [`01`](./01-foundation.md) §5.6, and this screen
is what it was written for.

**Offline shows a persistent `--warning-container` strip under the app bar,** `role="status"`, icon
plus text rather than colour alone, driven by `navigator.onLine` and the `online`/`offline` events.
`navigator.onLine` reports link state rather than reachability — a captive portal reads as online —
so failures are still surfaced inline regardless of what the strip says.

**The composer stays enabled while offline** and sends queue as failed-with-retry. Blocking input to
someone mid-thought is worse than letting them type and retry: the thought is what is perishable,
not the request. This is the one place the design accepts a queued failure rather than preventing the
action, and the opposite of the offline treatment for forms in [`01`](./01-foundation.md) §5.2, where
nothing can usefully be queued.

| State | Presentation |
|---|---|
| Sending | Bubble at 0.55 alpha, no spinner |
| Sent | Full opacity, no tick |
| Failed | 0.55 alpha, inline "Not sent · Retry" button beneath |
| Streaming | Incoming bubble growing in place with a caret |
| Stopped | Streaming bubble removed; user's message remains |
| Reply failed | User's bubble sent; inline error where the reply would be, with Retry |
| Offline | Warning strip under the app bar; composer enabled |

---

## 6. Message actions

Android long-presses. Long-press exists only on touch and is undiscoverable under a pointer, so the
web affordance is **a hover-revealed action row at `md`+, a context menu on right-click, and keyboard
access.** The row sits at the bubble's outer top corner, holds ghost icon buttons, and fades in over
100ms ([`01`](./01-foundation.md) §4.4). Below `md` it is replaced by long-press opening the same menu
as a bottom sheet, since a hover row on touch never appears.

**Hover-only actions are inaccessible.** Not less convenient — unreachable for anyone navigating by
keyboard or switch, which is a WCAG 2.1.1 failure and the single most likely accessibility defect on
this screen. So each message is focusable and the row appears on `:focus-within` as well as `:hover`,
with the row's buttons entering tab order only while their message is focused — keeping the thread
traversable at one stop per message rather than five.

| Action | Behaviour |
|---|---|
| Copy text | `navigator.clipboard.writeText`. Confirmation toast — this is what toasts are for |
| Speak this | `POST /voice/synthesize` for an assistant message. Blocked on §8.5 |
| Delete message | `DELETE /messages/:id`, destructive-coloured, confirmation dialog |
| Regenerate reply | Present, disabled, `aria-disabled`, tooltip. No endpoint (§2) |

**Deleting a message does not un-remember it.** `MessagesService.remove` sets `deletedAt` on the row;
the `Memory` that `MemoryExtractorService` derived from it survives untouched, so she still knows
what was in the message the user just deleted. Someone deleting something sensitive expects the
opposite. Until the backend cascades, the confirmation says so plainly — the message is removed from
the conversation, and anything she remembered from it is managed separately in Memory, with a link
there. A dialog that quietly overstates what deletion does is worse than no dialog.

---

## 7. Scroll behaviour

Entirely web-specific, and the part of this screen most likely to feel subtly wrong.

**Anchor to the bottom on load, before paint,** so the thread never appears mid-scroll and then
jumps. Setting `scrollTop = scrollHeight` in a layout effect does this; `scrollIntoView` in a passive
effect does not, because it runs after the browser has painted the top of the list.

**Stay pinned while streaming only if the user is already near the bottom** — within 120px. If they
have scrolled up to re-read something, auto-scrolling drags them away from the text they are reading,
which is the most hostile thing a chat interface can do. The pin state is captured when the stream
starts and updated on scroll, not recomputed per delta.

**Never call `scrollIntoView` on every delta.** It is a layout-and-scroll operation sixty times a
second, it fights any user scroll in that window, and with `behavior: "smooth"` the animations queue
and the list stutters. Set `scrollTop` directly inside the same `requestAnimationFrame` flush that
commits the text (§3.6), so measurement and scroll happen once per frame and in the right order.

**`overflow-anchor: auto` on the scroll container** lets the browser hold visual position when
content is inserted above the viewport, which is what makes prepending older messages tolerable. It
works against the pinned case, where the view *should* follow growing content, so it is `none` on the
streaming bubble. It is a hint the browser may ignore, so it refines explicit scroll management
rather than replacing it.

**A "jump to latest" pill** appears above the composer once the user is more than one viewport from
the bottom, with a count of what arrived since — a real button, keyboard-reachable, and the way back
after reading history. And **preserve scroll position when the composer grows**: the `<textarea>`
grows from one row to five ([`01`](./01-foundation.md) §5.5) and each growth shortens the viewport,
which is invisible when pinned but shifts what the user is reading upward a line at a time when they
are not. A `ResizeObserver` on the composer adds the height delta to `scrollTop` in that case.

---

## 8. Voice

### 8.1 Capture: click to start, click to stop

Android holds the mic and releases to send. On web that is worse, for two reasons with no touch
equivalent. **Holding a mouse button for twenty seconds is uncomfortable,** and it occupies the
pointer for the whole recording so the user cannot even scroll the thread they are replying to. And
**a pointer can leave the element mid-press**: `pointerleave` during a held button is an easy
accident with a mouse, and every handling of it is bad — cancel discards a recording the user meant
to keep, send removes the cancel gesture entirely, ignore leaves a button pressed while the cursor is
elsewhere on the page.

**So: click the mic to start, click again to stop and send, `Esc` to cancel.** The overlay makes the
recording state unmistakable rather than a subtle mode, and cancel is both `Esc`
([`01`](./01-foundation.md) §5.7) and a visible button, because a keyboard-only escape route is not
discoverable. This also makes voice usable by anyone who cannot sustain a press, which on Android
needed a separate tap-and-lock alternative.

The overlay carries a timer and **a live waveform from an `AnalyserNode`** on the captured stream,
sampled per animation frame. **This amplitude data is real**, unlike the playback waveform in §4.2,
because the audio is in the browser while it is being recorded. Drawing a real waveform here and a
fixed pattern there is not an inconsistency — one has the data and the other does not, and inventing
it in the second case is the only dishonest option available. Under `prefers-reduced-motion` the
waveform becomes a static level meter.

### 8.2 The recording pipeline, and the codec problem

`navigator.mediaDevices.getUserMedia({ audio: true })` for the stream, `MediaRecorder` to encode,
chunks collected into a `Blob`, posted as `multipart/form-data` under the field name `audio` — which
is what `FileInterceptor('audio')` in `voice.controller.ts` expects.

**There is no single audio format every browser produces.** `MediaRecorder` emits
`audio/webm;codecs=opus` in Chrome and Firefox and `audio/mp4` in Safari, and neither will produce
the other's. So the client checks support in preference order and sends what it gets:

```ts
const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t));
```

**Reading `voice.service.ts` and `gemini-speech-to-text.provider.ts`, this will not work, and it is a
blocker.** Three findings, in order of severity.

*The provider forwards the browser's MIME type verbatim.*
`GeminiSpeechToTextProvider.transcribe` passes `mime_type: input.mimeType` into
`client.interactions.create` with no normalisation. Gemini's documented audio input formats are WAV,
MP3, AIFF, AAC, OGG and FLAC — `audio/webm` is not among them, `audio/mp4` is not either, and a
parameterised type like `audio/webm;codecs=opus` is not a shape the API expects at all. **Neither of
the two formats browsers actually emit is in the provider's supported set.** A server-side normalise
and transcode to WAV or MP3 before the STT call is a prerequisite, not an optimisation.

*The failure will be unreadable.* The provider's `catch` collapses every non-`BadRequestException`
into `InternalServerErrorException('Speech-to-text failed')`, so an unsupported codec, an expired API
key and a provider outage are one indistinguishable 500. Nothing the client does can tell the user
which occurred, which is why voice cannot be diagnosed from the front end today.

*The user's own audio will not play back even if transcription succeeds.*
`VoiceService.getAudioExtension` looks the MIME type up as an exact key in a map containing
`'audio/webm'` but not `'audio/webm;codecs=opus'`, so the parameterised type misses and the file is
stored as `.audio`. `useStaticAssets` then serves it with no usable `Content-Type` and `<audio>`
refuses it. Safari's plain `audio/mp4` maps to `.m4a` correctly, so this failure is Chrome- and
Firefox-only — the most common browsers, in the least obvious way. `mimeType.startsWith('audio/')`
passes throughout, so nothing rejects the upload; it simply produces an unplayable file.

Two fixes, and the recommendation is both. Client-side, strip parameters before upload
(`mimeType.split(";")[0]`), which is one line and clears the extension bug. Server-side, parse MIME
parameters in `getAudioExtension` and transcode to a documented format before calling the provider.
The client strip alone is insufficient, because unparameterised `audio/webm` is still not a format
Gemini accepts. An interim client-only workaround exists — capture through an `AudioWorklet` and
encode 16kHz mono WAV in the browser, roughly 2MB a minute and comfortably inside the 10MB
`FileInterceptor` limit — and it is the only path that unblocks voice with no backend change.

### 8.3 Permission, and three states Android does not have

**Requested on first mic use with a rationale shown before the browser prompt** — never on page load.
A permission dialog that appears before the user has expressed any interest in the microphone is the
fastest route to a permanent denial, and on web that denial is far worse than on Android.

| State | Presentation |
|---|---|
| `prompt` | Rationale card, then "Allow microphone" triggers `getUserMedia` |
| `granted` | Straight into the recording overlay |
| `denied` | Instructions to re-enable in browser settings. **No retry button** |
| Insecure context | Voice entry point hidden, with an explanatory tooltip |

**A `denied` decision is sticky per origin and cannot be re-prompted from JavaScript.** Calling
`getUserMedia` again rejects immediately with no dialog, so a "Try again" button is a button that
does nothing. The only correct UI is an explanation of how to reverse the decision in browser
settings, naming the lock icon in the address bar, since that is where every major browser puts it.
`navigator.permissions.query({ name: "microphone" })` reads the state ahead of time in Chromium, and
its absence elsewhere is why the copy must work without it.

**`getUserMedia` requires a secure context.** On plain HTTP `navigator.mediaDevices` is `undefined`
and the call fails with a `TypeError` rather than a permission error, so the mic entry point is
hidden entirely when `window.isSecureContext` is false rather than shown and broken. A staging
deployment on HTTP therefore has no voice at all — worth knowing before it is filed as a bug.

### 8.4 The round trip is one request and eight seconds of nothing

`POST /voice/respond` transcribes, loads the companion and her voice, generates a reply, synthesises
speech, and persists two `Message` rows — steps 4 to 11 of `VoiceService.respond` — in one request
with no intermediate output. Two model calls and a TTS call in series is eight seconds or more.

**The client shows three staged steps on a timer:** transcribing → thinking → generating her voice.
**This is a fiction, and an honest one.** There is one request and no progress events, so the steps
advance on elapsed time rather than server state. What makes it defensible is that it describes what
is actually happening — those are the three phases, in that order, inside `respond` — and it sets an
expectation of duration rather than of imminence. A single spinner for eight seconds reads as a hang.
The staging must not claim precision it lacks: no percentages, no time remaining, and the last step
holds indefinitely rather than completing on schedule and then waiting.

**The transcript renders as an outgoing bubble labelled "Transcribed from your voice note."**
`respond` returns `transcript` alongside both messages, and showing it is not a nicety:
mis-transcription is common, and without it the user sees her answer a question they did not ask with
no way to work out why. The label matters as much as the text — an unlabelled outgoing bubble
containing words the user never typed is confusing in its own right.

Playback is a plain `<audio>` element owned by `AudioMessage`. `StorageService.save` returns a
**relative** path — `/uploads/voice/{userId}/{uuid}.wav` — which must be resolved against the API base
URL rather than the web origin. On web that means the browser fetches from the Nest origin directly,
and it is **the one place the BFF is bypassed**: an `<audio src>` cannot carry a cookie-derived
Authorization header, and proxying media through a route handler means either buffering it or
reimplementing range requests, neither worth it for a voice note.

That works today because `main.ts` mounts `useStaticAssets(join(process.cwd(), 'uploads'), { prefix:
'/uploads/' })` with no guard: `GET /uploads/**` is public. It is also a privacy problem worth
raising now. **Every voice note in the product — the user's recordings and her replies — is served
from an unauthenticated URL with no expiry.** Filenames are UUIDv4, so they are not guessable by
brute force, and that is the only thing protecting them: the user directory is enumerable, the URL is
a bearer token that never expires, and anything that leaks one — a referrer header, browser-history
sync, a proxy log — leaks the audio permanently. In a product whose content is intimate by design,
"the path is hard to guess" is not an authorisation model. The fix is signed time-limited URLs or an
authenticated media route; the design is indifferent to which.

### 8.5 Two backend blockers on voice

**The route is double-prefixed.** `VoiceController` is declared `@Controller('api/v1/voice')` while
`main.ts` calls `setGlobalPrefix(API_BASE_PATH)`, so the live paths are `/api/v1/api/v1/voice/*`. The
BFF targets the correct single-prefix path and the controller should become `@Controller('voice')`.

**The voice endpoints have no `JwtAuthGuard`, and two of the three therefore crash.** There is no
`@UseGuards` on `VoiceController`, so `request.user` is never populated — and `synthesize` and
`respond` both read `Number(request.user.id)`, which throws on undefined and surfaces as a 500.
`POST /voice/transcribe` never touches `request.user`, so it works and is completely open: an
expensive paid model behind a 10MB upload, callable by anyone.

Adding the guard is necessary but not sufficient. `JwtPayload` carries `sub`, not `id`, so
`request.user.id` would still be `undefined`, `Number(undefined)` is `NaN`, and the ownership queries
would match nothing and 404 on every call. The controller must read `sub` through `@CurrentUser()`,
as `MessagesController` and `ConversationsController` do. `UsageController` has the identical pair of
bugs (§9.1). Until both are fixed the entire voice feature is unreachable, and this UI ships behind a
flag.

---

## 9. History and the usage wall

`GET /conversations` returns rows straight from `ConversationsService.findAll` — `id`, `title`,
`lastMessageAt`, `companionId`, `metadata` — ordered by `lastMessageAt` descending. **There is no
message preview.**

Rows therefore show a title and a relative time rather than a snippet. **A preview is the single most
useful thing in a conversation list**: it is how anyone identifies a thread, since titles here are
either null or auto-generated. The honest options are to ship without it, or to have the backend add
a `lastMessage` field to the list response. Recommend the latter — it is a join the query is already
positioned to do — and the design accommodates both: the row reserves a second line holding a
one-line clamped preview when present and collapsing cleanly when absent, so shipping without
previews yields a shorter row rather than a broken one.

**Row layout:** a 40px `Avatar`, the title in `title-md` clamped to one line, the preview slot in
`body-md` `--on-surface-variant`, and a right-aligned relative time in `body-sm`. Where the title is
null the row falls back to the date the conversation started rather than to "Untitled", which tells
the user nothing they cannot already see. The active row gets a `--surface-container-low` background
plus `aria-current="page"`, because a background tint alone does not survive forced-colours mode.

**"Start a new conversation" is a real button at the top of the list, not a floating action button.**
A FAB solves a thumb-reach problem web does not have, and it floats over content on a surface with
room for an in-flow control. It is also a deliberate rather than frequent action — most sessions
continue the existing thread — and frequency is a FAB's whole argument.

**Deletion is a row action, not a swipe.** Swipe-to-delete has no pointer or keyboard equivalent, so
the affordance is an overflow menu in the row's hover/focus slot, on the same reveal rules as §6.
`DELETE /conversations/:id` soft-deletes. Undo is a five-second toast, and since the delete is soft,
the honest implementation removes the row locally and issues the request only when the undo window
closes — which makes Undo instant and correct rather than a second round trip that can itself fail.

### 9.1 The usage wall

Free is **100 messages per month**, per `USAGE_LIMITS.FREE.MESSAGES` in `usage-limits.ts`. The period
is the UTC calendar month — `UsageService.getCurrentPeriod` — not a rolling window and not the
subscription anniversary, which is what the reset date must reflect.

At the wall the composer is disabled and replaced in place by a card explaining what happened and
when it resets. Not a modal: a modal at the moment someone is trying to say something is a barrier
across their intent, and it can be dismissed into a composer that still does not work.

**The copy leads with what is safe.** "Your history and everything Aria remembers stays exactly as it
is." Only then the limit, the reset date, and the upgrade action. The fear at a paywall in *this*
product is not losing a feature — it is losing the relationship, and a user who suspects their
companion is being held hostage does not upgrade, they leave. That fear drives churn faster than the
paywall drives conversion, so the reassurance comes before the ask. **A soft warning at 80%** — a
`--warning-container` `Callout` above the composer, dismissible, stating what remains and the reset
date, shown once per period — means the wall never arrives as a surprise mid-conversation.

**None of this is reachable today.** `MessagesService` never calls `UsageService.consume()` — not in
`create`, not in `createAndStream` — so no limit is enforced anywhere and a free user can send
unbounded messages. `check` and `consume` are fully implemented and correct; nothing calls them from
the message path. The screen ships behind the same check that will eventually gate sending, and
activates when the backend wires up metering.

Two further gaps the design has to survive. `GET /usage/summary` is what the 80% warning needs, and
`UsageController` has no `JwtAuthGuard` and reads `req.user.id` where the payload carries `sub` — the
same pair of bugs as §8.5, so it throws rather than returning a summary. And **there is no
checkout**: `/subscriptions` is read-only with no create and no payment integration (see
[`05-companion-memory-account.md`](./05-companion-memory-account.md) §5), so the wall's primary
action has nowhere to go. Until checkout exists it routes to `/account/subscription`, which explains
the plans without being able to sell one — honest, and better than a button that opens nothing.

---

## 10. Accessibility

General requirements are in [`01`](./01-foundation.md) §9. Seven specifics here, one of which is the
most likely defect in the application.

**Each bubble is one accessible node.** Sender, text, and time form one accessible name on one
focusable element — "Aria, 2:14pm: I've been thinking about what you said" — not three separate
stops. Forty messages at three stops each is 120 tab stops between the user and the composer. This is
also where the exact timestamp lives, since the hover `title` from §4.1 is unreachable otherwise.

**The thread is `role="log"` with `aria-live="polite"`,** which tells a screen reader that content is
appended at the end and should be announced in order. `role="feed"` is the alternative and is wrong:
it implies a scrollable set of independent articles with `aria-posinset`, which describes a timeline,
not a conversation.

**The streaming bubble is `aria-live="polite"` with the caret excluded** from the accessible name.
Announcing the reply as it grows is what makes streaming an advantage rather than a barrier for a
screen-reader user; the caret is `aria-hidden`, or it is announced as a character on every flush.

**The typing indicator has a text alternative** — "Aria is typing" — announced once, not per frame of
the dot animation. Three animated dots are otherwise completely silent.

**Recording announces start and stop,** and the timer is a polite live region updating **every five
seconds** rather than every second. A per-second live region is a screen reader that cannot be
interrupted, which makes the cancel instruction impossible to hear.

**Message actions are reachable by keyboard.** Repeating §6 because it is the most likely failure
here: the row appears on `:focus-within` as well as `:hover`, every action has an accessible name
identifying its message, and the disabled Regenerate uses `aria-disabled` so it stays focusable and
can explain itself.

**Virtualisation breaks screen-reader navigation.** It is the obvious answer to the unpaginated
history fetch ([`01`](./01-foundation.md) §10), and rows removed from the DOM cannot be reached by a
virtual cursor: the user perceives a twenty-message conversation regardless of its real length, and
"read to the end" stops at an arbitrary point. Detecting assistive technology is unreliable and
privacy-invasive, so instead — keep the DOM window several viewports deep rather than one, do not
virtualise below a few hundred messages, and offer a "load all messages" control in the thread menu
that switches to a plain list. Below that threshold, where every real conversation will sit for a
long time, there is no virtualisation and therefore no problem.

---

## 11. Decisions

### 11.1 Settled

The Chat destination opens the conversation rather than a list, and at `lg`+ the list becomes a
persistent column instead of a hidden screen, with `/chat/history` retained as a real route. `fetch`
and a hand-written frame parser rather than `EventSource`, keyed on the SSE `event:` line and never
on `data.type`. The `done` payload replaces the accumulated buffer. A 30-second inactivity watchdog
in place of a server keepalive. Deltas accumulated in a ref and flushed on `requestAnimationFrame`,
with the streaming bubble isolated in its own component. Bubbles capped at `68ch` inside a `44rem`
column rather than at a percentage of the viewport. Timestamps only on gaps over five minutes, with
the exact time in the accessible name as well as on hover. Failures inline on the message, never a
toast; composer stays enabled offline. Message actions revealed on focus as well as hover.
Click-to-start / click-to-stop recording with `Esc` to cancel rather than hold-to-talk. Real waveform
while recording, fixed waveform on playback. Staged voice progress on a timer, declared here as a
fiction. Stop discards the partial reply from the view. Regenerate shown disabled, edit omitted.
"Start a new conversation" as a button rather than a FAB; deletion as a row action rather than a
swipe. The usage wall leads with what is safe.

### 11.2 Open

**No message pagination.** `GET /conversations/:id/messages` returns the entire thread with no
cursor. Fine at 50 messages, a multi-megabyte blocking payload at 5,000. The client can render a
window and virtualise upward, but that only hides it, and §10 explains what virtualisation costs.
**Cursor pagination is a backend prerequisite for launch,** not an optimisation.

**Stop does not stop the server.** There is no `request.on('close')` handler in
`messages.controller.ts` and the generator in `ai.service.ts` is not cancellable, so a stopped reply
is generated in full, persisted, and reappears on the next history load. Either the backend aborts on
socket close, or Stop is renamed to something it can deliver. No client change resolves this.

**Deleting a message does not delete its memory.** `MessagesService.remove` soft-deletes the row; the
extracted `Memory` survives. Either cascade the deletion or keep saying so plainly in the
confirmation — the current silence is not an option, and this is a data-protection question as much
as a UX one.

**Whether the blocking-send fallback is silent or announced.** Silent is smoother and makes the
product look inconsistent — sometimes it streams, sometimes it does not, with no explanation.
Announced is honest but puts a technical detail in front of someone mid-conversation. Leaning towards
one quiet line under the composer ("Slower connection — replies may arrive all at once") rather than
either extreme, but undecided.

**The `MediaRecorder` codec question is unresolved and blocks voice.** §8.2 is the finding: neither
`audio/webm;codecs=opus` nor `audio/mp4` — the only formats browsers produce — is in the set the
Gemini STT provider accepts, and the parameterised type additionally defeats
`VoiceService.getAudioExtension`, so the user's own recording is stored unplayable. The decision is
whether to transcode server-side before the STT call (correct, backend work) or to encode WAV in the
browser via an `AudioWorklet` (unblocks the client alone, more code, larger uploads). It needs
answering before the voice UI is built, not after.

**The unauthenticated `/uploads/` path.** `GET /uploads/**` is public with no expiry and is where
every voice note in the product lives (§8.4); UUIDv4 filenames are the entire access control. Signed
URLs or an authenticated media route — a backend decision, and the design is indifferent to which,
but shipping voice without one means shipping intimate audio on permanent public URLs.
