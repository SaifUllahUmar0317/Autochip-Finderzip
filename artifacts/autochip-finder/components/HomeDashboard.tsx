import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, TextField } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { listBookmarks, listHistory, listModules, listTools, type HistoryRow, type ModuleRow, type ToolName } from '@/lib/database';

export default function HomeDashboard() {
  const router = useRouter();
  const { colors, db, revision } = useApp();
  const [query, setQuery] = useState('');
  const [tools, setTools] = useState<ToolName[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      let active = true;
      void Promise.all([listTools(db), listModules(db), listHistory(db), listBookmarks(db)])
        .then(([nextTools, nextModules, nextHistory, nextBookmarks]) => {
          if (!active) return;
          setTools(nextTools);
          setModules(nextModules);
          setHistory(nextHistory);
          setBookmarkCount(nextBookmarks.length);
        })
        .catch((error: unknown) => {
          if (active) Alert.alert('Library could not load', error instanceof Error ? error.message : 'Try again.');
        });
      return () => {
        active = false;
      };
    }, [db, revision]),
  );

  const openSearch = (value = query) => {
    const trimmed = value.trim();
    router.push(trimmed ? { pathname: '/search', params: { q: trimmed } } : '/search');
  };
  const documentCount = modules.reduce((total, module) => total + module.documentCount, 0);
  const recentSearch = history[0];

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <Text style={[styles.appName, { color: colors.foreground }]}>AutoChip Finder</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Settings"
          testID="open-settings"
          onPress={() => router.push('/settings')}
          style={styles.headerAction}
          hitSlop={8}
        >
          <Feather name="settings" size={20} color={colors.foreground} />
        </Pressable>
      </View>

      <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.input }]}>
        <Feather name="search" size={19} color={colors.mutedForeground} />
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder="Search part number or chip number"
          accessibilityLabel="Search part number or chip number"
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={() => openSearch()}
          style={styles.searchInput}
          testID="home-search-input"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Search all manuals"
          testID="home-search-submit"
          onPress={() => openSearch()}
          style={({ pressed }) => [styles.searchAction, { backgroundColor: colors.primary }, pressed && styles.pressed]}
        >
          <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Programmers</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{documentCount} PDFs</Text>
      </View>
      <View style={[styles.toolList, { borderColor: colors.border, backgroundColor: colors.card }]}>
        {tools.map((tool, index) => {
          const toolModules = modules.filter((module) => module.tool === tool);
          const pdfCount = toolModules.reduce((total, module) => total + module.documentCount, 0);
          const icon = tool === 'CG100X' ? 'cpu' : 'activity';
          return (
            <Pressable
              key={tool}
              accessibilityRole="button"
              accessibilityLabel={`Open ${tool} programmer library`}
              testID={`tool-${tool.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
              onPress={() => router.push({ pathname: '/tool/[tool]', params: { tool } })}
              style={({ pressed }) => [
                styles.toolRow,
                index < tools.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                pressed && styles.pressed,
              ]}
            >
              <Feather name={icon} size={19} color={colors.mutedForeground} />
              <View style={styles.toolCopy}>
                <Text numberOfLines={1} style={[styles.toolName, { color: colors.foreground }]}>{tool}</Text>
                <Text style={[styles.toolMeta, { color: colors.mutedForeground }]}>
                  {toolModules.length} modules · {pdfCount} PDFs
                </Text>
              </View>
              <Feather name="chevron-right" size={19} color={colors.mutedForeground} />
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          testID="add-programmer"
          onPress={() => router.push('/add-programmer')}
          style={({ pressed }) => [styles.addRow, pressed && styles.pressed]}
        >
          <Feather name="plus" size={18} color={colors.primary} />
          <Text style={[styles.addLabel, { color: colors.primary }]}>Add programmer</Text>
        </Pressable>
      </View>

      <View style={styles.quickLinks}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/saved')}
          style={({ pressed }) => [styles.quickLink, { borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Feather name="bookmark" size={17} color={colors.mutedForeground} />
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>Saved</Text>
          <Text style={[styles.quickCount, { color: colors.mutedForeground }]}>{bookmarkCount}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/history')}
          style={({ pressed }) => [styles.quickLink, { borderColor: colors.border }, pressed && styles.pressed]}
        >
          <Feather name="clock" size={17} color={colors.mutedForeground} />
          <Text style={[styles.quickLabel, { color: colors.foreground }]}>Recent searches</Text>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <View style={styles.recentSection}>
        <View style={styles.sectionHeading}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent</Text>
          {recentSearch ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/history')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>View all</Text>
            </Pressable>
          ) : null}
        </View>
        {recentSearch ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => openSearch(recentSearch.query)}
            style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}
          >
            <Feather name="search" size={16} color={colors.mutedForeground} />
            <Text numberOfLines={1} style={[styles.recentQuery, { color: colors.foreground }]}>{recentSearch.query}</Text>
            <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : (
          <Text style={[styles.emptyRecent, { color: colors.mutedForeground }]}>Search history will appear here.</Text>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 22 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appName: { fontSize: 20, fontWeight: '600', letterSpacing: -0.3 },
  headerAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchBox: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 6, borderWidth: 1, borderRadius: 10 },
  searchInput: { flex: 1, minHeight: 48, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 },
  searchAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  count: { fontSize: 12 },
  toolList: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  toolRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 14 },
  toolCopy: { flex: 1, gap: 3 },
  toolName: { fontSize: 15, fontWeight: '600' },
  toolMeta: { fontSize: 12 },
  addRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 },
  addLabel: { fontSize: 14, fontWeight: '500' },
  quickLinks: { gap: 8 },
  quickLink: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 13, borderRadius: 9, borderWidth: 1 },
  quickLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  quickCount: { fontSize: 13 },
  recentSection: { gap: 9 },
  recentRow: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentQuery: { flex: 1, fontSize: 14 },
  seeAll: { fontSize: 13, fontWeight: '500' },
  emptyRecent: { fontSize: 13 },
  pressed: { opacity: 0.72 },
});