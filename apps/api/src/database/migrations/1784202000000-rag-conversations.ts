import { MigrationInterface, QueryRunner } from 'typeorm';

export class RagConversations1784202000000 implements MigrationInterface {
  name = 'RagConversations1784202000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE rag_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      knowledge_base_id uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      title varchar(120) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await queryRunner.query(
      `CREATE INDEX rag_conversations_kb_idx ON rag_conversations (knowledge_base_id, created_at DESC)`,
    );
    await queryRunner.query(`CREATE TABLE rag_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
      role varchar(12) NOT NULL CHECK (role IN ('user','assistant')), content text NOT NULL,
      model varchar(150), retrieval_mode varchar(20), created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await queryRunner.query(
      `CREATE INDEX rag_messages_conversation_idx ON rag_messages (conversation_id, created_at)`,
    );
    await queryRunner.query(`CREATE TABLE rag_message_citations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES rag_messages(id) ON DELETE CASCADE,
      document_chunk_id uuid REFERENCES document_chunks(id) ON DELETE SET NULL, citation_index integer NOT NULL CHECK (citation_index > 0),
      file_name varchar(255) NOT NULL, version_number integer NOT NULL, content text NOT NULL,
      start_offset integer NOT NULL, end_offset integer NOT NULL, UNIQUE(message_id, citation_index)
    )`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE rag_message_citations`);
    await queryRunner.query(`DROP TABLE rag_messages`);
    await queryRunner.query(`DROP TABLE rag_conversations`);
  }
}
