import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import {
    RecordUsageDto,
    UsageFeatureDto,
} from './dto/record-usage.dto.js';
import {
    limitFor,
    windowFor,
} from './free-tier-llm.js';
import {
    SubscriptionPlan,
    USAGE_LIMITS,
} from './usage-limits.js';
import { UsageLimitExceededException } from './usage.exceptions.js';

@Injectable()
export class UsageService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly subscriptionsService: SubscriptionsService,
    ) {}

    private get db(): any {
        return this.prisma.client;
    }

    async check(
        userId: number,
        feature: UsageFeatureDto,
        quantity = 1,
    ) {
        this.assertPositiveQuantity(quantity);

        const subscription =
            await this.subscriptionsService.getCurrent(
                userId,
            );

        const plan =
            subscription.plan as SubscriptionPlan;

        const limit = limitFor(plan, feature);
        const window = windowFor(plan, feature);

        const used =
            await this.getUsed(
                userId,
                feature,
                plan,
            );

        if (limit === undefined) {
            throw new BadRequestException(
                `No usage limit configured for ${plan}/${feature}`,
            );
        }

        if (
            limit !== null &&
            used + quantity > limit
        ) {
            throw new UsageLimitExceededException(
                feature,
                limit,
                used,
                quantity,
                {
                    period: window.period,
                    resetsAt: window.end,
                },
            );
        }

        return {
            allowed: true,
            feature,
            plan,
            limit,
            used,
            requested: quantity,
            remaining:
                limit === null
                    ? null
                    : Math.max(
                        0,
                        limit - used - quantity,
                    ),
            period: window.period,
            resetsAt: window.end,
        };
    }

    async record(
        userId: number,
        dto: RecordUsageDto,
    ) {
        this.assertPositiveQuantity(
            dto.quantity,
        );

        await this.check(
            userId,
            dto.feature,
            dto.quantity,
        );

        return this.write(
            userId,
            dto.feature,
            dto.quantity,
            dto.metadata,
        );
    }

    /**
     * Atomic-at-application-level consume operation:
     * validate the requested amount, then persist one usage record.
     *
     * Chat replies do not use this. They check first and `charge` only after
     * the model returns a reply, so a failed or aborted generation is free.
     */
    async consume(
        userId: number,
        feature: UsageFeatureDto,
        quantity = 1,
        metadata?: Record<string, unknown>,
    ) {
        await this.check(
            userId,
            feature,
            quantity,
        );

        return this.write(
            userId,
            feature,
            quantity,
            metadata,
        );
    }

    /**
     * Persist usage for work that already succeeded. Does not re-check the
     * cap: the caller checked before spending provider time, and a reply
     * that finished must count even if a concurrent request landed first.
     *
     * Accepted MVP limitation: check and charge are not one transaction, so
     * overlapping requests can record a few units past the free-tier cap.
     */
    async charge(
        userId: number,
        feature: UsageFeatureDto,
        quantity = 1,
        metadata?: Record<string, unknown>,
    ) {
        this.assertPositiveQuantity(quantity);
        return this.write(userId, feature, quantity, metadata);
    }

    async getUsed(
        userId: number,
        feature: UsageFeatureDto,
        plan?: SubscriptionPlan,
    ): Promise<number> {
        const resolved = plan ?? await this.planFor(userId);
        const { start, end } = windowFor(resolved, feature);

        const records =
            await this.db.orm.public.UsageRecord
                .where({
                    userId,
                    feature,
                })
                .all();

        return records
            .filter((record: any) => {
                const createdAt =
                    new Date(record.createdAt)
                        .toISOString();

                return (
                    createdAt >= start &&
                    createdAt < end
                );
            })
            .reduce(
                (
                    total: number,
                    record: any,
                ) =>
                    total +
                    Number(record.quantity),
                0,
            );
    }

    async getSummary(userId: number) {
        const subscription =
            await this.subscriptionsService.getCurrent(
                userId,
            );

        const plan =
            subscription.plan as SubscriptionPlan;

        const features =
            Object.keys(
                USAGE_LIMITS[plan] ?? {},
            ) as UsageFeatureDto[];

        const usage =
            await Promise.all(
                features.map(async (feature) => {
                    const used =
                        await this.getUsed(
                            userId,
                            feature,
                            plan,
                        );

                    const limit = limitFor(plan, feature);
                    const window = windowFor(plan, feature);

                    return {
                        feature,
                        used,
                        limit:
                            limit === undefined
                                ? null
                                : limit,
                        remaining:
                            limit === null ||
                            limit === undefined
                                ? null
                                : Math.max(
                                    0,
                                    limit - used,
                                ),
                        period: window.period,
                        resetsAt: window.end,
                    };
                }),
            );

        const messageWindow = windowFor(
            plan,
            UsageFeatureDto.MESSAGES,
        );

        return {
            plan,
            subscriptionId:
                subscription.id,
            period: {
                start: messageWindow.start,
                end: messageWindow.end,
            },
            usage,
        };
    }

    private async planFor(userId: number): Promise<SubscriptionPlan> {
        const subscription = await this.subscriptionsService.getCurrent(userId);
        return subscription.plan as SubscriptionPlan;
    }

    private write(
        userId: number,
        feature: UsageFeatureDto,
        quantity: number,
        metadata?: Record<string, unknown> | null,
    ) {
        return this.db.orm.public.UsageRecord.create({
            userId,
            feature,
            quantity,
            metadata: metadata ?? null,
        });
    }

    private assertPositiveQuantity(
        quantity: number,
    ) {
        if (
            !Number.isFinite(quantity) ||
            quantity <= 0
        ) {
            throw new BadRequestException(
                'Usage quantity must be greater than zero',
            );
        }
    }
}
