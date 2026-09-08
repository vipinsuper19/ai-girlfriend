import {
    IsEnum,
    IsOptional,
    IsString,
    Length,
} from 'class-validator';

import { CompanionGender } from './create-avatar.dto.js';

export class UpdateAvatarDto {
    @IsOptional()
    @IsString()
    @Length(2, 100)
    name?: string;

    @IsOptional()
    @IsEnum(CompanionGender)
    gender?: CompanionGender;

    @IsOptional()
    @IsString()
    @Length(1, 5000)
    systemPrompt?: string;

    @IsOptional()
    @IsString()
    @Length(1, 1000)
    greeting?: string;

    @IsOptional()
    appearance?: {
        age?: number;
        ethnicity?: string;
        skinTone?: string;
        hairColor?: string;
        hairStyle?: string;
        eyeColor?: string;
        bodyType?: string;
        height?: string;
        clothingStyle?: string;
        avatarUrl?: string;
        imagePrompt?: string;
        metadata?: Record<string, unknown>;
    };

    @IsOptional()
    personality?: {
        traits?: unknown[];
        interests?: unknown[];
        likes?: unknown;
        dislikes?: unknown;
        humorLevel?: number;
        flirtLevel?: number;
        empathyLevel?: number;
        romanceLevel?: number;
        communicationStyle?: string;
        metadata?: Record<string, unknown>;
    };

    @IsOptional()
    voice?: {
        provider?: string;
        voiceId?: string;
        language?: string;
        speed?: number;
        pitch?: number;
        settings?: Record<string, unknown>;
    };
}
