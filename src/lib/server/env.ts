/**
 * Server-side environment variables.
 * Importera BARA från server-kontext (middleware, API routes, SSR).
 *
 * Schemat definieras i astro.config.mjs. Astro validerar vid första åtkomst:
 * saknas PORTAL_SERVICE_USER/PASSWORD failar requesten med EnvInvalidVariables
 * i stället för att tyst falla tillbaka på gäst-åtkomst.
 *
 * PORTAL_SERVICE_PASSWORD är markerad som secret och läses från process.env
 * vid runtime. Den får aldrig gå via import.meta.env: Vite ersätter den vid
 * build och lösenordet hamnar då i klartext i dist/.
 *
 * ETERNA_API_URL är secret av samma tekniska skäl — inte för att den är
 * känslig, utan för att access: 'public' hade bakat in buildtidsvärdet i
 * dist/ och gjort den omöjlig att sätta med docker run -e.
 */

export {
  ETERNA_API_URL,
  PORTAL_SERVICE_USER,
  PORTAL_SERVICE_PASSWORD,
} from 'astro:env/server';
