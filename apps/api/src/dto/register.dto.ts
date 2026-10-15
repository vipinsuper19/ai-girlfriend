import {
    Equals,
    IsBoolean,
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

    /** Optional 18+ attestation. true stores ageConfirmedAt. A date of birth is not accepted. */
    @IsOptional()
    @IsBoolean()
    @Equals(true)
    ageConfirmed?: true;
}