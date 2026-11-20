import { vi } from 'vitest';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialogConfig } from '@angular/material/dialog';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BorradorComponent } from './components/borrador-component/borrador-component';
import { ResumenComponent } from './components/resumen-component/resumen-component';

const now = '2026-11-20T10:00:00';
const draft = {
  draftId: 1,
  caseId: 7,
  title: 'Demanda',
  status: 'Borrador',
  prompt: null,
  content: 'Hechos',
  updatedAt: now,
};
const summary = {
  summaryId: 2,
  caseId: null,
  documentId: 9,
  summaryType: 'Contrato',
  content: 'Texto',
  createdAt: now,
};

function button(root: ParentNode, label: string) {
  return Array.from(root.querySelectorAll('button')).find(
    (item) => item.textContent.trim() === label,
  )!;
}
function enter(element: HTMLInputElement | HTMLTextAreaElement, value: string) {
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
}
function selectFirst(element: HTMLSelectElement) {
  element.selectedIndex = 1;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
function filter(fixture: ComponentFixture<unknown>, name: string, value: string) {
  const root = (fixture.nativeElement as HTMLElement).querySelector('app-record-filter')!;
  selectFirst(root.querySelector('select')!);
  enter(root.querySelector('input[name=value]')!, value);
  enter(root.querySelector('input[name=from]')!, '2026-11-01');
  enter(root.querySelector('input[name=to]')!, '2026-11-30');
  root
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const request = TestBed.inject(HttpTestingController).expectOne((request) =>
    request.url.endsWith('/filter'),
  );
  expect(request.request.params.get('caseId')).toBe('7');
  expect(request.request.params.get(name)).toBe(value);
  for (const param of name === 'status'
    ? ['updatedFrom', 'updatedTo']
    : ['createdFrom', 'createdTo']) {
    expect(request.request.params.has(param)).toBe(true);
  }
  return request;
}

describe('Borradores y Resúmenes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: MAT_DIALOG_DEFAULT_OPTIONS,
          useValue: {
            ...new MatDialogConfig(),
            enterAnimationDuration: 0,
            exitAnimationDuration: 0,
          },
        },
      ],
    });
  });
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('permite filtrar por estado y por una sola fecha sin expedientes disponibles', async () => {
    const fixture = TestBed.createComponent(BorradorComponent);
    const http = TestBed.inject(HttpTestingController);
    const root = fixture.nativeElement as HTMLElement;
    http
      .expectOne('/api/drafts')
      .flush([draft, { ...draft, draftId: 2, title: 'Otra demanda', status: 'Revisado' }]);
    http.expectOne('/api/cases').flush([]);
    await fixture.whenStable();

    const form = root.querySelector('app-record-filter form')!;
    const caseSelect = form.querySelector('select')!;
    const status = form.querySelector<HTMLInputElement>('input[name=value]')!;
    const from = form.querySelector<HTMLInputElement>('input[name=from]')!;
    expect(caseSelect.disabled).toBe(true);
    expect(status.matches(':disabled')).toBe(false);
    expect(from.matches(':disabled')).toBe(false);

    enter(status, 'Revisado');
    enter(from, '2026-11-20');
    button(form, 'Aplicar').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('.record-card')).toHaveLength(1);
    expect(root.querySelector('.record-card')?.textContent).toContain('Otra demanda');

    enter(from, '2026-11-21');
    button(form, 'Aplicar').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('.record-card')).toHaveLength(0);

    button(form, 'Limpiar').click();
    await fixture.whenStable();
    expect(root.querySelectorAll('.record-card')).toHaveLength(2);
  });

  it('registra, abre, revisa, filtra y elimina un borrador', async () => {
    const fixture = TestBed.createComponent(BorradorComponent);
    const http = TestBed.inject(HttpTestingController);
    const root = fixture.nativeElement as HTMLElement;
    http.expectOne('/api/drafts').flush([]);
    http.expectOne('/api/cases').flush([{ caseId: 7, title: 'Prueba' }]);
    await fixture.whenStable();
    button(root, '+ Nuevo borrador').click();
    await fixture.whenStable();
    const form = root.querySelector('form[novalidate]:has([formcontrolname=title])')!;
    selectFirst(form.querySelector('select')!);
    enter(form.querySelector('input[formcontrolname=title]')!, draft.title);
    enter(form.querySelector('textarea[formcontrolname=content]')!, draft.content);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const create = http.expectOne({ method: 'POST', url: '/api/drafts' });
    expect(create.request.body).toEqual({
      caseId: 7,
      title: 'Demanda',
      status: 'Borrador',
      content: 'Hechos',
      prompt: null,
    });
    create.flush(draft);
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('.record-card')!.click();
    http.expectOne('/api/drafts/1').flush(draft);
    await fixture.whenStable();
    button(root, 'Marcar revisado').click();
    const update = http.expectOne({ method: 'PUT', url: '/api/drafts/1' });
    expect(update.request.body.status).toBe('Revisado');
    update.flush({ ...draft, status: 'Revisado' });
    await fixture.whenStable();
    filter(fixture, 'status', 'Revisado').flush([{ draftId: 1 }]);
    await fixture.whenStable();
    expect(root.querySelector('.record-card')?.textContent).toContain('Revisado');
    button(root, 'Eliminar').click();
    await fixture.whenStable();
    button(document.body.querySelector('mat-dialog-container')!, 'Eliminar').click();
    await vi.waitFor(() => expect(document.body.querySelector('mat-dialog-container')).toBeNull());
    await fixture.whenStable();
    http.expectOne({ method: 'DELETE', url: '/api/drafts/1' }).flush(null);
    await fixture.whenStable();
    expect(root.textContent).toContain('Borrador eliminado.');
  });

  it('preserva un resumen vinculado solamente a un documento y filtra por tipo y fechas', async () => {
    const fixture = TestBed.createComponent(ResumenComponent);
    const http = TestBed.inject(HttpTestingController);
    const root = fixture.nativeElement as HTMLElement;
    http.expectOne('/api/summaries').flush([summary]);
    http.expectOne('/api/cases').flush([{ caseId: 7, title: 'Prueba' }]);
    await fixture.whenStable();
    const filters = root.querySelector('app-record-filter')!;
    selectFirst(filters.querySelector('select')!);
    button(filters, 'Aplicar').click();
    http
      .expectOne('/api/cases/7/documents')
      .flush([{ documentId: 9, caseId: 7, fileName: 'contrato.pdf' }]);
    await fixture.whenStable();
    expect(root.querySelector('.record-card')?.textContent).toContain('Contrato');
    button(filters, 'Limpiar').click();
    await fixture.whenStable();
    root.querySelector<HTMLButtonElement>('.record-card')!.click();
    http.expectOne('/api/summaries/2').flush(summary);
    http
      .expectOne('/api/documents/9')
      .flush({ documentId: 9, caseId: 7, fileName: 'contrato.pdf' });
    await fixture.whenStable();
    expect(root.textContent).toContain('contrato.pdf');
    const form = root.querySelector('form[novalidate]:has([formcontrolname=summaryType])')!;
    enter(form.querySelector('textarea')!, 'Síntesis actualizada');
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const update = http.expectOne({ method: 'PUT', url: '/api/summaries/2' });
    expect(update.request.body).toEqual({
      caseId: null,
      documentId: 9,
      summaryType: 'Contrato',
      content: 'Síntesis actualizada',
    });
    update.flush({ ...summary, content: 'Síntesis actualizada' });
    http
      .expectOne('/api/documents/9')
      .flush({ documentId: 9, caseId: 7, fileName: 'contrato.pdf' });
    await fixture.whenStable();
    filter(fixture, 'summaryType', 'Contrato').flush([]);
    await fixture.whenStable();
    expect(root.textContent).toContain('No hay resúmenes para esos filtros.');
    button(root.querySelector('app-record-filter')!, 'Limpiar').click();
    button(root, '+ Nuevo resumen').click();
    await fixture.whenStable();
    const createForm = root.querySelector('form[novalidate]:has([formcontrolname=summaryType])')!;
    selectFirst(createForm.querySelector('select[formcontrolname=caseId]')!);
    http
      .expectOne('/api/cases/7/documents')
      .flush([{ documentId: 9, caseId: 7, fileName: 'contrato.pdf' }]);
    await fixture.whenStable();
    selectFirst(createForm.querySelector('select[formcontrolname=documentId]')!);
    enter(createForm.querySelector('input[formcontrolname=summaryType]')!, 'Ejecutivo');
    enter(createForm.querySelector('textarea')!, 'Una síntesis');
    createForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const request = http.expectOne({ method: 'POST', url: '/api/summaries' });
    expect(request.request.body).toEqual({
      caseId: 7,
      documentId: 9,
      summaryType: 'Ejecutivo',
      content: 'Una síntesis',
    });
    request.flush({ ...summary, ...request.request.body, summaryId: 3 });
    http
      .expectOne('/api/cases/7/documents')
      .flush([{ documentId: 9, caseId: 7, fileName: 'contrato.pdf' }]);
    await fixture.whenStable();
    button(root, 'Eliminar').click();
    await fixture.whenStable();
    button(document.body.querySelector('mat-dialog-container')!, 'Eliminar').click();
    await vi.waitFor(() => expect(document.body.querySelector('mat-dialog-container')).toBeNull());
    await fixture.whenStable();
    http.expectOne({ method: 'DELETE', url: '/api/summaries/3' }).flush(null);
    await fixture.whenStable();
    expect(root.textContent).toContain('Resumen eliminado.');
  });
});
