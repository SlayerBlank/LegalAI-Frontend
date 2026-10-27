import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { LoginService } from './login-service';
export const authGuard: CanActivateFn = (_route, state) => { const login=inject(LoginService); const router=inject(Router); return login.ensureSession().pipe(map((authenticated)=>authenticated||router.createUrlTree(['/usuarios/login'],{queryParams:{returnUrl:state.url}}))); };
