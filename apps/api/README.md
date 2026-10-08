<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ pnpm install
```

Apply the schema to the database after pulling (this branch uses `DeviceToken` and `ImageGeneration`):

```bash
$ pnpm --filter @ai-girlfriend/api exec prisma db update
```

## Configuration

Every feature below stays off until its variables are set. Unconfigured features answer `503` and the
clients hide the matching controls, so nothing is faked.

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Postgres connection |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN` | Session tokens |
| `JWT_RESET_SECRET` | Password reset tokens. Falls back to a value derived from `JWT_ACCESS_SECRET` |
| `APP_URL` | Web origin used in reset links, e.g. `https://app.example.com` |
| `SMTP_URL`, `MAIL_FROM` | Outgoing mail. Without `SMTP_URL` mail is written to the log, which is for development only |
| `GOOGLE_CLIENT_IDS` | Comma-separated OAuth client ids accepted by `POST /auth/google` (web) |
| `FIREBASE_PROJECT_ID` | Firebase ID tokens accepted by `POST /auth/google` (Android) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push notifications through FCM. Raw JSON or base64 |
| `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_STT_MODEL`, `GEMINI_TTS_MODEL`, `GEMINI_IMAGE_MODEL` | Chat, voice, and images |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Android Publisher API access for verifying purchases. Raw JSON or base64 |
| `GOOGLE_PLAY_PACKAGE_NAME` | Android application id the subscriptions belong to |
| `GOOGLE_PLAY_PRODUCTS` | Product to plan map, e.g. `premium_monthly:PREMIUM,plus_monthly:PREMIUM_PLUS` |
| `CORS_ORIGIN`, `PORT` | HTTP server |

### Google Play subscriptions

A plan changes only after `POST /api/v1/subscriptions/google-play` fetches the purchase from Google,
finds this user's obfuscated account id on it (from `GET /subscriptions/google-play`), and sees an
active, unexpired line item for the product. The server then acknowledges the purchase. Real-time
developer notifications are not wired yet, so renewals and cancellations reach the server when the app
re-sends owned purchases on the Plan screen; a lapsed `expiresAt` drops the user back to Free.

### Routes added for the clients

All under `/api/v1`, wrapped as `{ data }`.

| Route | Purpose |
| --- | --- |
| `POST /auth/google` | Exchange a Google or Firebase ID token for a session |
| `POST /auth/password/forgot` | Always `200` with the same body; mails a 30-minute reset link when the account exists |
| `POST /auth/password/reset/check` | `{ valid }` for a token without using it, so link scanners cannot spend it |
| `POST /auth/password/reset` | Set a new password; ends every session |
| `POST /auth/email` | Change the sign-in email (requires the current password) |
| `GET /users/me/export` | Everything stored for the account as JSON |
| `PATCH /users/me` | Also takes `memoryPaused` and `notificationsEnabled` |
| `POST /memories` | Add a memory by hand |
| `POST /messages/:id/regenerate` | Replace her newest reply |
| `POST /images`, `GET /images`, `GET /images/:id`, `DELETE /images/:id` | Generated photo gallery |
| `GET /notifications/status`, `POST /notifications/devices`, `DELETE /notifications/devices/:token`, `POST /notifications/test` | Push devices |
| `GET /subscriptions/google-play`, `POST /subscriptions/google-play` | Play Billing config and purchase verification |

Neither auth route is rate limited yet; put a limit in front of `password/forgot` before going public.

## Compile and run the project

```bash
# development
$ pnpm run start

# watch mode
$ pnpm run start:dev

# production mode
$ pnpm run start:prod
```

## Run tests

```bash
# unit tests
$ pnpm run test

# e2e tests
$ pnpm run test:e2e

# test coverage
$ pnpm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ pnpm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observer](https://observer.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
