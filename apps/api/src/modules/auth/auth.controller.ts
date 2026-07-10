import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService, PublicUser, RefreshResult } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() input: RegisterDto): Promise<PublicUser> {
    return this.authService.register(input);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(input);
    setRefreshCookie(response, result);
    return result.body;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.refresh(
      readRefreshCookie(request.cookies),
    );
    setRefreshCookie(response, result);
    return result.body;
  }
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
