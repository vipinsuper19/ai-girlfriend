import {
    IsEmail,
    IsNotEmpty,
    IsOptional,
    IsString,
    MaxLength,
    MinLength,
} from 'class-validator';

export class RegisterDto {
    @IsEmail()
    @IsNotEmpty()
    email!: string;

    @IsString()
    @MinLength(8)
    @MaxLength(128)
    password!: string;

    @IsString()
    @MinLength(2)
    @MaxLength(100)
    displayName!: string;

    /** ISO calendar date (YYYY-MM-DD). Checked, then discarded. Omit both age fields, or send both. */
    @IsOptional()
    @IsString()
    @MaxLength(10)
    dateOfBirth?: string;

    /** ISO-8601 timestamp for when the person confirmed they are 18 or older. */
    @IsOptional()
    @IsString()
    @MaxLength(40)
    ageConfirmedAt?: string;
}