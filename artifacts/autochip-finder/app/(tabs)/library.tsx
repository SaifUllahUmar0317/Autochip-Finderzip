import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActionButton, EmptyState, Pill, Screen, SectionTitle, Surface, TopBar, formatBytes, formatDate } from '@/components/common';
import { useApp } from '@/context/AppContext';
import {
  deleteDocument,
  listDocuments,
  listModules,
  replacePageIndex,
  updateDocumentName,
  updateDocumentStatus,
  type DocumentRow,
  type ModuleRow,
} from '@/lib/database';
import { extractPdfPages } from '@/lib/pdf-index';

export default function LibraryScreen() {
  const router = useRouter();
  const { colors, db, revision, refresh } = useApp();
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const load = useCallback(() => {
    if (!db) return;
    void Promise.all([listDocuments(db), listModules(db)]).then(([docs, moduleRows]) => {
      setDocuments(docs);
      setModules(moduleRows);
    });
  }, [db]);
  useFocusEffect(useCallback(() => { load(); }, [load, revision]));

  const visibleDocs = documents.filter((doc) => moduleFilter === 'all' || doc.moduleId === moduleFilter);

  const remove = (doc: DocumentRow) => {
    Alert.alert(
      'Remove this PDF?',
      `${doc.displayName} and its local search index will be removed. This cannot be undone.`,
      [
        { text: 'Keep PDF', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!db) return;
              if (doc.source === 'imported' && doc.uri) {
                try {
                  await FileSystem.deleteAsync(doc.uri, { idempotent: true });
                } catch {
                  // The database record still needs removing if the original file is already gone.
                }
              }
              await deleteDocument(db, doc.id);
              refresh();
              load();
            })();
          },
        },
      ],
    );
  };

  const reindex = async (doc: DocumentRow) => {
    if (!db || !doc.uri) return;
    setBusyId(doc.id);
    try {
      await updateDocumentStatus(db, doc.id, 'processing', null);
      const pages = await extractPdfPages(doc.uri);
      const hasText = pages.some((page) => page.text.trim().length > 0);
      await replacePageIndex(db, doc.id, pages, hasText ? 'ready' : 'no-text', hasText ? null : 'No selectable text was found. Scanned pages need OCR before they can be searched.');
      refresh();
      load();
    } catch (error) {
      await updateDocumentStatus(db, doc.id, 'failed', error instanceof Error ? error.message : 'Indexing failed.');
      load();
      Alert.alert('Indexing failed', 'The PDF is still in your library. Check that it is readable, then try again.');
    } finally {
      setBusyId(null);
    }
  };

  const saveRename = async (doc: DocumentRow) => {
    if (!db || !renameDraft.trim()) return;
    await updateDocumentName(db, doc.id, renameDraft.trim());
    setRenamingId(null);
    setRenameDraft('');
    refresh();
    load();
  };

  return (
    <Screen contentStyle={styles.content}>
      <TopBar title="PDF library" eyebrow="LOCAL DATABASE" right={
        <Pressable accessibilityRole="button" accessibilityLabel="Add PDF" onPress={() => router.push('/import')} style={styles.topAction}>
          <Feather name="plus" size={20} color={colors.primary} />
        </Pressable>
      } />
      <View style={styles.libraryIntro}>
        <View style={[styles.libraryIcon, { backgroundColor: colors.accent }]}>
          <Feather name="folder" size={21} color={colors.primary} />
        </View>
        <View style={styles.introText}>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>{documents.length} manuals indexed</Text>
          <Text style={[styles.introCopy, { color: colors.mutedForeground }]}>Manage your offline reference collection.</Text>
        </View>
      </View>
      <View style={styles.filterRow}>
        <Pill label="All" selected={moduleFilter === 'all'} onPress={() => setModuleFilter('all')} />
        {modules.map((module) => (
          <Pill key={module.id} label={module.name} selected={moduleFilter === module.id} onPress={() => setModuleFilter(module.id)} />
        ))}
      </View>
      <SectionTitle title="Documents" />
      {visibleDocs.length ? visibleDocs.map((doc) => (
        <Surface key={doc.id} style={styles.documentCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/viewer', params: { documentId: doc.id, page: doc.lastOpenedPage ?? 1 } })}
            style={styles.documentOpen}
          >
            <View style={[styles.fileIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="file-text" size={17} color={colors.cyan} />
            </View>
            <View style={styles.documentInfo}>
              <Text numberOfLines={1} style={[styles.documentName, { color: colors.foreground }]}>{doc.displayName}</Text>
              <Text numberOfLines={1} style={[styles.documentFilename, { color: colors.mutedForeground }]}>{doc.originalFilename}</Text>
              <Text style={[styles.documentMeta, { color: colors.mutedForeground }]}>
                {doc.moduleName} · {doc.pageCount} pages · {formatBytes(doc.fileSize)}
              </Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.statusRow}>
            <Pill
              label={
                doc.indexingStatus === 'ready' ? 'Indexed' :
                doc.indexingStatus === 'processing' ? 'Indexing' :
                doc.indexingStatus === 'no-text' ? 'No text layer' : 'Index failed'
              }
              tone={doc.indexingStatus === 'ready' ? 'success' : doc.indexingStatus === 'failed' || doc.indexingStatus === 'no-text' ? 'warning' : 'default'}
            />
            <Text style={[styles.importDate, { color: colors.mutedForeground }]}>{formatDate(doc.importedAt)}</Text>
          </View>
          {doc.indexError ? <Text style={[styles.errorText, { color: colors.warning }]}>{doc.indexError}</Text> : null}
          {renamingId === doc.id ? (
            <View style={styles.renameRow}>
              <TextField
                value={renameDraft}
                onChangeText={setRenameDraft}
                placeholder="Display name"
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void saveRename(doc)}
                style={styles.renameInput}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Save display name" onPress={() => void saveRename(doc)} style={styles.smallIcon}>
                <Feather name="check" size={18} color={colors.success} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Cancel rename" onPress={() => setRenamingId(null)} style={styles.smallIcon}>
                <Feather name="x" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.documentActions}>
              {doc.indexingStatus !== 'ready' && doc.source === 'imported' ? (
                <ActionButton label="Reindex" icon="refresh-cw" variant="secondary" compact loading={busyId === doc.id} onPress={() => void reindex(doc)} />
              ) : null}
              <ActionButton
                label="Rename"
                icon="edit-2"
                variant="quiet"
                compact
                onPress={() => {
                  setRenamingId(doc.id);
                  setRenameDraft(doc.displayName);
                }}
              />
              <ActionButton label="Remove" icon="trash-2" variant="quiet" compact onPress={() => remove(doc)} />
            </View>
          )}
        </Surface>
      )) : (
        <Surface style={styles.emptySurface}>
          <EmptyState
            icon="file-plus"
            title={moduleFilter === 'all' ? 'Your library is ready to grow' : 'No PDFs in this module yet'}
            description="Add a PDF from your device. AutoChip Finder keeps its file and searchable text on this device."
            action={<ActionButton label="Add a PDF" icon="plus" onPress={() => router.push('/import')} />}
          />
        </Surface>
      )}
      <View style={styles.footerNote}>
        <Feather name="shield" size={14} color={colors.success} />
        <Text style={[styles.footerText, { color: colors.mutedForeground }]}>Your PDFs and indexes stay on this device.</Text>
      </View>
    </Screen>
  );
}

import { TextField } from '@/components/common';

const styles = StyleSheet.create({
  content: { gap: 15 },
  topAction: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  libraryIntro: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 3 },
  libraryIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1 },
  introTitle: { fontSize: 15, fontWeight: '700' },
  introCopy: { fontSize: 12, marginTop: 3 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  documentCard: { gap: 12 },
  documentOpen: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  documentInfo: { flex: 1 },
  documentName: { fontSize: 13, fontWeight: '700' },
  documentFilename: { fontSize: 10, marginTop: 2 },
  documentMeta: { fontSize: 10, marginTop: 5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  importDate: { fontSize: 10 },
  errorText: { fontSize: 11, lineHeight: 16 },
  documentActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  renameRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  renameInput: { flex: 1, minHeight: 40 },
  smallIcon: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  emptySurface: { padding: 2 },
  footerNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 2 },
  footerText: { fontSize: 11 },
});