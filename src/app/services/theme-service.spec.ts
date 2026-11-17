import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme-service';

describe('Existing ThemeService: light, dark and system compatibility', () => {
  let media: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
  };
  let change: () => void;
  beforeEach(() => {
    localStorage.removeItem('legalai-theme');
    media = {
      matches: false,
      addEventListener: vi.fn((_type, listener) => (change = listener)),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => media),
    );
    TestBed.configureTestingModule({});
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    localStorage.removeItem('legalai-theme');
    vi.unstubAllGlobals();
    delete document.documentElement.dataset['theme'];
  });
  it('keeps previously saved light/dark values with the same storage key', () => {
    localStorage.setItem('legalai-theme', 'dark');
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('dark');
    expect(theme.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    media.matches = false;
    change();
    expect(theme.theme()).toBe('dark');
  });
  it('defaults to the actual system appearance when there is no explicit choice', () => {
    media.matches = true;
    const theme = TestBed.inject(ThemeService);
    expect(theme.preference()).toBe('system');
    expect(theme.theme()).toBe('dark');
    expect(localStorage.getItem('legalai-theme')).toBeNull();
  });
  it('reacts to system changes without reloading', () => {
    const theme = TestBed.inject(ThemeService);
    media.matches = true;
    change();
    expect(theme.theme()).toBe('dark');
    expect(document.documentElement.dataset['theme']).toBe('dark');
    media.matches = false;
    change();
    expect(theme.theme()).toBe('light');
  });
  it('switches back to system by clearing the existing preference', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setTheme('light');
    media.matches = true;
    theme.setPreference('system');
    expect(localStorage.getItem('legalai-theme')).toBeNull();
    expect(theme.preference()).toBe('system');
    expect(theme.theme()).toBe('dark');
  });
  it('keeps explicit choices stable when the system changes', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setPreference('light');
    media.matches = true;
    change();
    expect(theme.theme()).toBe('light');
    expect(localStorage.getItem('legalai-theme')).toBe('light');
  });
  it('preserves the existing toggle and setTheme API used by login and navbar', () => {
    const theme = TestBed.inject(ThemeService);
    theme.setTheme('dark');
    theme.toggle();
    expect(theme.theme()).toBe('light');
    expect(theme.preference()).toBe('light');
    expect(localStorage.getItem('legalai-theme')).toBe('light');
  });
  it('removes its media query listener when destroyed', () => {
    TestBed.inject(ThemeService);
    TestBed.resetTestingModule();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', change);
  });
});
