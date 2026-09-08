import {
    IsArray,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUrl,
    Length,
    Max,
    Min,
} from 'class-validator';

export enum CompanionGender {
    FEMALE = 'FEMALE',
    MALE = 'MALE',
    OTHER = 'OTHER',
}

export class CreateAvatarDto {
    @IsString()
    @IsNotEmpty()
    @Length(2, 100)
    name!: string;

    @IsEnum(CompanionGender)
    gender!: CompanionGender;

    @IsOptional()
    @IsString()
    @Length(1, 5000)
    systemPrompt?: string;

    @IsOptional()
    @IsString()
    @Length(1, 1000)
    greeting?: string;

    @IsOptional()
    @IsObject()
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
    @IsObject()
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
    @IsObject()
    voice?: {
        provider?: string;
        voiceId?: string;
        language?: string;
        speed?: number;
        pitch?: number;
        settings?: Record<string, unknown>;
    };
}
