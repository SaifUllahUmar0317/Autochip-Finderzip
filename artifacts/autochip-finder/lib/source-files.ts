import { Asset } from 'expo-asset';
import type { DocumentRow } from '@/lib/database';

const bundledAssets: Record<string, number> = {
  'seed-airbag': require('../assets/pdfs/airbag.pdf'),
  'seed-bcm': require('../assets/pdfs/bcm.pdf'),
  'seed-dashboard': require('../assets/pdfs/dashboard.pdf'),
  'seed-ecu': require('../assets/pdfs/ecu.pdf'),
};

export async function resolveDocumentUri(document: DocumentRow): Promise<string> {
  if (document.source === 'imported') {
    if (!document.uri) throw new Error('The original PDF file is missing from this device.');
    return document.uri;
  }
  const bundled = bundledAssets[document.id];
  if (!bundled) throw new Error('The bundled source PDF could not be found.');
  const asset = Asset.fromModule(bundled);
  await asset.downloadAsync();
  const uri = asset.localUri ?? asset.uri;
  if (!uri) throw new Error('The original PDF could not be opened from app storage.');
  return uri;
}