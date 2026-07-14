import { DataSource } from 'typeorm';
import { DocumentIndexService } from './document-index.service';
import { DocumentIndexBackfillService } from './document-index-backfill.service';
import { EmbeddingService } from './embedding.service';

describe('DocumentIndexBackfillService', () => {
  it('indexes ready historical versions without chunks', async () => {
    const query = jest
      .fn()
      .mockResolvedValue([{ id: 'version-1', extracted_text: '历史解析文本' }]);
    const dataSource = { query } as unknown as DataSource;
    const indexer = { index: jest.fn().mockResolvedValue({ chunkCount: 1 }) };
    const service = new DocumentIndexBackfillService(
      dataSource,
      indexer as unknown as DocumentIndexService,
      { isConfigured: () => false } as EmbeddingService,
    );

    await expect(service.backfill()).resolves.toBe(1);
    expect(indexer.index).toHaveBeenCalledWith('version-1', '历史解析文本');
    expect(query).toHaveBeenCalledWith(expect.any(String), [false]);
  });
});
