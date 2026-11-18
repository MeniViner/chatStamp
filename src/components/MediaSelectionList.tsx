import React from 'react';
import { PanResponder, Pressable, SectionList, StyleSheet, View, type ViewToken } from 'react-native';
import { Image } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/useAppTheme';
import { PrimaryButton } from './AppUi';
import type { MediaType } from '../types/media';
import { rangeIds, selectionState, setIdsSelected, type SelectionState } from '../store/fileSelectionState';

export type MediaCellItem = Readonly<{
  id: string; filename: string; uri: string; mediaType: MediaType;
  sender: string; dateLabel: string; dateBadge: 'known' | 'approximate' | 'missing';
  dayKey: string | null; sizeBytes?: number; durationLabel?: string; dateMillis?: number;
}>;
export type ThumbnailState = Readonly<{ uri: string | null; status: 'loading' | 'ready' | 'unavailable'; durationMillis?: number }>;
export type MediaCellProps = Readonly<{
  item: MediaCellItem; selected: boolean; thumbnailUri: string | null;
  thumbnailStatus: 'loading' | 'ready' | 'unavailable'; width: number;
  onOpen: (id: string) => void; onToggle: (id: string) => void;
  onStartRange: (id: string) => void;
  onRegisterCell: (id: string, view: View | null) => void;
  onThumbnailError?: (id: string) => void;
  durationLabel?: string;
  playing?: boolean; onPlayAudio?: (id: string) => void;
}>;
export type DaySelectionHeaderProps = Readonly<{
  groupKey: string; label: string; state: SelectionState; onToggleDay: (key: string) => void;
}>;
export type SelectionFooterProps = Readonly<{
  selected: number; total: number; selectedBytes: number; unknownSizeCount: number;
  state: SelectionState; onToggleAll: () => void; onSave: () => void;
}>;
export type MediaSelectionListProps = Readonly<{
  items: readonly MediaCellItem[]; selectedIds: ReadonlySet<string>;
  thumbnails: ReadonlyMap<string, ThumbnailState>; columns: 3 | 5; width: number;
  onOpen: (id: string) => void; onToggle: (id: string) => void;
  onSetSelection: (selection: ReadonlySet<string>) => void;
  onViewableIds: (ids: readonly string[]) => void;
  onThumbnailError?: (id: string) => void;
  playingAudioId?: string; onPlayAudio: (id: string) => void;
}>;

type SelectionRow = Readonly<{ key: string; visual: boolean; items: readonly MediaCellItem[] }>;
type SelectionSection = Readonly<{ key: string; dayKey: string | null; ids: readonly string[]; data: readonly SelectionRow[] }>;
const isVisual = (item: MediaCellItem) => ['photo', 'video', 'sticker', 'gif'].includes(item.mediaType);
const noThumbnail: ThumbnailState = { uri: null, status: 'loading' };

export function formatSelectionBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function SelectionCircle({ selected, onPress, label }: { selected: boolean; onPress: () => void; label: string }) {
  const theme = useAppTheme();
  return <Pressable onPress={onPress} accessibilityRole="checkbox" accessibilityLabel={label}
    accessibilityState={{ checked: selected }} style={styles.checkTouch}>
    <MaterialCommunityIcons name={selected ? 'check-circle' : 'checkbox-blank-circle-outline'} size={26}
      color={selected ? theme.colors.primary : theme.colors.onSurface} style={styles.checkIcon} />
  </Pressable>;
}

export const MediaGridCell = React.memo(function MediaGridCell(props: MediaCellProps) {
  const { item, selected, thumbnailUri, thumbnailStatus, width, onOpen, onToggle, onStartRange, onRegisterCell, onThumbnailError } = props;
  const { t } = useTranslation();
  const theme = useAppTheme();
  const held = React.useRef(false);
  const [imageFailed, setImageFailed] = React.useState(false);
  React.useEffect(() => setImageFailed(false), [thumbnailUri, thumbnailStatus]);
  const registerRef = React.useCallback((view: View | null) => onRegisterCell(item.id, view), [item.id, onRegisterCell]);
  return <View ref={registerRef} style={{ width, height: width }} collapsable={false}>
    <Pressable style={[styles.gridCell, { backgroundColor: theme.colors.surfaceVariant }]}
      accessibilityRole="button" accessibilityLabel={t('picker.openItem', { name: item.filename, sender: item.sender, date: item.dateLabel })}
      accessibilityState={{ selected }} onPress={() => { if (!held.current) onOpen(item.id); held.current = false; }}
      onPressIn={() => { held.current = false; }} onLongPress={() => { held.current = true; onStartRange(item.id); }} delayLongPress={450}>
      {thumbnailUri && !imageFailed ? <Image source={{ uri: thumbnailUri }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={item.id} cachePolicy="none"
        onError={() => { setImageFailed(true); onThumbnailError?.(item.id); }} />
        : <View style={styles.placeholder} accessibilityLabel={t(thumbnailStatus === 'loading' ? 'picker.thumbnailLoading' : 'picker.thumbnailUnavailable')}>
          <MaterialCommunityIcons name={item.mediaType === 'video' ? 'video-outline' : 'image-outline'} size={32} color={theme.colors.onSurfaceVariant} />
        </View>}
      {item.mediaType === 'video' || item.mediaType === 'gif' ? <View style={styles.mediaBadge}>
        <Text style={styles.overlayText}>{item.mediaType === 'gif' ? 'GIF' : `▶ ${props.durationLabel ?? item.durationLabel ?? t('picker.video')}`}</Text>
      </View> : null}
      {item.dateBadge !== 'known' ? <View style={styles.dateBadge} accessibilityLabel={t(`picker.date.${item.dateBadge}`)}>
        <MaterialCommunityIcons name={item.dateBadge === 'missing' ? 'calendar-question' : 'calendar-clock'} size={18} color="white" />
      </View> : null}
    </Pressable>
    <View style={styles.corner}><SelectionCircle selected={selected} onPress={() => onToggle(item.id)} label={t('picker.selectItem', { name: item.filename })} /></View>
  </View>;
});

export const CompactMediaRow = React.memo(function CompactMediaRow(props: MediaCellProps) {
  const { item, selected, onOpen, onToggle, onStartRange, onRegisterCell, playing, onPlayAudio } = props;
  const { t } = useTranslation();
  const theme = useAppTheme();
  const audio = item.mediaType === 'voice' || item.mediaType === 'audio';
  const held = React.useRef(false);
  const registerRef = React.useCallback((view: View | null) => onRegisterCell(item.id, view), [item.id, onRegisterCell]);
  return <View ref={registerRef} collapsable={false} style={[styles.compact, { borderBottomColor: theme.colors.outlineVariant }]}>
    {audio ? <Pressable onPress={() => onPlayAudio?.(item.id)} style={styles.checkTouch} accessibilityRole="button"
      accessibilityLabel={t(playing ? 'picker.pauseAudio' : 'picker.playAudio', { name: item.filename })}>
      <MaterialCommunityIcons name={playing ? 'pause' : 'play'} size={28} color={theme.colors.primary} />
    </Pressable> : <MaterialCommunityIcons name="file-document-outline" size={28} color={theme.colors.onSurfaceVariant} style={styles.documentIcon} />}
    <Pressable style={styles.rowText} accessibilityRole="button" accessibilityLabel={t('picker.openItem', { name: item.filename, sender: item.sender, date: item.dateLabel })}
      accessibilityState={{ selected }} onPress={() => { if (!held.current) onOpen(item.id); held.current = false; }}
      onPressIn={() => { held.current = false; }} onLongPress={() => { held.current = true; onStartRange(item.id); }} delayLongPress={450}>
      <Text variant="bodyMedium" numberOfLines={1}>{item.filename}</Text>
      <Text variant="bodySmall" numberOfLines={1} style={{ color: theme.colors.onSurfaceVariant }}>
        {item.sender} · {item.dateLabel}{item.dateBadge === 'known' ? '' : ` · ${t(`picker.date.${item.dateBadge}`)}`}
      </Text>
    </Pressable>
    <SelectionCircle selected={selected} onPress={() => onToggle(item.id)} label={t('picker.selectItem', { name: item.filename })} />
  </View>;
});

export const DaySelectionHeader = React.memo(function DaySelectionHeader({ groupKey, label, state, onToggleDay }: DaySelectionHeaderProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return <Pressable onPress={() => onToggleDay(groupKey)} accessibilityRole="checkbox" accessibilityLabel={t('picker.selectDay', { date: label })}
    accessibilityState={{ checked: state === 'some' ? 'mixed' : state === 'all' }}
    style={[styles.dayHeader, { backgroundColor: theme.colors.surface }]}>
    <Text variant="titleSmall" style={styles.dayTitle}>{label}</Text>
    <MaterialCommunityIcons name={state === 'all' ? 'checkbox-marked' : state === 'some' ? 'minus-box' : 'checkbox-blank-outline'} size={24} color={theme.colors.primary} />
  </Pressable>;
});

export const SelectionFooter = React.memo(function SelectionFooter({ selected, total, selectedBytes, unknownSizeCount, state, onToggleAll, onSave }: SelectionFooterProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  return <View style={styles.footer}>
    <Pressable onPress={onToggleAll} disabled={!total} accessibilityRole="checkbox" accessibilityLabel={t('picker.selectFilter')}
      accessibilityState={{ checked: state === 'some' ? 'mixed' : state === 'all', disabled: !total }} style={styles.footerSelect}>
      <MaterialCommunityIcons name={state === 'all' ? 'checkbox-marked' : state === 'some' ? 'minus-box' : 'checkbox-blank-outline'} size={24} color={theme.colors.primary} />
      <Text style={styles.footerCount}>{t('picker.selectionCount', { selected, total })} · {formatSelectionBytes(selectedBytes)}{unknownSizeCount ? ` + ${t('picker.unknownSize', { count: unknownSizeCount })}` : ''}</Text>
    </Pressable>
    <PrimaryButton disabled={!selected} onPress={onSave} icon="content-save-outline">{t('picker.save')}</PrimaryButton>
  </View>;
});

function buildSections(items: readonly MediaCellItem[], columns: number): readonly SelectionSection[] {
  const sections: { key: string; dayKey: string | null; ids: string[]; data: SelectionRow[] }[] = [];
  for (const item of items) {
    let section = sections[sections.length - 1];
    if (!section || section.dayKey !== item.dayKey) {
      section = { key: `${item.dayKey ?? 'missing'}:${item.id}`, dayKey: item.dayKey, ids: [], data: [] };
      sections.push(section);
    }
    section.ids.push(item.id);
    const visual = isVisual(item), previous = section.data[section.data.length - 1];
    if (visual && previous?.visual && previous.items.length < columns) {
      section.data[section.data.length - 1] = { ...previous, items: [...previous.items, item] };
    } else section.data.push({ key: item.id, visual, items: [item] });
  }
  return sections;
}

export function MediaSelectionList(props: MediaSelectionListProps) {
  const { items, selectedIds, thumbnails, columns, width, onOpen, onToggle, playingAudioId, onPlayAudio } = props;
  const { t, i18n } = useTranslation();
  const sections = React.useMemo(() => buildSections(items, columns), [items, columns]);
  const refs = React.useRef(new Map<string, View>());
  const rects = React.useRef(new Map<string, { x: number; y: number; width: number; height: number }>());
  const current = React.useRef(props); current.current = props;
  const sectionRef = React.useRef(sections); sectionRef.current = sections;
  const drag = React.useRef<{ anchor: string; baseline: ReadonlySet<string>; selected: boolean } | null>(null);
  const captured = React.useRef(false);
  const [dragging, setDragging] = React.useState(false);
  React.useEffect(() => { drag.current = null; captured.current = false; setDragging(false); }, [items]);
  const register = React.useCallback((id: string, view: View | null) => { if (view) refs.current.set(id, view); else { refs.current.delete(id); rects.current.delete(id); } }, []);
  const beginRange = React.useCallback((id: string) => {
    const p = current.current;
    drag.current = { anchor: id, baseline: p.selectedIds, selected: !p.selectedIds.has(id) };
    captured.current = false;
    setDragging(true);
    rects.current.clear();
    refs.current.forEach((view, key) => view.measureInWindow((x, y, measuredWidth, height) => { rects.current.set(key, { x, y, width: measuredWidth, height }); }));
    p.onSetSelection(setIdsSelected(p.selectedIds, [id], !p.selectedIds.has(id)));
  }, []);
  const endRange = React.useCallback(() => { drag.current = null; captured.current = false; setDragging(false); }, []);
  const responder = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponderCapture: () => drag.current !== null,
    onPanResponderGrant: () => { captured.current = true; },
    onPanResponderMove: (event) => {
      const operation = drag.current; if (!operation) return;
      const { pageX, pageY } = event.nativeEvent;
      const target = [...rects.current].find(([, r]) => pageX >= r.x && pageX <= r.x + r.width && pageY >= r.y && pageY <= r.y + r.height)?.[0];
      if (target) current.current.onSetSelection(setIdsSelected(operation.baseline,
        rangeIds(current.current.items.map((item) => item.id), operation.anchor, target), operation.selected));
    },
    onPanResponderRelease: endRange, onPanResponderTerminate: endRange,
  }), [endRange]);
  const toggleDay = React.useCallback((key: string) => {
    const group = sectionRef.current.find((section) => section.key === key); if (!group) return;
    const p = current.current;
    p.onSetSelection(setIdsSelected(p.selectedIds, group.ids, selectionState(p.selectedIds, group.ids) !== 'all'));
  }, []);
  const viewability = React.useRef(({ viewableItems }: { viewableItems: ViewToken<SelectionRow>[] }) => {
    current.current.onViewableIds(viewableItems.flatMap((entry) => entry.item?.items?.map((item) => item.id) ?? []));
  }).current;
  const viewabilityConfig = React.useRef({ itemVisiblePercentThreshold: 5 }).current;
  const dayLabel = (key: string | null) => key === null ? t('picker.date.missing')
    : new Intl.DateTimeFormat(i18n.resolvedLanguage ?? 'en', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${key}T12:00:00`));
  return <View style={styles.list} {...responder.panHandlers} onTouchEnd={() => { if (!captured.current) endRange(); }}>
    <SectionList<SelectionRow, SelectionSection> sections={sections} extraData={selectedIds}
      keyExtractor={(row) => row.key} stickySectionHeadersEnabled scrollEnabled={!dragging}
      // Keep the JS render window bounded. Disable native clipping after Fabric
      // child-order failures when empty/date-filtered sections were replaced.
      initialNumToRender={8} maxToRenderPerBatch={8} windowSize={5} removeClippedSubviews={false}
      onViewableItemsChanged={viewability} viewabilityConfig={viewabilityConfig}
      ListEmptyComponent={<Text style={styles.empty}>{t('picker.empty')}</Text>}
      renderSectionHeader={({ section }) => <DaySelectionHeader groupKey={section.key} label={dayLabel(section.dayKey)}
        state={selectionState(selectedIds, section.ids)} onToggleDay={toggleDay} />}
      renderItem={({ item: row }) => <View style={styles.gridRow}>
        {row.items.map((item) => {
          const thumb = thumbnails.get(item.id) ?? noThumbnail;
          const cell = { item, selected: selectedIds.has(item.id), thumbnailUri: thumb.uri, thumbnailStatus: thumb.status,
            width: (width - (columns - 1) * 4) / columns, onOpen, onToggle,
            onStartRange: beginRange, onRegisterCell: register, playing: playingAudioId === item.id, onPlayAudio,
            onThumbnailError: props.onThumbnailError,
            durationLabel: thumb.durationMillis === undefined ? item.durationLabel : `${Math.floor(thumb.durationMillis / 60000)}:${String(Math.floor(thumb.durationMillis / 1000) % 60).padStart(2, '0')}` };
          return row.visual ? <MediaGridCell key={item.id} {...cell} /> : <CompactMediaRow key={item.id} {...cell} />;
        })}
      </View>} />
  </View>;
}

const styles = StyleSheet.create({
  list: { flex: 1 }, gridRow: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  gridCell: { flex: 1, overflow: 'hidden', borderRadius: 16 }, placeholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  corner: { position: 'absolute', top: 0, end: 0 }, checkTouch: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { backgroundColor: '#00000099', borderRadius: 16 }, mediaBadge: { position: 'absolute', bottom: 6, start: 6, backgroundColor: '#000000aa', borderRadius: 4, paddingHorizontal: 4 },
  overlayText: { color: 'white', fontSize: 11 }, dateBadge: { position: 'absolute', bottom: 6, end: 6, backgroundColor: '#000000aa', borderRadius: 4 },
  compact: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 64, borderBottomWidth: StyleSheet.hairlineWidth },
  documentIcon: { marginHorizontal: 10 }, rowText: { flex: 1, justifyContent: 'center' },
  dayHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  dayTitle: { flex: 1, fontWeight: '600' }, footer: { gap: 4 }, footerSelect: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerCount: { flex: 1 }, empty: { textAlign: 'center', padding: 24 },
});
