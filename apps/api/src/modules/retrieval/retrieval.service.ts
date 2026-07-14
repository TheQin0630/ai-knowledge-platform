import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import { EmbeddingService } from './embedding.service';

interface RankedChunk {
  chunkId: string;
  rank: number;
}

interface ChunkRow {
  chunk_id: string;
  content: string;
  start_offset: number;
  end_offset: number;
  document_id: string;
  file_name: string;
  version_number: number;
}

export interface RetrievalResult {
  query: string;
  mode: 'keyword' | 'hybrid';
  results: Array<{
    chunkId: string;
    content: string;
    startOffset: number;
    endOffset: number;
    documentId: string;
    fileName: string;
    versionNumber: number;
    score: number;
    keywordRank: number | null;
    vectorRank: number | null;
  }>;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly access: WorkspaceAccessService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async search(
    workspaceId: string,
    knowledgeBaseId: string,
    userId: string,
    query: string,
    limit: number,
  ): Promise<RetrievalResult> {
    await this.access.requireMembership(workspaceId, userId);
    await this.requireKnowledgeBase(workspaceId, knowledgeBaseId);
    const candidateLimit = Math.max(limit * 3, 20);
    const keywordRows = await this.keywordSearch(
      knowledgeBaseId,
      query,
      candidateLimit,
    );
    let vectorRows: ChunkRow[] = [];
    let vectorAvailable = false;
    try {
      const batch = await this.embeddings.embed([query]);
      if (batch) {
        vectorAvailable = true;
        vectorRows = await this.vectorSearch(
          knowledgeBaseId,
          batch.vectors[0],
          batch.dimensions,
          candidateLimit,
        );
      }
    } catch (error) {
      this.logger.warn({
        event: 'retrieval_vector_search_degraded',
        reason:
          error instanceof Error
            ? error.message.slice(0, 200)
            : 'Unknown error',
      });
    }

    const rows = new Map(
      [...keywordRows, ...vectorRows].map((row) => [row.chunk_id, row]),
    );
    const fused = reciprocalRankFusion(
      ranked(keywordRows),
      ranked(vectorRows),
      limit,
    );
    return {
      query,
      mode: vectorAvailable ? 'hybrid' : 'keyword',
      results: fused.map((result) => {
        const row = rows.get(result.chunkId)!;
        return {
          chunkId: result.chunkId,
          content: row.content,
          startOffset: row.start_offset,
          endOffset: row.end_offset,
          documentId: row.document_id,
          fileName: row.file_name,
          versionNumber: row.version_number,
          score: result.score,
          keywordRank: result.keywordRank,
          vectorRank: result.vectorRank,
        };
      }),
    };
  }

  private async requireKnowledgeBase(
    workspaceId: string,
    knowledgeBaseId: string,
  ): Promise<void> {
    const rows = await this.dataSource.query<Array<{ exists: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM knowledge_bases WHERE id = $1 AND workspace_id = $2
       ) AS exists`,
      [knowledgeBaseId, workspaceId],
    );
    if (!rows[0]?.exists) {
      throw new NotFoundException({
        error: {
          code: 'KNOWLEDGE_BASE_NOT_FOUND',
          message: 'Knowledge base not found',
        },
      });
    }
  }

  private keywordSearch(
    knowledgeBaseId: string,
    query: string,
    limit: number,
  ): Promise<ChunkRow[]> {
    return this.dataSource.query(
      `${baseQuery}
       AND (STRPOS(LOWER(c.content), LOWER($2)) > 0 OR similarity(c.content, $2) > 0.05)
       ORDER BY (CASE WHEN STRPOS(LOWER(c.content), LOWER($2)) > 0 THEN 1 ELSE 0 END) + similarity(c.content, $2) DESC, c.id
       LIMIT $3`,
      [knowledgeBaseId, query, limit],
    );
  }

  private vectorSearch(
    knowledgeBaseId: string,
    vector: number[],
    dimensions: number,
    limit: number,
  ): Promise<ChunkRow[]> {
    return this.dataSource.query(
      `${baseQuery}
       AND c.embedding IS NOT NULL
       AND c.embedding_dimensions = $3
       ORDER BY c.embedding <=> $2::vector, c.id
       LIMIT $4`,
      [knowledgeBaseId, JSON.stringify(vector), dimensions, limit],
    );
  }
}

const baseQuery = `SELECT
  c.id AS chunk_id,
  c.content,
  c.start_offset,
  c.end_offset,
  d.id AS document_id,
  d.file_name,
  dv.version_number
FROM document_chunks c
JOIN document_versions dv ON dv.id = c.document_version_id
JOIN documents d ON d.id = dv.document_id
WHERE d.knowledge_base_id = $1
  AND dv.status = 'ready'
  AND dv.version_number = (
    SELECT MAX(latest.version_number)
    FROM document_versions latest
    WHERE latest.document_id = d.id AND latest.status = 'ready'
  )`;

function ranked(rows: ChunkRow[]): RankedChunk[] {
  return rows.map((row, index) => ({ chunkId: row.chunk_id, rank: index + 1 }));
}

export function reciprocalRankFusion(
  keyword: RankedChunk[],
  vector: RankedChunk[],
  limit: number,
): Array<{
  chunkId: string;
  score: number;
  keywordRank: number | null;
  vectorRank: number | null;
}> {
  const fused = new Map<
    string,
    {
      chunkId: string;
      score: number;
      keywordRank: number | null;
      vectorRank: number | null;
    }
  >();
  addRanks(fused, keyword, 'keywordRank');
  addRanks(fused, vector, 'vectorRank');
  return [...fused.values()]
    .sort(
      (left, right) =>
        right.score - left.score || left.chunkId.localeCompare(right.chunkId),
    )
    .slice(0, limit);
}

function addRanks(
  fused: Map<
    string,
    {
      chunkId: string;
      score: number;
      keywordRank: number | null;
      vectorRank: number | null;
    }
  >,
  ranks: RankedChunk[],
  field: 'keywordRank' | 'vectorRank',
): void {
  for (const item of ranks) {
    const result = fused.get(item.chunkId) ?? {
      chunkId: item.chunkId,
      score: 0,
      keywordRank: null,
      vectorRank: null,
    };
    result[field] = item.rank;
    result.score += 1 / (60 + item.rank);
    fused.set(item.chunkId, result);
  }
}
