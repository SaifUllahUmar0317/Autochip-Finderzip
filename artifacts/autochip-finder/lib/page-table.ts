export interface ParsedPageTable {
  title: string | null;
  columns: string[];
  rows: string[][];
  structured: boolean;
}

const HEADER_NAMES = new Set([
  'brand',
  'chip',
  'model',
  'module',
  'number',
  'partnumber',
  'series',
  'year',
  'yearchip',
]);

function normalizeHeader(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function splitColumns(line: string): string[] {
  if (line.includes('\t')) {
    return line.split(/\t+/).map((cell) => cell.trim()).filter(Boolean);
  }
  const spacedCells = line.trim().split(/ {2,}/).map((cell) => cell.trim()).filter(Boolean);
  return spacedCells.length > 1 ? spacedCells : [line.trim().replace(/\s+/g, ' ')];
}

function expandJoinedHeaderCells(cells: string[]): string[] {
  const labels = /Part\s+number|Year\s*\/?\s*chip|Series|Brand|Module|Model|Number|Chip/gi;
  return cells.flatMap((cell) => {
    const parts = cell.match(labels);
    if (!parts || normalizeHeader(parts.join('')) !== normalizeHeader(cell)) return [cell];
    return parts.map((part) => part.trim());
  });
}

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const matches = cells.filter((cell) => HEADER_NAMES.has(normalizeHeader(cell))).length;
  return matches >= 2;
}

function getHeaderRow(text: string): { index: number; cells: string[] } | null {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  for (let index = 0; index < lines.length; index += 1) {
    const cells = expandJoinedHeaderCells(splitColumns(lines[index]));
    if (isHeaderRow(cells)) return { index, cells };
  }
  return null;
}

export function findPageTableHeaders(text: string): string[] | null {
  return getHeaderRow(text)?.cells ?? null;
}

function rowWithMissingModule(
  cells: string[],
  columnCount: number,
  moduleIndex: number,
): string[] {
  let sourceIndex = 0;
  return Array.from({ length: columnCount }, (_, index) => {
    if (index === moduleIndex) return '';
    const value = cells[sourceIndex] ?? '';
    sourceIndex += 1;
    return value;
  });
}

export function parsePageTable(text: string, fallbackColumns: string[] | null = null): ParsedPageTable {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const currentHeader = getHeaderRow(text);
  const columns = currentHeader?.cells ?? fallbackColumns ?? [];
  const bodyLines = currentHeader ? lines.slice(currentHeader.index + 1) : lines;
  const splitBody = bodyLines.map(splitColumns);

  let structured = columns.length > 1;
  if (!columns.length) {
    const largestRow = Math.max(1, ...splitBody.map((cells) => cells.length));
    structured = largestRow > 1;
    columns.push(
      ...Array.from({ length: largestRow }, (_, index) =>
        largestRow === 1 ? 'Extracted text' : `Column ${index + 1}`,
      ),
    );
  }

  const moduleIndex = columns.findIndex((column) => normalizeHeader(column) === 'module');
  const rows: string[][] = [];

  for (let index = 0; index < splitBody.length;) {
    const cells = splitBody[index];
    const nextCells = splitBody[index + 1];
    const followingCells = splitBody[index + 2];

    // Some PDF table cells wrap vertically while the other cells stay on one line.
    // For the CG100X BCM list, module names wrap around otherwise complete rows.
    if (
      moduleIndex >= 0 &&
      cells.length === 1 &&
      nextCells?.length === columns.length - 1
    ) {
      const row = rowWithMissingModule(nextCells, columns.length, moduleIndex);
      row[moduleIndex] = cells[0];
      if (followingCells?.length === 1) {
        row[moduleIndex] = `${row[moduleIndex]} ${followingCells[0]}`.trim();
        index += 3;
      } else {
        index += 2;
      }
      rows.push(row);
      continue;
    }

    if (
      moduleIndex >= 0 &&
      cells.length === columns.length - 1 &&
      nextCells?.length === 1
    ) {
      const row = rowWithMissingModule(cells, columns.length, moduleIndex);
      row[moduleIndex] = nextCells[0];
      rows.push(row);
      index += 2;
      continue;
    }

    if (cells.length > columns.length) {
      rows.push([
        ...cells.slice(0, columns.length - 1),
        cells.slice(columns.length - 1).join(' '),
      ]);
    } else {
      rows.push(Array.from({ length: columns.length }, (_, columnIndex) => cells[columnIndex] ?? ''));
    }
    index += 1;
  }

  const title = currentHeader && currentHeader.index > 0
    ? lines.slice(0, currentHeader.index).join(' · ')
    : null;

  return { title, columns, rows, structured };
}