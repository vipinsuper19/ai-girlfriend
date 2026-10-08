import {
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class ChangePasswordDto {
    @IsString()
    @MinLength(1, { message: 'Enter your current password.' })
    @MaxLength(128)
    currentPassword!: string;

    @IsString()
    @MinLength(8, { message: 'Use at least 8 characters.' })
    @MaxLength(128, { message: 'Keep the password under 128 characters.' })
    newPassword!: string;
}
