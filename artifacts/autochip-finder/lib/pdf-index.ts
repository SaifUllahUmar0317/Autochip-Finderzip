import * as FileSystem from 'expo-file-system/legacy';
import * as pdfjs from 'pdfjs-dist/build/pdf.js';
import type { IndexedPage } from '@/lib/database';

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
};

type PdfPage = {
  getTextContent: () => Promise<{ items: PdfTextItem[] }>;
  cleanup: () => void;
};

type PdfDocument = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
};

type PdfLoadingTask = {
  promise: Promise<PdfDocument>;
  destroy: () => Promise<void>;
};

type PdfJsApi = {
  getDocument: (source: {
    data: Uint8Array;
    disableWorker: boolean;
    isEvalSupported: boolean;
  }) => PdfLoadingTask;
};

const pdfApi = pdfjs as unknown as PdfJsApi;

function decodeBase64(value: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const clean = value.replace(/[^A-Za-z0-9+/=]/g, '');
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(Math.max(0, Math.floor((clean.length * 3) / 4) - padding));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const character of clean) {
    if (character === '=') break;
    const digit = alphabet.indexOf(character);
    if (digit < 0) continue;
    buffer = (buffer << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (index < bytes.length) bytes[index++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

function textInReadingOrder(items: PdfTextItem[]): string {
  const lines = new Map<number, { x: number; width: number; text: string }[]>();
  for (const item of items) {
    const text = item.str?.trim();
    if (!text) continue;
    const transform = item.transform ?? [];
    const y = Math.round(transform[5] ?? 0);
    const x = transform[4] ?? 0;
    const group = lines.get(y) ?? [];
    group.push({ x, width: item.width ?? 0, text });
    lines.set(y, group);
  }
  return [...lines.entries()]
    .sort(([a], [b]) => b - a)
    .map(([, line]) => {
      const sorted = line.sort((a, b) => a.x - b.x);
      return sorted.reduce((result, part, index) => {
        if (index === 0) return part.text;
        const previous = sorted[index - 1];
        const gap = part.x - (previous.x + previous.width);
        const separator = gap >= 18 ? '\t' : gap >= 1 ? ' ' : '';
        return `${result}${separator}${part.text}`;
      }, '');
    })
    .join('\n');
}

export async function extractPdfPages(
  uri: string,
  onProgress?: (current: number, total: number) => void,
): Promise<IndexedPage[]> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const task = pdfApi.getDocument({
    data: decodeBase64(base64),
    disableWorker: true,
    isEvalSupported: false,
  });
  let document: PdfDocument | null = null;
  try {
    document = await task.promise;
    const pages: IndexedPage[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push({ pageNumber, text: textInReadingOrder(content.items) });
      page.cleanup();
      onProgress?.(pageNumber, document.numPages);
    }
    return pages;
  } finally {
    if (document) await document.destroy();
    else await task.destroy();
  }
}