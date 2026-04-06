import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const allowedApiKeys = this.getAllowedApiKeys();
    if (allowedApiKeys.length === 0) {
      throw new ServiceUnavailableException('API key no configurada');
    }

    const request = context.switchToHttp().getRequest();
    const headerValue = request.headers?.['x-api-key'];
    const apiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new UnauthorizedException('Header x-api-key requerido');
    }

    const normalizedApiKey = apiKey.trim();
    const isValid = allowedApiKeys.some((allowedKey) =>
      this.safeEquals(normalizedApiKey, allowedKey),
    );

    if (!isValid) {
      throw new UnauthorizedException('API key invalida');
    }

    return true;
  }

  private getAllowedApiKeys(): string[] {
    const rawKeys =
      this.configService.get<string>('API_KEYS') ||
      this.configService.get<string>('API_KEY') ||
      '';

    return rawKeys
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }

  private safeEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'utf8');
    const rightBuffer = Buffer.from(right, 'utf8');

    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
