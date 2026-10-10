import {
    IsIn,
    IsInt,
    IsOptional,
    IsString,
    Matches,
    Max,
    MaxLength,
    Min,
} from 'class-validator';

import { MEMORY_CONTENT_MAX } from '../memory-list.js';

const MEMORY_TYPES = [
    'PROFILE',
    'PREFERENCE',
    'RELATIONSHIP',
    'CONVERSATION',
    'FACT',
] as const;

export class CreateMemoryDto {
    @IsInt()
    @Min(1)
    companionId!: number;

    @IsString()
    @Matches(/\S/, { message: 'content must not be blank' })
    @MaxLength(MEMORY_CONTENT_MAX)
    content!: string;

    @IsIn(MEMORY_TYPES)
    type!: (typeof MEMORY_TYPES)[number];

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(10)
    importance?: number;
}
