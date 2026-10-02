import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActionButton, Screen, SectionTitle, Surface, TopBar, formatBytes } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { getStats, listDocuments, replacePageIndex, updateDocumentStatus, bundledDocuments } from '@/lib/database';
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

  const themes: { value: ThemePreference; label: string; icon: 'moon' | 'sun' | 'smartphone' }[] = [
    { value: 'dark', label: 'Dark', icon: 'moon' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'system', label: 'System', icon: 'smartphone' },
  ];

  return (
    <Screen contentStyle={styles.content}>
      <TopBar title="Settings" />
      <SectionTitle title="Appearance" />
      <Surface style={styles.themeCard}>
        <Text style={[styles.cardHeading, { color: colors.foreground }]}>Color theme</Text>
        <Text style={[styles.cardCopy, { color: colors.mutedForeground }]}>Light, dark, or match your device.</Text>
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
          <Text style={[styles.statsLabel, { color: colors.mutedForeground }]}>Storage</Text>
        </View>
      </Surface>
      <ActionButton label={rebuilding ? 'Rebuilding indexes…' : 'Rebuild PDF indexes'} icon="refresh-cw" loading={rebuilding} onPress={rebuildIndexes} />
      {progress ? <Text style={[styles.progressText, { color: colors.mutedForeground }]}>{progress}</Text> : null}

      <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>
        Your PDFs, indexes, bookmarks, and search history stay on this device.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  themeCard: { gap: 6 },
  cardHeading: { fontSize: 14, fontWeight: '600' },
  cardCopy: { fontSize: 13, lineHeight: 19 },
  themeChoices: { flexDirection: 'row', gap: 8, marginTop: 8 },
  themeChoice: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, borderColor: 'transparent', borderRadius: 9 },
  themeLabel: { fontSize: 13, fontWeight: '600' },
  statsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 13 },
  statsCell: { flex: 1, alignItems: 'center', gap: 4 },
  statsNumber: { fontSize: 15, fontWeight: '600' },
  statsLabel: { fontSize: 12 },
  statsDivider: { width: 1, height: 30 },
  progressText: { fontSize: 12, marginTop: -7 },
  privacyNote: { fontSize: 13, lineHeight: 19 },
});