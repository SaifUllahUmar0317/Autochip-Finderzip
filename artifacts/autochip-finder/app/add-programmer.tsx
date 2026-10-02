import React, { useState } from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ActionButton, Screen, TextField, TopBar } from '@/components/common';
import { useApp } from '@/context/AppContext';
import { createTool } from '@/lib/database';

export default function AddProgrammerScreen() {
  const router = useRouter();
  const { colors, db, refresh } = useApp();
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const addProgrammer = async () => {
    if (!db || saving) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Enter a programmer name.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      await createTool(db, cleanName);
      refresh();
      router.back();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add this programmer.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen keyboardAvoiding contentStyle={styles.content}>
      <TopBar title="Add programmer" eyebrow="YOUR LIBRARIES" />
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.infoIcon, { backgroundColor: colors.accent }]}>
          <Feather name="cpu" size={20} color={colors.primary} />
        </View>
        <View style={styles.infoCopy}>
          <Text style={[styles.infoTitle, { color: colors.foreground }]}>Create a programmer library</Text>
          <Text style={[styles.infoDescription, { color: colors.mutedForeground }]}>
            Add a name for the device. You can organize its manuals into modules afterward.
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={[styles.label, { color: colors.foreground }]}>Programmer name</Text>
        <TextField
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (error) setError('');
          }}
          placeholder="e.g. Xhorse VVDI Prog"
          accessibilityLabel="Programmer name"
          autoCapitalize="words"
          autoFocus
          maxLength={60}
          returnKeyType="done"
          onSubmitEditing={() => void addProgrammer()}
          testID="programmer-name-input"
        />
        {error ? <Text accessibilityRole="alert" style={[styles.error, { color: colors.destructive }]}>{error}</Text> : null}
      </View>

      <View style={styles.actions}>
        <ActionButton
          label="Add programmer"
          icon="plus"
          onPress={() => void addProgrammer()}
          disabled={!name.trim()}
          loading={saving}
          testID="save-programmer"
        />
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancel}>
          <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Cancel</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 22 },
  infoCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 13, padding: 15, borderWidth: 1, borderRadius: 18 },
  infoIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  infoCopy: { flex: 1, gap: 4 },
  infoTitle: { fontSize: 14, fontWeight: '800' },
  infoDescription: { fontSize: 12, lineHeight: 18 },
  form: { gap: 9 },
  label: { fontSize: 13, fontWeight: '700' },
  error: { fontSize: 12, lineHeight: 17 },
  actions: { gap: 8 },
  cancel: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 13, fontWeight: '600' },
});