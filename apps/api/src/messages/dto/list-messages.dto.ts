import {
    IsInt,
    IsOptional,
    Max,
    Min,
} from 'class-validator';

import { MESSAGE_PAGE_MAX } from '../message-page.js';

export class ListMessagesDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    before?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(MESSAGE_PAGE_MAX)
    limit?: number;
}
