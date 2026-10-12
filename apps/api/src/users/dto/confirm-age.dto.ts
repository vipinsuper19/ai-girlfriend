import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ConfirmAgeDto {
    @IsString()
    @IsNotEmpty()
    @MaxLength(10)
    dateOfBirth!: string;

    @IsString()
    @IsNotEmpty()
    @MaxLength(40)
    ageConfirmedAt!: string;
}
