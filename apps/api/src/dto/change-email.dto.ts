import {
    IsEmail,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class ChangeEmailDto {
    @IsString()
    @MinLength(1, { message: 'Enter your password.' })
    @MaxLength(128)
    password!: string;

    @IsEmail({}, { message: 'Enter a valid email.' })
    @MaxLength(254)
    newEmail!: string;
}
