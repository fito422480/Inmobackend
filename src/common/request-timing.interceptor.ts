import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logIfSlowOrError(
            request.method,
            request.url,
            response?.statusCode ?? 200,
            Date.now() - startedAt,
          );
        },
        error: (error) => {
          this.logIfSlowOrError(
            request.method,
            request.url,
            error?.status ?? error?.statusCode ?? response?.statusCode ?? 500,
            Date.now() - startedAt,
          );
        },
      }),
    );
  }

  private logIfSlowOrError(
    method: string,
    url: string,
    statusCode: number,
    durationMs: number,
  ) {
    if (statusCode < 400 && durationMs < 1000) {
      return;
    }

    this.logger.warn(
      `${method} ${url} -> ${statusCode} en ${durationMs}ms`,
    );
  }
}
