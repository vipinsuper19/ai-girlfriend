import 'dotenv/config';

import {
  ValidationPipe,
  VersioningType
} from '@nestjs/common';

import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

import helmet from 'helmet';
//import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { API_BASE_PATH } from './common/constants/api.constants.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
  );

  // const configService = app.get(ConfigService);

  app.use(helmet());
  // app.setGlobalPrefix('api');

  // app.enableVersioning({
  //   type: VersioningType.URI,
  //   defaultVersion: '1'
  // });

  app.enableCors({
    // origin: configService.get<string>(
    //   'app.corsOrigin'
    // ),
    origin: process.env['CORS_ORIGIN']?.split(',') ?? [
      'http://localhost:3000',
      'http://localhost:5173',
    ],
    credentials: true,
    methods: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS'
    ],
    allowedHeaders: [
      'Content-Type',
      'Authorization'
    ]
  });

  app.setGlobalPrefix(API_BASE_PATH);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true
      }
    })
  );

  // app.useGlobalFilters(
  //   new GlobalExceptionFilter()
  // );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new ResponseInterceptor()
  );

  app.useStaticAssets(
    join(process.cwd(), 'uploads'),
    {
      prefix: '/uploads/',
    },
  );


  //const port =configService.get<number>('app.port') ?? 3001;
  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port);

  console.log(`API running on http://localhost:${port}/${API_BASE_PATH}`);
  // console.log(
  //   `API running on http://localhost:${port}/api/v1`
  // );
}

bootstrap();