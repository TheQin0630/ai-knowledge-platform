import { MigrationInterface, QueryRunner } from 'typeorm';

export class EvaluationRuns1784288400000 implements MigrationInterface {
  name = 'EvaluationRuns1784288400000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE evaluation_runs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), knowledge_base_id uuid NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
      created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT, name varchar(120) NOT NULL,
      retrieval_version varchar(50) NOT NULL, model varchar(150), case_count integer NOT NULL CHECK (case_count > 0),
      keyword_coverage numeric(5,4) NOT NULL, citation_coverage numeric(5,4) NOT NULL, grounded_rate numeric(5,4) NOT NULL,
      results jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await queryRunner.query(
      `CREATE INDEX evaluation_runs_kb_created_idx ON evaluation_runs (knowledge_base_id, created_at DESC)`,
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE evaluation_runs`);
  }
}
