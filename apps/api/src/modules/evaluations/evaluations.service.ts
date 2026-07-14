import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RagService } from '../rag/rag.service';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import { RunEvaluationDto } from './dto/run-evaluation.dto';
import { scoreEvaluationCase } from './evaluation-scorer';

@Injectable()
export class EvaluationsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly access: WorkspaceAccessService,
    private readonly rag: RagService,
  ) {}

  async run(
    workspaceId: string,
    knowledgeBaseId: string,
    userId: string,
    input: RunEvaluationDto,
  ) {
    await this.access.requireMembership(workspaceId, userId);
    const results = [];
    for (const testCase of input.cases) {
      const answer = await this.rag.ask(
        workspaceId,
        knowledgeBaseId,
        userId,
        testCase.question,
      );
      results.push({
        question: testCase.question,
        answer: answer.answer,
        citations: answer.citations,
        ...scoreEvaluationCase(
          answer,
          testCase.expectedKeywords,
          testCase.expectedFiles,
        ),
      });
    }
    const summary = summarize(results);
    const [run] = await this.dataSource.query<
      Array<{ id: string; created_at: Date }>
    >(
      `INSERT INTO evaluation_runs (knowledge_base_id, created_by, name, retrieval_version, model, case_count,
       keyword_coverage, citation_coverage, grounded_rate, results)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb) RETURNING id, created_at`,
      [
        knowledgeBaseId,
        userId,
        input.name,
        'rrf-v1',
        results.find((item) => item.citations.length)?.citations
          ? 'configured-provider'
          : null,
        results.length,
        summary.keywordCoverage,
        summary.citationCoverage,
        summary.groundedRate,
        JSON.stringify(results),
      ],
    );
    return {
      id: run.id,
      name: input.name,
      retrievalVersion: 'rrf-v1',
      caseCount: results.length,
      ...summary,
      results,
      createdAt: run.created_at,
    };
  }

  async list(workspaceId: string, knowledgeBaseId: string, userId: string) {
    await this.access.requireMembership(workspaceId, userId);
    return this.dataSource.query<
      Array<{
        id: string;
        name: string;
        retrievalVersion: string;
        model: string | null;
        caseCount: number;
        keywordCoverage: string;
        citationCoverage: string;
        groundedRate: string;
        createdAt: Date;
      }>
    >(
      `SELECT id, name, retrieval_version AS "retrievalVersion", model, case_count AS "caseCount",
      keyword_coverage AS "keywordCoverage", citation_coverage AS "citationCoverage", grounded_rate AS "groundedRate",
      created_at AS "createdAt" FROM evaluation_runs WHERE knowledge_base_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [knowledgeBaseId],
    );
  }
}

export function summarize(
  results: Array<{
    keywordCoverage: number;
    citationCoverage: number;
    grounded: boolean;
  }>,
) {
  const average = (values: number[]) =>
    Number(
      (values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(
        4,
      ),
    );
  return {
    keywordCoverage: average(results.map((item) => item.keywordCoverage)),
    citationCoverage: average(results.map((item) => item.citationCoverage)),
    groundedRate: average(results.map((item) => (item.grounded ? 1 : 0))),
  };
}
