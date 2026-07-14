import { resolve } from 'node:path';
import { config } from 'dotenv';

export const repositoryEnvPath = resolve(__dirname, '../../../../.env');

export function loadMigrationEnvironment(
  envFile: string = repositoryEnvPath,
): void {
  config({ path: envFile, override: false, quiet: true });
  if (!process.env.DATABASE_URL && process.env.POSTGRES_PASSWORD) {
    process.env.DATABASE_URL = createLocalDatabaseUrl(process.env);
  }
}

function createLocalDatabaseUrl(environment: NodeJS.ProcessEnv): string {
  const url = new URL('postgresql://127.0.0.1');
  url.username = environment.POSTGRES_USER ?? 'ai_knowledge';
  url.password = environment.POSTGRES_PASSWORD!;
  url.port = environment.POSTGRES_PORT ?? '5432';
  url.pathname = environment.POSTGRES_DB ?? 'ai_knowledge';
  return url.toString();
}
