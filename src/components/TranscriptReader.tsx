import React from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Chip, IconButton, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { readTranscriptPage, type TranscriptPage } from '../services/transcriptReader';
import { senderColorIndex, toTranscriptEntries, transcriptSenders, type TranscriptEntry } from '../lib/transcriptMessages';
import { useAppTheme } from '../theme/useAppTheme';
import { radius, spacing } from '../theme/designTokens';
import { surfaceRoles } from './AppUi';

type Props = { uri: string; filename: string };
type MessageEntry = Extract<TranscriptEntry, { kind: 'message' }>;

/** Name colors tuned separately for light and dark surfaces. */
const senderPalettes = {
  light: ['#1565c0', '#c2410c', '#2e7d32', '#ad1457', '#6a1b9a', '#8d6e00', '#00796b', '#c62828'],
  dark: ['#8ab4f8', '#ffb38a', '#a5d6a7', '#f48fb1', '#ce93d8', '#ffd54f', '#80cbc4', '#ef9a9a']
} as const;

export function TranscriptReader(props: Props) {
  return <TranscriptDocument key={props.uri} {...props} />;
}

function TranscriptDocument({ uri, filename }: Props) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [position, setPosition] = React.useState({ offset: 0, previous: [] as number[] });
  const [page, setPage] = React.useState<TranscriptPage>();
  const [failed, setFailed] = React.useState(false), [retry, setRetry] = React.useState(0);
  const [me, setMe] = React.useState<string | null>(null);
  const [searching, setSearching] = React.useState(false), [query, setQuery] = React.useState('');
  React.useEffect(() => {
    let alive = true;
    setPage(undefined); setFailed(false);
    void readTranscriptPage(uri, position.offset).then((result) => {
      if (alive) setPage(result);
    }, () => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [position.offset, retry, uri]);
  const current = page?.offset === position.offset ? page : undefined;
  const entries = React.useMemo(() => current ? toTranscriptEntries(current.text) : [], [current]);
  const senders = React.useMemo(() => transcriptSenders(entries), [entries]);
  const needle = query.trim().toLocaleLowerCase();
  const visible = React.useMemo(() => needle
    ? entries.filter((entry) => entry.kind !== 'day' && `${entry.kind === 'message' ? entry.sender : ''} ${entry.body}`.toLocaleLowerCase().includes(needle))
    : entries, [entries, needle]);
  const previous = position.previous.length > 0;
  const palette = senderPalettes[theme.dark ? 'dark' : 'light'];

  const renderEntry = React.useCallback(({ item }: { item: TranscriptEntry }) => {
    if (item.kind === 'day') return <View style={styles.center}>
      <View style={[styles.dayPill, { backgroundColor: surfaceRoles(theme).raised }]}>
        <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>{item.date}</Text>
      </View>
    </View>;
    if (item.kind === 'system') return <View style={styles.center}>
      <Text variant="bodySmall" selectable style={[styles.system, { color: theme.colors.onSurfaceVariant, backgroundColor: surfaceRoles(theme).low }]}>
        {item.body}
      </Text>
    </View>;
    if (item.kind === 'text') return <Text selectable style={[styles.plain, { color: theme.colors.onSurface }]}>{item.body}</Text>;
    return <MessageBubble entry={item} mine={item.sender === me} showName={needle ? true : item.startsRun}
      nameColor={palette[senderColorIndex(item.sender, palette.length)]} />;
  }, [me, needle, palette, theme]);

  if (failed) return <View style={styles.status}>
    <Text accessibilityRole="alert" style={styles.centerText}>{t('viewer.transcriptError')}</Text>
    <Button mode="contained-tonal" onPress={() => setRetry((value) => value + 1)}>{t('viewer.transcriptRetry')}</Button>
  </View>;
  if (!current) return <View style={styles.status}><ActivityIndicator accessibilityLabel={t('viewer.transcriptLoading')} /></View>;

  return <View style={styles.reader}>
    {entries.length ? <View style={styles.toolbar}>
      {searching ? <View style={[styles.search, { backgroundColor: surfaceRoles(theme).raised }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.onSurfaceVariant} importantForAccessibility="no" />
        <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={t('viewer.transcriptSearch')}
          placeholderTextColor={theme.colors.onSurfaceVariant} accessibilityLabel={t('viewer.transcriptSearch')}
          style={[styles.searchInput, { color: theme.colors.onSurface }]} />
        <IconButton icon="close" size={24} style={styles.touchTarget} accessibilityLabel={t('common.close')} onPress={() => { setQuery(''); setSearching(false); }} />
      </View> : <>
        {senders.length > 1 ? <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flex} contentContainerStyle={styles.people}>
          <Text variant="labelLarge" style={[styles.peopleLabel, { color: theme.colors.onSurfaceVariant }]}>{t('viewer.transcriptMe')}</Text>
          {senders.map((sender) => <Chip key={sender} compact selected={me === sender} showSelectedCheck={false}
            onPress={() => setMe((value) => value === sender ? null : sender)}
            style={{ backgroundColor: me === sender ? theme.colors.secondaryContainer : surfaceRoles(theme).raised }}
            textStyle={{ color: me === sender ? theme.colors.onSecondaryContainer : theme.colors.onSurface }}>{sender}</Chip>)}
        </ScrollView> : <View style={styles.flex} />}
        <IconButton icon="magnify" accessibilityLabel={t('viewer.transcriptSearch')} onPress={() => setSearching(true)} />
      </>}
    </View> : null}
    {needle ? <Text variant="labelMedium" accessibilityLiveRegion="polite" style={[styles.matches, { color: theme.colors.onSurfaceVariant }]}>
      {t(visible.length ? 'viewer.transcriptMatches' : 'viewer.transcriptNoMatches', { count: visible.length })}
    </Text> : null}
    {entries.length ? <FlatList key={current.offset} data={visible} keyExtractor={(entry) => entry.key} renderItem={renderEntry}
      style={styles.flex} contentContainerStyle={styles.content} accessibilityLabel={filename} nestedScrollEnabled
      initialNumToRender={24} maxToRenderPerBatch={24} windowSize={9} keyboardShouldPersistTaps="handled" />
      : <View style={styles.status}><Text selectable style={[styles.centerText, { color: theme.colors.onSurfaceVariant }]}>{t('viewer.transcriptEmpty')}</Text></View>}
    <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
      {previous || current.nextOffset !== null ? <>
        <Text variant="labelMedium" style={[styles.centerText, { color: theme.colors.onSurfaceVariant }]}>{t('viewer.transcriptSection', { current: position.previous.length + 1 })}</Text>
        <View style={styles.controls}>
          <Button mode="outlined" style={styles.button} contentStyle={styles.buttonContent} disabled={!previous} onPress={() => setPosition((value) => value.offset !== current.offset ? value : ({
            offset: value.previous[value.previous.length - 1] ?? 0, previous: value.previous.slice(0, -1),
          }))}>{t('viewer.transcriptPreviousSection')}</Button>
          <Button mode="contained-tonal" style={styles.button} contentStyle={styles.buttonContent} disabled={current.nextOffset === null} onPress={() => {
            const nextOffset = current.nextOffset;
            if (nextOffset !== null) setPosition((value) => value.offset !== current.offset ? value : ({ offset: nextOffset, previous: [...value.previous, value.offset] }));
          }}>{t('viewer.transcriptNextSection')}</Button>
        </View>
      </> : null}
      {current.nextOffset === null ? <Text variant="labelMedium" style={[styles.centerText, { color: theme.colors.onSurfaceVariant }]}>{t('viewer.transcriptEnd')}</Text> : null}
    </View>
  </View>;
}

const MessageBubble = React.memo(function MessageBubble({ entry, mine, showName, nameColor }: {
  entry: MessageEntry; mine: boolean; showName: boolean; nameColor: string;
}) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const background = mine ? theme.colors.primaryContainer : surfaceRoles(theme).raised;
  const foreground = mine ? theme.colors.onPrimaryContainer : theme.colors.onSurface;
  const tail = entry.startsRun ? 4 : radius.bubble;
  // The name is only drawn on the first bubble of a run, so screen readers get it on every bubble.
  const content = entry.attachment
    ? [`${t('viewer.transcriptAttachment')} ${entry.attachment}`, entry.caption].filter(Boolean).join(', ')
    : entry.body;
  return <View style={[styles.bubbleRow, mine ? styles.mineRow : null, entry.startsRun ? styles.runStart : null]}>
    <View accessible accessibilityLabel={`${entry.sender}, ${entry.time}: ${content}`} style={[styles.bubble, {
      backgroundColor: background,
      borderTopStartRadius: mine ? radius.bubble : tail,
      borderTopEndRadius: mine ? tail : radius.bubble
    }]}>
      {showName && !mine ? <Text variant="labelLarge" numberOfLines={1} style={[styles.sender, { color: nameColor }]}>{entry.sender}</Text> : null}
      {entry.attachment ? <View style={[styles.attachment, { backgroundColor: mine ? theme.colors.primary + '1f' : surfaceRoles(theme).low }]}>
        <MaterialCommunityIcons name="paperclip" size={18} color={foreground} importantForAccessibility="no" />
        <Text variant="bodyMedium" numberOfLines={2} ellipsizeMode="middle" selectable style={[styles.attachmentName, { color: foreground }]}>{entry.attachment}</Text>
      </View> : null}
      {entry.caption ? <Text selectable style={[styles.body, { color: foreground }]}>{entry.caption}</Text> : null}
      {entry.attachment ? null : <Text selectable style={[styles.body, { color: foreground }, entry.omitted ? styles.omitted : null]}>{entry.body}</Text>}
      <Text variant="labelSmall" style={[styles.time, { color: mine ? theme.colors.onPrimaryContainer : theme.colors.onSurfaceVariant }]}>{entry.time}</Text>
    </View>
  </View>;
});

const styles = StyleSheet.create({
  reader: { flex: 1, width: '100%' }, flex: { flex: 1, minWidth: 0 },
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingStart: spacing.smallGap },
  people: { alignItems: 'center', gap: 6, paddingEnd: spacing.smallGap },
  peopleLabel: { marginEnd: 2 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: radius.button, paddingStart: 14, marginEnd: spacing.smallGap, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8, paddingHorizontal: 8, textAlign: 'auto', writingDirection: 'auto' },
  matches: { textAlign: 'center', paddingBottom: spacing.tinyGap },
  content: { paddingHorizontal: spacing.gap, paddingVertical: spacing.smallGap, gap: 2 },
  center: { alignItems: 'center', paddingVertical: 6 },
  dayPill: { borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 4 },
  system: { textAlign: 'center', borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '90%', overflow: 'hidden' },
  plain: { fontSize: 15, lineHeight: 22, paddingVertical: 6, textAlign: 'auto', writingDirection: 'auto' },
  bubbleRow: { flexDirection: 'row', justifyContent: 'flex-start' },
  mineRow: { justifyContent: 'flex-end' },
  runStart: { marginTop: 6 },
  bubble: { maxWidth: '86%', minWidth: 72, borderRadius: radius.bubble, paddingHorizontal: 12, paddingTop: 7, paddingBottom: 5, gap: 2 },
  sender: { fontWeight: '700', textAlign: 'auto', writingDirection: 'auto' },
  body: { fontSize: 16, lineHeight: 22, textAlign: 'auto', writingDirection: 'auto' },
  omitted: { fontStyle: 'italic', opacity: 0.75 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  attachmentName: { flexShrink: 1, textAlign: 'auto', writingDirection: 'auto' },
  time: { alignSelf: 'flex-end', fontVariant: ['tabular-nums'], opacity: 0.85 },
  status: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16, gap: 12 },
  centerText: { textAlign: 'center' },
  footer: { paddingHorizontal: spacing.smallGap, paddingTop: spacing.smallGap, gap: 6, borderTopWidth: StyleSheet.hairlineWidth },
  controls: { flexDirection: 'row', gap: 8 }, button: { flex: 1, borderRadius: radius.button }, buttonContent: { minHeight: 48 },
  touchTarget: { width: 48, height: 48, margin: 0 },
});
