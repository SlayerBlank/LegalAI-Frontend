import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { authGuard } from './auth.guard';
import { jwtInterceptor } from './jwt.interceptor';
import { LoginService } from './login-service';

/** HU-133 – Cerrar sesión (CA-01, CA-02 y CA-03). */
describe('HU-133 cerrar sesión', () => {
  let http: HttpTestingController;
  let login: LoginService;
  let router: Router;

  const runGuard = (url: string) =>
    TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    ) as Observable<boolean | UrlTree>;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    login = TestBed.inject(LoginService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    sessionStorage.setItem(
      'legalai-session',
      JSON.stringify({ tokenType: 'Bearer', accessToken: 'token-activo' }),
    );
    login.currentUser.set({ userId: 7 } as never);
    login.state.set('authenticated');
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('CA-01: elimina el token y los datos del usuario y redirige al login', () => {
    login.logout();
    expect(login.getAccessToken()).toBeNull();
    expect(login.currentUser()).toBeNull();
    expect(login.state()).toBe('anonymous');
    expect(router.navigate).toHaveBeenCalledWith(['/usuarios/login']);
  });

  it('CA-02: authGuard bloquea las rutas internas tras el cierre (Atrás o URL directa)', async () => {
    expect(await firstValueFrom(runGuard('/documentos'))).toBe(true);
    login.logout();
    const result = await firstValueFrom(runGuard('/documentos'));
    expect(result instanceof UrlTree).toBe(true);
    expect(router.serializeUrl(result as UrlTree)).toBe('/usuarios/login?returnUrl=%2Fdocumentos');
  });

  it('CA-03: las solicitudes a la API ya no envían el token', () => {
    const client = TestBed.inject(HttpClient);
    client.get('/api/cases').subscribe();
    expect(http.expectOne('/api/cases').request.headers.get('Authorization')).toBe(
      'Bearer token-activo',
    );
    login.logout();
    client.get('/api/cases').subscribe();
    expect(http.expectOne('/api/cases').request.headers.has('Authorization')).toBe(false);
  });
});
