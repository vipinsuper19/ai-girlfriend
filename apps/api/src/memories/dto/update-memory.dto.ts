import {
    IsIn,
    IsInt,
    IsISO8601,
    IsNumber,
    IsOptional,
    IsString,
    Max,
    MaxLength,
    Min,
    ValidateIf,
} from 'class-validator';

import { MEMORY_CONTENT_MAX } from '../memory-list.js';

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
    @MaxLength(MEMORY_CONTENT_MAX)
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
    @ValidateIf((dto: UpdateMemoryDto) => dto.expiresAt !== '')
    @IsISO8601()
    expiresAt?: string;
}
