import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
  { path: '', loadComponent: () => import('./core/layout/main-layout/main-layout.component').then((m) => m.MainLayoutComponent), children: [
    { path: '', pathMatch: 'full', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
    ...[
      ['clientes', 'Clientes', 'Gestión y seguimiento de clientes.'], ['expedientes', 'Expedientes', 'Organización de asuntos y procesos legales.'], ['documentos', 'Documentos', 'Repositorio central de documentos legales.'], ['chat-ia', 'Asistente IA', 'Espacio para asistencia legal inteligente.'], ['borradores', 'Borradores', 'Creación y revisión de documentos en borrador.'], ['resumenes', 'Resúmenes', 'Síntesis y consulta de información jurídica.'], ['citaciones-ia', 'Citaciones IA', 'Apoyo inteligente para citaciones legales.'], ['usuarios', 'Usuarios', 'Administración de usuarios de la plataforma.'], ['roles', 'Roles', 'Configuración de roles y permisos.'], ['auditoria', 'Auditoría', 'Registro y consulta de actividad del sistema.'],
    ].map(([path, title, description]) => ({ path, data: { title, description }, loadComponent: () => import('./shared/components/placeholder-page.component').then((m) => m.PlaceholderPageComponent) })),
  ] },
  { path: '**', loadComponent: () => import('./shared/components/not-found.component').then((m) => m.NotFoundComponent) },
];
