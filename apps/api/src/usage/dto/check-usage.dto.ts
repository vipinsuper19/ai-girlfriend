import {
    IsEnum,
    IsInt,
    Min,
} from 'class-validator';

import { UsageFeatureDto } from './record-usage.dto.js';

export class CheckUsageDto {
    @IsEnum(UsageFeatureDto)
    feature!: UsageFeatureDto;

    @IsInt()
    @Min(1)
    quantity!: number;
}
