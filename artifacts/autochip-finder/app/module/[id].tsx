import React, { useCallback, useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, EmptyState, Pill, Screen, SectionTitle, Surface, TopBar, formatBytes } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { getModule, listDocuments, type DocumentRow, type ModuleRow } from '@/lib/database';

export default function ModuleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const { colors, db, revision } = useApp();
  const [module, setModule] = useState<ModuleRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!db || !id) return;
      let active = true;
      void Promise.all([getModule(db, id), listDocuments(db, undefined, id)]).then(([moduleRow, docs]) => {
        if (!active) return;
        setModule(moduleRow);
        setDocuments(docs);
      });
      return () => {
        active = false;
      };
    }, [db, id, revision]),
  );

  if (!module) {
    return (
      <Screen contentStyle={styles.content}>
        <TopBar title="Module" />
        <EmptyState icon="alert-circle" title="Module not found" description="This module may have been removed from the local library." />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={styles.content}>
      <TopBar title={module.name} eyebrow={module.tool} right={
        <Pressable accessibilityRole="button" accessibilityLabel="Add PDF" onPress={() => router.push({ pathname: '/import', params: { tool: module.tool, moduleId: module.id } })} style={styles.addIcon}>
          <Feather name="plus" size={20} color={colors.primary} />
        </Pressable>
      } />
      <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.summaryIcon, { backgroundColor: colors.accent }]}>
          <Feather name="grid" size={22} color={colors.primary} />
        </View>
        <View style={styles.summaryInfo}>
          <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{documents.length} reference PDFs</Text>
          <Text style={[styles.summaryMeta, { color: colors.mutedForeground }]}>{module.indexedPageCount.toLocaleString()} pages indexed · {documents.reduce((sum, doc) => sum + doc.fileSize, 0) ? formatBytes(documents.reduce((sum, doc) => sum + doc.fileSize, 0)) : '0 B'}</Text>
        </View>
      </View>
      <ActionButton label={`Search ${module.name}`} icon="search" onPress={() => router.push({ pathname: '/search', params: { tool: module.tool, moduleId: module.id } })} />
      <View style={styles.sectionHeading}>
        <SectionTitle title="Documents" />
        <Pill label={`${documents.length}`} />
      </View>
      {documents.length ? documents.map((doc) => (
        <Surface key={doc.id} style={styles.documentCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/viewer', params: { documentId: doc.id, page: doc.lastOpenedPage ?? 1 } })}
            style={styles.documentRow}
          >
            <View style={[styles.fileIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="file-text" size={17} color={colors.cyan} />
            </View>
            <View style={styles.documentInfo}>
              <Text numberOfLines={1} style={[styles.documentName, { color: colors.foreground }]}>{doc.displayName}</Text>
              <Text style={[styles.documentMeta, { color: colors.mutedForeground }]}>{doc.pageCount} pages · {formatBytes(doc.fileSize)}</Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: doc.indexingStatus === 'ready' ? colors.success : colors.warning }]}>{doc.indexingStatus === 'ready' ? 'Ready to search' : doc.indexingStatus === 'no-text' ? 'No text layer' : 'Needs reindexing'}</Text>
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>{doc.source === 'bundled' ? 'Included' : 'On device'}</Text>
          </View>
        </Surface>
      )) : (
        <Surface style={styles.emptyCard}>
          <EmptyState
            icon="file-plus"
            title="No PDFs in this module"
            description="Add a manual to make its pages searchable and available offline."
            action={<ActionButton label="Add a PDF" icon="plus" onPress={() => router.push({ pathname: '/import', params: { tool: module.tool, moduleId: module.id } })} />}
          />
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 15 },
  addIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, borderRadius: 18, borderWidth: 1 },
  summaryIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  summaryInfo: { flex: 1 },
  summaryTitle: { fontSize: 15, fontWeight: '700' },
  summaryMeta: { fontSize: 10, marginTop: 4 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 },
  documentCard: { gap: 12 },
  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileIcon: { width: 37, height: 37, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  documentInfo: { flex: 1 },
  documentName: { fontSize: 13, fontWeight: '700' },
  documentMeta: { fontSize: 10, marginTop: 4 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusText: { fontSize: 10, fontWeight: '600' },
  emptyCard: { padding: 2 },
});