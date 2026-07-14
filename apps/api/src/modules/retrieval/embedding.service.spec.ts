import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from './embedding.service';

describe('EmbeddingService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('degrades to keyword-only mode when no endpoint is configured', async () => {
    const service = new EmbeddingService(config({}));
    expect(service.isConfigured()).toBe(false);
    await expect(service.embed(['知识库检索'])).resolves.toBeNull();
  });

  it('validates and returns OpenAI-compatible embeddings', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ index: 0, embedding: [0.1, 0.2, 0.3] }] }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    const service = new EmbeddingService(
      config({
        EMBEDDING_BASE_URL: 'http://embedding.test/v1',
        EMBEDDING_API_KEY: 'secret',
        EMBEDDING_MODEL: 'example-model',
      }),
    );
    expect(service.isConfigured()).toBe(true);

    await expect(service.embed(['知识库检索'])).resolves.toEqual({
      model: 'example-model',
      dimensions: 3,
      vectors: [[0.1, 0.2, 0.3]],
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'http://embedding.test/v1/embeddings',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('rejects malformed provider responses instead of persisting bad vectors', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ index: 0, embedding: ['bad'] }] }),
        {
          status: 200,
        },
      ),
    );
    const service = new EmbeddingService(
      config({ EMBEDDING_BASE_URL: 'http://embedding.test/v1' }),
    );

    await expect(service.embed(['query'])).rejects.toThrow(
      'Embedding provider returned an invalid response',
    );
  });
});

function config(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}
