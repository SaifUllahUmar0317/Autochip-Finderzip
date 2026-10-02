import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActionButton, EmptyState, HighlightedText, Screen, SectionTitle, Surface, TopBar } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { deleteBookmark, listBookmarks, type BookmarkRow } from '@/lib/database';

export default function SavedScreen() {
  const router = useRouter();
  const { colors, db, revision, refresh } = useApp();
  const [bookmarks, setBookmarks] = useState<BookmarkRow[]>([]);
  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      let active = true;
      void listBookmarks(db).then((rows) => {
        if (active) setBookmarks(rows);
      });
      return () => {
        active = false;
      };
    }, [db, revision]),
  );
  const removeBookmark = (bookmark: BookmarkRow) => {
    Alert.alert('Remove saved result?', 'This removes the bookmark, not the PDF.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          if (!db) return;
          void deleteBookmark(db, bookmark.id).then(() => {
            refresh();
            setBookmarks((current) => current.filter((item) => item.id !== bookmark.id));
          });
        },
      },
    ]);
  };

  return (
    <Screen contentStyle={styles.content}>
      <TopBar title="Saved results" right={
        <Pressable accessibilityRole="button" accessibilityLabel="Search history" onPress={() => router.push('/history')} style={styles.topIcon}>
          <Feather name="clock" size={19} color={colors.foreground} />
        </Pressable>
      } />
      <SectionTitle title={`Bookmarks · ${bookmarks.length}`} />
      {bookmarks.length ? bookmarks.map((item) => (
        <Surface key={item.id} style={styles.card}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.displayName}, page ${item.pageNumber}`}
            onPress={() => router.push({ pathname: '/viewer', params: { documentId: item.documentId, page: item.pageNumber } })}
          >
            <View style={styles.cardTop}>
              <View style={[styles.bookmarkIcon, { backgroundColor: colors.accent }]}>
                <Feather name="bookmark" size={15} color={colors.primary} />
              </View>
              <View style={styles.cardHeading}>
                <Text numberOfLines={1} style={[styles.cardTitle, { color: colors.foreground }]}>{item.title}</Text>
                <Text numberOfLines={1} style={[styles.cardMeta, { color: colors.mutedForeground }]}>{item.tool} · {item.moduleName} · page {item.pageNumber}</Text>
              </View>
              <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
            </View>
            <HighlightedText text={item.snippet} query="" numberOfLines={3} style={[styles.snippet, { color: colors.secondaryForeground }]} />
            <Text numberOfLines={1} style={[styles.fileName, { color: colors.mutedForeground }]}>{item.displayName}</Text>
          </Pressable>
          <View style={styles.cardActions}>
            <ActionButton label="Remove" icon="bookmark" variant="quiet" compact onPress={() => removeBookmark(item)} />
          </View>
        </Surface>
      )) : (
        <Surface style={styles.emptyCard}>
          <EmptyState
            icon="bookmark"
            title="No saved matches yet"
            description="Bookmark any search result to keep its source document and page one tap away."
            action={<ActionButton label="Search manuals" icon="search" onPress={() => router.push('/search')} />}
          />
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  topIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  card: { gap: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookmarkIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardHeading: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600' },
  cardMeta: { fontSize: 12, marginTop: 3 },
  snippet: { fontSize: 13, lineHeight: 19 },
  fileName: { fontSize: 12 },
  cardActions: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  emptyCard: { padding: 2 },
});