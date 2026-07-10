import { createPersistenceDataSource } from './typeorm.options';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to run database migrations');
}

export default createPersistenceDataSource(databaseUrl);
