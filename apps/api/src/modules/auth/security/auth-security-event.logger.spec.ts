import type { LoggerService } from '@nestjs/common';
import {
  AuthSecurityEventLogger,
  createAuthSecurityEventSink,
} from './auth-security-event.logger';

describe('AuthSecurityEventLogger', () => {
  const log = jest.fn();
  const warn = jest.fn();
  const sink = { log, warn } as unknown as LoggerService;
  const events = new AuthSecurityEventLogger(sink);
  const requestId = '24924a67-4a89-4372-a3e3-e00f06e4c595';

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('records successful login and session revocation as allowlisted info events', () => {
    events.loginSucceeded(requestId);
    events.sessionRevoked(requestId);

    expect(log).toHaveBeenNthCalledWith(1, {
      event: 'auth_login_succeeded',
      requestId,
    });
    expect(log).toHaveBeenNthCalledWith(2, {
      event: 'auth_session_revoked',
      requestId,
    });
  });

  it('records rejected and anomalous authentication as allowlisted warnings', () => {
    events.loginRejected(requestId, 'invalid_credentials');
    events.refreshRejected(requestId, 'replay');
    events.sessionBindingMismatch(requestId);
    events.dependencyUnavailable(requestId, 'access');

    expect(warn).toHaveBeenNthCalledWith(1, {
      event: 'auth_login_rejected',
      requestId,
      reason: 'invalid_credentials',
    });
    expect(warn).toHaveBeenNthCalledWith(2, {
      event: 'auth_refresh_rejected',
      requestId,
      reason: 'replay',
    });
    expect(warn).toHaveBeenNthCalledWith(3, {
      event: 'auth_session_binding_mismatch',
      requestId,
    });
    expect(warn).toHaveBeenNthCalledWith(4, {
      event: 'auth_dependency_unavailable',
      requestId,
      operation: 'access',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toMatch(
      /email|password|token|cookie|redis|database/i,
    );
  });

  it('emits a parseable single-line JSON record through the production sink', () => {
    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const productionEvents = new AuthSecurityEventLogger(
      createAuthSecurityEventSink(),
    );

    productionEvents.loginSucceeded(requestId);

    expect(consoleLog).toHaveBeenCalledTimes(1);
    const output: unknown = consoleLog.mock.calls[0][0];
    expect(typeof output).toBe('string');
    const parsed = JSON.parse(output as string) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      level: 'log',
      context: 'AuthSecurityEvent',
      message: {
        event: 'auth_login_succeeded',
        requestId,
      },
    });
    expect(output).not.toContain('\n');
    consoleLog.mockRestore();
  });
});
