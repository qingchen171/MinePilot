/** Page-lifetime audio only; Settings arrive from the committed public projection. */
export type SoundKind = 'move' | 'flag' | 'detection' | 'airplane' | 'revive' | 'lucky' |
  'benben' | 'reward' | 'pending' | 'failure' | 'victory' | 'item' | 'saved';
export interface SoundHandle { play(): Promise<void>; stop(): void }
export type SoundFactory = (kind: SoundKind | 'music') => SoundHandle;
export interface AudioSettings { readonly musicEnabled: boolean; readonly soundEffectsEnabled: boolean }

/** The handle, not a shared channel, is stopped when an old play promise settles late. */
export function createPageAudio(factory: SoundFactory) {
  let settings: AudioSettings = { musicEnabled: false, soundEffectsEnabled: false };
  let visible = true;
  let clean = true;
  let recovery = false;
  let gesture = false;
  let disposed = false;
  let generation = 0;
  let music: { token: number; handle: SoundHandle } | null = null;
  const voices: { token: number; handle: SoundHandle }[] = [];
  const MUSIC = () => !disposed && visible && clean && !recovery && gesture && settings.musicEnabled;
  const SFX = () => !disposed && visible && clean && !recovery && settings.soundEffectsEnabled;
  const stopMusic = () => { music?.handle.stop(); music = null; generation += 1; };
  const stopVoices = () => { for (const voice of voices.splice(0)) voice.handle.stop(); generation += 1; };
  const syncMusic = () => {
    if (!MUSIC()) { stopMusic(); return; }
    if (music !== null) return;
    let handle: SoundHandle;
    try { handle = factory('music'); } catch { return; }
    const token = ++generation;
    music = { token, handle };
    void Promise.resolve().then(() => handle.play()).then(() => {
      if (music?.token !== token || !MUSIC()) handle.stop();
    }, () => { if (music?.token === token) music = null; handle.stop(); });
  };
  return Object.freeze({
    adoptSettings(next: AudioSettings) {
      settings = { musicEnabled: next.musicEnabled === true, soundEffectsEnabled: next.soundEffectsEnabled === true };
      if (!SFX()) stopVoices();
      syncMusic();
    },
    gesture() { gesture = true; syncMusic(); },
    setVisible(value: boolean) { visible = value; if (!value) stopVoices(); syncMusic(); },
    setAuthorityClean(value: boolean) { clean = value; if (!value) stopVoices(); syncMusic(); },
    setRecovery(value: boolean) { recovery = value; if (value) stopVoices(); syncMusic(); },
    playCue(kind: SoundKind) {
      if (!SFX()) return;
      // Bounded, non-queued voices. One call per committed operation, not per Reward entry.
      if (voices.length >= 3) return;
      let handle: SoundHandle;
      try { handle = factory(kind); } catch { return; }
      const token = ++generation;
      const voice = { token, handle };
      voices.push(voice);
      void Promise.resolve().then(() => handle.play()).then(() => {
        if (!voices.includes(voice) || !SFX()) { handle.stop(); return; }
        setTimeout(() => { handle.stop(); const index = voices.indexOf(voice);
          if (index >= 0) voices.splice(index, 1); }, 350);
      }, () => { handle.stop();
        const index = voices.indexOf(voice);
        if (index >= 0) voices.splice(index, 1);
      });
    },
    dispose() { disposed = true; stopMusic(); stopVoices(); },
  });
}

/** Self-generated oscillator placeholders; no external or paid audio assets. */
export function createBrowserSoundFactory(): SoundFactory {
  let context: AudioContext | null = null;
  const frequencies: Record<SoundKind | 'music', number> = {
    music: 196, move: 392, flag: 330, detection: 523, airplane: 587,
    revive: 440, lucky: 659, benben: 494, reward: 784, pending: 262,
    failure: 220, victory: 880, item: 523, saved: 392,
  };
  return (kind) => {
    let stopped = false;
    let oscillator: OscillatorNode | null = null;
    let gain: GainNode | null = null;
    return {
      async play() {
        if (stopped) return;
        context ??= new AudioContext();
        const owningContext = context;
        await owningContext.resume();
        if (stopped) return;
        oscillator = owningContext.createOscillator();
        gain = owningContext.createGain();
        oscillator.type = kind === 'music' ? 'sine' : 'triangle';
        oscillator.frequency.value = frequencies[kind];
        gain.gain.value = kind === 'music' ? .012 : .045;
        oscillator.connect(gain).connect(owningContext.destination);
        oscillator.start();
        if (kind !== 'music') {
          gain.gain.setTargetAtTime(0, owningContext.currentTime + .06, .055);
          oscillator.stop(owningContext.currentTime + .28);
        }
      },
      stop() {
        stopped = true;
        try { oscillator?.stop(); } catch { /* Already ended. */ }
        oscillator?.disconnect(); gain?.disconnect();
      },
    };
  };
}
