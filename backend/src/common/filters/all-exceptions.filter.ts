import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Error as MongooseError } from 'mongoose';

interface ErrorResponseBody {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
}

/**
 * Final-line exception filter. Three responsibilities:
 *  1. Let HttpException subclasses pass through unchanged (they already carry
 *     the right status + message for the client).
 *  2. Translate Mongoose CastError / ValidationError into predictable 400s.
 *  3. Map anything else to a generic 500 and log the stack server-side, so
 *     internal details never leak to the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { status, message, error } = this.resolveError(exception, request);

    const body: ErrorResponseBody = {
      statusCode: status,
      message,
      error,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(body);
  }

  private resolveError(
    exception: unknown,
    request: Request,
  ): { status: number; message: string | string[]; error: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      const { message, error } = this.extractHttpExceptionPayload(raw);
      return {
        status,
        message: message ?? exception.message,
        error: error ?? exception.name,
      };
    }

    if (exception instanceof MongooseError.ValidationError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: Object.values(exception.errors).map((err) => err.message),
        error: 'ValidationError',
      };
    }

    if (exception instanceof MongooseError.CastError) {
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Invalid value "${String(exception.value)}" for field "${exception.path}"`,
        error: 'CastError',
      };
    }

    const err = exception instanceof Error ? exception : undefined;
    this.logger.error(
      `Unhandled exception on ${request.method} ${request.url}: ${
        err?.message ?? 'unknown error'
      }`,
      err?.stack,
    );

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'InternalServerError',
    };
  }

  private extractHttpExceptionPayload(raw: string | object): {
    message?: string | string[];
    error?: string;
  } {
    if (typeof raw === 'string') {
      return { message: raw };
    }
    const obj = raw as { message?: unknown; error?: unknown };
    const message =
      typeof obj.message === 'string' || Array.isArray(obj.message)
        ? (obj.message as string | string[])
        : undefined;
    const error = typeof obj.error === 'string' ? obj.error : undefined;
    return { message, error };
  }
}
