import { Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-pageComponent/landing-pageComponent';
import { DashboardMainComponent } from './components/dashboard-main/dashboard-main';
import { DashboardHomeComponent } from './components/dashboard-main/dashboard-home';
import { ClienteComponent } from './components/cliente-component/cliente-component';
import { CitacionesIaComponent } from './components/citaciones-ia-component/citaciones-ia-component';
import { UsuarioComponent } from './components/usuario-component/usuario-component';
import { UsuarioInsertComponent } from './components/usuario-component/usuario-insert/usuario-insert';
import { UsuarioLoginComponent } from './components/usuario-component/usuario-login/usuario-login';
import { GestionUsuariosComponent } from './components/gestion-usuarios/gestion-usuarios';
import { RolComponent } from './components/rol-component/rol-component';
import { NotFoundComponent } from './components/errors/not-found/not-found';
import { authGuard } from './services/auth.guard';
import { adminGuard } from './services/admin.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'landing', pathMatch: 'full' },
  { path: 'landing', component: LandingPageComponent },
  {
    path: '', component: DashboardMainComponent, canActivate: [authGuard], children: [
      { path: 'dashboard', component: DashboardHomeComponent },
      { path: 'clientes', component: ClienteComponent },
      {
        path: 'expedientes',
        loadComponent: () =>
          import('./components/expediente-component/expediente-component').then((m) => m.ExpedienteComponent),
      },
      {
        path: 'documentos',
        loadComponent: () =>
          import('./components/documento-component/documento-component').then((m) => m.DocumentoComponent),
      },
      {
        path: 'documentos/:documentId/fragmentos',
        loadComponent: () =>
          import('./components/documento-chunk-component/documento-chunk-component').then(
            (m) => m.DocumentoChunkComponent,
          ),
      },
      {
        path: 'chat-ia',
        loadComponent: () =>
          import('./components/chat-ia-component/chat-ia-component').then((m) => m.ChatIaComponent),
      },
      {
        path: 'borradores',
        loadComponent: () => import('./components/borrador-component/borrador-component').then((module) => module.BorradorComponent),
      },
      {
        path: 'resumenes',
        loadComponent: () => import('./components/resumen-component/resumen-component').then((module) => module.ResumenComponent),
      },
      { path: 'citaciones-ia', component: CitacionesIaComponent },
      // Sprint 4: módulo Reportes (HU-134 a HU-143), cada reporte en su propio chunk.
      {
        path: 'reportes',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./components/reportes-component/reportes-component').then((m) => m.ReportesComponent),
          },
          {
            path: 'sesiones-por-expediente',
            loadComponent: () =>
              import('./components/reportes-component/sesiones-por-expediente/sesiones-por-expediente').then(
                (m) => m.SesionesPorExpedienteComponent,
              ),
          },
          {
            path: 'documentos-por-cliente',
            loadComponent: () =>
              import('./components/reportes-component/documentos-por-cliente/documentos-por-cliente').then(
                (m) => m.DocumentosPorClienteComponent,
              ),
          },
          {
            path: 'expedientes-abiertos-por-abogado',
            loadComponent: () =>
              import(
                './components/reportes-component/expedientes-abiertos-por-abogado/expedientes-abiertos-por-abogado'
              ).then((m) => m.ExpedientesAbiertosPorAbogadoComponent),
          },
          {
            path: 'borradores-por-estado',
            loadComponent: () =>
              import('./components/reportes-component/borradores-por-estado/borradores-por-estado').then(
                (m) => m.BorradoresPorEstadoComponent,
              ),
          },
          {
            path: 'resumenes-por-tipo',
            loadComponent: () =>
              import('./components/reportes-component/resumenes-por-tipo/resumenes-por-tipo').then(
                (m) => m.ResumenesPorTipoComponent,
              ),
          },
          {
            path: 'expedientes-por-estado',
            loadComponent: () =>
              import('./components/reportes-component/expedientes-por-estado/expedientes-por-estado').then(
                (m) => m.ExpedientesPorEstadoComponent,
              ),
          },
          {
            path: 'documentos-pendientes',
            loadComponent: () =>
              import('./components/reportes-component/documentos-pendientes/documentos-pendientes').then(
                (m) => m.DocumentosPendientesComponent,
              ),
          },
          {
            path: 'expedientes-de-cliente',
            loadComponent: () =>
              import('./components/reportes-component/expedientes-de-cliente/expedientes-de-cliente').then(
                (m) => m.ExpedientesDeClienteComponent,
              ),
          },
          {
            path: 'actividad-chat',
            loadComponent: () =>
              import('./components/reportes-component/actividad-chat/actividad-chat').then(
                (m) => m.ActividadChatComponent,
              ),
          },
          {
            path: 'auditoria-por-accion',
            canActivate: [adminGuard],
            loadComponent: () =>
              import('./components/reportes-component/auditoria-por-accion/auditoria-por-accion').then(
                (m) => m.AuditoriaPorAccionComponent,
              ),
          },
        ],
      },
      { path: 'gestionusuarios', component: GestionUsuariosComponent, canActivate: [adminGuard] },
      { path: 'roles', component: RolComponent, canActivate: [adminGuard] },
      {
        path: 'auditoria',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./components/auditoria-component/auditoria-component').then(
            (m) => m.AuditoriaComponent,
          ),
      },
    ],
  },
  {
    path: 'usuarios', component: UsuarioComponent, children: [
      { path: 'registrar', component: UsuarioInsertComponent },
      { path: 'login', component: UsuarioLoginComponent },
    ],
  },
  { path: '**', component: NotFoundComponent },
];
