import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

/** Guard funcional: verifica sesión vía /me; sin sesión → /signin. Deny-by-default. */
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const profile = await auth.me();
  return profile ? true : router.createUrlTree(['/signin']);
};
