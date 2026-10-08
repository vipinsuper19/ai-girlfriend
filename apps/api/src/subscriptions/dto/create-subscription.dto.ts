import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export enum SubscriptionPlanDto {
    FREE = 'FREE',
    PREMIUM = 'PREMIUM',
    PREMIUM_PLUS = 'PREMIUM_PLUS',
}

export class CreateSubscriptionDto {
    @IsEnum(SubscriptionPlanDto)
    plan!: SubscriptionPlanDto;

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
