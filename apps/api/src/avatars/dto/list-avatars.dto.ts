import { IsIn, IsOptional } from 'class-validator';

export class ListAvatarsDto {
    @IsOptional()
    @IsIn(['ACTIVE', 'ARCHIVED'])
    status?: 'ACTIVE' | 'ARCHIVED';
}
