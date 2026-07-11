import { ConsoleLogger, Inject, Injectable } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';

export const AUTH_SECURITY_EVENT_SINK = Symbol('AUTH_SECURITY_EVENT_SINK');

export type LoginRejectionReason = 'invalid_credentials' | 'rate_limited';
export type RefreshRejectionReason =
  'invalid_token' | 'session_missing' | 'replay';
export type AuthDependencyOperation = 'login' | 'refresh' | 'logout' | 'access';

@Injectable()
export class AuthSecurityEventLogger {
  constructor(
    @Inject(AUTH_SECURITY_EVENT_SINK) private readonly sink: LoggerService,
  ) {}

  loginSucceeded(requestId: string): void {
    this.sink.log({ event: 'auth_login_succeeded', requestId });
  }

  sessionRevoked(requestId: string): void {
    this.sink.log({ event: 'auth_session_revoked', requestId });
  }

  loginRejected(requestId: string, reason: LoginRejectionReason): void {
    this.sink.warn({ event: 'auth_login_rejected', requestId, reason });
  }

  refreshRejected(requestId: string, reason: RefreshRejectionReason): void {
    this.sink.warn({ event: 'auth_refresh_rejected', requestId, reason });
  }

  sessionBindingMismatch(requestId: string): void {
    this.sink.warn({ event: 'auth_session_binding_mismatch', requestId });
  }

  dependencyUnavailable(
    requestId: string,
    operation: AuthDependencyOperation,
  ): void {
    this.sink.warn({
      event: 'auth_dependency_unavailable',
      requestId,
      operation,
    });
  }
}

export function createAuthSecurityEventSink(): LoggerService {
  return new ConsoleLogger('AuthSecurityEvent', {
    json: true,
    colors: false,
    compact: true,
    forceConsole: true,
  });
}
