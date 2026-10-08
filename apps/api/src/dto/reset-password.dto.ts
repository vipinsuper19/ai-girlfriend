import {
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class ResetPasswordDto {
    @IsString()
    @MinLength(1)
    @MaxLength(2048)
    token!: string;

    @IsString()
    @MinLength(8, { message: 'Use at least 8 characters.' })
    @MaxLength(128, { message: 'Keep the password under 128 characters.' })
    newPassword!: string;
}

export class CheckResetTokenDto {
    @IsString()
    @MinLength(1)
    @MaxLength(2048)
    token!: string;
}
