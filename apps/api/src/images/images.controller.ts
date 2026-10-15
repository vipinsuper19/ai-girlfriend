import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';

import { ParseEntityIdPipe } from '../common/pipes/parse-entity-id.pipe.js';
import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';
import { CreateImageDto } from './dto/create-image.dto.js';
import { ListImagesDto } from './dto/list-images.dto.js';
import { ImagesService } from './images.service.js';

@Controller('images')
@UseGuards(JwtAuthGuard)
export class ImagesController {
    constructor(
        private readonly images: ImagesService,
    ) { }

    @Post()
    create(
        @CurrentUser() user: JwtPayload,
        @Body() dto: CreateImageDto,
    ) {
        return this.images.create(Number(user.sub), dto);
    }

    @Get()
    findAll(
        @CurrentUser() user: JwtPayload,
        @Query() query: ListImagesDto,
    ) {
        return this.images.findAll(Number(user.sub), query);
    }

    @Get(':id')
    findOne(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) id: number,
    ) {
        return this.images.findOne(Number(user.sub), id);
    }

    @Delete(':id')
    remove(
        @CurrentUser() user: JwtPayload,
        @Param('id', ParseEntityIdPipe) id: number,
    ) {
        return this.images.remove(Number(user.sub), id);
    }
}
