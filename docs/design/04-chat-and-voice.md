# Design Task 3b — Chat & Voice

The conversation screen and everything around it: streaming, failure, voice capture, message actions,
history, and the usage wall.

Tokens from [`01-foundation.md`](./01-foundation.md). Visual reference:
`canvases/android-chat-voice.canvas.tsx`.

---

## 1. The Chat tab opens the conversation, not a list

With one companion there is one ongoing relationship. Making the tab root a list of threads puts a
speed bump in front of the only thing most sessions are for.

**The Chat tab opens the most recent conversation directly.** History moves behind a clock icon in the
app bar. This is how messaging a single person works in every other app, and it removes a tap from
the highest-frequency action in the product.

The conversation list still exists and is still designed — threads are useful for separating topics,
and the backend models them — it is just not the front door.

---

## 2. What the API supports

Read from `messages.controller.ts` and `voice.controller.ts`, not the PRD.

| Capability | Endpoint | Status |
|---|---|---|
| Send, streamed | `POST /conversations/:id/messages/stream` | Works — SSE `message` / `delta` / `done` / `error` |
| Send, blocking | `POST /conversations/:id/messages` | Works — fallback when SSE fails |
| Load history | `GET /conversations/:id/messages` | Works, **no pagination** |
| Delete a message | `DELETE /messages/:id` | Works |
| Voice round trip | `POST /voice/respond` | Built, but double-prefixed and unguarded |
| Regenerate a reply | — | **No endpoint.** PRD lists it |
| Edit a sent message | — | **No endpoint.** PRD lists it |
| Image in a message | `Message.imageUrl` | Field exists, nothing produces one |
| Last-message preview | `GET /conversations` | Not returned |
| Enforce message limits | `UsageService.consume()` | Exists, never called from `MessagesService` |

Four PRD chat features have no implementation. Regenerate appears in the action sheet **disabled**
rather than omitted, because its absence is temporary and users of other AI products will look for
it. Edit is omitted entirely — a message you sent to a person is not normally editable, so its
absence reads as intentional rather than missing.

---

## 3. Streaming

### 3.1 Event handling

```
message  → the persisted user message; swap the optimistic bubble for the real ID
delta    → append text to the in-progress assistant bubble
done     → the persisted assistant message; replace the accumulated buffer with it
error    → surface inline, keep whatever text arrived
```

Always replace the buffer with the `done` payload rather than trusting the accumulated deltas.
Dropped or duplicated deltas are invisible until the message is reloaded from the server and the text
silently differs.

### 3.2 Client requirements

`readTimeout(0)` on the streaming OkHttp client. The default 10 seconds kills long replies mid-stream.
Use a separate client instance so normal requests keep a sane timeout.

`POST` with `text/event-stream` needs `okhttp-sse`'s `EventSources.createFactory`, not
`androidx.compose` or a plain `EventSource` — the standard SSE API is GET-only.

The backend sends no keepalive comments. A stalled connection is indistinguishable from a slow model,
so the client needs its own inactivity watchdog: if no `delta` arrives for 30 seconds, treat it as
failed. (Backend fix: emit `: ping` every 15 seconds.)

If the response arrives as `application/json` rather than `text/event-stream`, an exception was thrown
before `flushHeaders()`. Parse it as the normal error envelope.

### 3.3 Stop

Stop cancels the `EventSource`. **The partial reply is discarded, not saved.** The backend has no
resume and no way to persist a half-generated message, so keeping a truncated reply in the thread
would leave something that looks like a bug forever. The UI removes it.

### 3.4 Presence

The app bar status line is the streaming state made ambient: "Active now" at rest, "Typing…" while
deltas arrive, "One moment…" during a voice round trip, "Offline" when disconnected. It is the same
information as the typing indicator, in a place the eye already goes.

---

## 4. Message rendering

**Outgoing:** `bubbleOut` (Mulberry 40 / 30), 20dp radius with a 6dp tail on the bottom-right.
**Incoming:** `bubbleIn` (surface container), same shape mirrored. Max width 80%.

**Timestamps appear only on gaps.** A timestamp under every bubble is noise in a fast exchange. Show
one when more than five minutes separate two messages, plus a centred day marker on date change. The
exact time is always available on long press.

**Long messages never truncate.** No "read more". The AI's long replies are the product.

**Voice notes** render as a bubble with a play control, a static waveform, and a duration. The
waveform is decorative — the API returns audio with no amplitude data — so it should be a fixed
pattern, not a fake random one that implies it reflects the audio.

**Image bubbles** are designed at 70% width with the same corner treatment. They are currently
unreachable; keep the composable, guard the branch.

**System messages** are centred, `bodySmall`, `onSurfaceVariant`, no bubble — "Aria's personality was
updated". They are client-generated markers, not `Message` rows.

### 4.1 Failure

A failed send stays in place at 50% opacity with an inline "Not sent · Retry" beneath it.

**Never a snackbar.** A snackbar scrolls away from the message it describes, and it disappears in four
seconds — likely before someone reading a long reply notices it. The error belongs attached to the
thing that failed.

Offline shows a persistent amber strip under the app bar. The composer stays enabled; sends queue as
failed-with-retry rather than being blocked, because blocking input to someone mid-thought is worse
than letting them type and retry.

### 4.2 Long-press actions

Copy text · Speak this · Delete message · ~~Regenerate reply~~ (disabled, no API).

Delete is destructive-coloured and calls `DELETE /messages/:id`. Deleting a message the AI has already
built context on does not un-remember it — the memory row persists. Worth a line in the confirmation.

---

## 5. Voice

### 5.1 Capture

Hold the mic to record, release to send, slide left to cancel. Hold-to-talk suits short emotional
messages and needs no stop-button hunt. `MediaRecorder`, AAC in an MPEG-4 container, uploaded as
`audio/mp4`.

The recording panel shows a live waveform from `MediaRecorder.getMaxAmplitude()` polled at 60ms, a
timer, and "Slide to cancel". The waveform here **is** real, unlike the playback one, because
amplitude is available live.

Permission is requested on first mic tap with a rationale, not at app start.

### 5.2 The round trip

`POST /voice/respond` is a single request that transcribes, generates a reply, and synthesises speech.
That is eight seconds or more of nothing.

**The client shows three staged steps on a timer:** transcribing → thinking → generating her voice.
This is a fiction — there is one request and no progress events — but it is an honest one, because it
describes what is actually happening server-side and sets an expectation of duration. A single spinner
for eight seconds reads as a hang.

The transcript comes back and renders as an outgoing bubble labelled "Transcribed from your voice
note", so the user can see what she heard. Mis-transcription is common and invisible otherwise.

Playback is Media3 `ExoPlayer`. Audio URLs are relative (`/uploads/voice/...`) and must be resolved
against the API base URL.

### 5.3 Two backend blockers

**The route is double-prefixed.** `VoiceController` is declared `@Controller('api/v1/voice')` while
`main.ts` already sets a global prefix of `api/v1`, so the real path is `/api/v1/api/v1/voice/*`. The
client should target the correct path and the controller should be changed to `@Controller('voice')`.

**Voice endpoints have no `JwtAuthGuard`.** They are the most expensive endpoints in the product and
are currently open. This needs fixing before any build ships.

---

## 6. History

`GET /conversations` returns `id`, `title`, `lastMessageAt` — **no message preview**.

Rows therefore show the title and a relative time, not a snippet. A message preview is the single most
useful thing in a conversation list, so the honest options are: ship without it, or have the backend
include a `lastMessage` field. Recommend the latter; the design accommodates both.

Rows are 40dp avatar, title, secondary line, right-aligned relative time. The active conversation gets
a `surfaceContainerLow` background. "Start a new conversation" is a filled button at the bottom rather
than a FAB, because it is a deliberate rather than frequent action.

Swipe to delete calls `DELETE /conversations/:id`, with undo.

---

## 7. Usage limit

Free is 100 messages a month (`usage-limits.ts`). At the wall, the composer is disabled and a card
explains the reset date.

**The copy leads with what is safe.** "Your history and everything Aria remembers stays exactly as it
is." The fear at a paywall in this product is losing the relationship, not losing a feature, and that
fear will drive churn faster than the paywall drives conversion.

A soft warning appears at 80% so the wall is never a surprise mid-conversation.

**None of this is reachable today.** `MessagesService` never calls `UsageService.consume()`, so no
limit is enforced. The screen is designed and shipped behind the same check; it activates when the
backend wires up metering.

---

## 8. Accessibility

Each bubble is one merged semantics node reading sender, text, and time — not three separate stops.

The streaming bubble is `liveRegion = Polite` so its text is announced as it grows, and the caret is
excluded from semantics.

The typing indicator has `contentDescription = "Aria is typing"`. Three animated dots are otherwise
silent.

Recording announces start and stop; the timer is a polite live region updating every 5 seconds, not
every second.

The mic button is 48dp minimum and hold-to-talk has a tap-and-lock alternative for users who cannot
hold a press.

`FLAG_SECURE` is applied to the chat screen so conversation content is excluded from the recents
thumbnail.

---

## 9. Decisions

Settled: Chat tab opens the conversation; timestamps only on gaps; failures inline, never a snackbar;
staged voice progress; Stop discards rather than saves; regenerate shown disabled, edit omitted.

Open:

**No message pagination.** `GET /conversations/:id/messages` returns the entire history. That is fine
at 50 messages and a problem at 5,000. The client should cache in Room and render from there, but the
initial fetch will grow unboundedly. Cursor pagination is a backend prerequisite for launch.

**Deleting a message does not delete its memory.** `MessagesService.remove` removes the row; the
`Memory` extracted from it survives. A user who deletes something sensitive will reasonably expect it
forgotten. Either cascade the deletion or say plainly in the confirmation that memory is managed
separately.

**Blocking-send fallback.** If SSE fails, falling back to `POST /messages` gives a reply with no
streaming. Better than an error, but the transition is visible. Worth deciding whether to fall back
silently or tell the user the connection degraded.
