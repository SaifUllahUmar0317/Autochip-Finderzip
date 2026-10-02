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
  const { colors, db, revision, refresh } = useApp();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [moduleQuery, setModuleQuery] = useState('');
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
  const visibleModules = modules.filter((module) =>
    module.name.toLocaleLowerCase().includes(moduleQuery.trim().toLocaleLowerCase()),
  );

  return (
    <Screen contentStyle={styles.content}>
      <TopBar title={tool} right={
        <Pressable accessibilityRole="button" accessibilityLabel="Add a PDF" onPress={() => router.push({ pathname: '/import', params: { tool } })} style={styles.headerIcon}>
          <Feather name="file-plus" size={19} color={colors.primary} />
        </Pressable>
      } />
      <View style={styles.librarySummary}>
        <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
          {modules.length} modules · {modules.reduce((total, module) => total + module.documentCount, 0)} PDFs
        </Text>
      </View>
      <ActionButton label="Search" icon="search" onPress={() => router.push({ pathname: '/search', params: { tool } })} />
      <View style={[styles.listSearch, { borderColor: colors.input, backgroundColor: colors.card }]}>
        <Feather name="search" size={17} color={colors.mutedForeground} />
        <TextField
          value={moduleQuery}
          onChangeText={setModuleQuery}
          placeholder="Filter modules"
          accessibilityLabel="Filter modules by name"
          returnKeyType="search"
          style={styles.searchInput}
        />
      </View>
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
      {visibleModules.length ? visibleModules.map((module) => {
        const index = modules.findIndex((item) => item.id === module.id);
        return (
        <Surface key={module.id} style={styles.moduleCard}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/module/[id]', params: { id: module.id } })}
            style={styles.moduleOpen}
          >
            <Feather name="grid" size={18} color={colors.mutedForeground} />
            <View style={styles.moduleText}>
              <Text numberOfLines={1} style={[styles.moduleName, { color: colors.foreground }]}>{module.name}</Text>
              <Text style={[styles.moduleMeta, { color: colors.mutedForeground }]}>{module.documentCount} PDFs · {module.indexedPageCount.toLocaleString()} indexed pages</Text>
            </View>
            <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
          </Pressable>
          <View style={styles.moduleActions}>
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
      )}) : (
        <Surface style={styles.emptyCard}>
          <EmptyState
            icon={modules.length ? 'search' : 'layers'}
            title={modules.length ? 'No matching modules' : 'No modules yet'}
            description={modules.length ? 'Try a different name.' : 'Create a module to organize its PDFs.'}
            action={modules.length ? undefined : <ActionButton label="Create a module" icon="plus" onPress={beginCreate} />}
          />
        </Surface>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12 },
  headerIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  librarySummary: { marginTop: -8 },
  summaryText: { fontSize: 13 },
  listSearch: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 13, paddingRight: 8, borderWidth: 1, borderRadius: 10 },
  searchInput: { flex: 1, minHeight: 48, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  createIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  editor: { gap: 10 },
  editorLabel: { fontSize: 13, fontWeight: '700' },
  editorActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  moduleCard: { gap: 7, padding: 12 },
  moduleOpen: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moduleText: { flex: 1 },
  moduleName: { fontSize: 15, fontWeight: '600' },
  moduleMeta: { fontSize: 12, marginTop: 3 },
  moduleActions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 5 },
  smallAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { padding: 2 },
});