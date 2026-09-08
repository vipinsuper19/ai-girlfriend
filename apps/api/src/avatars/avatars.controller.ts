import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';

import {
    FileTypeValidator,
    MaxFileSizeValidator,
    ParseFilePipe,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

import { AvatarsService } from './avatars.service.js';
import { CreateAvatarDto } from './dto/create-avatar.dto.js';
import { UpdateAvatarDto } from './dto/update-avatar.dto.js';

@Controller('avatars')
@UseGuards(JwtAuthGuard)
export class AvatarsController {
    constructor(
        private readonly avatarsService: AvatarsService,
    ) { }

    @Post()
    async create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateAvatarDto,
    ) {
        return this.avatarsService.create(
            String(user.sub),
            dto,
        );
    }

    @Get()
    async findAll(
        @CurrentUser() user: JwtPayload,
    ) {
        return this.avatarsService.findAll(
            String(user.sub),
        );
    }

    @Get(':id')
    async findOne(
        @CurrentUser() user: JwtPayload,
        @Param('id') companionId: string,
    ) {
        return this.avatarsService.getOne(
            String(user.sub),
            companionId,
        );
    }

    @Patch(':id')
    async update(
        @CurrentUser() user: JwtPayload,
        @Param('id') avatarId: string,
        @Body() dto: UpdateAvatarDto,
    ) {
        return this.avatarsService.update(
            String(user.sub),
            avatarId,
            dto,
        );
    }

    @Delete(':id')
    async remove(
        @CurrentUser() user: JwtPayload,
        @Param('id') avatarId: string,
    ) {
        return this.avatarsService.remove(
            String(user.sub),
            avatarId,
        );
    }

    @Post(':id/avatar')
    @UseInterceptors(
        FileInterceptor('file'),
    )
    async uploadAvatar(
        @CurrentUser() user: JwtPayload,
        @Param('id') companionId: string,
        @UploadedFile(
            new ParseFilePipe({
                validators: [
                    new MaxFileSizeValidator({
                        maxSize: 5 * 1024 * 1024,
                    }),
                    new FileTypeValidator({
                        fileType: /^image\/(jpeg|png|webp)$/,
                    }),
                ],
            }),
        )
        file: Express.Multer.File,
    ) {
        return this.avatarsService.uploadAvatar(
            user.sub,
            companionId,
            file,
        );
    }
}