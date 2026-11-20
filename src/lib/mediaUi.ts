import type { MediaType } from '../types/media';

const visibleMediaTypes: MediaType[] = ['photo', 'video', 'voice', 'audio', 'sticker', 'gif', 'document'];

export function isSaveableMediaType(mediaType: MediaType): boolean {
  return visibleMediaTypes.includes(mediaType);
}
