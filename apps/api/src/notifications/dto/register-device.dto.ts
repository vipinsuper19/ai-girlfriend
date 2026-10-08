import { IsIn, IsString, Matches, MaxLength } from 'class-validator';

import { DEVICE_PLATFORMS, type DevicePlatform } from '../push-message.js';

export class RegisterDeviceDto {
    @IsString()
    @Matches(/^\S+$/, { message: 'token must not contain spaces' })
    @MaxLength(4096)
    token!: string;

    @IsIn(DEVICE_PLATFORMS)
    platform!: DevicePlatform;
}
