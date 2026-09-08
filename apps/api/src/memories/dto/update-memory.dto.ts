import {
    IsIn,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    Min,
} from 'class-validator';

const MEMORY_TYPES = [
    'PROFILE',
    'PREFERENCE',
    'RELATIONSHIP',
    'CONVERSATION',
    'FACT',
] as const;

export class UpdateMemoryDto {
    @IsOptional()
    @IsString()
    content?: string;

    @IsOptional()
    @IsIn(MEMORY_TYPES)
    type?: (typeof MEMORY_TYPES)[number];

    @IsOptional()
    @IsInt()
    @Min(0)
    @Max(100)
    importance?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    confidence?: number;

    @IsOptional()
    @IsString()
    expiresAt?: string;
}
