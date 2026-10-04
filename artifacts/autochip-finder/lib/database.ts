import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import seedIndex from '@/data/seed-index.json';
import { findDocumentTableHeaders, findPageTableHeaders, parsePageTable } from '@/lib/page-table';

export type ToolName = string;
export type IndexStatus = 'processing' | 'ready' | 'no-text' | 'failed';

export interface ModuleRow {
  id: string;
  tool: ToolName;
  name: string;
  description: string | null;
  sortOrder: number;
  documentCount: number;
  indexedPageCount: number;
}

export interface DocumentRow {
  id: string;
  moduleId: string;
  moduleName: string;
  tool: ToolName;
  displayName: string;
  originalFilename: string;
  uri: string | null;
  pageCount: number;
  fileSize: number;
  importedAt: number;
  lastOpenedAt: number | null;
  lastOpenedPage: number | null;
  indexingStatus: IndexStatus;
  indexError: string | null;
  source: 'bundled' | 'imported';
}

export interface SearchResult {
  pageId: number;
  documentId: string;
  moduleId: string;
  tool: ToolName;
  moduleName: string;
  displayName: string;
  originalFilename: string;
  pageNumber: number;
  pageCount: number;
  text: string;
  snippet: string;
  source: 'bundled' | 'imported';
  uri: string | null;
  /** Column names parsed from the page table (e.g. Series, Brand, Part number, Chip) */
  matchColumns?: string[];
  /** All data rows from the page that match the query, with one entry per column */
  matchRows?: string[][];
}

export interface SearchChipRecord {
  id: number;
  documentId: string;
  pageNumber: number;
  tool: ToolName;
  moduleName: string;
  displayName: string;
  brand: string;
  model: string;
  partNumber: string;
  chip: string;
}

export interface BookmarkRow {
  id: string;
  documentId: string;
  moduleId: string;
  tool: ToolName;
  moduleName: string;
  displayName: string;
  originalFilename: string;
  pageNumber: number;
  title: string;
  snippet: string;
  createdAt: number;
  uri: string | null;
  source: 'bundled' | 'imported';
}

export interface HistoryRow {
  id: string;
  query: string;
  tool: ToolName | null;
  moduleId: string | null;
  createdAt: number;
}

export interface SeedDocument {
  id: string;
  tool: ToolName;
  module: string;
  displayName: string;
  filename: string;
  pageCount: number;
  fileSize: number;
  source: string;
  pages: { pageNumber: number; text: string }[];
}

export interface IndexedPage {
  pageNumber: number;
  text: string;
}

export const bundledDocuments = seedIndex as SeedDocument[];

export function createId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeText(value: string): string {
  return value.normalize('NFKD').toLocaleLowerCase().replace(/[^a-z0-9]/g, '');
}

const CHIP_REGEX = /\b((?:24|25|93|95|35)[A-Z0-9]{2,5}|MC9S12[A-Z0-9]+|9S12[A-Z0-9]+|SPC56[A-Z0-9]+|MAC[0-9]+|MB9[0-9][A-Z0-9]+|R5F[0-9A-Z]+|PIC[0-9A-Z]+|ATMEGA[0-9]+|70F[0-9]+|u?PD78[0-9A-Z]+|XC2[0-9A-Z]+|TMS[0-9A-Z]+|NEC)\b/i;

const AUTOMOTIVE_BRANDS = new Set([
  'acura', 'audi', 'bmw', 'buick', 'cadillac', 'cadilac', 'chery', 'chevrolet',
  'chrysler', 'citroen', 'dacia', 'daewoo', 'datsun', 'dodge', 'ducati', 'fiat',
  'ford', 'geely', 'great wall', 'greatwall', 'honda', 'hyundai', 'infiniti',
  'isuzu', 'iveco', 'jaguar', 'jeep', 'kia', 'lada', 'lamborghini', 'land rover',
  'landrover', 'lexus', 'lifan', 'mazda', 'mercedes', 'mercedes-benz', 'mg',
  'mitsubishi', 'nissan', 'opel', 'peugeot', 'porsche', 'renault', 'saab', 'seat',
  'skoda', 'smart', 'ssangyong', 'ssang yong', 'subaru', 'suzuki', 'toyota',
  'volkswagen', 'vw', 'volvo', 'aprilia', 'byd', 'haval', 'hummer'
]);

export function mapColumnsToRecord(
  columns: string[],
  cells: string[],
): { brand: string; model: string; partNumber: string; chip: string } {
  let brand = '';
  let model = '';
  let partNumber = '';
  let chip = '';

  const matchedIndices = new Set<number>();

  columns.forEach((col, idx) => {
    const norm = col.toLowerCase().replace(/[^a-z0-9]/g, '');
    const val = (cells[idx] || '').trim();
    if (!val || val === '-') return;

    if (/^(brand|company|make|maker|manufacturer|car|vehicle)$/.test(norm)) {
      brand = val;
      matchedIndices.add(idx);
    } else if (/^(chip|chipnumber|chipno|eeprom|mcu|micro|processor|mask|memory|device|yearchip)$/.test(norm)) {
      chip = val;
      matchedIndices.add(idx);
    } else if (/^(partnumber|partno|part|pn|number|ref|unit)$/.test(norm)) {
      partNumber = val;
      matchedIndices.add(idx);
    } else if (/^(model|series|module|type|system|application)$/.test(norm)) {
      model = model ? `${model} ${val}` : val;
      matchedIndices.add(idx);
    }
  });

  // For unmapped cells or generic fallback columns (Column 1, Column 2, etc.):
  cells.forEach((val, idx) => {
    if (matchedIndices.has(idx)) return;
    val = (val || '').trim();
    if (!val || val === '-') return;

    if (!chip && CHIP_REGEX.test(val)) {
      const m = val.match(CHIP_REGEX);
      chip = m ? m[0] : val;
      return;
    }

    const valLower = val.toLowerCase();
    if (!brand && AUTOMOTIVE_BRANDS.has(valLower)) {
      brand = val;
      return;
    }

    if (!partNumber) {
      partNumber = val;
    } else if (!model) {
      model = val;
    }
  });

  // If model was populated from a 'Model' column that contains the part number (like in iProg list)
  if (model && !partNumber) {
    const match = model.match(/^([A-Za-z0-9\s\-]+?)\s+([A-Z0-9]{3,}[-. ][A-Z0-9\s\.\-]+)$/i);
    if (match && !/^\d/.test(match[1])) {
      model = match[1].trim();
      partNumber = match[2].trim();
    } else {
      partNumber = model;
    }
  }

  return { brand, model, partNumber, chip };
}

function excerptFor(text: string, query: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const terms = query.trim().split(/\s+/).map(normalizeText).filter(Boolean);
  const preferred = lines.find((line) => terms.length > 0 && terms.every((term) => normalizeText(line).includes(term)));
  if (preferred) return preferred;
  const partial = lines.find((line) => terms.some((term) => normalizeText(line).includes(term)));
  return partial ?? lines.slice(0, 4).join(' · ');
}

const SCHEMA = `
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS tools (
    name TEXT PRIMARY KEY NOT NULL,
    createdAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY NOT NULL,
    tool TEXT NOT NULL REFERENCES tools(name),
    name TEXT NOT NULL,
    description TEXT,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    createdAt INTEGER NOT NULL,
    UNIQUE(tool, name)
  );
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY NOT NULL,
    moduleId TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    displayName TEXT NOT NULL,
    originalFilename TEXT NOT NULL,
    uri TEXT,
    pageCount INTEGER NOT NULL DEFAULT 0,
    fileSize INTEGER NOT NULL DEFAULT 0,
    importedAt INTEGER NOT NULL,
    lastOpenedAt INTEGER,
    lastOpenedPage INTEGER,
    indexingStatus TEXT NOT NULL DEFAULT 'processing',
    indexError TEXT,
    source TEXT NOT NULL DEFAULT 'imported'
  );
  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    pageNumber INTEGER NOT NULL,
    text TEXT NOT NULL,
    normalizedText TEXT NOT NULL,
    UNIQUE(documentId, pageNumber)
  );
  CREATE INDEX IF NOT EXISTS pages_document_page_idx ON pages(documentId, pageNumber);
  CREATE INDEX IF NOT EXISTS documents_module_idx ON documents(moduleId, indexingStatus);
  CREATE TABLE IF NOT EXISTS bookmarks (
    id TEXT PRIMARY KEY NOT NULL,
    documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    pageNumber INTEGER NOT NULL,
    title TEXT NOT NULL,
    snippet TEXT NOT NULL,
    createdAt INTEGER NOT NULL,
    UNIQUE(documentId, pageNumber)
  );
  CREATE TABLE IF NOT EXISTS search_history (
    id TEXT PRIMARY KEY NOT NULL,
    query TEXT NOT NULL,
    tool TEXT,
    moduleId TEXT,
    createdAt INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS chip_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    pageNumber INTEGER NOT NULL,
    tool TEXT NOT NULL,
    moduleName TEXT NOT NULL,
    displayName TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    partNumber TEXT NOT NULL DEFAULT '',
    chip TEXT NOT NULL DEFAULT '',
    searchTokens TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS chip_records_doc_page_idx ON chip_records(documentId, pageNumber);
  CREATE INDEX IF NOT EXISTS chip_records_tokens_idx ON chip_records(searchTokens);
  CREATE INDEX IF NOT EXISTS chip_records_tool_mod_idx ON chip_records(tool, moduleName);
  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
`;

export async function initializeDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync('autochip-finder.db');
  await db.execAsync(SCHEMA);
  await db.runAsync(
    'INSERT OR IGNORE INTO tools (name, createdAt) VALUES (?, ?)',
    'CG100X',
    Date.now(),
  );
  await db.runAsync(
    'INSERT OR IGNORE INTO tools (name, createdAt) VALUES (?, ?)',
    'iProg Pro',
    Date.now(),
  );

  const seeded = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'seed_manifest_v1'",
  );
  if (!seeded) {
    await db.withTransactionAsync(async () => {
      let order = 0;
      for (const doc of bundledDocuments) {
        const moduleId = `cg100x-${doc.module.toLowerCase()}`;
        await db.runAsync(
          `INSERT OR IGNORE INTO modules (id, tool, name, description, sortOrder, createdAt)
           VALUES (?, ?, ?, ?, ?, ?)`,
          moduleId,
          doc.tool,
          doc.module,
          `Bundled ${doc.module.toLowerCase()} reference manual`,
          order++,
          Date.now(),
        );
        await db.runAsync(
          `INSERT OR IGNORE INTO documents
           (id, moduleId, displayName, originalFilename, pageCount, fileSize, importedAt, indexingStatus, source)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', 'bundled')`,
          doc.id,
          moduleId,
          doc.displayName,
          doc.filename,
          doc.pageCount,
          doc.fileSize,
          Date.now(),
        );
        const existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM pages WHERE documentId = ? LIMIT 1',
          doc.id,
        );
        if (!existing) {
          for (const page of doc.pages) {
            const text = page.text.trim();
            if (!text) continue;
            await db.runAsync(
              'INSERT OR IGNORE INTO pages (documentId, pageNumber, text, normalizedText) VALUES (?, ?, ?, ?)',
              doc.id,
              page.pageNumber,
              text,
              normalizeText(text),
            );
          }
        }
      }
      await db.runAsync(
        "INSERT INTO app_settings (key, value) VALUES ('seed_manifest_v1', 'done')",
      );
    });
  }

  const recordsSeeded = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_settings WHERE key = 'records_manifest_v3'",
  );
  if (!recordsSeeded) {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM chip_records WHERE documentId LIKE "seed-%"');
      for (const doc of bundledDocuments) {
        const headers = findPageTableHeaders(doc.pages[0]?.text ?? '');
        for (const page of doc.pages) {
          const table = parsePageTable(page.text, headers);
          for (const row of table.rows) {
            const rec = mapColumnsToRecord(table.columns, row);
            if (rec.brand || rec.model || rec.partNumber || rec.chip) {
              const searchTokens = (rec.brand + ' ' + rec.model + ' ' + rec.partNumber + ' ' + rec.chip)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '');
              await db.runAsync(
                `INSERT INTO chip_records (documentId, pageNumber, tool, moduleName, displayName, brand, model, partNumber, chip, searchTokens)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                doc.id,
                page.pageNumber,
                doc.tool,
                doc.module,
                doc.displayName,
                rec.brand,
                rec.model,
                rec.partNumber,
                rec.chip,
                searchTokens,
              );
            }
          }
        }
      }
      await db.runAsync(
        "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('records_manifest_v3', 'done')",
      );
    });
  }

  await db.runAsync(
    "UPDATE documents SET indexingStatus = 'failed', indexError = 'Indexing was interrupted. Retry indexing to continue.' WHERE indexingStatus = 'processing'",
  );
  return db;
}

export async function readSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function writeSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}

export async function getStats(db: SQLiteDatabase): Promise<{
  pdfCount: number;
  indexedPageCount: number;
  moduleCount: number;
  storageBytes: number;
}> {
  const [stats, modules, storage] = await Promise.all([
    db.getFirstAsync<{ pdfCount: number; indexedPageCount: number }>(
      `SELECT (SELECT COUNT(*) FROM documents) AS pdfCount,
        (SELECT COUNT(*) FROM pages p JOIN documents d ON d.id = p.documentId WHERE d.indexingStatus = 'ready') AS indexedPageCount`,
    ),
    db.getFirstAsync<{ moduleCount: number }>('SELECT COUNT(*) AS moduleCount FROM modules'),
    db.getFirstAsync<{ storageBytes: number }>(
      'SELECT COALESCE(SUM(fileSize), 0) AS storageBytes FROM documents',
    ),
  ]);
  return {
    pdfCount: stats?.pdfCount ?? 0,
    indexedPageCount: stats?.indexedPageCount ?? 0,
    moduleCount: modules?.moduleCount ?? 0,
    storageBytes: storage?.storageBytes ?? 0,
  };
}

export async function listTools(db: SQLiteDatabase): Promise<ToolName[]> {
  const rows = await db.getAllAsync<{ name: ToolName }>(
    'SELECT name FROM tools ORDER BY createdAt ASC, name COLLATE NOCASE ASC',
  );
  return rows.map((row) => row.name);
}

export async function createTool(db: SQLiteDatabase, name: string): Promise<void> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error('Enter a programmer name.');
  if (cleanName.length > 60) throw new Error('Programmer names must be 60 characters or fewer.');

  const existing = await db.getFirstAsync<{ name: string }>(
    'SELECT name FROM tools WHERE name = ? COLLATE NOCASE',
    cleanName,
  );
  if (existing) throw new Error('A programmer with this name already exists.');

  await db.runAsync(
    'INSERT INTO tools (name, createdAt) VALUES (?, ?)',
    cleanName,
    Date.now(),
  );
}

export async function listModules(db: SQLiteDatabase, tool?: ToolName): Promise<ModuleRow[]> {
  const rows = await db.getAllAsync<Omit<ModuleRow, 'tool'> & { tool: ToolName }>(
    `SELECT m.id, m.tool, m.name, m.description, m.sortOrder,
      COUNT(DISTINCT d.id) AS documentCount,
      COALESCE(SUM(CASE WHEN d.indexingStatus = 'ready' THEN d.pageCount ELSE 0 END), 0) AS indexedPageCount
     FROM modules m
     LEFT JOIN documents d ON d.moduleId = m.id
     ${tool ? 'WHERE m.tool = ?' : ''}
     GROUP BY m.id
     ORDER BY m.sortOrder ASC, m.name COLLATE NOCASE ASC`,
    ...(tool ? [tool] : []),
  );
  return rows;
}

export async function getModule(db: SQLiteDatabase, id: string): Promise<ModuleRow | null> {
  const rows = await listModules(db);
  return rows.find((row) => row.id === id) ?? null;
}

export async function createModule(
  db: SQLiteDatabase,
  tool: ToolName,
  name: string,
  description = '',
): Promise<string> {
  const moduleId = createId('module');
  const order = await db.getFirstAsync<{ nextOrder: number }>(
    'SELECT COALESCE(MAX(sortOrder), -1) + 1 AS nextOrder FROM modules WHERE tool = ?',
    tool,
  );
  await db.runAsync(
    'INSERT INTO modules (id, tool, name, description, sortOrder, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    moduleId,
    tool,
    name.trim(),
    description.trim(),
    order?.nextOrder ?? 0,
    Date.now(),
  );
  return moduleId;
}

export async function renameModule(db: SQLiteDatabase, id: string, name: string): Promise<void> {
  await db.runAsync('UPDATE modules SET name = ? WHERE id = ?', name.trim(), id);
}

export async function moveModule(db: SQLiteDatabase, id: string, direction: -1 | 1): Promise<void> {
  const module = await db.getFirstAsync<{ id: string; tool: ToolName; sortOrder: number }>(
    'SELECT id, tool, sortOrder FROM modules WHERE id = ?',
    id,
  );
  if (!module) return;
  const rows = await db.getAllAsync<{ id: string; sortOrder: number }>(
    'SELECT id, sortOrder FROM modules WHERE tool = ? ORDER BY sortOrder ASC',
    module.tool,
  );
  const index = rows.findIndex((row) => row.id === id);
  const swap = rows[index + direction];
  if (!swap) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE modules SET sortOrder = ? WHERE id = ?', swap.sortOrder, id);
    await db.runAsync('UPDATE modules SET sortOrder = ? WHERE id = ?', module.sortOrder, swap.id);
  });
}

export async function deleteModule(db: SQLiteDatabase, id: string): Promise<DocumentRow[]> {
  const documents = await listDocuments(db, undefined, id);
  await db.runAsync('DELETE FROM modules WHERE id = ?', id);
  return documents;
}

export async function listDocuments(
  db: SQLiteDatabase,
  tool?: ToolName,
  moduleId?: string,
): Promise<DocumentRow[]> {
  const where: string[] = [];
  const params: string[] = [];
  if (tool) {
    where.push('m.tool = ?');
    params.push(tool);
  }
  if (moduleId) {
    where.push('m.id = ?');
    params.push(moduleId);
  }
  const rows = await db.getAllAsync<DocumentRow>(
    `SELECT d.*, m.name AS moduleName, m.tool
     FROM documents d JOIN modules m ON m.id = d.moduleId
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY COALESCE(d.lastOpenedAt, d.importedAt) DESC`,
    ...params,
  );
  return rows;
}

export async function getDocument(db: SQLiteDatabase, id: string): Promise<DocumentRow | null> {
  return await db.getFirstAsync<DocumentRow>(
    `SELECT d.*, m.name AS moduleName, m.tool
     FROM documents d JOIN modules m ON m.id = d.moduleId WHERE d.id = ?`,
    id,
  );
}

export async function documentExists(
  db: SQLiteDatabase,
  filename: string,
  fileSize: number,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM documents WHERE originalFilename = ? AND fileSize = ? LIMIT 1',
    filename,
    fileSize,
  );
  return Boolean(row);
}

export async function createDocumentRecord(
  db: SQLiteDatabase,
  record: {
    id: string;
    moduleId: string;
    displayName: string;
    originalFilename: string;
    uri: string;
    pageCount: number;
    fileSize: number;
  },
): Promise<void> {
  await db.runAsync(
    `INSERT INTO documents
     (id, moduleId, displayName, originalFilename, uri, pageCount, fileSize, importedAt, indexingStatus, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'processing', 'imported')`,
    record.id,
    record.moduleId,
    record.displayName,
    record.originalFilename,
    record.uri,
    record.pageCount,
    record.fileSize,
    Date.now(),
  );
}

export async function updateDocumentName(
  db: SQLiteDatabase,
  id: string,
  displayName: string,
): Promise<void> {
  await db.runAsync('UPDATE documents SET displayName = ? WHERE id = ?', displayName.trim(), id);
}

export async function replacePageIndex(
  db: SQLiteDatabase,
  documentId: string,
  pages: IndexedPage[],
  status: IndexStatus,
  error: string | null = null,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM pages WHERE documentId = ?', documentId);
    await db.runAsync('DELETE FROM chip_records WHERE documentId = ?', documentId);
    for (const page of pages) {
      const text = page.text.trim();
      if (!text) continue;
      await db.runAsync(
        'INSERT INTO pages (documentId, pageNumber, text, normalizedText) VALUES (?, ?, ?, ?)',
        documentId,
        page.pageNumber,
        text,
        normalizeText(text),
      );
    }

    const docRow = await db.getFirstAsync<{ tool: string; moduleName: string; displayName: string }>(
      'SELECT m.tool, m.name AS moduleName, d.displayName FROM documents d JOIN modules m ON m.id = d.moduleId WHERE d.id = ?',
      documentId,
    );
    if (docRow && pages.length > 0) {
      const headers = findDocumentTableHeaders(pages);
      for (const page of pages) {
        const table = parsePageTable(page.text, headers);
        for (const row of table.rows) {
          const rec = mapColumnsToRecord(table.columns, row);
          if (rec.brand || rec.model || rec.partNumber || rec.chip) {
            const searchTokens = (rec.brand + ' ' + rec.model + ' ' + rec.partNumber + ' ' + rec.chip)
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
            await db.runAsync(
              `INSERT INTO chip_records (documentId, pageNumber, tool, moduleName, displayName, brand, model, partNumber, chip, searchTokens)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              documentId,
              page.pageNumber,
              docRow.tool,
              docRow.moduleName,
              docRow.displayName,
              rec.brand,
              rec.model,
              rec.partNumber,
              rec.chip,
              searchTokens,
            );
          }
        }
      }
    }

    await db.runAsync(
      'UPDATE documents SET indexingStatus = ?, indexError = ?, pageCount = CASE WHEN ? > 0 THEN ? ELSE pageCount END WHERE id = ?',
      status,
      error,
      pages.length,
      pages.length,
      documentId,
    );
  });
}

export async function updateDocumentStatus(
  db: SQLiteDatabase,
  id: string,
  status: IndexStatus,
  error: string | null,
): Promise<void> {
  await db.runAsync(
    'UPDATE documents SET indexingStatus = ?, indexError = ? WHERE id = ?',
    status,
    error,
    id,
  );
}

export async function deleteDocument(db: SQLiteDatabase, id: string): Promise<DocumentRow | null> {
  const document = await getDocument(db, id);
  await db.runAsync('DELETE FROM documents WHERE id = ?', id);
  return document;
}

export async function searchPages(
  db: SQLiteDatabase,
  options: {
    query: string;
    tool?: ToolName;
    moduleId?: string;
    documentId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<SearchResult[]> {
  const tokens = options.query.match(/[a-z0-9]+/gi)?.map(normalizeText).filter(Boolean) ?? [];
  if (!tokens.length) return [];
  const where = [
    "d.indexingStatus = 'ready'",
    ...tokens.map(() => 'p.normalizedText LIKE ?'),
  ];
  const params: (string | number)[] = tokens.map((token) => `%${token}%`);
  if (options.tool) {
    where.push('m.tool = ?');
    params.push(options.tool);
  }
  if (options.moduleId) {
    where.push('m.id = ?');
    params.push(options.moduleId);
  }
  if (options.documentId) {
    where.push('d.id = ?');
    params.push(options.documentId);
  }
  const limit = options.limit ?? 50;
  params.push(limit, options.offset ?? 0);
  const rows = await db.getAllAsync<Omit<SearchResult, 'snippet'>>(
    `SELECT p.id AS pageId, d.id AS documentId, m.id AS moduleId, m.tool, m.name AS moduleName,
      d.displayName, d.originalFilename, p.pageNumber, d.pageCount, p.text, d.source, d.uri
     FROM pages p
     JOIN documents d ON d.id = p.documentId
     JOIN modules m ON m.id = d.moduleId
     WHERE ${where.join(' AND ')}
     ORDER BY CASE WHEN p.normalizedText LIKE ? THEN 0 ELSE 1 END,
       m.tool, m.name COLLATE NOCASE, d.displayName COLLATE NOCASE, p.pageNumber
     LIMIT ? OFFSET ?`,
    ...params.slice(0, -2),
    `%${normalizeText(options.query)}%`,
    ...params.slice(-2),
  );

  // Build a cache of first-page headers per document so inner pages inherit column names
  const docHeaderCache = new Map<string, string[]>();
  return rows.map((row) => {
    // Get or detect column headers for this document
    if (!docHeaderCache.has(row.documentId)) {
      // Find the first-page text for this document from rows to detect headers
      const firstPageRow = rows.find((r) => r.documentId === row.documentId && r.pageNumber === 1);
      const headers = firstPageRow ? findPageTableHeaders(firstPageRow.text) : null;
      docHeaderCache.set(row.documentId, headers ?? []);
    }
    const cachedHeaders = docHeaderCache.get(row.documentId) ?? [];

    // Parse the page table using inherited headers when the page itself has no header row
    const table = parsePageTable(row.text, cachedHeaders.length > 0 ? cachedHeaders : null);
    const terms = options.query.trim().split(/\s+/).map(normalizeText).filter(Boolean);
    const matchRows = table.rows.filter((cells) =>
      terms.length > 0 && cells.some((cell) => terms.some((term) => normalizeText(cell).includes(term))),
    );

    return {
      ...row,
      snippet: excerptFor(row.text, options.query),
      matchColumns: table.columns,
      matchRows,
    };
  });
}

export async function searchChipRecords(
  db: SQLiteDatabase,
  options: {
    query: string;
    tool?: ToolName;
    moduleId?: string;
    documentId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<SearchChipRecord[]> {
  const rawQuery = options.query.trim();
  if (!rawQuery) return [];
  const tokens = rawQuery.match(/[a-z0-9]+/gi)?.map((t) => t.toLowerCase()) ?? [];
  if (!tokens.length) return [];

  const where: string[] = [];
  const params: (string | number)[] = [];

  for (const token of tokens) {
    where.push('searchTokens LIKE ?');
    params.push(`%${token}%`);
  }

  if (options.tool) {
    where.push('tool = ?');
    params.push(options.tool);
  }
  if (options.moduleId) {
    where.push('documentId IN (SELECT id FROM documents WHERE moduleId = ?)');
    params.push(options.moduleId);
  }
  if (options.documentId) {
    where.push('documentId = ?');
    params.push(options.documentId);
  }

  const limit = options.limit ?? 50;
  params.push(limit, options.offset ?? 0);

  const sql = `
    SELECT id, documentId, pageNumber, tool, moduleName, displayName, brand, model, partNumber, chip
    FROM chip_records
    WHERE ${where.join(' AND ')}
    ORDER BY tool, moduleName, pageNumber, brand, partNumber
    LIMIT ? OFFSET ?
  `;

  return await db.getAllAsync<SearchChipRecord>(sql, ...params);
}

export async function getPageText(
  db: SQLiteDatabase,
  documentId: string,
  pageNumber: number,
): Promise<string | null> {
  const row = await db.getFirstAsync<{ text: string }>(
    'SELECT text FROM pages WHERE documentId = ? AND pageNumber = ?',
    documentId,
    pageNumber,
  );
  return row?.text ?? null;
}

export async function recordOpenedPage(
  db: SQLiteDatabase,
  documentId: string,
  pageNumber: number,
): Promise<void> {
  await db.runAsync(
    'UPDATE documents SET lastOpenedAt = ?, lastOpenedPage = ? WHERE id = ?',
    Date.now(),
    pageNumber,
    documentId,
  );
}

export async function listBookmarks(db: SQLiteDatabase): Promise<BookmarkRow[]> {
  return await db.getAllAsync<BookmarkRow>(
    `SELECT b.*, d.moduleId, d.displayName, d.originalFilename, d.uri, d.source,
       m.name AS moduleName, m.tool
     FROM bookmarks b
     JOIN documents d ON d.id = b.documentId
     JOIN modules m ON m.id = d.moduleId
     ORDER BY b.createdAt DESC`,
  );
}

export async function hasBookmark(
  db: SQLiteDatabase,
  documentId: string,
  pageNumber: number,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM bookmarks WHERE documentId = ? AND pageNumber = ?',
    documentId,
    pageNumber,
  );
  return Boolean(row);
}

export async function toggleBookmark(
  db: SQLiteDatabase,
  result: SearchResult,
): Promise<void> {
  const exists = await hasBookmark(db, result.documentId, result.pageNumber);
  if (exists) {
    await db.runAsync(
      'DELETE FROM bookmarks WHERE documentId = ? AND pageNumber = ?',
      result.documentId,
      result.pageNumber,
    );
    return;
  }
  await db.runAsync(
    'INSERT OR IGNORE INTO bookmarks (id, documentId, pageNumber, title, snippet, createdAt) VALUES (?, ?, ?, ?, ?, ?)',
    createId('bookmark'),
    result.documentId,
    result.pageNumber,
    `${result.moduleName} · page ${result.pageNumber}`,
    result.snippet,
    Date.now(),
  );
}

export async function deleteBookmark(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM bookmarks WHERE id = ?', id);
}

export async function saveHistory(
  db: SQLiteDatabase,
  query: string,
  tool: ToolName | null = null,
  moduleId: string | null = null,
): Promise<void> {
  const normalized = query.trim();
  if (!normalized) return;
  await db.runAsync(
    'INSERT INTO search_history (id, query, tool, moduleId, createdAt) VALUES (?, ?, ?, ?, ?)',
    createId('search'),
    normalized,
    tool,
    moduleId,
    Date.now(),
  );
  await db.runAsync(
    'DELETE FROM search_history WHERE id NOT IN (SELECT id FROM search_history ORDER BY createdAt DESC LIMIT 100)',
  );
}

export async function listHistory(db: SQLiteDatabase): Promise<HistoryRow[]> {
  return await db.getAllAsync<HistoryRow>(
    'SELECT * FROM search_history ORDER BY createdAt DESC LIMIT 100',
  );
}

export async function deleteHistoryItem(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM search_history WHERE id = ?', id);
}

export async function clearHistory(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM search_history');
}

export async function clearLocalDatabase(db: SQLiteDatabase): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM bookmarks');
    await db.runAsync('DELETE FROM search_history');
    await db.runAsync('DELETE FROM pages');
    await db.runAsync('DELETE FROM documents');
    await db.runAsync('DELETE FROM modules');
    await db.runAsync("DELETE FROM app_settings WHERE key != 'theme'");
  });
}