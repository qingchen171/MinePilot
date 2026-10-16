import { describe, expect, it, vi } from 'vitest';
import { createPageAudio, type SoundHandle, type SoundKind } from '../../../src/audio/page-audio';

const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function deferred() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe('S5-08 page-lifetime audio', () => {
  it('stops an expired asynchronous music handle without stopping a newer handle', async () => {
    const old = deferred();
    const handles: { kind: SoundKind | 'music'; stop: ReturnType<typeof vi.fn> }[] = [];
    const factory = (kind: SoundKind | 'music'): SoundHandle => {
      const stop = vi.fn(); handles.push({ kind, stop });
      return { play: () => handles.length === 1 ? old.promise : Promise.resolve(), stop };
    };
    const audio = createPageAudio(factory);
    audio.adoptSettings({ musicEnabled: true, soundEffectsEnabled: false });
    audio.gesture(); await tick();
    expect(handles).toHaveLength(1);
    audio.adoptSettings({ musicEnabled: false, soundEffectsEnabled: false });
    expect(handles[0]!.stop).toHaveBeenCalled();
    audio.adoptSettings({ musicEnabled: true, soundEffectsEnabled: false }); await tick();
    expect(handles).toHaveLength(2);
    old.resolve(); await tick();
    expect(handles[0]!.stop).toHaveBeenCalled();
    expect(handles[1]!.stop).not.toHaveBeenCalled();
    audio.dispose();
  });
  it('invalidates old sound on dirty, hidden, Recovery and dispose; rejected autoplay changes no authority', async () => {
    const pending = deferred();
    const stop = vi.fn();
    const audio = createPageAudio(() => ({ play: () => pending.promise, stop }));
    audio.adoptSettings({ musicEnabled: false, soundEffectsEnabled: true });
    audio.playCue('reward'); await tick();
    audio.setAuthorityClean(false); expect(stop).toHaveBeenCalled();
    pending.reject(new Error('autoplay denied')); await tick();
    audio.playCue('victory'); expect(stop).toHaveBeenCalledTimes(2);
    audio.setAuthorityClean(true); audio.setVisible(false); audio.playCue('victory');
    audio.setVisible(true); audio.setRecovery(true); audio.playCue('victory');
    audio.dispose();
  });
  it('bounds one-shot voices and never queues excess sounds', async () => {
    const handles: ReturnType<typeof vi.fn>[] = [];
    const audio = createPageAudio(() => { const stop = vi.fn(); handles.push(stop);
      return { play: () => new Promise<void>(() => {}), stop }; });
    audio.adoptSettings({ musicEnabled: false, soundEffectsEnabled: true });
    for (let i = 0; i < 9; i++) audio.playCue('move');
    await tick(); expect(handles).toHaveLength(3);
    audio.dispose(); expect(handles.every((stop) => stop.mock.calls.length === 1)).toBe(true);
  });
});
