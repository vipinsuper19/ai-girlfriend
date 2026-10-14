import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
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

import { AgeConfirmedGuard } from '../auth/age-confirmed.guard.js';
import { ParseEntityIdPipe } from '../common/pipes/parse-entity-id.pipe.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

import { AvatarsService } from './avatars.service.js';
import { CreateAvatarDto } from './dto/create-avatar.dto.js';
import { ListAvatarsDto } from './dto/list-avatars.dto.js';
import { UpdateAvatarDto } from './dto/update-avatar.dto.js';

@Controller('avatars')
@UseGuards(JwtAuthGuard)
export class AvatarsController {
    constructor(
        private readonly avatarsService: AvatarsService,
    ) { }

    @Post()
    @UseGuards(AgeConfirmedGuard)
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
        @Query() query: ListAvatarsDto,
    ) {
        return this.avatarsService.findAll(
            String(user.sub),
            query.status,
        );
    }

    @Get(':id')
    async findOne(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) companionId: number,
    ) {
        return this.avatarsService.getOne(
            String(user.sub),
            String(companionId),
        );
    }

    @Patch(':id')
    async update(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) avatarId: number,
        @Body() dto: UpdateAvatarDto,
    ) {
        return this.avatarsService.update(
            String(user.sub),
            String(avatarId),
            dto,
        );
    }

    @Delete(':id')
    async remove(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) avatarId: number,
    ) {
        return this.avatarsService.remove(
            String(user.sub),
            String(avatarId),
        );
    }

    @Post(':id/restore')
    async restore(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) companionId: number,
    ) {
        return this.avatarsService.restore(
            String(user.sub),
            String(companionId),
        );
    }

    @Post(':id/avatar')
    @UseInterceptors(
        FileInterceptor('file'),
    )
    async uploadAvatar(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) companionId: number,
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
            String(companionId),
            file,
        );
    }
}