import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ChatSession } from '../../../models/chat-ia';
import { CaseResponse } from '../../../models/expediente';
import { ChatIaService } from '../../../services/chat-ia-service';
import { ExpedienteService } from '../../../services/expediente-service';
import { I18nService } from '../../../services/i18n.service';
import { I18N_PIPES } from '../../../shared/i18n/i18n.pipes';
import { ReportChartComponent } from '../report-chart/report-chart';
import { ReportShellComponent } from '../report-shell/report-shell';
import { ReportQuery, ReportRow, dayOf, formatDay, isoDay } from '../report-state';
import { ReportTableComponent } from '../report-table/report-table';

/** Máximo de días que se completan con cero para que la línea no salte días sin actividad. */
const MAX_FILLED_DAYS = 366;

/** Cantidad de sesiones por día de última actividad (updatedAt o, si falta, createdAt). */
export function sessionsPerDay(sessions: readonly ChatSession[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const day = dayOf(session.updatedAt ?? session.createdAt);
    if (day) counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return counts;
}

/** Días consecutivos entre el primero y el último con actividad, con cero en los vacíos. */
export function fillDays(counts: Map<string, number>): [string, number][] {
  const days = [...counts.keys()].sort();
  if (!days.length) return [];
  const [y, m, d] = days[0].split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const filled: [string, number][] = [];
  for (let i = 0; i <= MAX_FILLED_DAYS; i++) {
    const day = isoDay(start, i);
    filled.push([day, counts.get(day) ?? 0]);
    if (day >= days[days.length - 1]) return filled;
  }
  // Rango demasiado largo: solo los días con actividad.
  return days.map((day) => [day, counts.get(day)!]);
}

/** HU-142: actividad de sesiones de chat por día, con filtro por expediente (consume HU-69). */
@Component({
  selector: 'app-reporte-actividad-chat',
  standalone: true,
  imports: [
    FormsModule,
    ReportShellComponent,
    ReportChartComponent,
    ReportTableComponent,
    ...I18N_PIPES,
  ],
  templateUrl: './actividad-chat.html',
  styleUrls: ['../report-common.css', './actividad-chat.css'],
})
export class ActividadChatComponent {
  private readonly chat = inject(ChatIaService);
  private readonly casesApi = inject(ExpedienteService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly query = new ReportQuery<ChatSession>(this.destroyRef);
  readonly cases = signal<CaseResponse[]>([]);
  readonly caseId = signal<number | null>(null);

  /** Serie del gráfico, en orden cronológico. */
  readonly series = computed<ReportRow[]>(() => {
    const locale = this.i18n.locale();
    return fillDays(sessionsPerDay(this.query.data())).map(([day, count]) => ({
      key: day,
      label: formatDay(day, locale),
      count,
    }));
  });

  /** Tabla: solo días con actividad, del más reciente al más antiguo. */
  readonly activeDays = computed(() =>
    this.series()
      .filter((row) => row.count > 0)
      .reverse(),
  );

  constructor() {
    this.casesApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (cases) => this.cases.set(cases ?? []), error: () => this.cases.set([]) });
    this.apply();
  }

  apply(): void {
    const caseId = this.caseId();
    this.query.run(() => this.chat.listAllSessions(caseId));
  }
}
