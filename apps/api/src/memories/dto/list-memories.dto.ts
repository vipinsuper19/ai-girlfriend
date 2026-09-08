import {
    IsIn,
    IsInt,
    IsOptional,
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

export class ListMemoriesDto {
    @IsOptional()
    @IsIn(MEMORY_TYPES)
    type?: (typeof MEMORY_TYPES)[number];

    @IsOptional()
    @IsInt()
    @Min(1)
    companionId?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    conversationId?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 50;
}
