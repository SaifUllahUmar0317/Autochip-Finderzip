import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  Share,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, EmptyState, Pill, Screen, Surface, TextField, TopBar } from '@/components/common';
import { ExtractedPageTable, findPageTableHeaders } from '@/components/ExtractedPageTable';
import { useApp } from '@/context/AppContext';
import {
  getDocument,
  getPageText,
  hasBookmark,
  recordOpenedPage,
  toggleBookmark,
  type DocumentRow,
  type SearchResult,
} from '@/lib/database';
import { resolveDocumentUri } from '@/lib/source-files';
import { renderPdfPageImage } from '@/lib/pdf-index';

export default function ViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    documentId?: string | string[];
    page?: string | string[];
    q?: string | string[];
  }>();
  const documentId = first(params.documentId);
  const routePage = Number(first(params.page) || '1');
  const query = first(params.q);
  const { colors, db, refresh } = useApp();
  const [document, setDocument] = useState<DocumentRow | null>(null);
  const [pageNumber, setPageNumber] = useState(Number.isFinite(routePage) && routePage > 0 ? Math.floor(routePage) : 1);
  const [pageDraft, setPageDraft] = useState(String(pageNumber));
  const [pageText, setPageText] = useState<string | null>(null);
  const [headerText, setHeaderText] = useState('');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  // Diagram rendering state
  const [activeTab, setActiveTab] = useState<'diagram' | 'text'>('diagram');
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [renderingImage, setRenderingImage] = useState(false);

  useEffect(() => {
    const safePage = Number.isFinite(routePage) && routePage > 0 ? Math.floor(routePage) : 1;
    setPageNumber(safePage);
    setPageDraft(String(safePage));
  }, [documentId, routePage]);

  // Load document and page text
  useFocusEffect(
    useCallback(() => {
      if (!db || !documentId) return;
      let active = true;
      setLoading(true);
      void Promise.all([
        getDocument(db, documentId),
        getPageText(db, documentId, pageNumber),
        hasBookmark(db, documentId, pageNumber),
        getPageText(db, documentId, 1),
      ]).then(([doc, text, saved, firstPageText]) => {
        if (!active) return;
        setDocument(doc);
        setPageText(text);
        setHeaderText(firstPageText ?? '');
        setIsBookmarked(saved);
        if (doc) void recordOpenedPage(db, documentId, pageNumber);
        setLoading(false);
      }).catch(() => {
        if (!active) return;
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }, [db, documentId, pageNumber]),
  );

  // Automatically render the visual diagram for this physical page
  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    setRenderingImage(true);
    setPageImage(null);

    void resolveDocumentUri(document)
      .then((uri) => renderPdfPageImage(uri, pageNumber))
      .then((dataUrl) => {
        if (cancelled) return;
        setPageImage(dataUrl);
        setRenderingImage(false);
      })
      .catch(() => {
        if (cancelled) return;
        setRenderingImage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [document, pageNumber]);

  const goToPage = (next: number) => {
    if (!document) return;
    const bounded = Math.max(1, Math.min(document.pageCount, Math.floor(next)));
    setPageNumber(bounded);
    setPageDraft(String(bounded));
  };

  const submitPage = () => {
    const requested = Number.parseInt(pageDraft, 10);
    if (Number.isFinite(requested)) goToPage(requested);
    else setPageDraft(String(pageNumber));
  };

  const openOriginal = async () => {
    if (!document) return;
    setSharing(true);
    try {
      const uri = await resolveDocumentUri(document);
      if (Platform.OS === 'web') {
        Alert.alert('Open the original PDF', 'Use the device PDF library to open the original document.');
        return;
      }
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing is unavailable', 'The extracted source text remains available in AutoChip Finder.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${document.displayName} · page ${pageNumber}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      Alert.alert('Could not open the PDF', error instanceof Error ? error.message : 'The original file is not available.');
    } finally {
      setSharing(false);
    }
  };

  const copyPage = async () => {
    if (!pageText) return;
    await Clipboard.setStringAsync(pageText);
    Alert.alert('Copied', `Extracted text from page ${pageNumber} was copied.`);
  };

  const toggleCurrentBookmark = async () => {
    if (!db || !document || !pageText) return;
    const result: SearchResult = {
      pageId: 0,
      documentId: document.id,
      moduleId: document.moduleId,
      tool: document.tool,
      moduleName: document.moduleName,
      displayName: document.displayName,
      originalFilename: document.originalFilename,
      pageNumber,
      pageCount: document.pageCount,
      text: pageText,
      snippet: pageText.split(/\r?\n/).filter(Boolean).slice(0, 4).join(' · '),
      source: document.source,
      uri: document.uri,
    };
    await toggleBookmark(db, result);
    setIsBookmarked((value) => !value);
    refresh();
  };

  const shareExcerpt = () => {
    if (!document || !pageText) return;
    void Share.share({
      message: `${document.displayName} · ${document.moduleName} · page ${pageNumber}\n\n${pageText.slice(0, 2400)}`,
    });
  };

  return (
    <Screen contentStyle={styles.content}>
      <TopBar
        title="Page Diagram"
        eyebrow="PDF VISUAL VIEWER"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            onPress={() => void toggleCurrentBookmark()}
            style={styles.headerAction}
            disabled={!pageText && !pageImage}
          >
            <Feather name="bookmark" size={19} color={isBookmarked ? colors.primary : colors.foreground} />
          </Pressable>
        }
      />

      {loading ? (
        <Surface style={styles.loadingCard}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading document...</Text>
        </Surface>
      ) : !document ? (
        <EmptyState
          icon="alert-triangle"
          title="PDF not found"
          description="This document may have been removed from your library."
          action={<ActionButton label="Open library" icon="folder" onPress={() => router.push('/(tabs)/library')} />}
        />
      ) : (
        <>
          {/* Document Banner */}
          <View style={[styles.documentBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.fileIcon, { backgroundColor: colors.accent }]}>
              <Feather name="cpu" size={18} color={colors.primary} />
            </View>
            <View style={styles.documentInfo}>
              <Text numberOfLines={2} style={[styles.documentTitle, { color: colors.foreground }]}>
                {document.displayName}
              </Text>
              <Text style={[styles.documentMeta, { color: colors.mutedForeground }]}>
                {document.tool} · {document.moduleName}
              </Text>
            </View>
            <Pill label={document.indexingStatus === 'ready' ? 'Indexed' : document.indexingStatus} tone={document.indexingStatus === 'ready' ? 'success' : 'warning'} />
          </View>

          {/* Page Navigation Controller */}
          <Surface style={styles.pageControl}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous page"
              disabled={pageNumber <= 1}
              onPress={() => goToPage(pageNumber - 1)}
              style={[styles.pageArrow, pageNumber <= 1 && styles.disabled]}
            >
              <Feather name="chevron-left" size={21} color={colors.foreground} />
            </Pressable>
            <Text style={[styles.pageLabel, { color: colors.mutedForeground }]}>PAGE</Text>
            <TextField
              value={pageDraft}
              onChangeText={setPageDraft}
              keyboardType="number-pad"
              returnKeyType="done"
              onSubmitEditing={submitPage}
              onBlur={submitPage}
              accessibilityLabel="Page number"
              style={styles.pageInput}
            />
            <Text style={[styles.pageTotal, { color: colors.mutedForeground }]}>of {document.pageCount}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next page"
              disabled={pageNumber >= document.pageCount}
              onPress={() => goToPage(pageNumber + 1)}
              style={[styles.pageArrow, pageNumber >= document.pageCount && styles.disabled]}
            >
              <Feather name="chevron-right" size={21} color={colors.foreground} />
            </Pressable>
          </Surface>

          {query ? (
            <View style={[styles.matchBanner, { backgroundColor: colors.accent }]}>
              <Feather name="search" size={13} color={colors.primary} />
              <Text numberOfLines={2} style={[styles.matchText, { color: colors.accentForeground }]}>
                Matching Unit / Search: {query}
              </Text>
            </View>
          ) : null}

          {/* Tab Selector: Diagram View vs Table/Text View */}
          <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Pressable
              onPress={() => setActiveTab('diagram')}
              style={[
                styles.tabItem,
                activeTab === 'diagram' && { backgroundColor: colors.accent },
              ]}
            >
              <Feather name="image" size={14} color={activeTab === 'diagram' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabLabel, { color: activeTab === 'diagram' ? colors.primary : colors.mutedForeground }]}>
                Full Diagram Page
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setActiveTab('text')}
              style={[
                styles.tabItem,
                activeTab === 'text' && { backgroundColor: colors.accent },
              ]}
            >
              <Feather name="file-text" size={14} color={activeTab === 'text' ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabLabel, { color: activeTab === 'text' ? colors.primary : colors.mutedForeground }]}>
                Text / Table Data
              </Text>
            </Pressable>
          </View>

          {/* Tab 1: Full Visual Diagram */}
          {activeTab === 'diagram' && (
            <Surface style={styles.diagramCard}>
              <View style={styles.sourceHeading}>
                <View>
                  <Text style={[styles.sourceLabel, { color: colors.mutedForeground }]}>High Resolution Diagram</Text>
                  <Text style={[styles.sourcePageTitle, { color: colors.foreground }]}>Diagram Page {pageNumber}</Text>
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Share excerpt" onPress={shareExcerpt} style={styles.actionIcon}>
                  <Feather name="share-2" size={17} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {renderingImage ? (
                <View style={styles.diagramLoadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={[styles.diagramLoadingText, { color: colors.mutedForeground }]}>
                    Rendering diagram page...
                  </Text>
                </View>
              ) : pageImage ? (
                <View style={[styles.imageWrapper, { borderColor: colors.border, backgroundColor: '#ffffff' }]}>
                  <Image
                    source={{ uri: pageImage }}
                    style={styles.diagramImage}
                    resizeMode="contain"
                    accessibilityLabel={`Diagram for page ${pageNumber}`}
                  />
                </View>
              ) : (
                <View style={styles.diagramLoadingContainer}>
                  <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>
                    Visual diagram rendering complete or unavailable. You can also view the original PDF below.
                  </Text>
                </View>
              )}
            </Surface>
          )}

          {/* Tab 2: Extracted Text / Table View */}
          {activeTab === 'text' && (
            pageText ? (
              <Surface style={styles.sourceCard}>
                <View style={styles.sourceHeading}>
                  <View>
                    <Text style={[styles.sourceLabel, { color: colors.mutedForeground }]}>Text from this page</Text>
                    <Text style={[styles.sourcePageTitle, { color: colors.foreground }]}>Original page {pageNumber}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel="Share source page text" onPress={shareExcerpt} style={styles.actionIcon}>
                    <Feather name="share-2" size={17} color={colors.mutedForeground} />
                  </Pressable>
                </View>
                <ExtractedPageTable
                  text={pageText}
                  headerText={headerText || (findPageTableHeaders(pageText) ? pageText : '')}
                  query={query}
                  colors={colors}
                />
                <ActionButton label="Copy page text" icon="copy" variant="secondary" compact onPress={() => void copyPage()} />
              </Surface>
            ) : (
              <Surface style={styles.noTextCard}>
                <EmptyState
                  icon="file-text"
                  title={document.indexingStatus === 'no-text' ? 'This PDF has no text layer' : 'Page text is not indexed'}
                  description="Use the Full Diagram Page tab to inspect diagrams and pinouts."
                />
              </Surface>
            )
          )}

          <ActionButton label="Open original PDF in external viewer" icon="external-link" loading={sharing} variant="primary" onPress={() => void openOriginal()} />
          <Text style={[styles.viewerNote, { color: colors.mutedForeground }]}>
            Full high-definition page diagrams are rendered directly from the offline PDF document.
          </Text>
        </>
      )}
    </Screen>
  );
}

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  loadingCard: { padding: 22, alignItems: 'center' },
  loadingText: { fontSize: 12 },
  documentBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  fileIcon: { width: 40, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  documentInfo: { flex: 1, gap: 4 },
  documentTitle: { fontSize: 14, fontWeight: '600' },
  documentMeta: { fontSize: 12 },
  pageControl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 9 },
  pageArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  disabled: { opacity: 0.35 },
  pageLabel: { fontSize: 12, fontWeight: '600', marginRight: 1 },
  pageInput: { minHeight: 38, width: 54, borderRadius: 10, textAlign: 'center', paddingHorizontal: 3, fontSize: 14, fontWeight: '700' },
  pageTotal: { fontSize: 11 },
  matchBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 9 },
  matchText: { fontSize: 13, fontWeight: '500', flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 4,
    gap: 4,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  diagramCard: {
    padding: 12,
    gap: 12,
  },
  diagramLoadingContainer: {
    height: 380,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  diagramLoadingText: {
    fontSize: 13,
    fontWeight: '500',
  },
  imageWrapper: {
    width: '100%',
    height: 480,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagramImage: {
    width: '100%',
    height: '100%',
  },
  sourceCard: { gap: 12, padding: 12 },
  sourceHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sourceLabel: { fontSize: 14, fontWeight: '600' },
  sourcePageTitle: { fontSize: 16, fontWeight: '600', marginTop: 3 },
  actionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  noTextCard: { padding: 2 },
  viewerNote: { fontSize: 12, lineHeight: 18, paddingHorizontal: 2 },
});
