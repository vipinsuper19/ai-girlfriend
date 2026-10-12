import { Equals, IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GoogleLoginDto {
    @IsString()
    @MinLength(1)
    @MaxLength(8192)
    idToken!: string;

    /** Optional 18+ attestation. true stores ageConfirmedAt. A date of birth is not accepted. */
    @IsOptional()
    @IsBoolean()
    @Equals(true)
    ageConfirmed?: true;
}
