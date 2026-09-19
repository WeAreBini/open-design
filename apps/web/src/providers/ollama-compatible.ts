import type { AppConfig, ChatMessage } from '../types';
import type { StreamHandlers } from './anthropic';
import { streamProxyEndpoint, type ProxyContext } from './api-proxy';

// We Are Bini change. Apache License 2.0. Pass projectId so Ollama can read and write project files.
export async function streamMessageOllama(
  cfg: AppConfig,
  system: string,
  history: ChatMessage[],
  signal: AbortSignal,
  handlers: StreamHandlers,
  context?: ProxyContext,
): Promise<void> {
  return streamProxyEndpoint('/api/proxy/ollama/stream', cfg, system, history, signal, handlers, context);
}
