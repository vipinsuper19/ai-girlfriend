import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListImagesDto {
    @IsOptional()
    @IsInt()
    @Min(1)
    companionId?: number;

    @IsOptional()
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number;
}
