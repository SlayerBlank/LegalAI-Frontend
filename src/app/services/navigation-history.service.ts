import { Injectable, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavigationHistoryService {
  private readonly router = inject(Router);
  private currentUrl = this.router.url;
  private previousUrl: string | null = null;

  constructor() {
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.previousUrl = this.currentUrl;
      this.currentUrl = event.urlAfterRedirects;
    });
  }

  goBack(fallback = '/landing'): void {
    const previous = this.previousUrl;
    if (previous && this.isSafePublicUrl(previous)) {
      void this.router.navigateByUrl(previous);
      return;
    }
    void this.router.navigateByUrl(fallback);
  }

  private isSafePublicUrl(url: string): boolean {
    const path = url.split('?')[0].split('#')[0];
    return ['/landing', '/usuarios/login', '/usuarios/registrar'].includes(path);
  }
}
