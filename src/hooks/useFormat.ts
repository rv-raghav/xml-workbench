import { useEffect, useRef } from 'react';
import type { FormatOptions, FormatResult, TabType } from '../types';
import type { WorkerRequest, WorkerResponse } from '../workers/formatWorker';

type Pending = {
  resolve: (result: FormatResult) => void;
  reject: (err: Error) => void;
};

let worker: Worker | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (worker) return worker;
  try {
    worker = new Worker(new URL('../workers/formatWorker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const job = pending.get(event.data.id);
      if (!job) return;
      pending.delete(event.data.id);
      if (event.data.error) job.reject(new Error(event.data.error));
      else if (event.data.result) job.resolve(event.data.result);
      else job.reject(new Error('Empty worker response'));
    };
    worker.onerror = () => {
      worker = null;
    };
    return worker;
  } catch {
    worker = null;
    return null;
  }
}

const WORKER_THRESHOLD = 256 * 1024;

/** XML parsing needs DOMParser, which background workers do not have. */
export function usesFormatWorker(type: TabType, length: number): boolean {
  if (type === 'xml') return false;
  return length >= WORKER_THRESHOLD;
}

export async function formatAsync(
  type: TabType,
  input: string,
  options: FormatOptions,
  unescape = false,
): Promise<FormatResult> {
  const { formatDocument } = await import('../utils/formatDocument');
  if (!usesFormatWorker(type, input.length)) {
    if (input.length >= WORKER_THRESHOLD) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    return formatDocument(type, input, options, unescape);
  }
  const w = getWorker();
  if (!w) {
    return formatDocument(type, input, options, unescape);
  }
  const id = ++seq;
  return new Promise<FormatResult>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    const request: WorkerRequest = { id, type, input, options, unescape };
    w.postMessage(request);
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        try {
          resolve(formatDocument(type, input, options, unescape));
        } catch (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    }, 8000);
  });
}

export function useFormat() {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  return { formatAsync, mounted };
}
