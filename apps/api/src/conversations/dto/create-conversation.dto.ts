import {
    IsInt,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateConversationDto {
    @Type(() => Number)
    @IsInt()
    @IsNotEmpty()
    companionId!: number;

    @IsOptional()
    @IsString()
    @MaxLength(255)
    title?: string;

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
