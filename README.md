# LegalAI Frontend

Placeholder visual y estructural para la plataforma de gestión legal LegalAI. Incluye Landing pública, formularios provisionales de Login/Registro y una SPA administrativa preparada para crecer sin implementar todavía autenticación real ni lógica de negocio.

## Tecnologías y requisitos

- Angular 22.2.3 con Standalone Components.
- TypeScript estricto, HTML y SCSS.
- Angular Router, Signals y componentes nativos.
- Angular Reactive Forms y HttpClient preparado.
- Node.js 24.16.0 o compatible con Angular 22.
- npm 11.13.0 o compatible.

## Instalación y ejecución

```bash
npm ci
npm start
```

La aplicación estará disponible en `http://localhost:4200/`.

Para compilar:

```bash
npm run build -- --configuration production
```

## Render Static Site

El [Blueprint](./render.yaml) utiliza Node.js `24.16.0` y publica
`dist/legalai-frontend/browser`. En una configuración manual, usa
`npm ci --include=dev && npm run build -- --configuration production` y
agrega una regla **Rewrite** de `/*` a `/index.html` para Angular Router.

La compilación de producción llama a `https://legalai-arqweb-01eb.up.railway.app/api`.
Spring Boot debe permitir por CORS el origen HTTPS que Render asigne al sitio
y cualquier dominio personalizado que se use. Las solicitudes preflight
`OPTIONS` deben admitir los encabezados `Authorization` y `Content-Type`
y los métodos `GET`, `POST`, `PUT`, `PATCH` y `DELETE`. En desarrollo,
el navegador llama a `http://localhost:4200/api` y el proxy reenvía a
`http://localhost:8080/api` con el encabezado `Origin: http://localhost:5173`
definido en el proxy existente.

## Estructura

```text
src/app/
├── components/        # Componentes organizados por módulo
│   ├── dashboard-main/ # Layout administrativo, navbar y sidebar
│   ├── usuario-component/ # Gestión, login y registro provisional
│   ├── landing-pageComponent/
│   └── <modulo>-component/
├── models/            # dtos/, request/ y response/ para Swagger futuro
├── services/          # Servicios esqueleto por módulo y tema
├── core/, features/, shared/ # Compatibilidad temporal de la implementación previa
└── app.routes.ts, app.config.ts, app.ts, app.html, app.css
```

Los módulos funcionales usan `PlaceholderPageComponent` mientras el equipo define sus contratos con el Swagger real del backend.

## Rutas disponibles

`/` redirige a `/landing`; también están disponibles `/dashboard`, `/clientes`, `/expedientes`, `/documentos`, `/chat-ia`, `/borradores`, `/resumenes`, `/citaciones-ia`, `/gestionusuarios`, `/roles`, `/auditoria`, `/usuarios/registrar`, `/usuarios/login` y `/**`. Landing, Login y Registro son públicos; las rutas internas están protegidas por `authGuard` y comparten el layout administrativo.

## Reportes (Sprint 4)

Módulo con lazy loading dentro del layout protegido por `authGuard`. Cada reporte tiene gráfico (Chart.js con `ng2-charts`), estados de carga, vacío y error con reintento, y una tabla con los datos. Los colores salen de los tokens `--chart-1` a `--chart-8` de `src/styles.scss` (tema claro y oscuro).

| Ruta | HU | Endpoint |
|---|---|---|
| `/reportes` | Índice | — |
| `/reportes/sesiones-por-expediente` | HU-134 | `GET /api/cases/chat-session-count` |
| `/reportes/documentos-por-cliente` | HU-135 | `GET /api/clients/document-count` |
| `/reportes/expedientes-abiertos-por-abogado` | HU-136 | `GET /api/cases/open-with-lawyer` |
| `/reportes/borradores-por-estado` | HU-137 | `GET /api/drafts` y `GET /api/drafts/filter` |
| `/reportes/resumenes-por-tipo` | HU-138 | `GET /api/summaries` y `GET /api/summaries/filter` |
| `/reportes/expedientes-por-estado` | HU-139 | `GET /api/cases?openedFrom&openedTo` |
| `/reportes/documentos-pendientes` | HU-140 | `GET /api/documents/pending-review/{abogadoId}` |
| `/reportes/expedientes-de-cliente` | HU-141 | `GET /api/clients/{clientId}/cases/filter` |
| `/reportes/actividad-chat` | HU-142 | `GET /api/chat/sessions` |
| `/reportes/auditoria-por-accion` | HU-143 (solo ADMIN, `adminGuard`) | `GET /api/audit-logs/advanced-search` |

## Tema claro y oscuro

`ThemeService` en `src/app/services/theme.service.ts` mantiene el estado con Angular Signals, aplica `data-theme` al elemento raíz, guarda la elección en `localStorage` y usa la preferencia del sistema cuando no existe una elección guardada. El selector está disponible en Landing, Login, Registro y el header administrativo.

## Formularios provisionales

Login y Registro usan `ReactiveFormsModule` y los DTOs reales del contrato. Login envía `email/password`; Registro envía `fullName/email/password`, valida longitud y máximo de 72 bytes UTF-8 de la contraseña, y no permite seleccionar roles. Ambas respuestas guardan la sesión recibida y redirigen al Dashboard.

## Añadir una página o módulo

1. Crea el componente dentro de `src/app/features/<modulo>/`.
2. Define su ruta en `src/app/app.routes.ts`, preferiblemente con `loadComponent`.
3. Reutiliza tokens CSS de `src/styles.scss` y componentes de `src/app/shared/`.
4. Evita dependencias directas entre módulos funcionales.

## Trabajo colaborativo

Usar `main` como rama estable y ramas `feature/<modulo>-<tarea>`. Cada cambio debe entrar mediante Pull Request. Coordina modificaciones a `app.routes.ts`, `styles.scss` y componentes de `core/` para evitar conflictos. No se crean commits ni se hace push automáticamente.

## Preparación para Spring Boot

`provideHttpClient(withXhr(), withInterceptors([jwtInterceptor]))` está configurado. La URL base local es `/api` y [proxy.conf.js](./proxy.conf.js) la dirige a `http://localhost:8080` durante `ng serve`. `LoginService` conserva `accessToken` y `tokenType` en `sessionStorage`; esto permite restaurar la sesión, pero deja el token accesible a JavaScript y debe revisarse como decisión de seguridad antes de producción. No hay refresh token ni logout HTTP.

## Reorganización y trabajo colaborativo

La arquitectura activa sigue `components/`, `models/` y `services/`, con archivos separados `.ts`, `.html` y `.css` por componente. Cada integrante puede trabajar principalmente en su carpeta de componente, su servicio y sus futuros modelos. El navbar y sidebar solo se definen en `components/dashboard-main/`. Las carpetas heredadas `core/`, `features/` y `shared/` se conservan temporalmente porque contienen la implementación anterior y no se eliminaron sin confirmación; las rutas nuevas ya no dependen de ellas.

## Pendientes

- Revisar la estrategia de almacenamiento de JWT antes de producción.
- Verificar CORS/origen permitido en despliegues distintos al proxy local.
- Implementar progresivamente clientes, expedientes, documentos y módulos de IA.
- Añadir validaciones, manejo de errores, permisos y pruebas conforme se incorporen funcionalidades.
