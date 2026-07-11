import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ContextualRequest } from '../../http/request-context';
import { LoginAttemptLimiter } from './abuse/login-attempt-limiter';
import { AuthService, PublicUser, RefreshResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AccessTokenGuard } from './guard/access-token.guard';
import type { AuthenticatedRequest } from './guard/access-token.guard';
import { AuthSecurityEventLogger } from './security/auth-security-event.logger';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginAttemptLimiter: LoginAttemptLimiter,
    private readonly securityEvents: AuthSecurityEventLogger,
  ) {}

  @Post('register')
  register(@Body() input: RegisterDto): Promise<PublicUser> {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Req() request: ContextualRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    let limit;
    try {
      limit = await this.loginAttemptLimiter.consume({
        sourceAddress:
          request.ip ?? request.socket.remoteAddress ?? 'unknown-source',
        email: input.email,
      });
    } catch (error) {
      if (hasStatus(error, HttpStatus.SERVICE_UNAVAILABLE)) {
        this.securityEvents.dependencyUnavailable(request.requestId, 'login');
      }
      throw error;
    }
    if (!limit.allowed) {
      this.securityEvents.loginRejected(request.requestId, 'rate_limited');
      response.setHeader('Retry-After', limit.retryAfterSeconds.toString());
      throw new HttpException(
        {
          error: {
            code: 'AUTH_RATE_LIMITED',
            message: 'Too many authentication attempts',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let result;
    try {
      result = await this.authService.login(input);
    } catch (error) {
      if (hasStatus(error, HttpStatus.UNAUTHORIZED)) {
        this.securityEvents.loginRejected(
          request.requestId,
          'invalid_credentials',
        );
      } else if (hasStatus(error, HttpStatus.SERVICE_UNAVAILABLE)) {
        this.securityEvents.dependencyUnavailable(request.requestId, 'login');
      }
      throw error;
    }
    this.securityEvents.loginSucceeded(request.requestId);
    setRefreshCookie(response, result);
    return result.body;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: ContextualRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      readRefreshCookie(request.cookies),
      request.requestId,
    );
    setRefreshCookie(response, result);
    return result.body;
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: ContextualRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    try {
      await this.authService.logout(
        readRefreshCookie(request.cookies),
        request.requestId,
      );
    } finally {
      clearRefreshCookie(response);
    }
  }

  @Get('me')
  @UseGuards(AccessTokenGuard)
  me(@Req() request: AuthenticatedRequest): Promise<PublicUser> {
    return this.authService.getCurrentUser(request.auth.userId);
  }
}

function hasStatus(error: unknown, status: number): boolean {
  return error instanceof HttpException && error.getStatus() === status;
}

function readRefreshCookie(cookies: unknown): string | undefined {
  if (typeof cookies !== 'object' || cookies === null) {
    return undefined;
  }

  const refreshToken = (cookies as Record<string, unknown>).refresh_token;
  return typeof refreshToken === 'string' ? refreshToken : undefined;
}

function setRefreshCookie(
  response: Response,
  result: Pick<RefreshResult, 'refreshToken' | 'refreshExpiresIn'>,
): void {
  response.cookie('refresh_token', result.refreshToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/v1/auth',
    maxAge: result.refreshExpiresIn * 1_000,
  });
}

function clearRefreshCookie(response: Response): void {
  response.clearCookie('refresh_token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/v1/auth',
  });
}
