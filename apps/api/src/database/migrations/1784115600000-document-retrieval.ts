import { MigrationInterface, QueryRunner } from 'typeorm';

export class DocumentRetrieval1784115600000 implements MigrationInterface {
  name = 'DocumentRetrieval1784115600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await queryRunner.query(
      `CREATE TABLE document_chunks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        document_version_id uuid NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,
        chunk_index integer NOT NULL CHECK (chunk_index >= 0),
        content text NOT NULL CHECK (content <> ''),
        start_offset integer NOT NULL CHECK (start_offset >= 0),
        end_offset integer NOT NULL CHECK (end_offset > start_offset),
        embedding vector,
        embedding_model varchar(150),
        embedding_dimensions integer CHECK (embedding_dimensions > 0),
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (document_version_id, chunk_index),
        CONSTRAINT document_chunks_embedding_metadata_check CHECK (
          (embedding IS NULL AND embedding_model IS NULL AND embedding_dimensions IS NULL)
          OR
          (embedding IS NOT NULL AND embedding_model IS NOT NULL AND embedding_dimensions IS NOT NULL)
        )
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX document_chunks_version_idx ON document_chunks (document_version_id, chunk_index)`,
    );
    await queryRunner.query(
      `CREATE INDEX document_chunks_content_trgm_idx ON document_chunks USING gin (content gin_trgm_ops)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE document_chunks`);
  }
}
