import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: process.env.TRUST_PROXY === 'true',
    }),
  );

  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: corsOrigins,
      credentials: process.env.CORS_CREDENTIALS === 'true',
    });
  }

  const port = Number(process.env.APP_PORT || process.env.PORT) || 3000;
  const host = process.env.APP_HOST || '0.0.0.0';

  await app.listen({ port, host });
  const url = await app.getUrl();

  console.log(`\nBackend Fastify corriendo en ${url}`);
}

bootstrap();
