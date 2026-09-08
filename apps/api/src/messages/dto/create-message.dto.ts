import {
    IsIn,
    IsNotEmpty,
    IsObject,
    IsOptional,
    IsString,
    IsUrl,
    MaxLength,
} from 'class-validator';

export class CreateMessageDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(10000)
    content!: string;

    @IsOptional()
    @IsIn(['TEXT', 'AUDIO', 'IMAGE'])
    type?: 'TEXT' | 'AUDIO' | 'IMAGE';

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;

    @IsOptional()
    @IsUrl()
    audioUrl?: string;

    @IsOptional()
    @IsUrl()
    imageUrl?: string;
}