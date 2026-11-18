import { TestBed } from '@angular/core/testing';
import { LEGAL_THEME, LegalThemeMusicService, noteToFrequency } from './legal-theme-music.service';
import { MusicToggleComponent } from '../shared/i18n/music-toggle';

/** AudioContext mínimo para jsdom: registra cuántas notas se programan. */
function fakeAudio() {
  const started: number[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const node = () => {
    const n: Record<string, unknown> = {
      gain: param(),
      frequency: param(),
      delayTime: param(),
      type: '',
      start: (t: number) => started.push(t),
      stop: vi.fn(),
      disconnect: vi.fn(),
    };
    n['connect'] = (target: unknown) => target;
    return n;
  };
  class FakeAudioContext {
    currentTime = 0;
    state = 'running';
    destination = node();
    resume = vi.fn();
    createGain = node;
    createOscillator = node;
    createBiquadFilter = node;
    createDelay = node;
  }
  return { FakeAudioContext, started };
}

describe('Marcha de la Justicia (melodía original)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('convierte notas a frecuencias con temperamento igual', () => {
    expect(noteToFrequency('A4')).toBeCloseTo(440, 5);
    expect(noteToFrequency('A3')).toBeCloseTo(220, 5);
    expect(noteToFrequency('D4')).toBeCloseTo(293.66, 1);
    expect(() => noteToFrequency('H9')).toThrow();
  });

  it('tiene 8 compases de 4 tiempos y una armonía por medio compás', () => {
    expect(LEGAL_THEME.beats).toBe(32);
    expect(LEGAL_THEME.chords).toHaveLength(16);
    expect(LEGAL_THEME.melody.at(-2)?.[0]).toBe('D4'); // termina en la tónica (Re)
  });

  it('no hace nada si el navegador no tiene Web Audio', () => {
    vi.stubGlobal('AudioContext', undefined);
    TestBed.configureTestingModule({});
    const music = TestBed.inject(LegalThemeMusicService);
    expect(music.supported).toBe(false);
    expect(music.toggle()).toBe(false);
  });

  it('suena solo al pulsar, programa la pieza completa y se detiene', () => {
    vi.useFakeTimers();
    const { FakeAudioContext, started } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    TestBed.configureTestingModule({});
    const music = TestBed.inject(LegalThemeMusicService);
    expect(music.playing()).toBe(false);
    expect(started).toHaveLength(0);
    expect(music.toggle()).toBe(true);
    const notes = LEGAL_THEME.melody.filter(([pitch]) => pitch).length;
    // melodía (+ vibrato) + 16 acordes × (3 notas + bajo + timbal)
    expect(started.length).toBe(notes * 2 + 16 * 5);
    expect(music.toggle()).toBe(false);
    vi.runAllTimers();
    expect(music.playing()).toBe(false);
  });

  it('el botón 🎵 alterna aria-pressed y anuncia el estado', async () => {
    const { FakeAudioContext } = fakeAudio();
    vi.stubGlobal('AudioContext', FakeAudioContext);
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(MusicToggleComponent);
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.textContent).toContain('Sonando: Marcha de la Justicia');
    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});
