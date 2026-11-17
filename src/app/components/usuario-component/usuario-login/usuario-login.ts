import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, PRIMARY_OUTLET, Router, RouterLink } from '@angular/router';
import { LoginService } from '../../../services/login-service';
import { ThemeService } from '../../../services/theme-service';
import { NavigationHistoryService } from '../../../services/navigation-history.service';
import { PublicAuthFrame } from '../../../shared/public-auth/public-auth-frame';
import { LoginRequest } from '../../../models/request/login-request';

@Component({
  selector: 'app-usuario-login',
  imports: [ReactiveFormsModule, RouterLink, PublicAuthFrame],
  templateUrl: './usuario-login.html',
  styleUrls: ['../../../shared/public-auth/public-form.css', './usuario-login.css'],
})
export class UsuarioLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly loginService = inject(LoginService);
  private readonly navigationHistory = inject(NavigationHistoryService);
  readonly theme = inject(ThemeService);
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  private readonly cd = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute);
  get passwordBytes(): number {
    return new TextEncoder().encode(this.form.controls.password.value).length;
  }
  showPassword = false;
  loading = false;
  message = '';
  goBack(): void {
    this.navigationHistory.goBack();
  }
  submit(): void {
    if (this.loading) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading = true;
    this.message = '';
    const request: LoginRequest = this.form.getRawValue();
    this.loginService.login(request).subscribe({
      next: () => {
        this.loading = false;
        this.cd.markForCheck();
        void this.router.navigateByUrl(this.destination());
      },
      error: (error: unknown) => {
        this.loading = false;
        this.message = this.loginService.errorMessage(error, 'No fue posible iniciar sesión.');
        this.cd.markForCheck();
      },
    });
  }
  private destination(): string {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    if (!requested || !requested.startsWith('/') || requested.startsWith('//')) return '/dashboard';
    try {
      const tree = this.router.parseUrl(requested);
      const segments = tree.root.children[PRIMARY_OUTLET]?.segments;
      const known = this.router.config.some(
        (r) =>
          r.path === '' &&
          r.canActivate?.length &&
          r.children?.some((child) => child.path === segments?.[0]?.path),
      );
      return known && segments?.length === 1 && Object.keys(tree.root.children).length === 1
        ? requested
        : '/dashboard';
    } catch {
      return '/dashboard';
    }
  }
}
