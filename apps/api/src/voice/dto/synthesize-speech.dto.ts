import {
    IsInt,
    IsNotEmpty,
    IsString,
    MaxLength,
    Min,
} from 'class-validator';

export class SynthesizeSpeechDto {
    @IsInt()
    @Min(1)
    companionId!: number;

    @IsString()
    @IsNotEmpty()
    @MaxLength(10_000)
    text!: string;
}