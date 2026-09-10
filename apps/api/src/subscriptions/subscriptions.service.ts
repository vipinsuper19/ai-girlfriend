import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import {
    CreateSubscriptionDto,
    SubscriptionPlanDto,
} from './dto/create-subscription.dto.js';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto.js';

@Injectable()
export class SubscriptionsService {
    constructor(
        private readonly prisma: PrismaService,
    ) {}

    private get db(): any {
        return this.prisma.client;
    }

    /**
     * Return the user's active/current subscription.
     *
     * If the user has never subscribed, a FREE subscription
     * is created so downstream usage enforcement always has
     * a subscription record to inspect.
     */
    async getCurrent(userId: number) {
        this.assertUserId(userId);

        const subscription =
            await this.db.orm.public.Subscription
                .where({
                    userId,
                    status: {
                        in: [
                            'ACTIVE',
                            'TRIALING',
                            'PAST_DUE',
                        ],
                    },
                })
                .orderBy((subscription: any) =>
                    subscription.createdAt.desc(),
                )
                .first();

        if (subscription) {
            return subscription;
        }

        return this.createFreeSubscription(userId);
    }

    /**
     * Return the user's latest subscription record, including
     * expired/canceled records when no current subscription exists.
     */
    async getLatest(userId: number) {
        this.assertUserId(userId);

        const subscription =
            await this.db.orm.public.Subscription
                .where({ userId })
                .orderBy((item: any) =>
                    item.createdAt.desc(),
                )
                .first();

        return subscription ?? this.createFreeSubscription(userId);
    }

    /**
     * Create a subscription record.
     *
     * This method is intended for the billing/payment integration
     * layer. Do not trust client-supplied provider identifiers in
     * a public purchase endpoint.
     */
    async create(
        userId: number,
        dto: CreateSubscriptionDto,
    ) {
        this.assertUserId(userId);

        if (dto.plan === SubscriptionPlanDto.FREE) {
            return this.createFreeSubscription(userId);
        }

        const now = new Date().toISOString();

        return this.db.orm.public.Subscription.create({
            userId,
            plan: dto.plan,
            provider: dto.provider ?? null,
            providerSubscriptionId:
                dto.providerSubscriptionId ?? null,
            status: 'ACTIVE',
            startedAt:
                dto.startedAt ?? now,
            expiresAt:
                dto.expiresAt ?? null,
            updatedAt: now,
        });
    }

    /**
     * Update an existing subscription owned by the user.
     */
    async update(
        userId: number,
        subscriptionId: number,
        dto: UpdateSubscriptionDto,
    ) {
        this.assertUserId(userId);
        this.assertId(subscriptionId, 'subscriptionId');

        const existing =
            await this.db.orm.public.Subscription
                .where({
                    id: subscriptionId,
                    userId,
                })
                .first();

        if (!existing) {
            throw new NotFoundException(
                'Subscription not found',
            );
        }

        const data: Record<string, unknown> = {};

        if (dto.plan !== undefined) {
            data.plan = dto.plan;
        }

        if (dto.status !== undefined) {
            data.status = dto.status;
        }

        if (dto.provider !== undefined) {
            data.provider = dto.provider;
        }

        if (
            dto.providerSubscriptionId !== undefined
        ) {
            data.providerSubscriptionId =
                dto.providerSubscriptionId;
        }

        if (dto.startedAt !== undefined) {
            data.startedAt = dto.startedAt;
        }

        if (dto.expiresAt !== undefined) {
            data.expiresAt = dto.expiresAt;
        }

        if (Object.keys(data).length === 0) {
            throw new BadRequestException(
                'At least one subscription field is required',
            );
        }

        data.updatedAt = new Date().toISOString();

        return this.db.orm.public.Subscription
            .where({
                id: subscriptionId,
                userId,
            })
            .update(data);
    }

    /**
     * Internal billing helper for activating/updating a provider
     * subscription without exposing payment-provider details to
     * normal client APIs.
     */
    async activateProviderSubscription(params: {
        userId: number;
        plan: 'PREMIUM' | 'PREMIUM_PLUS';
        provider: string;
        providerSubscriptionId: string;
        startedAt?: string;
        expiresAt?: string | null;
    }) {
        this.assertUserId(params.userId);

        if (!params.providerSubscriptionId.trim()) {
            throw new BadRequestException(
                'providerSubscriptionId is required',
            );
        }

        const existing =
            await this.db.orm.public.Subscription
                .where({
                    providerSubscriptionId:
                        params.providerSubscriptionId,
                })
                .first();

        const now = new Date().toISOString();

        if (existing) {
            return this.db.orm.public.Subscription
                .where({ id: existing.id })
                .update({
                    userId: params.userId,
                    plan: params.plan,
                    provider: params.provider,
                    providerSubscriptionId:
                        params.providerSubscriptionId,
                    status: 'ACTIVE',
                    startedAt:
                        params.startedAt ?? existing.startedAt,
                    expiresAt:
                        params.expiresAt ?? existing.expiresAt,
                    updatedAt: now,
                });
        }

        return this.db.orm.public.Subscription.create({
            userId: params.userId,
            plan: params.plan,
            provider: params.provider,
            providerSubscriptionId:
                params.providerSubscriptionId,
            status: 'ACTIVE',
            startedAt:
                params.startedAt ?? now,
            expiresAt:
                params.expiresAt ?? null,
            updatedAt: now,
        });
    }

    private async createFreeSubscription(
        userId: number,
    ) {
        const existing =
            await this.db.orm.public.Subscription
                .where({
                    userId,
                    plan: 'FREE',
                    status: 'ACTIVE',
                })
                .orderBy((subscription: any) =>
                    subscription.createdAt.desc(),
                )
                .first();

        if (existing) {
            return existing;
        }

        const now = new Date().toISOString();

        return this.db.orm.public.Subscription.create({
            userId,
            plan: 'FREE',
            provider: null,
            providerSubscriptionId: null,
            status: 'ACTIVE',
            startedAt: now,
            expiresAt: null,
            updatedAt: now,
        });
    }

    private assertUserId(userId: number) {
        if (!Number.isInteger(userId) || userId <= 0) {
            throw new BadRequestException(
                'Invalid user id',
            );
        }
    }

    private assertId(
        value: number,
        name: string,
    ) {
        if (!Number.isInteger(value) || value <= 0) {
            throw new BadRequestException(
                `Invalid ${name}`,
            );
        }
    }
}
