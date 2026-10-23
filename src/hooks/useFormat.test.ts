import { describe, expect, it } from 'vitest';
import { usesFormatWorker } from './useFormat';

describe('usesFormatWorker', () => {
  it('keeps XML on the main thread so DOMParser is available', () => {
    expect(usesFormatWorker('xml', 10)).toBe(false);
    expect(usesFormatWorker('xml', 300_000)).toBe(false);
  });

  it('sends large JSON and list documents to the worker', () => {
    expect(usesFormatWorker('json', 300_000)).toBe(true);
    expect(usesFormatWorker('list', 300_000)).toBe(true);
    expect(usesFormatWorker('json', 100)).toBe(false);
  });
});