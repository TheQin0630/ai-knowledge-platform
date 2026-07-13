import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocumentIngestion1784029200000 implements MigrationInterface {
  name = 'DocumentIngestion1784029200000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE document_version_status AS ENUM ('queued', 'processing', 'ready', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TABLE documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), knowledge_base_id uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE, file_name varchar(255) NOT NULL, created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT documents_file_name_check CHECK (file_name = BTRIM(file_name) AND file_name <> ''))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX documents_knowledge_base_file_name_ci_unique_idx ON documents (knowledge_base_id, LOWER(file_name))`,
    );
    await queryRunner.query(
      `CREATE TABLE document_versions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE, version_number integer NOT NULL CHECK (version_number > 0), object_key varchar(500) NOT NULL UNIQUE, media_type varchar(100) NOT NULL, size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 26214400), status document_version_status NOT NULL DEFAULT 'queued', extracted_text text, error_code varchar(100), error_message varchar(500), attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0), created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE (document_id, version_number))`,
    );
    await queryRunner.query(
      `CREATE INDEX document_versions_document_created_idx ON document_versions (document_id, created_at DESC)`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE document_versions`);
    await queryRunner.query(`DROP TABLE documents`);
    await queryRunner.query(`DROP TYPE document_version_status`);
  }
}
