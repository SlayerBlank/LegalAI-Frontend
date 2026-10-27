import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
@Component({ selector:'app-not-found', imports:[RouterLink], template:`<main class="not-found"><div class="code">404</div><h1>Página no encontrada</h1><p>La ruta solicitada no existe.</p><a routerLink="/">Volver al inicio</a></main>`, styles:[`.not-found{min-height:100dvh;display:grid;place-content:center;text-align:center;padding:2rem}.code{font-size:5rem;font-weight:800;color:var(--primary)}h1{margin:.5rem 0}p{color:var(--muted)}a{color:var(--primary);font-weight:600;text-decoration:none}`] })
export class NotFoundComponent {}
