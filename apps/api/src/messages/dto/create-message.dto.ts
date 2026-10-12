import {
    IsIn,
    IsObject,
    IsOptional,
    IsString,
    Matches,
    MaxLength,
} from 'class-validator';

import { MESSAGE_CONTENT_MAX } from '../message-limits.js';

/**
 * Clients write text only. Audio rows come from POST /voice/respond, which
 * stores the file itself, so a client cannot point a message at any URL.
 */
export class CreateMessageDto {
    @IsString()
    @Matches(/\S/, { message: 'content must not be blank' })
    @MaxLength(MESSAGE_CONTENT_MAX)
    content!: string;

    @IsOptional()
    @IsIn(['TEXT'])
    type?: 'TEXT';

    @IsOptional()
    @IsObject()
    metadata?: Record<string, unknown>;
}
