import { Routes } from '@angular/router';
import { LandingPageComponent } from './components/landing-pageComponent/landing-pageComponent';
import { DashboardMainComponent } from './components/dashboard-main/dashboard-main';
import { DashboardHomeComponent } from './components/dashboard-main/dashboard-home';
import { ClienteComponent } from './components/cliente-component/cliente-component';
import { ExpedienteComponent } from './components/expediente-component/expediente-component';
import { DocumentoComponent } from './components/documento-component/documento-component';
import { ChatIaComponent } from './components/chat-ia-component/chat-ia-component';
import { BorradorComponent } from './components/borrador-component/borrador-component';
import { ResumenComponent } from './components/resumen-component/resumen-component';
import { CitacionesIaComponent } from './components/citaciones-ia-component/citaciones-ia-component';
import { UsuarioComponent } from './components/usuario-component/usuario-component';
import { UsuarioInsertComponent } from './components/usuario-component/usuario-insert/usuario-insert';
import { UsuarioLoginComponent } from './components/usuario-component/usuario-login/usuario-login';
import { RolComponent } from './components/rol-component/rol-component';
import { AuditoriaComponent } from './components/auditoria-component/auditoria-component';
import { NotFoundComponent } from './components/errors/not-found/not-found';

export const routes: Routes = [
  { path: '', redirectTo: 'landing', pathMatch: 'full' },
  { path: 'landing', component: LandingPageComponent },
  {
    path: '', component: DashboardMainComponent, children: [
      { path: 'dashboard', component: DashboardHomeComponent },
      { path: 'clientes', component: ClienteComponent },
      { path: 'expedientes', component: ExpedienteComponent },
      { path: 'documentos', component: DocumentoComponent },
      { path: 'chat-ia', component: ChatIaComponent },
      { path: 'borradores', component: BorradorComponent },
      { path: 'resumenes', component: ResumenComponent },
      { path: 'citaciones-ia', component: CitacionesIaComponent },
      { path: 'gestionusuarios', component: UsuarioComponent },
      { path: 'roles', component: RolComponent },
      { path: 'auditoria', component: AuditoriaComponent },
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
