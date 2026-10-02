import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActionButton, Pill, Screen, SectionTitle, Surface, TopBar, formatBytes } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { clearHistory, getStats, listDocuments, replacePageIndex, updateDocumentStatus, bundledDocuments } from '@/lib/database';
import { extractPdfPages } from '@/lib/pdf-index';
import type { ThemePreference } from '@/constants/colors';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, db, revision, theme, setTheme, refresh } = useApp();
  const [stats, setStats] = useState({ pdfCount: 0, indexedPageCount: 0, moduleCount: 0, storageBytes: 0 });
  const [rebuilding, setRebuilding] = useState(false);
  const [progress, setProgress] = useState('');

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      let active = true;
      void getStats(db).then((next) => {
        if (active) setStats(next);
      });
      return () => {
        active = false;
      };
    }, [db, revision]),
  );

  const rebuildIndexes = () => {
    if (!db || rebuilding) return;
    Alert.alert(
      'Rebuild every PDF index?',
      'All local page indexes will be regenerated from their stored source PDFs. Your files, bookmarks, and search history will remain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rebuild indexes',
          onPress: () => {
            void (async () => {
              setRebuilding(true);
              let failed = 0;
              try {
                const documents = await listDocuments(db);
                for (let index = 0; index < documents.length; index += 1) {
                  const document = documents[index];
                  setProgress(`Reindexing ${index + 1} of ${documents.length}: ${document.displayName}`);
                  await updateDocumentStatus(db, document.id, 'processing', null);
                  try {
                    const seed = document.source === 'bundled'
                      ? bundledDocuments.find((item) => item.id === document.id)
                      : null;
                    const pages = seed
                      ? seed.pages
                      : document.uri
                        ? await extractPdfPages(document.uri)
                        : [];
                    if (!seed && !document.uri) throw new Error('The saved PDF is missing.');
                    const hasText = pages.some((page) => page.text.trim().length > 0);
                    await replacePageIndex(
                      db,
                      document.id,
                      pages,
                      hasText ? 'ready' : 'no-text',
                      hasText ? null : 'No selectable text was found in this PDF.',
                    );
                  } catch (error) {
                    failed += 1;
                    await updateDocumentStatus(
                      db,
                      document.id,
                      'failed',
                      error instanceof Error ? error.message : 'Reindexing failed.',
                    );
                  }
                }
                refresh();
                Alert.alert(
                  failed ? 'Index rebuild finished with errors' : 'Indexes rebuilt',
                  failed
                    ? `${failed} PDF${failed === 1 ? '' : 's'} could not be indexed. Open the Library tab to retry them.`
                    : 'Your PDF page indexes are ready for offline search.',
                );
              } finally {
                setProgress('');
                setRebuilding(false);
              }
            })();
          },
        },
      ],
    );
  };

  const clearSearchHistory = () => {
    if (!db) return;
    Alert.alert('Clear search history?', 'This does not remove your saved bookmarks or PDFs.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear history',
        style: 'destructive',
        onPress: () => {
          void clearHistory(db).then(() => {
            refresh();
            Alert.alert('History cleared', 'Your saved PDFs and bookmarks are unchanged.');
          });
        },
      },
    ]);
  };

  const themes: { value: ThemePreference; label: string; icon: 'moon' | 'sun' | 'smartphone' }[] = [
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'system', label: 'System', icon: 'smartphone' },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <TopBar title="Settings" eyebrow="ON-DEVICE PREFERENCES" />
      <SectionTitle title="Appearance" />
      <Surface style={styles.themeCard}>
        <Text style={[styles.cardHeading, { color: colors.foreground }]}>Color theme</Text>
        <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>Choose a theme or follow your device setting.</Text>
        <View style={styles.themeChoices}>
          {themes.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="button"
              accessibilityState={{ selected: theme === item.value }}
              testID={`theme-${item.value}`}
              onPress={() => void setTheme(item.value)}
              style={[
                styles.themeChoice,
                { backgroundColor: theme === item.value ? colors.accent : colors.secondary },
                theme === item.value && { borderColor: colors.primary },
              ]}
            >
              <Feather name={item.icon} size={15} color={theme === item.value ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.themeLabel, { color: theme === item.value ? colors.accentForeground : colors.secondaryForeground }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Surface>

      <SectionTitle title="Local library" />
      <Surface style={styles.statsCard}>
        <View style={styles.statsCell}>
          <Text style={[styles.statsNumber, { color: colors.foreground }]}>{stats.pdfCount}</Text>
          <Text style={[styles.statsLabel, { color: colors.mutedForeground }]}>PDFs</Text>
        </View>
        <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statsCell}>
          <Text style={[styles.statsNumber, { color: colors.foreground }]}>{stats.indexedPageCount.toLocaleString()}</Text>
          <Text style={[styles.statsLabel, { color: colors.mutedForeground }]}>pages</Text>
        </View>
        <View style={[styles.statsDivider, { backgroundColor: colors.border }]} />
        <View style={styles.statsCell}>
          <Text numberOfLines={1} style={[styles.statsNumber, { color: colors.foreground }]}>{formatBytes(stats.storageBytes)}</Text>
          <Text style={[styles.statsLabel, { color: colors.mutedForeground }]}>PDF files</Text>
        </View>
      </Surface>
      <ActionButton label="Open PDF library" icon="folder" variant="secondary" onPress={() => router.push('/(tabs)/library')} />
      <ActionButton label={rebuilding ? 'Rebuilding indexes…' : 'Rebuild PDF indexes'} icon="refresh-cw" loading={rebuilding} onPress={rebuildIndexes} />
      {progress ? <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{progress}</Text> : null}

      <SectionTitle title="Search data" />
      <Surface style={styles.preferenceRow}>
        <View style={[styles.preferenceIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="clock" size={16} color={colors.cyan} />
        </View>
        <View style={styles.preferenceInfo}>
          <Text style={[styles.preferenceTitle, { color: colors.foreground }]}>Search history</Text>
          <Text style={[styles.preferenceCopy, { color: colors.mutedForeground }]}>Clear recent queries without removing saved pages.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search history" onPress={clearSearchHistory} style={styles.clearAction}>
          <Feather name="trash-2" size={17} color={colors.destructive} />
        </Pressable>
      </Surface>
      <ActionButton label="Manage saved results" icon="bookmark" variant="secondary" onPress={() => router.push('/(tabs)/saved')} />
      <Surface style={styles.privacyCard}>
        <View style={[styles.privacyIcon, { backgroundColor: colors.accent }]}>
          <Feather name="shield" size={17} color={colors.success} />
        </View>
        <View style={styles.privacyInfo}>
          <Text style={[styles.privacyTitle, { color: colors.foreground }]}>Private by default</Text>
          <Text style={[styles.privacyCopy, { color: colors.mutedForeground }]}>Your manuals, indexes, bookmarks, and search history are stored locally. AutoChip Finder does not use accounts or cloud sync.</Text>
        </View>
      </Surface>
      <View style={styles.versionRow}>
        <Pill label="VERSION 1.0.0" />
        <Text style={[styles.versionCopy, { color: colors.mutedForeground }]}>AutoChip Finder · Programmer manual library</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  themeCard: { gap: 6 },
  cardHeading: { fontSize: 14, fontWeight: '700' },
  cardCopy: { fontSize: 11, lineHeight: 16 },
  themeChoices: { flexDirection: 'row', gap: 8, marginTop: 8 },
  themeChoice: { flex: 1, minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: 'transparent', borderRadius: 12 },
  themeLabel: { fontSize: 11, fontWeight: '700' },
  statsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 15 },
  statsCell: { flex: 1, alignItems: 'center', gap: 4 },
  statsNumber: { fontSize: 15, fontWeight: '800' },
  statsLabel: { fontSize: 9 },
  statsDivider: { width: 1, height: 30 },
  progressText: { fontSize: 10, marginTop: -7 },
  preferenceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  preferenceIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  preferenceInfo: { flex: 1, gap: 3 },
  preferenceTitle: { fontSize: 12, fontWeight: '700' },
  preferenceCopy: { fontSize: 10, lineHeight: 15 },
  clearAction: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  privacyCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  privacyIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  privacyInfo: { flex: 1, gap: 4 },
  privacyTitle: { fontSize: 12, fontWeight: '700' },
  privacyCopy: { fontSize: 10, lineHeight: 15 },
  versionRow: { alignItems: 'center', gap: 4, marginTop: 2 },
  versionCopy: { fontSize: 9 },
});