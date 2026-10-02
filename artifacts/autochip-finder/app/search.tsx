import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ActionButton,
  EmptyState,
  HighlightedText,
  Pill,
  Screen,
  SectionTitle,
  Surface,
  TextField,
  TopBar,
} from '@/components/common';
import { useApp } from '@/context/AppContext';
import {
  listTools,
  listDocuments,
  listModules,
  saveHistory,
  searchChipRecords,
  type DocumentRow,
  type ModuleRow,
  type SearchChipRecord,
  type ToolName,
} from '@/lib/database';

const PAGE_SIZE = 50;

export default function SearchScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    q?: string | string[];
    tool?: string | string[];
    moduleId?: string | string[];
    documentId?: string | string[];
  }>();
  const initialQuery = first(params.q);
  const routeTool = first(params.tool);
  const routeModule = first(params.moduleId);
  const routeDocument = first(params.documentId);
  const { colors, db, revision, refresh } = useApp();
  const [query, setQuery] = useState(initialQuery);
  const [selectedTool, setSelectedTool] = useState<ToolName | null>(routeTool ?? null);
  const [selectedModule, setSelectedModule] = useState(routeModule);
  const [selectedDocument, setSelectedDocument] = useState(routeDocument);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tools, setTools] = useState<ToolName[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [results, setResults] = useState<SearchChipRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const historySaved = useRef('');

  useEffect(() => {
    setQuery(initialQuery);
    setSelectedTool(routeTool ?? null);
    setSelectedModule(routeModule);
    setSelectedDocument(routeDocument);
  }, [initialQuery, routeTool, routeModule, routeDocument]);

  useEffect(() => {
    if (!db) return;
    let active = true;
    void Promise.all([listTools(db), listModules(db), listDocuments(db)]).then(([toolRows, moduleRows, docs]) => {
      if (!active) return;
      setTools(toolRows);
      setModules(moduleRows);
      setDocuments(docs);
    });
    return () => {
      active = false;
    };
  }, [db, revision]);

  useEffect(() => {
    if (!db || !initialQuery.trim() || historySaved.current === initialQuery.trim()) return;
    historySaved.current = initialQuery.trim();
    void saveHistory(db, initialQuery, selectedTool === 'all' ? null : selectedTool, selectedModule || null).then(refresh);
  }, [db, initialQuery, selectedTool, selectedModule, refresh]);

  // Fast search with lean 80ms debounce for lightning speed
  useEffect(() => {
    if (!db || !query.trim()) {
      setResults([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setHasMore(false);
    const timer = setTimeout(() => {
      void searchChipRecords(db, {
        query,
        tool: selectedTool ?? undefined,
        moduleId: selectedModule || undefined,
        documentId: selectedDocument || undefined,
        limit: PAGE_SIZE + 1,
      }).then((rows) => {
        if (cancelled) return;
        setResults(rows.slice(0, PAGE_SIZE));
        setHasMore(rows.length > PAGE_SIZE);
        setLoading(false);
      }).catch((error: unknown) => {
        if (cancelled) return;
        setResults([]);
        setHasMore(false);
        setLoading(false);
        Alert.alert('Search could not finish', error instanceof Error ? error.message : 'Try again.');
      });
    }, 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [db, query, selectedTool, selectedModule, selectedDocument]);

  const submitSearch = () => {
    if (!db || !query.trim()) return;
    void saveHistory(db, query, selectedTool === 'all' ? null : selectedTool, selectedModule || null).then(refresh);
  };

  const showMore = async () => {
    if (!db || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await searchChipRecords(db, {
        query,
        tool: selectedTool ?? undefined,
        moduleId: selectedModule || undefined,
        documentId: selectedDocument || undefined,
        limit: PAGE_SIZE + 1,
        offset: results.length,
      });
      setResults((current) => [...current, ...rows.slice(0, PAGE_SIZE)]);
      setHasMore(rows.length > PAGE_SIZE);
    } catch (error) {
      Alert.alert('Could not load more results', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setLoadingMore(false);
    }
  };

  const changeTool = (value: ToolName | null) => {
    setSelectedTool(value);
    setSelectedModule('');
    setSelectedDocument('');
  };

  const visibleModules = modules.filter((item) => selectedTool === null || item.tool === selectedTool);
  const visibleDocuments = documents.filter((item) =>
    (selectedTool === null || item.tool === selectedTool) &&
    (!selectedModule || item.moduleId === selectedModule),
  );
  const activeFilterCount = Number(selectedTool !== null) + Number(Boolean(selectedModule)) + Number(Boolean(selectedDocument));

  return (
    <Screen keyboardAvoiding contentStyle={styles.content}>
      <TopBar title="Search manuals" />

      {/* Concise, professional search bar */}
      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={19} color={colors.mutedForeground} />
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search part or chip..."
          accessibilityLabel="Search part or chip"
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={submitSearch}
          style={styles.queryInput}
          testID="search-input"
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} style={styles.clearButton}>
            <Feather name="x-circle" size={17} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>

      {/* Filter Toggle */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={filtersOpen ? 'Hide search filters' : `Show search filters${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
        accessibilityState={{ expanded: filtersOpen }}
        onPress={() => setFiltersOpen((open) => !open)}
        style={({ pressed }) => [styles.filterToggle, { borderColor: colors.border }, pressed && styles.pressed]}
      >
        <Feather name="sliders" size={16} color={colors.mutedForeground} />
        <Text style={[styles.filterToggleText, { color: colors.foreground }]}>
          Filters{activeFilterCount ? ` · ${activeFilterCount} active` : ''}
        </Text>
        <Text numberOfLines={1} style={[styles.filterSummary, { color: colors.mutedForeground }]}>
          {selectedDocument
            ? documents.find((item) => item.id === selectedDocument)?.displayName
            : selectedModule
              ? modules.find((item) => item.id === selectedModule)?.name
              : selectedTool ?? 'All manuals'}
        </Text>
        <Feather name={filtersOpen ? 'chevron-up' : 'chevron-down'} size={17} color={colors.mutedForeground} />
      </Pressable>

      {filtersOpen ? (
        <View style={styles.filters}>
          <View style={styles.filterBlock}>
            <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>PROGRAMMER</Text>
            <View style={styles.filterRow}>
              <Pill label="All manuals" selected={selectedTool === null} onPress={() => changeTool(null)} />
              {tools.map((tool) => (
                <Pill key={tool} label={tool} selected={selectedTool === tool} onPress={() => changeTool(tool)} />
              ))}
            </View>
          </View>
          {visibleModules.length ? (
            <View style={styles.filterBlock}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>MODULE</Text>
              <View style={styles.filterRow}>
                <Pill label="All modules" selected={!selectedModule} onPress={() => { setSelectedModule(''); setSelectedDocument(''); }} />
                {visibleModules.map((module) => (
                  <Pill key={module.id} label={module.name} selected={selectedModule === module.id} onPress={() => { setSelectedModule(module.id); setSelectedDocument(''); }} />
                ))}
              </View>
            </View>
          ) : null}
          {visibleDocuments.length ? (
            <View style={styles.filterBlock}>
              <Text style={[styles.filterLabel, { color: colors.mutedForeground }]}>PDF</Text>
              <View style={styles.filterRow}>
                <Pill label="All PDFs" selected={!selectedDocument} onPress={() => setSelectedDocument('')} />
                {visibleDocuments.map((doc) => (
                  <Pill key={doc.id} label={doc.displayName} selected={selectedDocument === doc.id} onPress={() => setSelectedDocument(doc.id)} />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Results Header */}
      <View style={styles.resultHeading}>
        <SectionTitle title={query.trim() ? 'Matching records' : 'Search the library'} />
        {loading ? (
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>Searching…</Text>
        ) : query.trim() ? (
          <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>
            {results.length}{hasMore ? '+' : ''} found
          </Text>
        ) : null}
      </View>

      {!query.trim() ? (
        <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>Search indexed text across your offline library.</Text>
      ) : null}

      {query.trim() && !loading && results.length === 0 ? (
        <Surface style={styles.emptyCard}>
          <EmptyState
            icon="search"
            title="No matching records"
            description="Check the spelling, remove a word, or switch back to all manuals."
          />
        </Surface>
      ) : null}

      {/* Clean, well-formatted records containing ONLY the 4 fields (Brand, Model, Part Number, Chip Number) */}
      {results.map((item) => (
        <Surface key={item.id} style={styles.recordCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.displayName}, page ${item.pageNumber}`}
            testID={`result-record-${item.id}`}
            onPress={() =>
              router.push({
                pathname: '/viewer',
                params: {
                  documentId: item.documentId,
                  page: item.pageNumber,
                  q: query,
                },
              })
            }
            style={({ pressed }) => pressed && styles.pressed}
          >
            {/* Top Bar: Compact Manual & Page indicator */}
            <View style={styles.cardHeader}>
              <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
                <Feather name="file-text" size={12} color={colors.cyan} />
                <Text numberOfLines={1} style={[styles.badgeText, { color: colors.foreground }]}>
                  {item.tool} · {item.moduleName}
                </Text>
                <Text style={[styles.badgePage, { color: colors.mutedForeground }]}>
                  Page {item.pageNumber}
                </Text>
              </View>
              <View style={styles.openIndicator}>
                <Text style={[styles.openText, { color: colors.cyan }]}>Open</Text>
                <Feather name="arrow-up-right" size={13} color={colors.cyan} />
              </View>
            </View>

            {/* Exactly the 4 Core Fields: Model, Brand, Part Number, Chip Number */}
            <View style={[styles.fourFieldsContainer, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {/* Row 1: Brand & Model */}
              <View style={styles.fieldRow}>
                <View style={styles.fieldBox}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>BRAND</Text>
                  <HighlightedText
                    text={item.brand || '—'}
                    query={query}
                    style={[styles.fieldValue, { color: colors.foreground }]}
                  />
                </View>
                <View style={styles.fieldBox}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>MODEL</Text>
                  <HighlightedText
                    text={item.model || '—'}
                    query={query}
                    style={[styles.fieldValue, { color: colors.foreground }]}
                  />
                </View>
              </View>

              {/* Row 2: Part Number & Chip Number */}
              <View style={[styles.fieldRow, styles.fieldRowBottom, { borderTopColor: colors.border }]}>
                <View style={styles.fieldBox}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>PART NUMBER</Text>
                  <HighlightedText
                    text={item.partNumber || '—'}
                    query={query}
                    style={[styles.fieldValueHighlight, { color: colors.foreground }]}
                  />
                </View>
                <View style={styles.fieldBox}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>CHIP NUMBER</Text>
                  <HighlightedText
                    text={item.chip || '—'}
                    query={query}
                    style={[styles.fieldValueChip, { color: colors.cyan }]}
                  />
                </View>
              </View>
            </View>
          </Pressable>
        </Surface>
      ))}

      {hasMore ? (
        <ActionButton label="Load more matching records" icon="arrow-down" variant="secondary" loading={loadingMore} onPress={() => void showMore()} />
      ) : null}
    </Screen>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const styles = StyleSheet.create({
  content: { gap: 11 },
  searchBox: { minHeight: 52, borderRadius: 10, borderWidth: 1, paddingLeft: 14, paddingRight: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  queryInput: { flex: 1, borderWidth: 0, backgroundColor: 'transparent', minHeight: 48, paddingHorizontal: 0 },
  clearButton: { width: 38, height: 42, alignItems: 'center', justifyContent: 'center' },
  filterToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  filterToggleText: { fontSize: 14, fontWeight: '500' },
  filterSummary: { flex: 1, fontSize: 12, textAlign: 'right' },
  filters: { gap: 13, paddingVertical: 4 },
  filterBlock: { gap: 7 },
  filterLabel: { fontSize: 12, fontWeight: '600' },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  resultHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 },
  resultCount: { fontSize: 11, fontWeight: '600' },
  searchHint: { fontSize: 13 },
  emptyCard: { padding: 2 },

  /* Record card */
  recordCard: { padding: 12, borderRadius: 10, gap: 8 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flex: 1,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  badgePage: { fontSize: 11, fontWeight: '500' },
  openIndicator: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  openText: { fontSize: 12, fontWeight: '600' },

  /* 4-Field clean grid: Model, Brand, Part Number, Chip Number */
  fourFieldsContainer: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 12,
  },
  fieldRowBottom: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fieldBox: {
    flex: 1,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  fieldValueHighlight: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  fieldValueChip: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  pressed: { opacity: 0.72 },
});