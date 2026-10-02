import React, { type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';

type FeatherName = React.ComponentProps<typeof Feather>['name'];
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  contentStyle,
  keyboardAvoiding = false,
}: {
  children: ReactNode;
  contentStyle?: ViewStyle;
  keyboardAvoiding?: boolean;
}) {
  const { colors } = useApp();
  const insets = useSafeAreaInsets();
  const scrollContent = (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.screenContent,
        {
          paddingTop: Platform.OS === 'web' ? Math.max(67, insets.top) + 8 : insets.top + 8,
          paddingBottom: Platform.OS === 'web' ? 112 : Math.max(24, insets.bottom + 20),
        },
        contentStyle,
      ]}
    >
      {children}
    </ScrollView>
  );
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {keyboardAvoiding ? (
        <KeyboardAvoidingView style={styles.fill} behavior="padding" keyboardVerticalOffset={0}>
          {scrollContent}
        </KeyboardAvoidingView>
      ) : (
        scrollContent
      )}
    </View>
  );
}

export function TopBar({
  title,
  eyebrow,
  right,
}: {
  title: string;
  eyebrow?: string;
  right?: ReactNode;
}) {
  const router = useRouter();
  const { colors } = useApp();
  return (
    <View style={styles.topBar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        hitSlop={10}
        style={styles.backButton}
      >
        <Feather name="arrow-left" size={21} color={colors.foreground} />
      </Pressable>
      <View style={styles.topBarText}>
        {eyebrow ? <Text style={[styles.eyebrow, { color: colors.cyan }]}>{eyebrow}</Text> : null}
        <Text numberOfLines={1} style={[styles.topBarTitle, { color: colors.foreground }]}>
          {title}
        </Text>
      </View>
      {right ?? <View style={styles.topBarSpacer} />}
    </View>
  );
}

export function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
      {action}
    </View>
  );
}

export function Surface({
  children,
  style,
  onPress,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useApp();
  const content = (
    <View
      style={[
        styles.surface,
        { backgroundColor: colors.card, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

export function ActionButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  testID,
  compact = false,
}: {
  label: string;
  icon?: FeatherName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  compact?: boolean;
}) {
  const { colors } = useApp();
  const palette = {
    primary: { backgroundColor: colors.primary, color: colors.primaryForeground, borderColor: colors.primary },
    secondary: { backgroundColor: colors.secondary, color: colors.secondaryForeground, borderColor: colors.border },
    quiet: { backgroundColor: 'transparent', color: colors.primary, borderColor: 'transparent' },
    danger: { backgroundColor: colors.destructive, color: colors.destructiveForeground, borderColor: colors.destructive },
  }[variant];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      onPressIn={() => {
        if (!disabled && !loading) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      style={({ pressed }) => [
        styles.actionButton,
        compact && styles.actionButtonCompact,
        { backgroundColor: palette.backgroundColor, borderColor: palette.borderColor },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={palette.color} />
      ) : icon ? (
        <Feather name={icon} size={compact ? 15 : 17} color={palette.color} />
      ) : null}
      <Text style={[styles.actionLabel, { color: palette.color }, compact && styles.actionLabelCompact]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 20,
}: {
  icon: FeatherName | IoniconName;
  onPress: () => void;
  label: string;
  size?: number;
}) {
  const { colors } = useApp();
  const isIonicon = String(icon).includes('-outline') || icon === 'sunny-outline' || icon === 'moon-outline';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={`icon-${label.toLowerCase().replace(/\s+/g, '-')}`}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
    >
      {isIonicon ? (
        <Ionicons name={icon as IoniconName} size={size} color={colors.foreground} />
      ) : (
        <Feather name={icon as FeatherName} size={size} color={colors.foreground} />
      )}
    </Pressable>
  );
}

export function Pill({
  label,
  selected = false,
  onPress,
  tone = 'default',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'success' | 'warning';
}) {
  const { colors } = useApp();
  const color =
    tone === 'success' ? colors.success : tone === 'warning' ? colors.warning : colors.mutedForeground;
  const background =
    selected ? colors.accent : tone === 'success' ? colors.accent : tone === 'warning' ? colors.secondary : colors.muted;
  const textColor = selected ? colors.accentForeground : color;
  const body = (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <Text style={[styles.pillText, { color: textColor }]}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

export function TextField({
  style,
  ...props
}: TextInputProps) {
  const { colors } = useApp();
  return (
    <TextInput
      placeholderTextColor={colors.mutedForeground}
      selectionColor={colors.primary}
      autoCorrect={false}
      style={[
        styles.textField,
        {
          color: colors.foreground,
          backgroundColor: colors.card,
          borderColor: colors.input,
        },
        style,
      ]}
      {...props}
    />
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: FeatherName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  const { colors } = useApp();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
        <Feather name={icon} size={24} color={colors.cyan} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyDescription, { color: colors.mutedForeground }]}>{description}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  );
}

export function HighlightedText({
  text,
  query,
  numberOfLines,
  style,
}: {
  text: string;
  query: string;
  numberOfLines?: number;
  style?: object;
}) {
  const { colors } = useApp();
  const literal = query.trim();
  if (!literal) {
    return (
      <Text numberOfLines={numberOfLines} style={style}>
        {text}
      </Text>
    );
  }
  const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pieces = text.split(new RegExp(`(${escaped})`, 'ig'));
  return (
    <Text numberOfLines={numberOfLines} style={style}>
      {pieces.map((piece, index) =>
        piece.toLocaleLowerCase() === literal.toLocaleLowerCase() ? (
          <Text key={`${piece}-${index}`} style={{ color: colors.cyan, fontWeight: '700' }}>
            {piece}
          </Text>
        ) : (
          <Text key={`${piece}-${index}`}>{piece}</Text>
        ),
      )}
    </Text>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export const sharedStyles = StyleSheet.create({
  muted: { fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
});

const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { flex: 1 },
  screenContent: { paddingHorizontal: 20, flexGrow: 1, gap: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, gap: 10 },
  backButton: { width: 38, height: 42, alignItems: 'flex-start', justifyContent: 'center' },
  topBarText: { flex: 1, gap: 2 },
  topBarSpacer: { width: 32 },
  topBarTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
  surface: { borderWidth: 1, borderRadius: 18, padding: 16 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  actionButton: {
    minHeight: 46,
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonCompact: { minHeight: 36, borderRadius: 11, paddingHorizontal: 11 },
  actionLabel: { fontSize: 14, fontWeight: '700' },
  actionLabelCompact: { fontSize: 12 },
  disabled: { opacity: 0.48 },
  iconButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  pill: { borderRadius: 30, paddingVertical: 7, paddingHorizontal: 11, alignSelf: 'flex-start' },
  pillText: { fontSize: 11, fontWeight: '700' },
  textField: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26, paddingVertical: 32 },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  emptyDescription: { fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 300 },
  emptyAction: { marginTop: 18 },
});