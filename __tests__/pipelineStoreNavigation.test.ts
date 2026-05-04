import { beforeEach, describe, expect, it } from 'vitest';
import { usePipelineStore } from '../src/store/pipelineStore';

describe('pipelineStore overlay navigation', () => {
  beforeEach(() => {
    usePipelineStore.getState().reset();
  });

  it('returns from settings to the previous in-app screen', () => {
    usePipelineStore.getState().setStage('selectFiles');
    usePipelineStore.getState().openOverlayStage('settings');

    expect(usePipelineStore.getState().stage).toBe('settings');

    usePipelineStore.getState().closeOverlayStage('welcome');
    expect(usePipelineStore.getState().stage).toBe('selectFiles');
  });

  it('returns from history to the import root when opened from root', () => {
    usePipelineStore.getState().openOverlayStage('history');
    expect(usePipelineStore.getState().stage).toBe('history');

    usePipelineStore.getState().closeOverlayStage('welcome');
    expect(usePipelineStore.getState().stage).toBe('welcome');
  });
});
