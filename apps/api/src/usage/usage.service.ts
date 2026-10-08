import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { SubscriptionsService } from '../subscriptions/subscriptions.service.js';
import {
    RecordUsageDto,
    UsageFeatureDto,
} from './dto/record-usage.dto.js';
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

    /**
     * The current contract has no billing-period columns on UsageRecord.
     * Therefore 9.3 uses calendar-month usage windows:
     * [first day of current month, first day of next month).
     *
     * When billing-period support is added, this method should be the
     * single place that changes.
     */
    private getCurrentPeriod() {
        const now = new Date();

        const start = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                1,
                0,
                0,
                0,
                0,
            ),
        );

        const end = new Date(
            Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth() + 1,
                1,
                0,
                0,
                0,
                0,
            ),
        );

        return {
            start: start.toISOString(),
            end: end.toISOString(),
        };
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

        const limit =
            USAGE_LIMITS[plan]?.[feature];

        const used =
            await this.getUsed(
                userId,
                feature,
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

        return this.db.orm.public.UsageRecord.create({
            userId,
            feature: dto.feature,
            quantity: dto.quantity,
            metadata:
                dto.metadata ?? null,
        });
    }

    /**
     * Atomic-at-application-level consume operation:
     * validate the requested amount, then persist one usage record.
     *
     * The database contract does not currently contain a usage counter,
     * so the source of truth remains append-only UsageRecord rows.
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

        return this.db.orm.public.UsageRecord.create({
            userId,
            feature,
            quantity,
            metadata: metadata ?? null,
        });
    }

    async getUsed(
        userId: number,
        feature: UsageFeatureDto,
    ): Promise<number> {
        const { start, end } =
            this.getCurrentPeriod();

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
                        );

                    const limit =
                        USAGE_LIMITS[plan][feature];

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
                    };
                }),
            );

        return {
            plan,
            subscriptionId:
                subscription.id,
            period:
                this.getCurrentPeriod(),
            usage,
        };
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
