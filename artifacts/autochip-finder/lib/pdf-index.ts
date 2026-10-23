import * as FileSystem from 'expo-file-system/legacy';
import type { IndexedPage } from '@/lib/database';

export type { IndexedPage };

type ExtractorFn = (
  uri: string,
  onProgress?: (current: number, total: number) => void,
) => Promise<IndexedPage[]>;

type RendererFn = (
  uri: string,
  pageNumber: number,
) => Promise<string>;

let registeredExtractor: ExtractorFn | null = null;
let registeredRenderer: RendererFn | null = null;

const waitingExtractorQueue: Array<(extractor: ExtractorFn) => void> = [];
const waitingRendererQueue: Array<(renderer: RendererFn) => void> = [];

export function registerPdfExtractor(fn: ExtractorFn | null) {
  registeredExtractor = fn;
  if (fn) {
    while (waitingExtractorQueue.length > 0) {
      const resolve = waitingExtractorQueue.shift();
      if (resolve) resolve(fn);
    }
  }
}

export function registerPdfRenderer(fn: RendererFn | null) {
  registeredRenderer = fn;
  if (fn) {
    while (waitingRendererQueue.length > 0) {
      const resolve = waitingRendererQueue.shift();
      if (resolve) resolve(fn);
    }
  }
}

async function getExtractor(): Promise<ExtractorFn> {
  if (registeredExtractor) return registeredExtractor;
  return new Promise<ExtractorFn>((resolve) => {
    waitingExtractorQueue.push(resolve);
    setTimeout(() => {
      if (registeredExtractor) resolve(registeredExtractor);
    }, 8000);
  });
}

async function getRenderer(): Promise<RendererFn> {
  if (registeredRenderer) return registeredRenderer;
  return new Promise<RendererFn>((resolve) => {
    waitingRendererQueue.push(resolve);
    setTimeout(() => {
      if (registeredRenderer) resolve(registeredRenderer);
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

export async function renderPdfPageImage(
  uri: string,
  pageNumber: number,
): Promise<string> {
  const renderer = await getRenderer();
  if (renderer) {
    return renderer(uri, pageNumber);
  }
  throw new Error('PDF diagram renderer is not available.');
}
