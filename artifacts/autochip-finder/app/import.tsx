import React, { useCallback, useState } from 'react';
import { Alert, Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionButton, Pill, Screen, SectionTitle, Surface, TextField, TopBar, formatBytes } from '@/components/common';
import { useApp } from '@/context/AppContext';
import {
  createDocumentRecord,
  createId,
  createModule,
  listTools,
  documentExists,
  listModules,
  replacePageIndex,
  type ModuleRow,
  type ToolName,
} from '@/lib/database';
import { extractPdfPages } from '@/lib/pdf-index';

interface PickedPdf {
  uri: string;
  name: string;
  size: number;
}

export default function ImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tool?: string | string[]; moduleId?: string | string[] }>();
  const routeTool = getFirst(params.tool);
  const routeModule = getFirst(params.moduleId);
  const { colors, db, refresh, revision } = useApp();
  const [tool, setTool] = useState<ToolName>(routeTool ?? 'CG100X');
  const [tools, setTools] = useState<ToolName[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [moduleId, setModuleId] = useState(routeModule);
  const [createNewModule, setCreateNewModule] = useState(false);
  const [moduleName, setModuleName] = useState('');
  const [pickedPdf, setPickedPdf] = useState<PickedPdf | null>(null);
  const [picking, setPicking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState('');

  React.useEffect(() => {
    if (!db) return;
    void listTools(db).then((rows) => {
      setTools(rows);
      setTool((current) =>
        routeTool && rows.includes(routeTool)
          ? routeTool
          : rows.includes(current)
            ? current
            : rows[0] ?? 'CG100X',
      );
    });
  }, [db, revision, routeTool]);

  const loadModules = useCallback(() => {
    if (!db) return;
    void listModules(db, tool).then((rows) => {
      setModules(rows);
      if (moduleId && !rows.some((row) => row.id === moduleId)) setModuleId('');
    });
  }, [db, tool, moduleId]);
  React.useEffect(() => {
    loadModules();
  }, [loadModules]);

  const chooseTool = (nextTool: ToolName) => {
    setTool(nextTool);
    setModuleId('');
    setCreateNewModule(false);
  };

  const choosePdf = async () => {
    setError('');
    setPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets.length) return;
      const asset = result.assets[0];
      const isPdf = asset.mimeType === 'application/pdf' || asset.name.toLocaleLowerCase().endsWith('.pdf');
      if (!isPdf) {
        setError('Choose a PDF file to add it to the offline library.');
        return;
      }
      const info = await FileSystem.getInfoAsync(asset.uri);
      const cachedSize = info.exists && 'size' in info ? info.size ?? 0 : 0;
      setPickedPdf({ uri: asset.uri, name: asset.name, size: asset.size ?? cachedSize });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the device file picker.');
    } finally {
      setPicking(false);
    }
  };

  const importPdf = async () => {
    if (!db || !pickedPdf || importing) return;
    setError('');
    const selectedModule = createNewModule ? null : modules.find((item) => item.id === moduleId);
    if (!selectedModule && !createNewModule) {
      setError('Select a module or create one before importing this PDF.');
      return;
    }
    if (createNewModule && !moduleName.trim()) {
      setError('Enter a name for the new module.');
      return;
    }
    setImporting(true);
    setProgress({ current: 0, total: 0 });
    let copyUri: string | null = null;
    let documentId: string | null = null;
    try {
      if (await documentExists(db, pickedPdf.name, pickedPdf.size)) {
        setError('This PDF is already in your library. Find it in the Library tab, or rename the file before importing another copy.');
        return;
      }
      const targetModuleId = selectedModule?.id ?? await createModule(db, tool, moduleName.trim());
      const fileId = createId('pdf');
      const folder = `${FileSystem.documentDirectory}pdf-library/`;
      if (!FileSystem.documentDirectory) throw new Error('This device does not provide local document storage.');
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      copyUri = `${folder}${fileId}.pdf`;
      await FileSystem.copyAsync({ from: pickedPdf.uri, to: copyUri });
      documentId = createId('document');
      await createDocumentRecord(db, {
        id: documentId,
        moduleId: targetModuleId,
        displayName: pickedPdf.name.replace(/\.pdf$/i, ''),
        originalFilename: pickedPdf.name,
        uri: copyUri,
        pageCount: 0,
        fileSize: pickedPdf.size,
      });
      const pages = await extractPdfPages(copyUri, (current, total) => setProgress({ current, total }));
      const hasText = pages.some((page) => page.text.trim().length > 0);
      await replacePageIndex(
        db,
        documentId,
        pages,
        hasText ? 'ready' : 'no-text',
        hasText ? null : 'No selectable text was found. This PDF may contain scanned images; OCR is not included.',
      );
      refresh();
      if (hasText) {
        Alert.alert('PDF added', `${pages.length} pages were processed. The document is available for offline search.`);
      } else {
        Alert.alert('PDF saved without searchable text', 'The original file is stored locally, but this PDF has no selectable text layer to index.');
      }
      router.back();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'The PDF could not be indexed.';
      if (documentId) {
        const { updateDocumentStatus } = await import('@/lib/database');
        await updateDocumentStatus(db, documentId, 'failed', message);
        refresh();
      } else if (copyUri) {
        await FileSystem.deleteAsync(copyUri, { idempotent: true }).catch(() => undefined);
      }
      setError(`The PDF was not indexed: ${message}`);
    } finally {
      setImporting(false);
      setProgress(null);
    }
  };

  const currentModuleName = modules.find((item) => item.id === moduleId)?.name;
  const canImport = Boolean(pickedPdf && (createNewModule ? moduleName.trim() : moduleId));

  return (
    <Screen keyboardAvoiding contentStyle={styles.content}>
      <TopBar title="Add a PDF" eyebrow="IMPORT TO YOUR DEVICE" />
      <View style={[styles.intro, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.introIcon, { backgroundColor: colors.accent }]}>
          <Feather name="download-cloud" size={20} color={colors.primary} />
        </View>
        <View style={styles.introText}>
          <Text style={[styles.introTitle, { color: colors.foreground }]}>Build your offline library</Text>
          <Text style={[styles.introCopy, { color: colors.mutedForeground }]}>The PDF and its page index stay on this device. No account or network connection is needed.</Text>
        </View>
      </View>

      <View style={styles.section}>
        <SectionTitle title="Choose programmer" />
        <View style={styles.toolChoices}>
          {tools.map((item) => (
            <Pill key={item} label={item} selected={tool === item} onPress={() => chooseTool(item)} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <SectionTitle title="Choose module" />
          <Pressable accessibilityRole="button" onPress={() => { setCreateNewModule((value) => !value); setModuleId(''); }} style={styles.createModuleToggle}>
            <Text style={[styles.createModuleText, { color: colors.primary }]}>{createNewModule ? 'Select existing' : 'New module +'}</Text>
          </Pressable>
        </View>
        {createNewModule ? (
          <TextField value={moduleName} onChangeText={setModuleName} placeholder="New module name" maxLength={80} />
        ) : modules.length ? (
          <View style={styles.moduleChoices}>
            {modules.map((module) => (
              <Pill key={module.id} label={module.name} selected={moduleId === module.id} onPress={() => setModuleId(module.id)} />
            ))}
          </View>
        ) : (
          <Text style={[styles.helperText, { color: colors.mutedForeground }]}>This programmer has no modules. Create one to continue.</Text>
        )}
      </View>

      <View style={styles.section}>
        <SectionTitle title="PDF file" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose PDF from device"
          testID="pick-pdf"
          onPress={() => void choosePdf()}
          style={({ pressed }) => [
            styles.filePicker,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.filePickerIcon, { backgroundColor: colors.secondary }]}>
            <Feather name="file-plus" size={20} color={colors.cyan} />
          </View>
          <View style={styles.filePickerText}>
            <Text style={[styles.filePickerTitle, { color: colors.foreground }]}>{pickedPdf ? pickedPdf.name : 'Browse device files'}</Text>
            <Text style={[styles.filePickerSub, { color: colors.mutedForeground }]}>{pickedPdf ? `${formatBytes(pickedPdf.size)} · PDF` : 'Choose a searchable PDF'}</Text>
          </View>
          <Feather name="chevron-right" size={17} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {pickedPdf ? (
        <Surface style={styles.summary}>
          <View style={styles.summaryLine}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.summaryText, { color: colors.foreground }]}>Ready to add to {createNewModule ? (moduleName || 'new module') : (currentModuleName || 'a module')}</Text>
          </View>
          <Text style={[styles.summarySub, { color: colors.mutedForeground }]}>PDF text is extracted page by page and indexed for local search.</Text>
        </Surface>
      ) : null}
      {error ? (
        <View style={[styles.errorBox, { backgroundColor: colors.secondary }]}>
          <Feather name="alert-circle" size={15} color={colors.warning} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>{error}</Text>
        </View>
      ) : null}
      {importing && progress?.total ? (
        <View style={styles.progressBlock}>
          <Text style={[styles.progressLabel, { color: colors.foreground }]}>Indexing page {progress.current} of {progress.total}</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.secondary }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round((progress.current / progress.total) * 100)}%` }]} />
          </View>
        </View>
      ) : null}
      <ActionButton
        label={importing ? 'Indexing PDF…' : 'Import and index PDF'}
        icon="download"
        loading={importing || picking}
        disabled={!canImport}
        testID="import-pdf"
        onPress={() => void importPdf()}
      />
      <Text style={[styles.footer, { color: colors.mutedForeground }]}>PDFs with scanned image pages can be saved, but they need OCR to become searchable. OCR is not included.</Text>
    </Screen>
  );
}

function getFirst(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

const styles = StyleSheet.create({
  content: { gap: 18 },
  intro: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', padding: 15, borderRadius: 17, borderWidth: 1 },
  introIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  introText: { flex: 1, gap: 5 },
  introTitle: { fontSize: 14, fontWeight: '700' },
  introCopy: { fontSize: 11, lineHeight: 17 },
  section: { gap: 10 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolChoices: { flexDirection: 'row', gap: 8 },
  createModuleToggle: { paddingVertical: 7, paddingHorizontal: 4 },
  createModuleText: { fontSize: 11, fontWeight: '700' },
  moduleChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  helperText: { fontSize: 12, lineHeight: 18 },
  filePicker: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 16, borderWidth: 1 },
  filePickerIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  filePickerText: { flex: 1, gap: 4 },
  filePickerTitle: { fontSize: 13, fontWeight: '700' },
  filePickerSub: { fontSize: 10 },
  summary: { gap: 7, padding: 14 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  summaryText: { fontSize: 12, fontWeight: '700', flex: 1 },
  summarySub: { fontSize: 10, lineHeight: 15, marginLeft: 24 },
  errorBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 12 },
  errorText: { fontSize: 11, lineHeight: 17, flex: 1 },
  progressBlock: { gap: 7 },
  progressLabel: { fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 5, borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 5 },
  footer: { textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: -5 },
  pressed: { opacity: 0.8 },
});