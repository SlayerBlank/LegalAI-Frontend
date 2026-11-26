import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LoginService } from '../../services/login-service';
import { countBy, countByKeys, invalidRange } from './report-state';
import { REPORTS } from './report-catalog';
import { ReportesComponent } from './reportes-component';

describe('ReportesComponent (índice del Sprint 4)', () => {
  beforeEach(() => {
    localStorage.removeItem('legalai-language');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  function mount(roleName: string) {
    TestBed.inject(LoginService).currentUser.set({
      userId: 1,
      roleId: 1,
      roleName,
      fullName: 'Ana',
      email: 'ana@example.com',
      status: 'ACTIVE',
      createdAt: '',
      updatedAt: '',
    });
    const f = TestBed.createComponent(ReportesComponent);
    f.detectChanges();
    return f;
  }

  it('ADMIN ve las 10 tarjetas, con títulos que empiezan por "Visualizar"', () => {
    const f = mount('ADMIN');
    const cards = f.nativeElement.querySelectorAll('.report-card');
    expect(cards.length).toBe(10);
    const titles = Array.from(f.nativeElement.querySelectorAll('.card-title')).map((el) =>
      (el as HTMLElement).textContent!.trim(),
    );
    expect(titles.every((t) => t.startsWith('Visualizar reporte'))).toBe(true);
    expect(f.nativeElement.querySelector('a[href="/auditoria-por-accion"]')).not.toBeNull();
  });

  it('sin rol ADMIN se oculta la tarjeta de auditoría (HU-143 CA-03)', () => {
    const f = mount('USER');
    expect(f.nativeElement.querySelectorAll('.report-card').length).toBe(9);
    expect(f.nativeElement.textContent).not.toContain('HU-143');
  });

  it('el catálogo cubre HU-134 a HU-143 con rutas únicas', () => {
    expect(REPORTS.map((r) => r.hu)).toEqual(
      Array.from({ length: 10 }, (_, i) => `HU-${134 + i}`),
    );
    expect(new Set(REPORTS.map((r) => r.slug)).size).toBe(10);
  });
});

describe('Utilidades de agrupación de reportes', () => {
  it('countBy ordena de mayor a menor y desempata por etiqueta', () => {
    expect(countBy(['b', 'a', 'b', 'c', 'a', 'b'], (x) => x)).toEqual([
      { key: 'b', label: 'b', count: 3 },
      { key: 'a', label: 'a', count: 2 },
      { key: 'c', label: 'c', count: 1 },
    ]);
  });

  it('countByKeys respeta el orden fijo e incluye ceros', () => {
    expect(countByKeys(['X', 'Z'], ['X', 'Y', 'Z'], (x) => x, (k) => k.toLowerCase())).toEqual([
      { key: 'X', label: 'x', count: 1 },
      { key: 'Y', label: 'y', count: 0 },
      { key: 'Z', label: 'z', count: 1 },
    ]);
  });

  it('invalidRange solo falla con ambas fechas y la inicial posterior', () => {
    expect(invalidRange('2026-02-01', '2026-01-01')).toBe(true);
    expect(invalidRange('2026-01-01', '2026-01-01')).toBe(false);
    expect(invalidRange('2026-02-01', '')).toBe(false);
  });
});
