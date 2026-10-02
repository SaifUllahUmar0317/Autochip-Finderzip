import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { EmptyState, Screen, SectionTitle, Surface, TopBar, formatDate } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { clearHistory, deleteHistoryItem, listHistory, type HistoryRow } from '@/lib/database';

export default function HistoryScreen() {
  const router = useRouter();
  const { colors, db, revision, refresh } = useApp();
  const [items, setItems] = useState<HistoryRow[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      let active = true;
      void listHistory(db).then((rows) => {
        if (active) setItems(rows);
      });
      return () => {
        active = false;
      };
    }, [db, revision]),
  );
  const removeAll = () => {
    if (!db) return;
    Alert.alert('Clear search history?', 'Your saved bookmarks and PDFs will not be affected.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear history',
        style: 'destructive',
        onPress: () => {
          void clearHistory(db).then(() => {
            setItems([]);
            refresh();
          });
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.content}>
      <TopBar title="Search history" right={
        items.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear search history" onPress={removeAll} style={styles.clearButton}>
            <Feather name="trash-2" size={17} color={colors.destructive} />
          </Pressable>
        ) : <View style={styles.clearSpacer} />
      } />
      <SectionTitle title={`Recent searches · ${items.length}`} />
      {items.length ? items.map((item) => (
        <Surface key={item.id} style={styles.historyItem}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/search', params: { q: item.query, ...(item.tool ? { tool: item.tool } : {}), ...(item.moduleId ? { moduleId: item.moduleId } : {}) } })}
            style={styles.openHistory}
          >
            <View style={[styles.historyIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="clock" size={15} color={colors.cyan} />
            </View>
            <View style={styles.historyDetails}>
              <Text numberOfLines={1} style={[styles.query, { color: colors.foreground }]}>{item.query}</Text>
              <Text style={[styles.meta, { color: colors.mutedForeground }]}>
                {item.tool ?? 'All programmers'} · {formatDate(item.createdAt)}
              </Text>
            </View>
            <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Remove this search from history"
            onPress={() => {
              if (!db) return;
              void deleteHistoryItem(db, item.id).then(() => {
                setItems((current) => current.filter((row) => row.id !== item.id));
                refresh();
              });
            }}
            style={styles.removeIcon}
          >
            <Feather name="x" size={15} color={colors.mutedForeground} />
          </Pressable>
        </Surface>
      )) : (
        <Surface style={styles.emptyCard}>
          <EmptyState icon="clock" title="No recent searches" description="Your submitted searches will appear here for quick access." />
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  clearButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  clearSpacer: { width: 44 },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 13, gap: 2 },
  openHistory: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  historyDetails: { flex: 1 },
  query: { fontSize: 14, fontWeight: '600' },
  meta: { fontSize: 12, marginTop: 4 },
  removeIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { padding: 2 },
});