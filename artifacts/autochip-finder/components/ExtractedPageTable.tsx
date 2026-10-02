import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { HighlightedText } from '@/components/common';
import type { ThemeColors } from '@/constants/colors';
import { parsePageTable, findPageTableHeaders } from '@/lib/page-table';

export { findPageTableHeaders };

export function ExtractedPageTable({
  text,
  headerText,
  query,
  colors,
}: {
  text: string;
  headerText: string;
  query: string;
  colors: ThemeColors;
}) {
  const table = useMemo(
    () => parsePageTable(text, findPageTableHeaders(headerText)),
    [text, headerText],
  );
  const columnWidths = useMemo(
    () =>
      table.columns.map((column, columnIndex) => {
        const longestCell = Math.max(
          column.length,
          ...table.rows.slice(0, 80).map((row) => row[columnIndex]?.length ?? 0),
        );
        return Math.min(210, Math.max(112, Math.ceil(longestCell * 6.3 + 26)));
      }),
    [table],
  );
  const tableWidth = columnWidths.reduce((total, width) => total + width, 0);

  return (
    <View style={styles.container} testID="source-page-table">
      {table.title ? (
        <Text style={[styles.title, { color: colors.mutedForeground }]}>{table.title}</Text>
      ) : null}
      <View style={styles.meta}>
        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
          {table.rows.length} {table.rows.length === 1 ? 'row' : 'rows'} · {table.columns.length} {table.columns.length === 1 ? 'column' : 'columns'}
        </Text>
        {table.columns.length > 2 ? (
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Swipe sideways for more</Text>
        ) : null}
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.scrollContent}
        accessibilityLabel="Extracted page table"
      >
        <View style={[styles.table, { width: tableWidth, borderColor: colors.border }]}>
          <View style={styles.row}>
            {table.columns.map((column, index) => (
              <View
                key={`${column}-${index}`}
                style={[
                  styles.headerCell,
                  {
                    width: columnWidths[index],
                    backgroundColor: colors.accent,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.headerText, { color: colors.accentForeground }]}>{column}</Text>
              </View>
            ))}
          </View>
          {table.rows.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.row}>
              {table.columns.map((column, columnIndex) => (
                <View
                  key={`${column}-${rowIndex}`}
                  style={[
                    styles.cell,
                    {
                      width: columnWidths[columnIndex],
                      backgroundColor: rowIndex % 2 === 0 ? colors.card : colors.secondary,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  {row[columnIndex] ? (
                    <HighlightedText
                      text={row[columnIndex]}
                      query={query}
                      style={[styles.cellText, { color: colors.secondaryForeground }]}
                    />
                  ) : (
                    <Text style={[styles.cellText, { color: colors.mutedForeground }]}>—</Text>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
      {!table.structured ? (
        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          No clear column separators were found, so this page is shown as extracted text rows.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 9 },
  title: { fontSize: 11, fontWeight: '600', lineHeight: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaText: { fontSize: 9, fontWeight: '600' },
  scrollContent: { flexGrow: 0 },
  table: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  row: { flexDirection: 'row' },
  headerCell: {
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { fontSize: 10, fontWeight: '800', lineHeight: 14 },
  cell: {
    minHeight: 40,
    paddingHorizontal: 10,
    paddingVertical: 9,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cellText: { fontSize: 11, lineHeight: 16 },
  note: { fontSize: 9, lineHeight: 14 },
});