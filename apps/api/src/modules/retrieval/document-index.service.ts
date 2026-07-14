import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { EmbeddingService } from './embedding.service';
import { DocumentChunk } from './entities/document-chunk.entity';
import { TextChunkerService } from './text-chunker.service';

export interface IndexResult {
  chunkCount: number;
  vectorized: boolean;
}

@Injectable()
export class DocumentIndexService {
  private readonly logger = new Logger(DocumentIndexService.name);

  constructor(
    @InjectRepository(DocumentChunk)
    private readonly chunks: Repository<DocumentChunk>,
    private readonly chunker: TextChunkerService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async index(
    documentVersionId: string,
    extractedText: string,
  ): Promise<IndexResult> {
    const chunks = this.chunker.split(extractedText);
    let batch: Awaited<ReturnType<EmbeddingService['embed']>> = null;
    try {
      batch = await this.embeddings.embed(chunks.map(({ content }) => content));
    } catch (error) {
      this.logger.warn({
        event: 'document_vectorization_degraded',
        documentVersionId,
        reason: safeReason(error),
      });
    }

    await this.chunks.manager.transaction(async (manager) => {
      const repository = manager.getRepository(DocumentChunk);
      await repository.delete({ documentVersionId });
      await repository.insert(
        chunks.map((chunk, index) => ({
          id: randomUUID(),
          documentVersionId,
          chunkIndex: chunk.index,
          content: chunk.content,
          startOffset: chunk.startOffset,
          endOffset: chunk.endOffset,
          embedding: batch?.vectors[index] ?? null,
          embeddingModel: batch?.model ?? null,
          embeddingDimensions: batch?.dimensions ?? null,
        })),
      );
    });

    return { chunkCount: chunks.length, vectorized: batch !== null };
  }
}

function safeReason(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 200) : 'Unknown error';
}
