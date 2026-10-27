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
npm install
npm start
```

La aplicación estará disponible en `http://localhost:4200/`.

Para compilar:

```bash
npm run build
```

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

`provideHttpClient(withInterceptors([jwtInterceptor]))` está configurado. La URL base local es `/api` y [proxy.conf.json](./proxy.conf.json) la dirige a `http://localhost:8080` durante `ng serve`. `LoginService` conserva `accessToken` y `tokenType` en `sessionStorage`; esto permite restaurar la sesión, pero deja el token accesible a JavaScript y debe revisarse como decisión de seguridad antes de producción. No hay refresh token ni logout HTTP.

## Reorganización y trabajo colaborativo

La arquitectura activa sigue `components/`, `models/` y `services/`, con archivos separados `.ts`, `.html` y `.css` por componente. Cada integrante puede trabajar principalmente en su carpeta de componente, su servicio y sus futuros modelos. El navbar y sidebar solo se definen en `components/dashboard-main/`. Las carpetas heredadas `core/`, `features/` y `shared/` se conservan temporalmente porque contienen la implementación anterior y no se eliminaron sin confirmación; las rutas nuevas ya no dependen de ellas.

## Pendientes

- Revisar la estrategia de almacenamiento de JWT antes de producción.
- Verificar CORS/origen permitido en despliegues distintos al proxy local.
- Implementar progresivamente clientes, expedientes, documentos y módulos de IA.
- Añadir validaciones, manejo de errores, permisos y pruebas conforme se incorporen funcionalidades.
