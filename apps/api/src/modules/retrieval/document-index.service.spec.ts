import { Repository } from 'typeorm';
import { DocumentChunk } from './entities/document-chunk.entity';
import { EmbeddingService } from './embedding.service';
import { TextChunkerService } from './text-chunker.service';
import { DocumentIndexService } from './document-index.service';

describe('DocumentIndexService', () => {
  it('replaces prior chunks and remains keyword-searchable without embeddings', async () => {
    const rows: Partial<DocumentChunk>[] = [];
    const repository = fakeRepository(rows);
    const embeddings = { embed: jest.fn().mockResolvedValue(null) };
    const service = new DocumentIndexService(
      repository,
      new TextChunkerService(),
      embeddings as unknown as EmbeddingService,
    );

    await expect(service.index('version-1', '平台部署手册')).resolves.toEqual({
      chunkCount: 1,
      vectorized: false,
    });
    expect(rows).toEqual([
      expect.objectContaining({
        documentVersionId: 'version-1',
        chunkIndex: 0,
        content: '平台部署手册',
        embedding: null,
      }),
    ]);
  });

  it('persists validated vector metadata with every chunk', async () => {
    const rows: Partial<DocumentChunk>[] = [];
    const repository = fakeRepository(rows);
    const embeddings = {
      embed: jest.fn().mockResolvedValue({
        model: 'embedding-model',
        dimensions: 3,
        vectors: [[0.1, 0.2, 0.3]],
      }),
    };
    const service = new DocumentIndexService(
      repository,
      new TextChunkerService(),
      embeddings as unknown as EmbeddingService,
    );

    await expect(service.index('version-1', '检索内容')).resolves.toEqual({
      chunkCount: 1,
      vectorized: true,
    });
    expect(rows[0]).toMatchObject({
      embedding: [0.1, 0.2, 0.3],
      embeddingModel: 'embedding-model',
      embeddingDimensions: 3,
    });
  });
});

function fakeRepository(
  rows: Partial<DocumentChunk>[],
): Repository<DocumentChunk> {
  const transactionalRepository = {
    delete: jest.fn(() => Promise.resolve(rows.splice(0))),
    insert: jest.fn((values: Partial<DocumentChunk>[]) =>
      Promise.resolve(rows.push(...values)),
    ),
  };
  return {
    manager: {
      transaction: (
        work: (manager: {
          getRepository: () => typeof transactionalRepository;
        }) => Promise<void>,
      ) => work({ getRepository: () => transactionalRepository }),
    },
  } as unknown as Repository<DocumentChunk>;
}
