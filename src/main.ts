import * as crypto from 'crypto';
Object.assign(global, { crypto });
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // Ensure the database directory exists
  const dbPath = process.env.DATABASE_PATH || './data/marketplace.sqlite';
  mkdirSync(dirname(dbPath), { recursive: true });
  const app = await NestFactory.create(AppModule);

  // Global prefix for API routes
  app.setGlobalPrefix('api');

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT || 3000;
  console.log(`Starting server on 0.0.0.0:${port}...`);
  await app.listen(Number(port), '0.0.0.0');
  console.log(`Application is running on port ${port}`);
}
bootstrap().catch((err) => {
  console.error('Failed to start application:', err);
  process.exit(1);
});
