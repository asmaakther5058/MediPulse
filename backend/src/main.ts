import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter.js';

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

  // Duplicate keys -> 409, still-in-use rows -> 409, never a raw SQL error
  app.useGlobalFilters(new DatabaseExceptionFilter());

  // Applies @Exclude() (e.g. User.passwordHash) to every response
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // Interactive API docs at /api/docs (click Authorize and paste the accessToken)
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MediPulse API')
    .setDescription('Patient, Doctor, Diagnostic Center and Admin endpoints')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig), {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(process.env.PORT ?? 3000);
}

await bootstrap();
