import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
@Component({ selector:'app-main-layout', imports:[RouterOutlet,HeaderComponent,SidebarComponent], template:`<div class="app-shell"><app-sidebar [isOpen]="sidebarOpen" (closed)="sidebarOpen=false"/><div class="app-content"><app-header (menuRequested)="sidebarOpen=!sidebarOpen"/><main><router-outlet/></main></div></div>`, styles:[`.app-shell{display:flex;min-height:100dvh}.app-content{flex:1;min-width:0}main{padding:2rem;max-width:1440px;margin:0 auto}@media(max-width:720px){main{padding:1rem}}`] })
export class MainLayoutComponent { sidebarOpen=false; }
