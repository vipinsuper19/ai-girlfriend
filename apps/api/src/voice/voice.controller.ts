import {
    BadRequestException,
    Body,
    Controller,
    Post,
    Req,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';

import {
    FileInterceptor,
} from '@nestjs/platform-express';

import { VoiceService } from './voice.service.js';

import {
    SynthesizeSpeechDto,
} from './dto/synthesize-speech.dto.js';

@Controller('api/v1/voice')
export class VoiceController {
    constructor(
        private readonly voiceService:
            VoiceService,
    ) { }

    @Post('transcribe')
    @UseInterceptors(
        FileInterceptor('audio', {
            limits: {
                fileSize:
                    10 * 1024 * 1024,
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
        @Req() request: any,
        @Body()
        dto: SynthesizeSpeechDto,
    ) {
        return this.voiceService.synthesize(
            Number(request.user.id),
            dto.companionId,
            dto.text,
        );
    }

    @Post('respond')
    @UseInterceptors(
        FileInterceptor('audio', {
            limits: {
                fileSize:
                    10 * 1024 * 1024,
            },
        }),
    )
    async respond(
        @Req() request: any,
        @Body('conversationId')
        conversationId: string,
        @UploadedFile()
        file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException(
                'Audio file is required',
            );
        }

        return this.voiceService.respond(
            Number(request.user.id),
            Number(conversationId),
            file.buffer,
            file.mimetype,
        );
    }
}