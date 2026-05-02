import { describe, expect, it } from 'vitest';
import { classifyMedia } from '../src/lib/mediaClassifier';

describe('classifyMedia', () => {
  it.each([
    ['IMG-20260429-WA0030.jpg', 'photo'],
    ['IMG-20260429-WA0030.jpeg', 'photo'],
    ['VID-20260429-WA0039.mp4', 'video'],
    ['PTT-20251222-WA0089.opus', 'voice'],
    ['AUD-20251222-WA0001.opus', 'voice'],
    ['random.opus', 'voice'],
    ['STK-20260429-WA0001.webp', 'sticker'],
    ['anything.webp', 'sticker'],
    ['סמל2.pdf', 'document'],
    ['contact.vcf', 'document']
  ] as const)('%s => %s', (filename, expected) => {
    expect(classifyMedia(filename)).toBe(expected);
  });
});
