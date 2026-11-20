import React from 'react';
import { getThumbnail, invalidateThumbnail } from '../native/mediaPreviews';
import type { MediaCellItem, ThumbnailState } from './MediaSelectionList';
const emptyIds: readonly string[] = [];
const emptyThumbnails: ReadonlyMap<string, ThumbnailState> = new Map();

/** Request only the visible window; native code owns identity validation and LRU bounds. */
export function useMediaThumbnails(items: readonly MediaCellItem[]) {
  const [visibleWindow, setVisibleWindow] = React.useState<{ items: readonly MediaCellItem[]; ids: readonly string[] }>({ items, ids: emptyIds });
  const visibleIds = visibleWindow.items === items ? visibleWindow.ids : emptyIds;
  const [thumbnails, setThumbnails] = React.useState<ReadonlyMap<string, ThumbnailState>>(new Map());
  const thumbnailItems = React.useRef(items);
  const shownThumbnails = thumbnailItems.current === items ? thumbnails : emptyThumbnails;
  const byId = React.useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);
  const current = React.useRef({ byId, thumbnails: shownThumbnails, items }); current.current = { byId, thumbnails: shownThumbnails, items };
  const attempts = React.useRef(new Map<string, number>());
  const generation = React.useRef(0);
  const onViewableIds = React.useCallback((ids: readonly string[]) => {
    setVisibleWindow((window) => {
      const old = window.items === current.current.items ? window.ids : emptyIds;
      const oldSet = new Set(old), visible = new Set(ids);
      attempts.current.forEach((_, id) => { if (!visible.has(id)) attempts.current.delete(id); });
      ids.forEach((id) => { if (!oldSet.has(id)) attempts.current.delete(id); });
      return window.items === current.current.items && old.length === ids.length && old.every((id, index) => id === ids[index])
        ? window : { items: current.current.items, ids: ids.slice(0, 64) };
    });
  }, []);
  React.useEffect(() => { const operation = ++generation.current; attempts.current.clear(); thumbnailItems.current = items; setThumbnails((old) => old.size ? new Map() : old); return () => { generation.current = operation + 1; }; }, [items]);
  const onThumbnailError = React.useCallback((id: string) => {
    const item = current.current.byId.get(id), previous = current.current.thumbnails.get(id);
    if (!item) return;
    const count = attempts.current.get(id) ?? 0;
    attempts.current.set(id, count + 1);
    setThumbnails((old) => new Map(old).set(id, { uri: null, status: count >= 1 ? 'unavailable' : 'loading' }));
    if (count >= 1) return;
    const operation = generation.current;
    void (async () => {
      try {
        if (previous?.uri) await invalidateThumbnail(previous.uri);
        const result = await getThumbnail(item.uri, 256);
        if (operation !== generation.current) return;
        setThumbnails((old) => new Map(old).set(id, result.available
          ? { uri: result.uri, status: 'ready', durationMillis: result.durationMillis }
          : { uri: null, status: 'unavailable' }));
      } catch { if (operation === generation.current) setThumbnails((old) => new Map(old).set(id, { uri: null, status: 'unavailable' })); }
    })();
  }, []);
  React.useEffect(() => {
    let alive = true, next = 0;
    const queue = [...new Set(visibleIds.length ? visibleIds : items.slice(0, 24).map((item) => item.id))]
      .map((id) => byId.get(id)).filter((item): item is MediaCellItem => Boolean(item && (['photo', 'video', 'gif', 'sticker'].includes(item.mediaType) || item.filename.toLowerCase().endsWith('.pdf'))));
    async function work() {
      while (alive && next < queue.length) {
        const item = queue[next++];
        try {
          const result = await getThumbnail(item.uri, 256);
          if (alive) setThumbnails((old) => {
            const value: ThumbnailState = result.available ? { uri: result.uri, status: 'ready', durationMillis: result.durationMillis } : { uri: null, status: 'unavailable' };
            const previous = old.get(item.id);
            if (previous?.uri === value.uri && previous.status === value.status && previous.durationMillis === value.durationMillis) return old;
            return new Map(old).set(item.id, value);
          });
        } catch { if (alive) setThumbnails((old) => new Map(old).set(item.id, { uri: null, status: 'unavailable' })); }
      }
    }
    void work(); void work();
    return () => { alive = false; };
  }, [byId, items, visibleIds]);
  return { thumbnails: shownThumbnails, onViewableIds, onThumbnailError };
}
