import { DOCUMENT } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  effect,
  afterNextRender,
  Injector,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavbarComponent } from './navbar-component/navbar-component';
import { SidebarComponent } from './sidebar-component/sidebar-component';
@Component({
  selector: 'app-dashboard-main',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, SidebarComponent],
  templateUrl: './dashboard-main.html',
  styleUrl: './dashboard-main.css',
})
export class DashboardMainComponent {
  private readonly injector = inject(Injector);
  private readonly document = inject(DOCUMENT);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly media = this.document.defaultView?.matchMedia?.('(max-width: 1100px)');
  readonly compact = signal(this.media?.matches ?? false);
  readonly sidebarOpen = signal(false);
  constructor() {
    const destroy = inject(DestroyRef);
    let locked = false;
    let previousOverflow = '';
    const unlock = () => {
      if (locked) {
        this.document.body.style.overflow = previousOverflow;
        locked = false;
      }
    };
    effect(() => {
      if (this.compact() && this.sidebarOpen()) {
        if (!locked) {
          previousOverflow = this.document.body.style.overflow;
          this.document.body.style.overflow = 'hidden';
          locked = true;
        }
      } else unlock();
    });
    const resize = () => {
      this.compact.set(this.media?.matches ?? false);
      if (!this.compact()) this.sidebarOpen.set(false);
    };
    this.media?.addEventListener?.('change', resize);
    destroy.onDestroy(() => {
      this.media?.removeEventListener?.('change', resize);
      unlock();
    });
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationEnd && this.sidebarOpen()) this.closeSidebar();
      });
  }
  toggleSidebar(): void {
    if (this.sidebarOpen()) this.closeSidebar();
    else this.sidebarOpen.set(true);
  }
  @HostListener('document:keydown.escape') closeSidebar(): void {
    const wasOpen = this.sidebarOpen();
    this.sidebarOpen.set(false);
    if (wasOpen && this.compact()) {
      afterNextRender(
        () => {
          if (!this.sidebarOpen() && this.compact())
            this.element.nativeElement.querySelector<HTMLButtonElement>('.menu-trigger')?.focus();
        },
        { injector: this.injector },
      );
    }
  }
}
