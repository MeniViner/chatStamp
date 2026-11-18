import React from 'react';
import { Modal, PanResponder, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, Button, IconButton, Text } from 'react-native-paper';
import { Image } from 'expo-image';
import { VideoView, createVideoPlayer, type VideoPlayer } from 'expo-video';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { File } from 'expo-file-system';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../theme/useAppTheme';
import { getThumbnail, openFileInOtherApp, awaitMediaRelease } from '../native/mediaPreviews';
import { VideoLeaseController, type VideoLease } from '../lib/videoLease';
import { formatSelectionBytes, type MediaCellItem } from './MediaSelectionList';

export function useViewerVideoController(): VideoLeaseController {
  const [controller] = React.useState(() => new VideoLeaseController(awaitMediaRelease));
  React.useEffect(() => () => controller.dispose(), [controller]);
  return controller;
}

/** This owner is shared by every inline row and viewer audio page. */
export function useSharedMediaAudio() {
  type Status = Pick<AudioStatus, 'currentTime' | 'duration' | 'playing' | 'isLoaded' | 'playbackState' | 'isBuffering'>;
  const idle: Status = { currentTime: 0, duration: 0, playing: false, isLoaded: false, playbackState: 'idle', isBuffering: false };
  const [status, setStatus] = React.useState<Status>(idle);
  const [activeId, setActiveId] = React.useState<string>();
  const [error, setError] = React.useState(false);
  const active = React.useRef<string | undefined>(undefined);
  const player = React.useRef<AudioPlayer | null>(null);
  const listener = React.useRef<{ remove: () => void } | null>(null);
  const watchdog = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const generation = React.useRef(0), alive = React.useRef(true);
  const stop = React.useCallback(() => { generation.current++; try { player.current?.pause(); } catch { /* A released owner is already stopped. */ } }, []);
  const release = React.useCallback(async () => {
    generation.current++;
    const previous = player.current;
    player.current = null; active.current = undefined;
    listener.current?.remove(); listener.current = null;
    if (watchdog.current) clearTimeout(watchdog.current);
    if (previous) { try { previous.pause(); previous.remove(); } finally { previous.release(); } }
    if (alive.current) { setActiveId(undefined); setStatus({ currentTime: 0, duration: 0, playing: false, isLoaded: false, playbackState: 'idle', isBuffering: false }); }
    await awaitMediaRelease();
  }, []);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; void release().catch(() => undefined); }; }, [release]);
  const play = React.useCallback(async (item: MediaCellItem) => {
    const request = ++generation.current;
    try {
      setError(false);
      if (!player.current) {
        await awaitMediaRelease();
        if (!alive.current || request !== generation.current) return;
        const created = createAudioPlayer(null, { updateInterval: 250 });
        player.current = created;
        listener.current = created.addListener('playbackStatusUpdate', (next) => {
          if (!alive.current || player.current !== created) return;
          setStatus(next);
          if (next.isLoaded && watchdog.current) { clearTimeout(watchdog.current); watchdog.current = null; }
        });
      }
      const owner = player.current;
      if (active.current !== item.id) {
        owner.pause(); owner.replace(item.uri); active.current = item.id; setActiveId(item.id);
        setStatus({ currentTime: 0, duration: 0, playing: false, isLoaded: false, playbackState: 'buffering', isBuffering: true });
        if (watchdog.current) clearTimeout(watchdog.current);
        watchdog.current = setTimeout(() => { if (alive.current && active.current === item.id && !owner.isLoaded) setError(true); }, 10000);
        owner.play();
      } else if (owner.playing) owner.pause();
      else { if (owner.duration > 0 && owner.currentTime >= owner.duration - 0.1) await owner.seekTo(0); owner.play(); }
    } catch { setError(true); }
  }, []);
  return { player: player.current, status, activeId, play, stop, release, error };
}
export type SharedMediaAudio = ReturnType<typeof useSharedMediaAudio>;

type MediaViewerProps = {
  items: readonly MediaCellItem[]; currentId: string | null; selectedIds: ReadonlySet<string>;
  onPage: (id: string) => void; onDismiss: () => void; onToggle: (id: string) => void;
  video: VideoLeaseController; audio: SharedMediaAudio;
};

export function MediaViewer({ items, currentId, selectedIds, onPage, onDismiss, onToggle, video, audio }: MediaViewerProps) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const state = React.useSyncExternalStore(video.subscribe, video.snapshot, video.snapshot);
  const index = items.findIndex((item) => item.id === currentId), item = items[index];
  const zoomed = React.useRef(false);
  const current = React.useRef({ items, index, onPage }); current.current = { items, index, onPage };
  const page = React.useCallback((delta: number) => {
    const p = current.current, next = p.items[p.index + delta]; if (next) p.onPage(next.id);
  }, []);
  const pager = React.useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length === 1 && !zoomed.current && Math.abs(gesture.dx) > 35 && Math.abs(gesture.dy) < 30,
    onPanResponderRelease: (_, gesture) => { if (Math.abs(gesture.dx) > 50) page(gesture.dx < 0 ? 1 : -1); },
  }), [page]);
  React.useEffect(() => { zoomed.current = false; }, [currentId]);
  return <Modal visible={Boolean(item)} animationType="fade" onRequestClose={onDismiss} statusBarTranslucent navigationBarTranslucent>
    {item ? <View style={[styles.viewer, { backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom + 8 }]}>
      <View style={styles.toolbar}>
        <IconButton icon="close" accessibilityLabel={t('common.close')} onPress={onDismiss} />
        <View style={styles.heading}><Text variant="titleMedium">{item.sender}</Text><Text variant="bodySmall">{item.dateLabel}</Text></View>
        <Pressable style={styles.touch} accessibilityRole="checkbox" accessibilityLabel={t('picker.selectItem', { name: item.filename })}
          accessibilityState={{ checked: selectedIds.has(item.id) }} onPress={() => onToggle(item.id)}>
          <Text style={{ fontSize: 26, color: theme.colors.primary }}>{selectedIds.has(item.id) ? '☑' : '☐'}</Text>
        </Pressable>
      </View>
      <Text variant="bodySmall" style={styles.filename}>{item.filename}</Text>
      <View style={styles.page} {...pager.panHandlers}>
        {item.mediaType === 'video' ? (state.failed ? <FileFallback item={item} failed /> : state.mounted
          ? <VideoPlayback key={state.mounted.id} lease={state.mounted} item={item} controller={video} />
          : <ActivityIndicator accessibilityLabel={t('viewer.loading')} />)
          : ['photo', 'gif', 'sticker'].includes(item.mediaType) ? <ZoomImage key={item.id} item={item} onZoom={(value) => { zoomed.current = value; }} />
          : item.mediaType === 'voice' || item.mediaType === 'audio' ? <AudioPlayback item={item} audio={audio} />
          : item.filename.toLowerCase().endsWith('.pdf') ? <PdfPreview key={item.id} item={item} />
          : item.filename.toLowerCase().endsWith('.vcf') ? <ContactPreview key={item.id} item={item} />
          : <FileFallback item={item} />}
      </View>
      <View style={styles.paging}>
        <IconButton icon="chevron-left" accessibilityLabel={t('viewer.previous')} disabled={index <= 0} onPress={() => page(-1)} />
        <Text>{t('viewer.page', { current: index + 1, total: items.length })}</Text>
        <IconButton icon="chevron-right" accessibilityLabel={t('viewer.next')} disabled={index >= items.length - 1} onPress={() => page(1)} />
      </View>
    </View> : null}
  </Modal>;
}

let videoSlotTail: Promise<void> = Promise.resolve();
function reserveVideoSlot() {
  const ready = videoSlotTail;
  let resolve: () => void = () => undefined, reject: (error: unknown) => void = () => undefined;
  videoSlotTail = new Promise<void>((success, failure) => { resolve = success; reject = failure; });
  void videoSlotTail.catch(() => undefined);
  let finished = false;
  return { ready, finish(completion: Promise<void> = Promise.resolve()) {
    if (finished) return; finished = true;
    void Promise.all([ready, completion]).then(() => resolve(), reject);
  } };
}

function VideoPlayback({ lease, item, controller }: { lease: VideoLease; item: MediaCellItem; controller: VideoLeaseController }) {
  const { t } = useTranslation();
  const [player, setPlayer] = React.useState<VideoPlayer | null>(null);
  const [failed, setFailed] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    let cancelled = false, owner: VideoPlayer | null = null, subscription: { remove: () => void } | null = null;
    const slot = reserveVideoSlot();
    void slot.ready.then(() => {
      if (cancelled || !controller.claim(lease.id)) { slot.finish(); return; }
      try {
        const created = createVideoPlayer(lease.uri); owner = created; created.loop = false;
        subscription = created.addListener('statusChange', ({ status }) => { if (!cancelled) { setFailed(status === 'error'); setLoading(status === 'loading'); } });
        setLoading(created.status === 'loading'); setFailed(created.status === 'error'); setPlayer(created);
      }
      catch (error) { setFailed(true); controller.failClosed(); slot.finish(Promise.reject(error)); }
    }, () => { if (!cancelled) controller.failClosed(); slot.finish(); });
    return () => {
      cancelled = true;
      try { subscription?.remove(); } catch { /* Explicit native release still runs if listener removal fails. */ }
      if (owner) {
        let completion: Promise<void>;
        try { owner.release(); completion = awaitMediaRelease(); }
        catch (error) { completion = Promise.reject(error); }
        slot.finish(completion);
        void completion.then(() => controller.didUnmount(lease.id), () => controller.failClosed());
      } else { slot.finish(); controller.didUnmount(lease.id); }
    };
  }, [controller, lease.id, lease.uri]);
  // The useVideoPlayer factory runs during render. Construct after commit instead,
  // and hold the global slot through Android's asynchronous native release.
  return <View style={styles.full}>
    {player ? <VideoView player={player} style={styles.full} nativeControls contentFit="contain" fullscreenOptions={{ enable: false }} allowsPictureInPicture={false} /> : null}
    {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator accessibilityLabel={t('viewer.loading')} /></View> : null}
    {failed ? <FileFallback item={item} failed /> : null}
  </View>;
}

function ZoomImage({ item, onZoom }: { item: MediaCellItem; onZoom: (zoomed: boolean) => void }) {
  const [failed, setFailed] = React.useState(false);
  const [transform, setTransform] = React.useState({ scale: 1, x: 0, y: 0 });
  const state = React.useRef(transform);
  const start = React.useRef({ scale: 1, x: 0, y: 0, distance: 0, dx: 0, dy: 0, touches: 0 });
  const lastTap = React.useRef(0);
  const zoomCallback = React.useRef(onZoom); zoomCallback.current = onZoom;
  const responder = React.useMemo(() => {
    const distance = (touches: readonly { pageX: number; pageY: number }[]) => touches.length < 2 ? 0 : Math.hypot(touches[0].pageX - touches[1].pageX, touches[0].pageY - touches[1].pageY);
    return PanResponder.create({
      onStartShouldSetPanResponder: (event) => event.nativeEvent.touches.length > 1,
      onMoveShouldSetPanResponderCapture: (event, gesture) => event.nativeEvent.touches.length > 1 || (state.current.scale > 1 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5),
      onMoveShouldSetPanResponder: (event, gesture) => event.nativeEvent.touches.length > 1 || (state.current.scale > 1 && Math.abs(gesture.dx) + Math.abs(gesture.dy) > 5),
      onPanResponderGrant: (event, gesture) => {
        start.current = { ...state.current, distance: distance(event.nativeEvent.touches), dx: gesture.dx, dy: gesture.dy, touches: event.nativeEvent.touches.length };
        zoomCallback.current(true);
      },
      onPanResponderMove: (event, gesture) => {
        const span = distance(event.nativeEvent.touches), origin = start.current;
        if (origin.touches !== event.nativeEvent.touches.length) {
          start.current = { ...state.current, distance: span, dx: gesture.dx, dy: gesture.dy, touches: event.nativeEvent.touches.length };
          return;
        }
        const scale = span && origin.distance ? Math.max(1, Math.min(5, origin.scale * span / origin.distance)) : origin.scale;
        const next = { scale, x: scale === 1 ? 0 : Math.max(-600, Math.min(600, origin.x + gesture.dx - origin.dx)), y: scale === 1 ? 0 : Math.max(-800, Math.min(800, origin.y + gesture.dy - origin.dy)) };
        state.current = next; setTransform(next);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: () => zoomCallback.current(state.current.scale > 1),
      onPanResponderTerminate: () => zoomCallback.current(state.current.scale > 1),
    });
  }, []);
  if (failed) return <FileFallback item={item} failed />;
  return <View style={styles.full} {...responder.panHandlers}><Pressable style={styles.full} onPress={() => {
    const now = Date.now();
    if (now - lastTap.current < 300) { const scale = state.current.scale > 1 ? 1 : 2; const next = { scale, x: 0, y: 0 }; state.current = next; setTransform(next); onZoom(scale > 1); }
    lastTap.current = now;
  }}>
    <Image source={{ uri: item.uri }} contentFit="contain" style={[styles.full, { transform: [{ translateX: transform.x }, { translateY: transform.y }, { scale: transform.scale }] }]}
      accessibilityLabel={item.filename} onError={() => { onZoom(false); setFailed(true); }} />
  </Pressable></View>;
}

function clock(seconds: number) { const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0; return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`; }
function AudioPlayback({ item, audio }: { item: MediaCellItem; audio: SharedMediaAudio }) {
  const { t } = useTranslation();
  const { status, activeId, error } = audio;
  const active = activeId === item.id, loaded = active && status.isLoaded;
  const failed = error || (active && status.playbackState === 'error');
  return <View style={styles.audio}>
    <Text variant="titleMedium">{t('picker.voice')}</Text>
    {active && !loaded && !failed ? <ActivityIndicator accessibilityLabel={t('viewer.loading')} /> : null}
    {failed ? <Text accessibilityRole="alert">{t('viewer.audioError')}</Text> : null}
    <Button icon={active && status.playing ? 'pause' : 'play'} onPress={() => audio.play(item)}>{t(active && status.playing ? 'viewer.pause' : 'viewer.play')}</Button>
    <Text>{clock(loaded ? status.currentTime : 0)} / {clock(loaded ? status.duration : 0)}</Text>
    <View style={styles.paging}>
      <Button disabled={!loaded} onPress={() => { void audio.player?.seekTo(Math.max(0, status.currentTime - 10)); }}>{t('viewer.rewind')}</Button>
      <Button disabled={!loaded} onPress={() => { void audio.player?.seekTo(Math.min(status.duration, status.currentTime + 10)); }}>{t('viewer.forward')}</Button>
    </View>
    {loaded ? <Pressable style={styles.seek} accessibilityRole="adjustable" accessibilityLabel={t('viewer.seek')}
      accessibilityValue={{ min: 0, max: status.duration, now: status.currentTime }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={({ nativeEvent }) => { void audio.player?.seekTo(Math.max(0, Math.min(status.duration, status.currentTime + (nativeEvent.actionName === 'increment' ? 10 : -10)))); }}
      onPress={({ nativeEvent }) => { void audio.player?.seekTo(Math.max(0, Math.min(status.duration, nativeEvent.locationX / 260 * status.duration))); }}>
      <View style={[styles.seekFill, { width: `${Math.max(0, Math.min(100, status.currentTime / Math.max(1, status.duration) * 100))}%` }]} />
    </Pressable> : null}
    <FileFallback item={item} failed={failed} />
  </View>;
}

function PdfPreview({ item }: { item: MediaCellItem }) {
  const [uri, setUri] = React.useState<string | null>(null), [loading, setLoading] = React.useState(true);
  React.useEffect(() => { let alive = true; void getThumbnail(item.uri, 512).then((result) => { if (alive) { setUri(result.available ? result.uri : null); setLoading(false); } }, () => { if (alive) setLoading(false); }); return () => { alive = false; }; }, [item.uri]);
  return <View style={styles.full}>{loading ? <ActivityIndicator /> : uri ? <Image source={{ uri }} style={styles.full} contentFit="contain" accessibilityLabel={item.filename} /> : null}<FileFallback item={item} failed={!loading && !uri} /></View>;
}

function ContactPreview({ item }: { item: MediaCellItem }) {
  const [contact, setContact] = React.useState<{ name: string; phone: string } | null>(null);
  React.useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const file = new File(item.uri); if (!file.exists || file.size > 65536) return;
        const text = (await file.text()).replace(/\r?\n[ \t]/g, '');
        const name = text.match(/^FN(?:;[^:]*)?:(.*)$/im)?.[1]?.trim() ?? '';
        const phone = text.match(/^TEL(?:;[^:]*)?:(.*)$/im)?.[1]?.trim() ?? '';
        if (alive && (name || phone)) setContact({ name: name.replace(/\\n/g, '\n').replace(/\\([,;\\])/g, '$1'), phone });
      } catch { /* The metadata fallback remains available. */ }
    })();
    return () => { alive = false; };
  }, [item.uri]);
  return <View style={styles.audio}>{contact ? <><Text variant="headlineSmall">{contact.name}</Text><Text selectable>{contact.phone}</Text></> : null}<FileFallback item={item} /></View>;
}

function FileFallback({ item, failed = false }: { item: MediaCellItem; failed?: boolean }) {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [message, setMessage] = React.useState<string>();
  return <View style={[styles.fileCard, { backgroundColor: theme.colors.surfaceVariant }]}>
    {failed ? <Text>{t('viewer.previewUnavailable')}</Text> : null}
    <Text variant="titleSmall">{item.filename}</Text>
    <Text>{t(`media.singular.${item.mediaType}`)} · {item.sizeBytes === undefined ? t('picker.unknownSize', { count: 1 }) : formatSelectionBytes(item.sizeBytes)}</Text>
    <Button icon="open-in-new" onPress={() => { void openFileInOtherApp({ uri: item.uri, filename: item.filename }).then((result) => {
      if (!result.opened) setMessage(t(`viewer.external.${result.reason}`));
    }, () => setMessage(t('viewer.external.launch-failed'))); }}>{t('viewer.openExternal')}</Button>
    {message ? <Text accessibilityRole="alert">{message}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  viewer: { flex: 1, minHeight: 0 }, toolbar: { minHeight: 64, flexShrink: 0, flexDirection: 'row', alignItems: 'center' }, heading: { flex: 1 }, touch: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  filename: { paddingHorizontal: 16, paddingBottom: 8 }, page: { flex: 1, overflow: 'hidden', justifyContent: 'center' }, full: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, justifyContent: 'center' }, paging: { minHeight: 56, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  audio: { alignItems: 'center', padding: 16, gap: 12 }, fileCard: { margin: 16, padding: 16, borderRadius: 16, gap: 8 },
  seek: { width: 260, minHeight: 48, justifyContent: 'center', backgroundColor: '#80808044', borderRadius: 16, overflow: 'hidden' },
  seekFill: { height: 8, backgroundColor: '#af7653' },
});
