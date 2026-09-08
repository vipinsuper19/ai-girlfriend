import {
    IsOptional,
    IsString,
    Length,
} from 'class-validator';

export class UpdateUserDto {
    @IsOptional()
    @IsString()
    @Length(2, 100)
    displayName?: string;
}