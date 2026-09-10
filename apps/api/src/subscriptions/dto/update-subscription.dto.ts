import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export enum SubscriptionStatusDto {
    ACTIVE = 'ACTIVE',
    TRIALING = 'TRIALING',
    PAST_DUE = 'PAST_DUE',
    CANCELED = 'CANCELED',
    EXPIRED = 'EXPIRED',
}

export class UpdateSubscriptionDto {
    @IsOptional()
    @IsEnum(SubscriptionStatusDto)
    status?: SubscriptionStatusDto;

    @IsOptional()
    @IsEnum({
        FREE: 'FREE',
        PREMIUM: 'PREMIUM',
        PREMIUM_PLUS: 'PREMIUM_PLUS',
    })
    plan?: 'FREE' | 'PREMIUM' | 'PREMIUM_PLUS';

    @IsOptional()
    @IsString()
    provider?: string;

    @IsOptional()
    @IsString()
    providerSubscriptionId?: string;

    @IsOptional()
    @IsDateString()
    startedAt?: string;

    @IsOptional()
    @IsDateString()
    expiresAt?: string;
}
