import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

// PostgreSQL error codes -> HTTP responses, in the same shape Nest uses
// for its own exceptions: { message, error, statusCode }.
const PG_ERRORS: Record<string, { status: number; error: string; message: string }> = {
  '23505': { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'A record with these details already exists' },
  '23503': { status: HttpStatus.CONFLICT, error: 'Conflict', message: 'This record is linked to other records' },
  '23514': { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'A value breaks a database rule' },
  '22P02': { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'Invalid value format' },
  '22007': { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'Invalid date or time format' },
  '22008': { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'Date or time value is out of range' },
  '22001': { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'A value is too long' },
  '22003': { status: HttpStatus.BAD_REQUEST, error: 'Bad Request', message: 'A number is out of range' },
};

// Catches database errors that no service handled itself, so a duplicate
// key becomes 409 instead of 500. Unknown database errors stay 500 and
// never expose SQL or stack traces to the client.
@Catch(QueryFailedError)
export class DatabaseExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Database');

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const code = (exception as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ?? '';
    const known = PG_ERRORS[code];

    if (known) {
      response.status(known.status).json({
        message: known.message,
        error: known.error,
        statusCode: known.status,
      });
      return;
    }

    this.logger.error(exception.message, exception.stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      message: 'Internal server error',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
