import { IsString, Matches, MaxLength } from 'class-validator';

export class GooglePlayPurchaseDto {
    @IsString()
    @Matches(/^[a-z0-9][a-z0-9._]*$/, { message: 'productId is not a Play product id' })
    @MaxLength(100)
    productId!: string;

    @IsString()
    @Matches(/^\S+$/, { message: 'purchaseToken must not contain spaces' })
    @MaxLength(4096)
    purchaseToken!: string;
}
