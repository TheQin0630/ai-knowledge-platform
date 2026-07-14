import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmbeddingBatch {
  model: string;
  dimensions: number;
  vectors: number[][];
}

interface ProviderItem {
  index: number;
  embedding: number[];
}

@Injectable()
export class EmbeddingService {
  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('EMBEDDING_BASE_URL'));
  }

  async embed(inputs: string[]): Promise<EmbeddingBatch | null> {
    const baseUrl = this.config.get<string>('EMBEDDING_BASE_URL');
    if (!baseUrl) return null;
    const model =
      this.config.get<string>('EMBEDDING_MODEL') ?? 'text-embedding-3-small';
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ input: inputs, model }),
      signal: AbortSignal.timeout(
        this.config.get<number>('EMBEDDING_TIMEOUT_MS') ?? 30_000,
      ),
    });
    if (!response.ok) {
      throw new Error(
        `Embedding provider failed with status ${response.status}`,
      );
    }
    const payload: unknown = await response.json();
    const vectors = readVectors(payload, inputs.length);
    return { model, dimensions: vectors[0].length, vectors };
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    const apiKey = this.config.get<string>('EMBEDDING_API_KEY');
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    return headers;
  }
}

function readVectors(payload: unknown, expectedCount: number): number[][] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) invalidResponse();
  const items = payload.data as unknown[];
  if (items.length !== expectedCount) invalidResponse();
  const parsed = items
    .map(readItem)
    .sort((left, right) => left.index - right.index);
  const dimensions = parsed[0]?.embedding.length ?? 0;
  if (
    dimensions === 0 ||
    parsed.some(
      (item, index) =>
        item.index !== index || item.embedding.length !== dimensions,
    )
  ) {
    invalidResponse();
  }
  return parsed.map(({ embedding }) => embedding);
}

function readItem(value: unknown): ProviderItem {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.index) ||
    !Array.isArray(value.embedding) ||
    value.embedding.some(
      (number) => typeof number !== 'number' || !Number.isFinite(number),
    )
  ) {
    invalidResponse();
  }
  return value as unknown as ProviderItem;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function invalidResponse(): never {
  throw new Error('Embedding provider returned an invalid response');
}
