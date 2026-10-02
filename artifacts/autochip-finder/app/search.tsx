import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  Share,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
  hasBookmark,
  listTools,
  listBookmarks,
  listDocuments,
  listModules,
  saveHistory,
  searchPages,
  toggleBookmark,
  type DocumentRow,
  type ModuleRow,
  type SearchResult,
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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
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
    void Promise.all([listTools(db), listModules(db), listDocuments(db), listBookmarks(db)]).then(([toolRows, moduleRows, docs, bookmarks]) => {
      if (!active) return;
      setTools(toolRows);
      setModules(moduleRows);
      setDocuments(docs);
      setSavedKeys(new Set(bookmarks.map((item) => `${item.documentId}:${item.pageNumber}`)));
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
      void searchPages(db, {
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
    }, 180);
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
      const rows = await searchPages(db, {
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

  const onToggleBookmark = async (result: SearchResult) => {
    if (!db) return;
    const key = `${result.documentId}:${result.pageNumber}`;
    await toggleBookmark(db, result);
    setSavedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    refresh();
  };
  const copySnippet = async (result: SearchResult) => {
    await Clipboard.setStringAsync(result.snippet);
    Alert.alert('Copied', 'The source excerpt was copied to your clipboard.');
  };
  const shareResult = (result: SearchResult) => {
    void Share.share({
      message: `${result.displayName} · ${result.moduleName} · page ${result.pageNumber}\n\n${result.snippet}`,
    });
  };

  return (
    <Screen keyboardAvoiding contentStyle={styles.content}>
      <TopBar title="Search manuals" />
      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={19} color={colors.mutedForeground} />
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Part number or chip number"
          accessibilityLabel="Search indexed PDF text"
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
      <View style={styles.resultHeading}>
        <SectionTitle title={query.trim() ? 'Matching pages' : 'Search the library'} />
        {loading ? <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>Searching…</Text> : query.trim() ? <Text style={[styles.resultCount, { color: colors.mutedForeground }]}>{results.length}{hasMore ? '+' : ''} found</Text> : null}
      </View>
      {!query.trim() ? (
        <Text style={[styles.searchHint, { color: colors.mutedForeground }]}>Search indexed text across your offline library.</Text>
      ) : null}
      {query.trim() && !loading && results.length === 0 ? (
        <Surface style={styles.emptyCard}>
          <EmptyState
            icon="search"
            title="No matching pages"
            description="Check the spelling, remove a word, or switch back to all manuals. Scanned image-only PDFs need OCR before their contents can be searched."
          />
        </Surface>
      ) : null}
      {results.map((result) => (
        <Surface key={`${result.documentId}-${result.pageNumber}`} style={styles.resultCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${result.displayName}, page ${result.pageNumber}`}
            testID={`result-page-${result.pageNumber}`}
            onPress={() => router.push({ pathname: '/viewer', params: { documentId: result.documentId, page: result.pageNumber, q: query } })}
          >
            <View style={styles.resultTop}>
              <View style={[styles.pdfIcon, { backgroundColor: colors.secondary }]}>
                <Feather name="file-text" size={16} color={colors.cyan} />
              </View>
              <View style={styles.resultTitles}>
                <Text numberOfLines={1} style={[styles.resultDoc, { color: colors.foreground }]}>{result.displayName}</Text>
                <Text numberOfLines={1} style={[styles.resultMeta, { color: colors.mutedForeground }]}>{result.tool} · {result.moduleName} · page {result.pageNumber} of {result.pageCount}</Text>
              </View>
              <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
            </View>
            <View style={[styles.excerptBox, { backgroundColor: colors.background }]}>
              <HighlightedText text={result.snippet} query={query} numberOfLines={4} style={[styles.excerpt, { color: colors.secondaryForeground }]} />
            </View>
          </Pressable>
          <View style={styles.resultActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={savedKeys.has(`${result.documentId}:${result.pageNumber}`) ? 'Remove bookmark' : 'Bookmark result'} onPress={() => void onToggleBookmark(result)} style={styles.actionIcon}>
              <Feather name="bookmark" size={16} color={savedKeys.has(`${result.documentId}:${result.pageNumber}`) ? colors.primary : colors.mutedForeground} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Copy source excerpt" onPress={() => void copySnippet(result)} style={styles.actionIcon}>
              <Feather name="copy" size={16} color={colors.mutedForeground} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Share search result" onPress={() => shareResult(result)} style={styles.actionIcon}>
              <Feather name="share-2" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </Surface>
      ))}
      {hasMore ? (
        <ActionButton label="Load more matching pages" icon="arrow-down" variant="secondary" loading={loadingMore} onPress={() => void showMore()} />
      ) : null}
    </Screen>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const styles = StyleSheet.create({
  content: { gap: 12 },
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
  resultCard: { gap: 10, padding: 12, borderRadius: 10 },
  resultTop: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  pdfIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  resultTitles: { flex: 1 },
  resultDoc: { fontSize: 12, fontWeight: '700' },
  resultMeta: { fontSize: 12, marginTop: 3 },
  excerptBox: { borderRadius: 8, padding: 10, gap: 6 },
  excerpt: { fontSize: 13, lineHeight: 19 },
  resultActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
});