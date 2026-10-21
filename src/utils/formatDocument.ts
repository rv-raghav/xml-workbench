import type { FormatOptions, FormatResult, TabType } from '../types';
import {
  formatJson,
  unescapeAndFormatJson,
} from './jsonFormatter';
import { formatQuotedList } from './listFormatter';
import {
  formatXml,
  unescapeAndFormatXml,
} from './xmlFormatter';

export function formatDocument(
  type: TabType,
  input: string,
  options: FormatOptions,
  unescape = false,
): FormatResult {
  if (type === 'xml') {
    return unescape ? unescapeAndFormatXml(input, options) : formatXml(input, options);
  }
  if (type === 'list') {
    return formatQuotedList(input);
  }
  return unescape ? unescapeAndFormatJson(input, options) : formatJson(input, options);
}
