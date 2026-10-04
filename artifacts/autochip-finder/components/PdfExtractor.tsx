import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import { registerPdfExtractor, type IndexedPage } from '@/lib/pdf-index';
import { PDFJS_BUNDLE_HTML } from '@/lib/pdfjs-bundle';

interface PendingJob {
  uri: string;
  onProgress?: (current: number, total: number) => void;
  resolve: (pages: IndexedPage[]) => void;
  reject: (error: Error) => void;
}

export function PdfExtractor() {
  const webViewRef = useRef<WebView>(null);
  const isReadyRef = useRef(false);
  const currentJobRef = useRef<PendingJob | null>(null);
  const jobQueueRef = useRef<PendingJob[]>([]);

  const processNextJob = async () => {
    if (!isReadyRef.current || currentJobRef.current || jobQueueRef.current.length === 0) {
      return;
    }

    const job = jobQueueRef.current.shift()!;
    currentJobRef.current = job;

    try {
      const base64 = await FileSystem.readAsStringAsync(job.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Send to WebView
      // For large PDFs, we can chunk if needed; 500KB chunk size is safe for any bridge
      const CHUNK_SIZE = 400000;
      if (base64.length <= CHUNK_SIZE) {
        webViewRef.current?.injectJavaScript(`
          if (window.processPdf) {
            window.processPdf(${JSON.stringify(base64)});
          }
          true;
        `);
      } else {
        const totalChunks = Math.ceil(base64.length / CHUNK_SIZE);
        for (let i = 0; i < totalChunks; i++) {
          const chunk = base64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const isLast = i === totalChunks - 1;
          webViewRef.current?.injectJavaScript(`
            if (window.receivePdfChunk) {
              window.receivePdfChunk(${JSON.stringify(chunk)}, ${isLast});
            }
            true;
          `);
        }
      }
    } catch (err) {
      currentJobRef.current = null;
      job.reject(err instanceof Error ? err : new Error(String(err)));
      void processNextJob();
    }
  };

  useEffect(() => {
    registerPdfExtractor((uri: string, onProgress?: (current: number, total: number) => void) => {
      return new Promise<IndexedPage[]>((resolve, reject) => {
        jobQueueRef.current.push({ uri, onProgress, resolve, reject });
        void processNextJob();
      });
    });

    return () => {
      registerPdfExtractor(null);
    };
  }, []);

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'ready') {
        isReadyRef.current = true;
        void processNextJob();
      } else if (data.type === 'progress') {
        if (currentJobRef.current?.onProgress) {
          currentJobRef.current.onProgress(data.current, data.total);
        }
      } else if (data.type === 'done') {
        if (currentJobRef.current) {
          const job = currentJobRef.current;
          currentJobRef.current = null;
          job.resolve(data.pages || []);
          void processNextJob();
        }
      } else if (data.type === 'error') {
        if (currentJobRef.current) {
          const job = currentJobRef.current;
          currentJobRef.current = null;
          job.reject(new Error(data.message || 'PDF extraction failed.'));
          void processNextJob();
        }
      }
    } catch (e) {
      // ignore non-json messages
    }
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={webViewRef}
        originWhitelist={['*']}
        source={{ html: PDFJS_BUNDLE_HTML }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 1,
    height: 1,
    opacity: 0,
    position: 'absolute',
    bottom: -100,
    left: -100,
  },
  webView: {
    width: 1,
    height: 1,
  },
});
