import {
    BadRequestException,
    Body,
    Controller,
    Post,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';

import { FileInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '../decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../guards/jwt-auth.guard.js';
import type { JwtPayload } from '../interfaces/jwt-payload.interface.js';

import { SynthesizeSpeechDto } from './dto/synthesize-speech.dto.js';
import { VoiceService } from './voice.service.js';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
    constructor(
        private readonly voiceService: VoiceService,
    ) { }

    @Post('transcribe')
    @UseInterceptors(
        FileInterceptor('audio', {
            limits: {
                fileSize: 10 * 1024 * 1024,
            },
        }),
    )
    async transcribe(
        @UploadedFile()
        file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException(
                'Audio file is required',
            );
        }

        return this.voiceService.transcribe(
            file.buffer,
            file.mimetype,
        );
    }

    @Post('synthesize')
    async synthesize(
        @CurrentUser() user: JwtPayload,
        @Body() dto: SynthesizeSpeechDto,
    ) {
        return this.voiceService.synthesize(
            Number(user.sub),
            dto.companionId,
            dto.text,
        );
    }

    @Post('respond')
    @UseInterceptors(
        FileInterceptor('audio', {
            limits: {
                fileSize: 10 * 1024 * 1024,
            },
        }),
    )
    async respond(
        @CurrentUser() user: JwtPayload,
        @Body('conversationId') conversationId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException(
                'Audio file is required',
            );
        }

        return this.voiceService.respond(
            Number(user.sub),
            Number(conversationId),
            file.buffer,
            file.mimetype,
        );
    }
}
