import {
    IsEnum,
    IsInt,
    IsObject,
    IsOptional,
    Min,
} from 'class-validator';

export enum UsageFeatureDto {
    TEXT_TOKENS = 'TEXT_TOKENS',
    MESSAGES = 'MESSAGES',
    IMAGE_GENERATIONS = 'IMAGE_GENERATIONS',
    VOICE_MINUTES = 'VOICE_MINUTES',
    AUDIO_CALL_MINUTES = 'AUDIO_CALL_MINUTES',
    VIDEO_CALL_MINUTES = 'VIDEO_CALL_MINUTES',
}

export class RecordUsageDto {
    @IsEnum(UsageFeatureDto)
    feature!: UsageFeatureDto;

    @IsInt()
    @Min(1)
    quantity!: number;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
