import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  validateSync,
} from 'class-validator';
import type { ValidationError } from 'class-validator';

const PLACEHOLDER_SECRETS = new Set([
  'change_me_to_a_long_random_secret',
  'secret',
  'changeme',
]);

// Every setting the app reads from .env. Checked once at start-up:
// if anything required is missing or wrong, the app refuses to start and
// lists every problem at once (instead of failing later in odd places).
class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: 'development' | 'production' | 'test' = 'development';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  // Comma-separated, e.g. http://localhost:5173,https://medipulse.app
  @IsOptional()
  @IsString()
  CORS_ORIGINS?: string;

  // Database
  @IsString()
  @IsNotEmpty()
  DB_HOST: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  DB_PORT: number = 5432;

  @IsString()
  @IsNotEmpty()
  DB_USERNAME: string;

  // May be empty for a local server that trusts local connections
  @IsString()
  DB_PASSWORD: string;

  @IsString()
  @IsNotEmpty()
  DB_DATABASE: string;

  @IsOptional()
  @IsIn(['true', 'false'])
  DB_LOGGING?: string;

  // Auth
  @IsString()
  @IsNotEmpty()
  JWT_SECRET: string;

  // Seconds
  @IsOptional()
  @IsInt()
  @Min(60)
  JWT_EXPIRES_IN: number = 3600;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  UPLOAD_DIR?: string;

  // Email (all optional: without MAIL_HOST emails are only logged)
  @IsOptional()
  @IsString()
  MAIL_HOST?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  MAIL_PORT?: number;

  @IsOptional()
  @IsString()
  MAIL_USER?: string;

  @IsOptional()
  @IsString()
  MAIL_PASSWORD?: string;

  @IsOptional()
  @IsString()
  MAIL_FROM?: string;

  @IsOptional()
  @IsUrl({
    require_tld: false,
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  FRONTEND_URL?: string;
}

// .env values are strings; empty lines like `MAIL_HOST=` mean "not set"
function normalise(config: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    if (
      typeof value === 'string' &&
      value.trim() === '' &&
      key !== 'DB_PASSWORD'
    )
      continue;
    out[key] = value;
  }
  for (const key of ['PORT', 'DB_PORT', 'JWT_EXPIRES_IN', 'MAIL_PORT']) {
    if (typeof out[key] === 'string' && /^\d+$/.test(out[key] as string)) {
      out[key] = Number(out[key]);
    }
  }
  return out;
}

function describe(errors: ValidationError[]) {
  return errors.map((error) => {
    const reasons = Object.values(error.constraints ?? {}).join('; ');
    return `  - ${error.property}: ${reasons}`;
  });
}

export function validateEnv(config: Record<string, unknown>) {
  const env = plainToInstance(EnvironmentVariables, normalise(config));
  const problems = describe(
    validateSync(env, { skipMissingProperties: false }),
  );

  // A guessable JWT secret lets anyone forge a login token
  if (env.JWT_SECRET) {
    const weak =
      env.JWT_SECRET.length < 32 || PLACEHOLDER_SECRETS.has(env.JWT_SECRET);
    if (weak && env.NODE_ENV === 'production') {
      problems.push(
        '  - JWT_SECRET: must be at least 32 random characters and not the example value in production',
      );
    } else if (weak) {
      new Logger('Config').warn(
        'JWT_SECRET is short or the example value. Fine for local testing, never for production.',
      );
    }
  }

  if (env.MAIL_HOST && !env.MAIL_FROM) {
    new Logger('Config').warn(
      'MAIL_HOST is set but MAIL_FROM is not; using the default sender.',
    );
  }

  if (problems.length) {
    throw new Error(
      `Invalid .env configuration (fix these and restart):\n${problems.join('\n')}\n` +
        'See backend/.env.example for every setting.',
    );
  }

  return env;
}
