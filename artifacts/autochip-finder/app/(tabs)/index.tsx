import React, { useCallback, useState } from 'react';
import {
  Image,
  Pressable,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { Screen, Surface } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { listModules, listTools, type ModuleRow, type ToolName } from '@/lib/database';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, db, revision, theme, setTheme } = useApp();
  const { width } = useWindowDimensions();
  const [tools, setTools] = useState<ToolName[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!db) return;
      let active = true;
      void Promise.all([listTools(db), listModules(db)])
        .then(([nextTools, nextModules]) => {
          if (!active) return;
          setTools(nextTools);
          setModules(nextModules);
        })
        .catch(() => undefined);
      return () => {
        active = false;
      };
    }, [db, revision]),
  );
  const responsiveCards = width > 680;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.brand}>
          <Image source={require('../../assets/images/icon.png')} style={styles.brandIcon} />
          <View>
            <Text style={[styles.brandName, { color: colors.foreground }]}>AutoChip Finder</Text>
            <Text style={[styles.brandTagline, { color: colors.mutedForeground }]}>SMART MODULE SEARCH</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Switch theme"
            testID="toggle-theme"
            onPress={() => void setTheme(theme === 'dark' ? 'light' : 'dark')}
            style={styles.headerIcon}
          >
            <Feather name={theme === 'dark' ? 'sun' : 'moon'} size={19} color={colors.foreground} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            testID="open-settings"
            onPress={() => router.push('/settings')}
            style={styles.headerIcon}
          >
            <Feather name="settings" size={19} color={colors.foreground} />
          </Pressable>
        </View>
      </View>

      <View style={styles.pickerContent}>
        <View style={styles.pickerHeading}>
          <Text style={[styles.headingTitle, { color: colors.foreground }]}>Your programmers</Text>
          <Text style={[styles.headingHint, { color: colors.mutedForeground }]}>Choose a library to continue.</Text>
        </View>
        <View style={[styles.toolGrid, responsiveCards && styles.toolGridWide]}>
          {tools.map((tool, index) => {
            const toolModules = modules.filter((module) => module.tool === tool);
            const pdfCount = toolModules.reduce((count, module) => count + module.documentCount, 0);
            const isIprog = tool === 'iProg Pro';
            const iconColor = isIprog ? colors.cyan : colors.primary;
            const borderColor = tool === 'CG100X' ? colors.primary : isIprog ? colors.cyan : index % 2 ? colors.cyan : colors.primary;
            const subtitle = tool === 'CG100X'
              ? 'Support databases'
              : tool === 'iProg Pro'
                ? 'Programmer library'
                : 'Custom programmer library';
            return (
              <Pressable
                key={tool}
                accessibilityRole="button"
                accessibilityLabel={`Open ${tool} programmer library`}
                testID={`tool-${tool.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
                onPress={() => router.push({ pathname: '/tool/[tool]', params: { tool } })}
                style={({ pressed }) => [styles.toolPressable, responsiveCards && styles.toolPressableWide, pressed && styles.pressed]}
              >
                <Surface style={[styles.toolCard, { borderColor }]}>
                  <View style={[styles.toolIcon, { backgroundColor: isIprog ? colors.secondary : colors.accent }]}>
                    <Feather name={isIprog ? 'activity' : 'cpu'} size={21} color={iconColor} />
                  </View>
                  <View style={styles.toolArrow}>
                    <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
                  </View>
                  <Text numberOfLines={1} style={[styles.toolName, { color: colors.foreground }]}>{tool}</Text>
                  <Text style={[styles.toolSubtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
                  <View style={styles.toolFoot}>
                    <Text style={[styles.toolMeta, { color: colors.foreground }]}>{toolModules.length} modules</Text>
                    <Text style={[styles.toolMetaMuted, { color: colors.mutedForeground }]}>{pdfCount} PDFs</Text>
                  </View>
                </Surface>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          testID="add-programmer"
          onPress={() => router.push('/add-programmer')}
          style={({ pressed }) => [
            styles.addProgrammer,
            { borderColor: colors.border, backgroundColor: colors.card },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.addProgrammerIcon, { backgroundColor: colors.accent }]}>
            <Feather name="plus" size={18} color={colors.primary} />
          </View>
          <View style={styles.addProgrammerCopy}>
            <Text style={[styles.addProgrammerTitle, { color: colors.foreground }]}>Add programmer</Text>
            <Text style={[styles.addProgrammerHint, { color: colors.mutedForeground }]}>Create a library for another device</Text>
          </View>
          <Feather name="arrow-up-right" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 12 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 40, height: 40, borderRadius: 12 },
  brandName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.4 },
  brandTagline: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  pickerContent: { flex: 1, justifyContent: 'center', gap: 14, paddingBottom: 4 },
  pickerHeading: { gap: 4 },
  headingTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
  headingHint: { fontSize: 12 },
  toolGrid: { gap: 12 },
  toolGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  toolPressable: { width: '100%' },
  toolPressableWide: { width: '48%' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  toolCard: { minHeight: 116, padding: 14, borderWidth: 1, borderRadius: 19, overflow: 'hidden' },
  toolIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  toolArrow: { position: 'absolute', top: 17, right: 13 },
  toolName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.4, marginTop: 8 },
  toolSubtitle: { fontSize: 11, marginTop: 2 },
  toolFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 9, alignItems: 'center' },
  toolMeta: { fontSize: 11, fontWeight: '700' },
  toolMetaMuted: { fontSize: 10 },
  addProgrammer: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 17,
  },
  addProgrammerIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  addProgrammerCopy: { flex: 1 },
  addProgrammerTitle: { fontSize: 12, fontWeight: '800' },
  addProgrammerHint: { fontSize: 10, marginTop: 2 },
});