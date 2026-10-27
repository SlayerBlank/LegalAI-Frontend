import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
export type Theme = 'light' | 'dark';
@Injectable({ providedIn:'root' })
export class ThemeService { private readonly document=inject(DOCUMENT); private readonly storageKey='legalai-theme'; readonly theme=signal<Theme>(this.initialTheme()); constructor(){this.apply(this.theme());} toggle():void{this.setTheme(this.theme()==='light'?'dark':'light');} setTheme(theme:Theme):void{this.theme.set(theme);localStorage.setItem(this.storageKey,theme);this.apply(theme);} private initialTheme():Theme{const saved=localStorage.getItem(this.storageKey);if(saved==='light'||saved==='dark')return saved;return this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';} private apply(theme:Theme):void{this.document.documentElement.dataset['theme']=theme;} }
