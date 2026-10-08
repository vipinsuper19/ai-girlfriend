import {
    IsBoolean,
    IsOptional,
    IsString,
    Length,
} from 'class-validator';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @Length(2, 100)
    displayName?: string;

    @IsOptional()
    @IsBoolean()
    memoryPaused?: boolean;

    @IsOptional()
    @IsBoolean()
    notificationsEnabled?: boolean;
}
