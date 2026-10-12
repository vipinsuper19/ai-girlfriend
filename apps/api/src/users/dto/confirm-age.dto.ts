import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmAgeDto {
    /** ISO calendar date (YYYY-MM-DD). Checked, then discarded. */
    @IsString()
    @IsNotEmpty()
    @MaxLength(10)
    dateOfBirth!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(40)
    ageConfirmedAt!: string;
}
