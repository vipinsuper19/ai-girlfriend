import 'dotenv/config';

import {
  ValidationPipe,
  VersioningType
} from '@nestjs/common';

import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

import helmet from 'helmet';
//import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { API_BASE_PATH, UNPREFIXED_ROUTES } from './common/constants/api.constants.js';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule,
  );

  // const configService = app.get(ConfigService);

  app.use(helmet());
  // Render terminates TLS and appends the client to X-Forwarded-For.
  // One trusted hop makes req.ip that client. TRUST_PROXY_HOPS=0 keeps the socket address.
  const trustProxyHops = Number(process.env['TRUST_PROXY_HOPS'] ?? 1);
  app.set(
    'trust proxy',
    Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1,
  );
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

  // /health stays unprefixed for the Render health check. Play Store
  // pages (/privacy, /account-deletion) stay unprefixed too.
  app.setGlobalPrefix(API_BASE_PATH, { exclude: [...UNPREFIXED_ROUTES] });

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
    new ResponseInterceptor(app.get(Reflector)),
  );

  app.useStaticAssets(
    join(process.cwd(), 'uploads'),
    {
      prefix: '/uploads/',
    },
  );


  //const port =configService.get<number>('app.port') ?? 3001;
  const port = Number(process.env['PORT'] ?? 3001);
  await app.listen(port, '0.0.0.0');

  console.log(`API running on http://localhost:${port}/${API_BASE_PATH}`);
  // console.log(
  //   `API running on http://localhost:${port}/api/v1`
  // );
}

bootstrap();