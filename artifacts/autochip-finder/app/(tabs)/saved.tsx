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
      <TopBar title="Saved results" eyebrow="YOUR SHORTLIST" right={
        <Pressable accessibilityRole="button" accessibilityLabel="Search history" onPress={() => router.push('/history')} style={styles.topIcon}>
          <Feather name="clock" size={19} color={colors.foreground} />
        </Pressable>
      } />
      <View style={styles.intro}>
        <Text style={[styles.introTitle, { color: colors.foreground }]}>Keep useful matches close.</Text>
        <Text style={[styles.introText, { color: colors.mutedForeground }]}>Bookmarks are stored locally and open at their saved page.</Text>
      </View>
      <SectionTitle title={`Bookmarks · ${bookmarks.length}`} />
      {bookmarks.length ? bookmarks.map((item) => (
        <Surface key={item.id} style={styles.card}>
          <Pressable
            accessibilityRole="button"
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
            <ActionButton label="Open page" icon="book-open" compact onPress={() => router.push({ pathname: '/viewer', params: { documentId: item.documentId, page: item.pageNumber } })} />
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
      <View style={[styles.historyLink, { backgroundColor: colors.secondary }]}>
        <View style={styles.historyText}>
          <Text style={[styles.historyTitle, { color: colors.foreground }]}>Search history</Text>
          <Text style={[styles.historyDescription, { color: colors.mutedForeground }]}>Reopen recent part and chip lookups.</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Open search history" onPress={() => router.push('/history')}>
          <Feather name="arrow-right" size={19} color={colors.primary} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  topIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  intro: { gap: 5, paddingTop: 4 },
  introTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  introText: { fontSize: 12, lineHeight: 18 },
  card: { gap: 12 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookmarkIcon: { width: 33, height: 33, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  cardHeading: { flex: 1 },
  cardTitle: { fontSize: 13, fontWeight: '700' },
  cardMeta: { fontSize: 10, marginTop: 3 },
  snippet: { fontSize: 12, lineHeight: 18 },
  fileName: { fontSize: 10 },
  cardActions: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  emptyCard: { padding: 2 },
  historyLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 15, borderRadius: 16 },
  historyText: { gap: 3 },
  historyTitle: { fontSize: 13, fontWeight: '700' },
  historyDescription: { fontSize: 11 },
});