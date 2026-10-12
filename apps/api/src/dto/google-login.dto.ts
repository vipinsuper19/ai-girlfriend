import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleLoginDto {
    @IsString()
    @MinLength(1)
    @MaxLength(8192)
    idToken!: string;

    /** ISO calendar date (YYYY-MM-DD). Omit both age fields, or send both. */
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
