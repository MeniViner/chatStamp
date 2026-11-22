import React from 'react';
import TestRenderer, { act, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '../src/components/ConfirmDialog';

vi.mock('react-native', () => ({ ScrollView: 'ScrollView', StyleSheet: { create: <T,>(styles: T) => styles } }));
vi.mock('../src/components/AppUi', () => ({ textStyles: { start: {} }, surfaceRoles: () => ({ raised: '#eee' }) }));
vi.mock('../src/theme/useAppTheme', () => ({ useAppTheme: () => ({ colors: { surface: '#fff', error: '#900', primary: '#123' } }) }));
vi.mock('react-native-paper', async () => {
  const { createElement } = await import('react');
  const Dialog = Object.assign(({ children, ...props }: { children?: React.ReactNode }) => createElement('Dialog', props, children),
    { Title: 'DialogTitle', Content: 'DialogContent', Actions: 'DialogActions' });
  return { Dialog, Portal: 'Portal', Text: 'Text', Button: 'Button' };
});
const env = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
const previous = env.IS_REACT_ACT_ENVIRONMENT;
const renderers: ReactTestRenderer[] = [];
beforeAll(() => { env.IS_REACT_ACT_ENVIRONMENT = true; });
afterAll(() => { if (previous === undefined) delete env.IS_REACT_ACT_ENVIRONMENT; else env.IS_REACT_ACT_ENVIRONMENT = previous; });
afterEach(async () => { await act(async () => renderers.splice(0).forEach((renderer) => renderer.unmount())); });

describe('real confirmation busy controls', () => {
  it('disables both actions plus native backdrop/Back dismissal while committed, then unlocks after failure', async () => {
    const confirm = vi.fn(), dismiss = vi.fn();
    const tree = (busy: boolean) => React.createElement(ConfirmDialog, { visible: true, busy, title: 'Restart', body: 'Synthetic', confirmLabel: 'Now', cancelLabel: 'Later', onConfirm: confirm, onDismiss: dismiss });
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = TestRenderer.create(tree(true)); renderers.push(renderer); });
    const dialog = () => renderer.root.findByType('Dialog' as React.ElementType);
    const buttons = () => renderer.root.findAllByType('Button' as React.ElementType);
    expect(dialog().props).toMatchObject({ dismissable: false, dismissableBackButton: false });
    expect(buttons().every((button) => button.props.disabled && button.props.onPress === undefined)).toBe(true);
    await act(async () => dialog().props.onDismiss()); expect(dismiss).not.toHaveBeenCalled();
    await act(async () => renderer.update(tree(false)));
    expect(dialog().props).toMatchObject({ dismissable: true, dismissableBackButton: true });
    expect(buttons().every((button) => button.props.disabled === false && typeof button.props.onPress === 'function')).toBe(true);
    await act(async () => { buttons()[0].props.onPress(); buttons()[1].props.onPress(); });
    expect(dismiss).toHaveBeenCalledOnce(); expect(confirm).toHaveBeenCalledOnce();
    expect(buttons().every((button) => button.props.contentStyle.minHeight >= 48)).toBe(true);
    expect(buttons()[1].props).toMatchObject({ mode: 'text', textColor: '#123' });
    await act(async () => renderer.update(React.createElement(ConfirmDialog, { visible: true, destructive: true, title: 'Clear', body: 'Synthetic',
      confirmLabel: 'Clear', cancelLabel: 'Cancel', onConfirm: confirm, onDismiss: dismiss })));
    expect(buttons()[1].props).toMatchObject({ mode: 'text', textColor: '#900' });
  });
});
