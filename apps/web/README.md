# Web (`apps/web`)

Next.js App Router client. Tokens stay in HttpOnly cookies via `/api/bff/*`.

```bash
pnpm --filter @ai-girlfriend/web dev
```

Runs on http://localhost:3000 and expects the API on http://localhost:3001.

Copy `.env.example` to `.env.local` and set `JWT_ACCESS_SECRET` to the same value as the API.
