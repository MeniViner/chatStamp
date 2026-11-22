import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ListItem, OptionChoiceCard } from '../src/components/AppUi';

vi.mock('react-native', () => ({
  View: 'View', Pressable: 'Pressable', StatusBar: 'StatusBar', I18nManager: { isRTL: false },
  StyleSheet: { create: <T,>(styles: T) => styles, hairlineWidth: 1 }
}));
vi.mock('react-native-paper', () => ({
  Text: 'Text', RadioButton: 'RadioButton', Switch: 'Switch', Button: 'Button', Appbar: 'Appbar', ProgressBar: 'ProgressBar'
}));
vi.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView', useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
vi.mock('../src/native/mediaPreviews', () => ({ getThumbnail: vi.fn(), invalidateThumbnail: vi.fn() }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: new Proxy<Record<string, string>>({}, { get: () => '#123456' }) }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const host = (name: string) => name as React.ElementType;
const renderers: ReactTestRenderer[] = [];
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

async function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  await act(async () => { renderer = TestRenderer.create(element); renderers.push(renderer); });
  return renderer;
}
const flatten = (style: unknown): Record<string, unknown> => Array.isArray(style)
  ? Object.assign({}, ...style.map(flatten)) : (style && typeof style === 'object' ? style as Record<string, unknown> : {});
const resolveStyle = (node: ReactTestInstance) => flatten(typeof node.props.style === 'function' ? node.props.style({ pressed: false }) : node.props.style);
const isAncestor = (ancestor: ReactTestInstance, node: ReactTestInstance) => {
  for (let current = node.parent; current; current = current.parent) if (current === ancestor) return true;
  return false;
};
const textOf = (node: ReactTestInstance) => node.findAllByType(host('Text')).map((text) => text.props.children).flat().join(' ');

describe('shared ListItem keeps a pressable row as one accessible element', () => {
  it.each([true, false])('exposes OptionChoiceCard as a radio with checked=%s even with a badge and a details toggle', async (selected) => {
    const onPress = vi.fn();
    const renderer = await render(React.createElement(OptionChoiceCard, {
      title: 'Keep both', description: 'Adds a suffix', selected, badge: 'Recommended', technicalDetail: '/storage/emulated/0/Pictures', onPress
    }));
    const pressables = renderer.root.findAllByType(host('Pressable'));
    const row = pressables.find((node) => node.props.accessibilityRole === 'radio');
    expect(row).toBeDefined();
    const radio = row!;
    expect(radio.props.accessible).not.toBe(false);
    expect(radio.props.accessibilityLabel).toBe('Keep both, Adds a suffix');
    expect(radio.props.accessibilityState).toMatchObject({ checked: selected });
    expect(resolveStyle(radio).minHeight).toBeGreaterThanOrEqual(48);
    await act(async () => radio.props.onPress());
    expect(onPress).toHaveBeenCalledOnce();

    const toggle = pressables.find((node) => node !== radio && node.props.accessibilityRole === 'button');
    expect(toggle).toBeDefined();
    // The extras are siblings of the row, never nested inside its single accessible element.
    expect(isAncestor(radio, toggle!)).toBe(false);
    expect(isAncestor(toggle!, radio)).toBe(false);
    const badge = renderer.root.findAllByType(host('Text')).find((node) => node.props.children === 'Recommended');
    expect(badge).toBeDefined();
    expect(isAncestor(radio, badge!)).toBe(false);
    expect(textOf(radio)).not.toContain('Recommended');
    expect(textOf(radio)).not.toContain('common.showTechnicalDetails');
  });

  it('gives the technical-details toggle an expanded state and a 48dp target', async () => {
    const renderer = await render(React.createElement(OptionChoiceCard, {
      title: 'Custom folder', selected: false, technicalDetail: 'content://tree/synthetic', onPress: vi.fn()
    }));
    const toggle = () => renderer.root.findAllByType(host('Pressable')).find((node) => node.props.accessibilityRole === 'button')!;
    expect(toggle().props.accessibilityState).toMatchObject({ expanded: false });
    expect(resolveStyle(toggle()).minHeight).toBeGreaterThanOrEqual(48);
    expect(textOf(toggle())).toContain('common.showTechnicalDetails');
    expect(JSON.stringify(renderer.toJSON())).not.toContain('content://tree/synthetic');
    await act(async () => toggle().props.onPress());
    expect(toggle().props.accessibilityState).toMatchObject({ expanded: true });
    expect(textOf(toggle())).toContain('common.hideTechnicalDetails');
    expect(JSON.stringify(renderer.toJSON())).toContain('content://tree/synthetic');
  });

  it('keeps a plain pressable ListItem with children as one labelled element with the extras outside it', async () => {
    const renderer = await render(React.createElement(ListItem, {
      title: 'Saving', description: 'Folder and duplicates', onPress: vi.fn(), accessibilityRole: 'button', disabled: false
    }, React.createElement(host('Text'), { accessibilityRole: 'text' }, 'Extra line')));
    const [row] = renderer.root.findAllByType(host('Pressable'));
    expect(row.props).toMatchObject({ accessibilityRole: 'button', accessibilityLabel: 'Saving, Folder and duplicates' });
    expect(row.props.accessibilityState).toMatchObject({ disabled: false });
    expect(resolveStyle(row).minHeight).toBeGreaterThanOrEqual(48);
    expect(textOf(row)).not.toContain('Extra line');
    expect(textOf(renderer.root)).toContain('Extra line');
  });
});
