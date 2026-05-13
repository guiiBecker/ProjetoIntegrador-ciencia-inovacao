import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_COOKIE_NAME, PUBLIC_KEY } from './auth.constants';
import { AuthService } from './auth.service';

function extractCookieToken(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;
  const cookieParts = cookieHeader.split(';');
  for (const part of cookieParts) {
    const [name, ...valueParts] = part.trim().split('=');
    if (name === AUTH_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join('='));
    }
  }
  return null;
}

function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) return null;
  const [prefix, token] = authorizationHeader.split(' ');
  if (prefix?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const token = extractBearerToken(request.headers.authorization) || extractCookieToken(request.headers.cookie);
    if (!token) {
      throw new UnauthorizedException('Sessao nao encontrada');
    }

    const user = await this.authService.validateSession(token);
    if (!user) {
      throw new UnauthorizedException('Sessao invalida ou expirada');
    }

    request.user = user;
    return true;
  }
}