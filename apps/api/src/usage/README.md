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

The current `UsageRecord` contract has only `createdAt`, so Task 9.3 uses the
calendar month as the usage period.

If billing-period fields are introduced later, update `UsageService.getCurrentPeriod()`.

## Important product decision

The PRD specifies qualitative limits but does not specify numeric quotas.
This implementation therefore places explicit initial MVP defaults in
`usage-limits.ts`.

These are implementation defaults, not requirements from the PRD. They should
be replaced by admin-configurable limits before production billing.

## Integration rule

Do not call:

```ts
usageService.record(...)
```

after an AI operation when the operation can be denied.

Instead call:

```ts
await usageService.consume(...)
```

immediately before the paid/limited operation.

This prevents spending AI/provider resources after the user has already exceeded
their plan limit.

## Recommended integrations

### Text chat

Before AI generation:

```ts
await this.usageService.consume(
    userId,
    UsageFeatureDto.MESSAGES,
    1,
);
```

For provider-reported tokens, record token usage after the provider response:

```ts
await this.usageService.consume(
    userId,
    UsageFeatureDto.TEXT_TOKENS,
    totalTokens,
);
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
