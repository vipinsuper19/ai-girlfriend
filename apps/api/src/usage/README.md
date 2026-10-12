# Task 9.3 — Usage Tracking & Limits

## Purpose

Track subscription usage and enforce plan limits before expensive operations.

The PRD defines these usage dimensions:

- Text Tokens
- Messages
- Image Generations
- Voice Minutes
- Audio Call Minutes
- Video Call Minutes

## Current period

`UsageRecord` has only `createdAt`. Image, voice, and paid-plan chat use the
UTC calendar month. Free-tier chat (messages and estimated tokens) uses a UTC
day by default so the cap resets at midnight. `FREE_TIER_LLM_PERIOD=month`
switches that cap back to the calendar month.

## Important product decision

The PRD specifies qualitative limits but does not specify numeric quotas.
This implementation therefore places explicit initial MVP defaults in
`usage-limits.ts`.

These are implementation defaults, not requirements from the PRD. They should
be replaced by admin-configurable limits before production billing.

## Integration rule

Check the cap before calling a provider. Do not call `consume` or `record` in a
way that bills the user for work the provider never finished.

Chat replies (`MessagesService`) call `check` first, then `charge` only after a
successful assistant reply. A provider error, an empty reply, or a client
disconnect / Stop does not write a usage row.

Accepted MVP limitation: that check and the later charge are not one
transaction. Two requests can both pass the check and both finish, so a free
account can sit slightly over the cap. There is no reservation row. The next
request is refused.

Images, voice, and other operations that still reserve capacity up front call:

```ts
await usageService.consume(...)
```

immediately before the paid operation.

## Recommended integrations

### Text chat

Check both caps before generation. Charge message count and estimated tokens
only after the assistant reply is persisted:

```ts
await this.usageService.check(userId, UsageFeatureDto.MESSAGES, 1);
await this.usageService.check(userId, UsageFeatureDto.TEXT_TOKENS, 1);
// ...generate...
await this.usageService.charge(userId, UsageFeatureDto.MESSAGES, 1);
await this.usageService.charge(userId, UsageFeatureDto.TEXT_TOKENS, totalTokens);
```

### Image generation

Before provider call:

```ts
await this.usageService.consume(
    userId,
    UsageFeatureDto.IMAGE_GENERATIONS,
    1,
);
```

### Voice

Before accepting a voice operation, enforce the appropriate voice quota.
For duration-based charging, record actual audio seconds converted to minutes
according to the billing policy.

### Calls

Record actual call duration after the call ends. Do not reserve the full call
duration as usage unless the product explicitly chooses reservation billing.
