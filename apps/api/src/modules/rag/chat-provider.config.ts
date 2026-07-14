import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type ChatProvider =
  'openai' | 'glm' | 'deepseek' | 'qwen' | 'ollama' | 'custom';
export interface ResolvedChatProvider {
  provider: ChatProvider;
  baseUrl: string;
  model: string;
  apiKey?: string;
}

const presets: Record<
  Exclude<ChatProvider, 'custom'>,
  { baseUrl: string; model: string; key?: string }
> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4.1-mini',
    key: 'OPENAI_API_KEY',
  },
  glm: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4.5-flash',
    key: 'GLM_API_KEY',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    key: 'DEEPSEEK_API_KEY',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    key: 'DASHSCOPE_API_KEY',
  },
  ollama: {
    baseUrl: 'http://host.docker.internal:11434/v1',
    model: 'qwen3:8b',
  },
};

export function resolveChatProvider(
  config: ConfigService,
): ResolvedChatProvider {
  const selected = config.get<string>('CHAT_PROVIDER');
  if (!selected) {
    const baseUrl = config.get<string>('CHAT_BASE_URL');
    if (!baseUrl) unavailable('Chat provider is not configured');
    return {
      provider: 'custom',
      baseUrl,
      model: config.get<string>('CHAT_MODEL') ?? 'gpt-4.1-mini',
      apiKey: config.get<string>('CHAT_API_KEY'),
    };
  }
  if (!(selected in presets))
    unavailable(`Unsupported chat provider: ${selected}`);
  const provider = selected as Exclude<ChatProvider, 'custom'>;
  const preset = presets[provider];
  const apiKey =
    (preset.key ? config.get<string>(preset.key) : undefined) ??
    config.get<string>('CHAT_API_KEY');
  if (preset.key && !apiKey)
    unavailable(`API key is required for chat provider: ${provider}`);
  return {
    provider,
    baseUrl: config.get<string>('CHAT_BASE_URL') ?? preset.baseUrl,
    model: config.get<string>('CHAT_MODEL') ?? preset.model,
    ...(apiKey ? { apiKey } : {}),
  };
}

function unavailable(message: string): never {
  throw new ServiceUnavailableException({
    error: { code: 'CHAT_PROVIDER_UNAVAILABLE', message },
  });
}
