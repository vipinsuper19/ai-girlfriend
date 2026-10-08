# Web application design

Five documents covering every consumer screen for `apps/web`. They port the Android visual language
and decide everything Android did not have to: breakpoints, shells, the BFF, SSE over `fetch`, and
which API gaps the UI must absorb rather than pretend away.

| Doc | What it covers |
|---|---|
| [01-foundation.md](./01-foundation.md) | Tokens, type, shells, nav, BFF, components, endpoint reality |
| [02-authentication.md](./02-authentication.md) | Landing, login, signup, forgot/reset, middleware |
| [03-onboarding-and-home.md](./03-onboarding-and-home.md) | Wizard + Home |
| [04-chat-and-voice.md](./04-chat-and-voice.md) | Thread, SSE, history, voice, usage wall |
| [05-companion-memory-account.md](./05-companion-memory-account.md) | Companion, memory, account, subscription, system screens |

Canvases (open beside the chat): `web-design-foundation`, `web-auth-screens`, `web-onboarding-home`,
`web-chat-voice`, `web-companion-memory-account`.

The Android sibling set is in [`docs/design/`](../design/). Do not fork the palette from there.
