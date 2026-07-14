import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  listConfiguredChatProviders,
  resolveChatProvider,
} from './chat-provider.config';

export interface GeneratedAnswer {
  answer: string;
  citationIds: string[];
  model: string;
}

@Injectable()
export class ChatCompletionService {
  constructor(private readonly config: ConfigService) {}

  listProviders() {
    return listConfiguredChatProviders(this.config);
  }

  async answer(
    system: string,
    question: string,
    selection?: { provider?: string; model?: string },
  ): Promise<GeneratedAnswer> {
    const provider = resolveChatProvider(
      this.config,
      selection?.provider,
      selection?.model,
    );
    const { baseUrl, model } = provider;
    let response: Response;
    try {
      response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: this.headers(provider.apiKey),
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: question },
          ],
        }),
        signal: AbortSignal.timeout(
          this.config.get<number>('CHAT_TIMEOUT_MS') ?? 45_000,
        ),
      });
    } catch {
      throw unavailable('Chat provider is unavailable');
    }
    if (!response.ok)
      throw unavailable(`Chat provider failed with status ${response.status}`);
    const parsed = readProviderResponse(await response.json());
    return { ...parsed, model: `${provider.provider}/${model}` };
  }

  private headers(apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (apiKey) headers.authorization = `Bearer ${apiKey}`;
    return headers;
  }
}

function readProviderResponse(
  payload: unknown,
): Omit<GeneratedAnswer, 'model'> {
  const content = (
    payload as { choices?: Array<{ message?: { content?: unknown } }> }
  )?.choices?.[0]?.message?.content;
  if (typeof content !== 'string')
    throw unavailable('Chat provider returned an invalid response');
  try {
    const value = JSON.parse(content) as {
      answer?: unknown;
      citations?: unknown;
    };
    if (
      typeof value.answer !== 'string' ||
      !Array.isArray(value.citations) ||
      value.citations.some((id) => typeof id !== 'string')
    )
      throw new Error();
    return {
      answer: value.answer.trim(),
      citationIds: [...new Set(value.citations)] as string[],
    };
  } catch {
    throw unavailable('Chat provider returned an invalid response');
  }
}

function unavailable(message: string): ServiceUnavailableException {
  return new ServiceUnavailableException({
    error: { code: 'CHAT_PROVIDER_UNAVAILABLE', message },
  });
}
