import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, EmptyState, Screen, SectionTitle, Surface, TextField, TopBar } from '@/components/common';
import { useApp } from '@/context/AppContext';
import {
  createModule,
  deleteModule,
  listModules,
  moveModule,
  renameModule,
  type ModuleRow,
  type ToolName,
} from '@/lib/database';

export default function ToolScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tool?: string | string[] }>();
  const selected = Array.isArray(params.tool) ? params.tool[0] : params.tool;
  const tool: ToolName = selected ?? 'CG100X';
  const isIprog = tool === 'iProg Pro';
  const { colors, db, revision, refresh } = useApp();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!db) return;
    void listModules(db, tool).then(setModules);
  }, [db, tool]);
  useFocusEffect(useCallback(() => { load(); }, [load, revision]));

  const beginCreate = () => {
    setEditingId(null);
    setDraft('');
    setEditorOpen(true);
  };
  const beginRename = (item: ModuleRow) => {
    setEditingId(item.id);
    setDraft(item.name);
    setEditorOpen(true);
  };
  const saveModule = async () => {
    const name = draft.trim();
    if (!db || !name) return;
    setSaving(true);
    try {
      if (editingId) await renameModule(db, editingId, name);
      else await createModule(db, tool, name);
      setEditorOpen(false);
      setDraft('');
      refresh();
      load();
    } catch (error) {
      Alert.alert('Could not save module', error instanceof Error ? error.message : 'Try a different module name.');
    } finally {
      setSaving(false);
    }
  };
  const removeModule = (module: ModuleRow) => {
    Alert.alert(
      `Delete ${module.name}?`,
      `This also removes ${module.documentCount} PDF${module.documentCount === 1 ? '' : 's'} and their search indexes from this device.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete module',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (!db) return;
              const docs = await deleteModule(db, module.id);
              for (const doc of docs) {
                if (doc.source === 'imported' && doc.uri) {
                  try {
                    await FileSystem.deleteAsync(doc.uri, { idempotent: true });
                  } catch {
                    // Local records are removed even if the file was already deleted outside the app.
                  }
                }
              }
              refresh();
              load();
            })();
          },
        },
      ],
    );
  };
  const reorder = async (module: ModuleRow, direction: -1 | 1) => {
    if (!db) return;
    await moveModule(db, module.id, direction);
    refresh();
    load();
  };

  return (
    <Screen contentStyle={styles.content}>
      <TopBar title={tool} eyebrow="PROGRAMMER LIBRARY" right={
        <Pressable accessibilityRole="button" accessibilityLabel="Add a PDF" onPress={() => router.push({ pathname: '/import', params: { tool } })} style={styles.headerIcon}>
          <Feather name="file-plus" size={19} color={colors.primary} />
        </Pressable>
      } />
      <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: isIprog ? colors.secondary : colors.accent }]}>
          <Feather name={isIprog ? 'activity' : 'cpu'} size={23} color={colors.cyan} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>{modules.length} modules</Text>
          <Text style={[styles.heroSubtitle, { color: colors.mutedForeground }]}>
            {tool === 'CG100X'
              ? 'Seeded with the supplied CG100X reference PDFs.'
              : isIprog
                ? 'Start an iProg Pro collection by adding your own manuals.'
                : `Start a ${tool} collection by adding your manuals.`}
          </Text>
        </View>
      </View>
      <ActionButton label="Search this programmer" icon="search" onPress={() => router.push({ pathname: '/search', params: { tool } })} />
      <View style={styles.sectionHeading}>
        <SectionTitle title="Modules" />
        <Pressable accessibilityRole="button" accessibilityLabel="Create module" onPress={beginCreate} style={styles.createIcon}>
          <Feather name="plus-circle" size={21} color={colors.primary} />
        </Pressable>
      </View>
      {editorOpen ? (
        <Surface style={styles.editor}>
          <Text style={[styles.editorLabel, { color: colors.foreground }]}>{editingId ? 'Rename module' : 'New module'}</Text>
          <TextField value={draft} onChangeText={setDraft} placeholder="Module name" autoFocus returnKeyType="done" onSubmitEditing={() => void saveModule()} maxLength={80} />
          <View style={styles.editorActions}>
            <ActionButton label="Cancel" variant="secondary" compact onPress={() => setEditorOpen(false)} />
            <ActionButton label={editingId ? 'Save name' : 'Create'} icon="check" compact loading={saving} disabled={!draft.trim()} onPress={() => void saveModule()} />
          </View>
        </Surface>
      ) : null}
      {modules.length ? modules.map((module, index) => (
        <Surface key={module.id} style={styles.moduleCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/module/[id]', params: { id: module.id } })}
            style={styles.moduleOpen}
          >
            <View style={[styles.moduleIcon, { backgroundColor: colors.secondary }]}>
              <Feather name="grid" size={17} color={colors.cyan} />
            </View>
            <View style={styles.moduleText}>
              <Text numberOfLines={1} style={[styles.moduleName, { color: colors.foreground }]}>{module.name}</Text>
              <Text style={[styles.moduleMeta, { color: colors.mutedForeground }]}>{module.documentCount} PDFs · {module.indexedPageCount.toLocaleString()} indexed pages</Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.moduleActions}>
            <ActionButton label="Open" icon="folder" compact variant="secondary" onPress={() => router.push({ pathname: '/module/[id]', params: { id: module.id } })} />
            <ActionButton label="Add PDF" icon="plus" compact variant="quiet" onPress={() => router.push({ pathname: '/import', params: { tool, moduleId: module.id } })} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Move ${module.name} up`} disabled={index === 0} onPress={() => void reorder(module, -1)} style={styles.smallAction}>
              <Feather name="arrow-up" size={15} color={index === 0 ? colors.mutedForeground : colors.foreground} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Move ${module.name} down`} disabled={index === modules.length - 1} onPress={() => void reorder(module, 1)} style={styles.smallAction}>
              <Feather name="arrow-down" size={15} color={index === modules.length - 1 ? colors.mutedForeground : colors.foreground} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Rename ${module.name}`} onPress={() => beginRename(module)} style={styles.smallAction}>
              <Feather name="edit-2" size={15} color={colors.foreground} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${module.name}`} onPress={() => removeModule(module)} style={styles.smallAction}>
              <Feather name="trash-2" size={15} color={colors.destructive} />
            </Pressable>
          </View>
        </Surface>
      )) : (
        <Surface style={styles.emptyCard}>
          <EmptyState
            icon="layers"
            title="No modules yet"
            description="Create a module for this programmer, then add the matching PDFs."
            action={<ActionButton label="Create a module" icon="plus" onPress={beginCreate} />}
          />
        </Surface>
      )}
      <View style={styles.localNote}>
        <Feather name="wifi-off" size={14} color={colors.success} />
        <Text style={[styles.localNoteText, { color: colors.mutedForeground }]}>Search and library management work offline.</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 15 },
  headerIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 16, borderRadius: 18, borderWidth: 1 },
  heroIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: 4 },
  heroTitle: { fontSize: 16, fontWeight: '800' },
  heroSubtitle: { fontSize: 11, lineHeight: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  createIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  editor: { gap: 10 },
  editorLabel: { fontSize: 13, fontWeight: '700' },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  moduleCard: { gap: 11, padding: 14 },
  moduleOpen: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moduleIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  moduleText: { flex: 1 },
  moduleName: { fontSize: 14, fontWeight: '700' },
  moduleMeta: { fontSize: 10, marginTop: 4 },
  moduleActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3 },
  smallAction: { width: 31, height: 34, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { padding: 2 },
  localNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 3 },
  localNoteText: { fontSize: 11 },
});