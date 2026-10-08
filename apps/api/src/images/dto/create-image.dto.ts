import {
    IsInt,
    IsOptional,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';

import { IMAGE_PROMPT_MAX } from '../image-prompt.js';

export class CreateImageDto {
    @IsInt()
    @Min(1)
    companionId!: number;

    @IsOptional()
    @IsString()
    @MaxLength(IMAGE_PROMPT_MAX)
    prompt?: string;
}
