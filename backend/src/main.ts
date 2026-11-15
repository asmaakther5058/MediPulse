import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Comma-separated list, e.g. "http://localhost:5173,https://app.example.com".
  // Unset = allow all origins (development only).
  const origins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim());
  app.enableCors(origins?.length ? { origin: origins } : undefined);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Applies @Exclude() (e.g. User.passwordHash) to every response
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
