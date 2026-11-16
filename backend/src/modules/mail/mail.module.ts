import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter.js';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { MailService } from './mail.service.js';

const here = dirname(fileURLToPath(import.meta.url));

// SMTP settings come from .env (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD,
// MAIL_FROM). Use a sandbox such as Mailtrap while testing.
// Without MAIL_HOST nothing is sent: each email is printed to the server log.
@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const host = config.get<string>('MAIL_HOST');
        const port = Number(config.get<string>('MAIL_PORT') ?? 2525);

        return {
          transport: host
            ? {
                host,
                port,
                secure: port === 465,
                auth: config.get<string>('MAIL_USER')
                  ? {
                      user: config.get<string>('MAIL_USER'),
                      pass: config.get<string>('MAIL_PASSWORD'),
                    }
                  : undefined,
              }
            : { jsonTransport: true },
          defaults: {
            from:
              config.get<string>('MAIL_FROM') ??
              '"MediPulse" <no-reply@medipulse.local>',
          },
          template: {
            dir: join(here, 'templates'),
            adapter: new HandlebarsAdapter(),
            options: { strict: true },
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
