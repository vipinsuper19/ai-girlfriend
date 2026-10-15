import { Equals, IsBoolean } from 'class-validator';

/** 18+ attestation. A date of birth is not accepted. */
export class ConfirmAgeDto {
    @IsBoolean()
    @Equals(true)
    ageConfirmed!: true;
}
