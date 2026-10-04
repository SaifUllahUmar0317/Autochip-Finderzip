import * as FileSystem from 'expo-file-system/legacy';
import type { IndexedPage } from '@/lib/database';

export type { IndexedPage };

type ExtractorFn = (
  uri: string,
  onProgress?: (current: number, total: number) => void,
) => Promise<IndexedPage[]>;

let registeredExtractor: ExtractorFn | null = null;
const waitingQueue: Array<(extractor: ExtractorFn) => void> = [];

export function registerPdfExtractor(fn: ExtractorFn | null) {
  registeredExtractor = fn;
  if (fn) {
    while (waitingQueue.length > 0) {
      const resolve = waitingQueue.shift();
      if (resolve) resolve(fn);
    }
  }
}

async function getExtractor(): Promise<ExtractorFn> {
  if (registeredExtractor) {
    return registeredExtractor;
  }
  return new Promise<ExtractorFn>((resolve) => {
    waitingQueue.push(resolve);
    // Timeout after 8 seconds if WebView somehow fails to register
    setTimeout(() => {
      if (registeredExtractor) {
        resolve(registeredExtractor);
      }
    }, 8000);
  });
}

export async function extractPdfPages(
  uri: string,
  onProgress?: (current: number, total: number) => void,
): Promise<IndexedPage[]> {
  const extractor = await getExtractor();
  if (extractor) {
    return extractor(uri, onProgress);
  }
  throw new Error('PDF extraction engine is not available. Please restart the app and try again.');
}