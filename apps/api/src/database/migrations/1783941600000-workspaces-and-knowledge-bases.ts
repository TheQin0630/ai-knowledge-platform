import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorkspacesAndKnowledgeBases1783941600000 implements MigrationInterface {
  name = 'WorkspacesAndKnowledgeBases1783941600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE workspace_role AS ENUM ('owner', 'admin', 'member')`,
    );
    await queryRunner.query(`
      CREATE TABLE workspaces (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(120) NOT NULL,
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT workspaces_name_check CHECK (name = BTRIM(name) AND name <> '')
      )
    `);
    await queryRunner.query(`
      CREATE TABLE workspace_members (
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role workspace_role NOT NULL,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, user_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX workspace_members_user_idx
      ON workspace_members (user_id, workspace_id)
    `);
    await queryRunner.query(`
      CREATE TABLE knowledge_bases (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        name varchar(120) NOT NULL,
        description varchar(500),
        created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT knowledge_bases_name_check CHECK (name = BTRIM(name) AND name <> ''),
        CONSTRAINT knowledge_bases_description_check
          CHECK (description IS NULL OR (description = BTRIM(description) AND description <> ''))
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX knowledge_bases_workspace_name_ci_unique_idx
      ON knowledge_bases (workspace_id, LOWER(name))
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE knowledge_bases`);
    await queryRunner.query(`DROP TABLE workspace_members`);
    await queryRunner.query(`DROP TABLE workspaces`);
    await queryRunner.query(`DROP TYPE workspace_role`);
  }
}
