import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadMigrationEnvironment } from './migration-environment';

describe('loadMigrationEnvironment', () => {
  const variableName = 'MIGRATION_ENVIRONMENT_TEST_VALUE';
  const managedVariables = [
    variableName,
    'DATABASE_URL',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_PORT',
    'POSTGRES_DB',
  ] as const;
  let directory: string;
  let envFile: string;
  let originalValues: Record<string, string | undefined>;

  beforeEach(() => {
    originalValues = Object.fromEntries(
      managedVariables.map((name) => [name, process.env[name]]),
    );
    for (const name of managedVariables) delete process.env[name];
    directory = mkdtempSync(join(tmpdir(), 'migration-environment-'));
    envFile = join(directory, '.env');
  });

  afterEach(() => {
    for (const name of managedVariables) {
      const originalValue = originalValues[name];
      if (originalValue === undefined) delete process.env[name];
      else process.env[name] = originalValue;
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it('loads variables from the requested env file', () => {
    writeFileSync(envFile, `${variableName}=from-file\n`);

    loadMigrationEnvironment(envFile);

    expect(process.env[variableName]).toBe('from-file');
  });

  it('does not overwrite an explicitly configured environment variable', () => {
    process.env[variableName] = 'from-process';
    writeFileSync(envFile, `${variableName}=from-file\n`);

    loadMigrationEnvironment(envFile);

    expect(process.env[variableName]).toBe('from-process');
  });

  it('builds the host database URL from the Compose PostgreSQL settings', () => {
    writeFileSync(
      envFile,
      [
        'POSTGRES_USER=local-user',
        'POSTGRES_PASSWORD=p@ss/word',
        'POSTGRES_PORT=55432',
        'POSTGRES_DB=local-database',
      ].join('\n'),
    );

    loadMigrationEnvironment(envFile);

    expect(process.env.DATABASE_URL).toBe(
      'postgresql://local-user:p%40ss%2Fword@127.0.0.1:55432/local-database',
    );
  });

  it('keeps an explicitly configured database URL', () => {
    process.env.DATABASE_URL = 'postgresql://ci-host/ci-database';
    writeFileSync(envFile, 'POSTGRES_PASSWORD=local-password\n');

    loadMigrationEnvironment(envFile);

    expect(process.env.DATABASE_URL).toBe('postgresql://ci-host/ci-database');
  });
});
