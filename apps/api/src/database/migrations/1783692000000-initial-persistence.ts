import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialPersistence1783692000000 implements MigrationInterface {
  name = 'InitialPersistence1783692000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    await queryRunner.query(`CREATE TYPE user_role AS ENUM ('user', 'admin')`);
    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(320) NOT NULL,
        password_hash varchar(255) NOT NULL,
        role user_role NOT NULL DEFAULT 'user',
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT users_email_normalized_check
          CHECK (email = LOWER(BTRIM(email)))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX users_email_ci_unique_idx ON users (LOWER(email))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE users`);
    await queryRunner.query(`DROP TYPE user_role`);
  }
}
