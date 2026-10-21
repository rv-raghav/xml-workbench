import type { FormatOptions, TabType } from '../types';
import { formatDocument } from '../utils/formatDocument';

export interface WorkerRequest {
  id: number;
  type: TabType;
  input: string;
  options: FormatOptions;
  unescape?: boolean;
}

export interface WorkerResponse {
  id: number;
  result?: ReturnType<typeof formatDocument>;
  error?: string;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, type, input, options, unescape } = event.data;
  try {
    const result = formatDocument(type, input, options, unescape);
    const response: WorkerResponse = { id, result };
    self.postMessage(response);
  } catch (err) {
    const response: WorkerResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
