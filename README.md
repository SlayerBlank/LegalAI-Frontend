# LegalAI Frontend

Placeholder visual y estructural para la plataforma de gestión legal LegalAI. Esta primera versión es una SPA independiente, preparada para que el equipo incorpore funcionalidades por módulo sin implementar todavía lógica de negocio, autenticación ni llamadas al backend.

## Tecnologías y requisitos

- Angular 22.2.3 con Standalone Components.
- TypeScript estricto, HTML y SCSS.
- Angular Router, Signals y componentes nativos.
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
├── core/              # Layout, navegación, tema y configuración transversal
│   ├── http/          # URL base para la futura integración HTTP
│   ├── layout/        # Sidebar, header y layout compartido
│   └── theme/         # ThemeService basado en Signals
├── features/          # Páginas por área funcional
│   ├── auth/          # Login provisional
│   └── dashboard/     # Dashboard inicial
└── shared/            # Componentes reutilizables y página 404
```

Los módulos funcionales usan `PlaceholderPageComponent` mientras el equipo define sus contratos con el Swagger real del backend.

## Rutas disponibles

`/`, `/login`, `/clientes`, `/expedientes`, `/documentos`, `/chat-ia`, `/borradores`, `/resumenes`, `/citaciones-ia`, `/usuarios`, `/roles` y `/auditoria`. Las rutas de módulos se cargan de forma diferida; las rutas inexistentes muestran una página 404.

## Tema claro y oscuro

`ThemeService` mantiene el estado con Angular Signals, aplica `data-theme` al elemento raíz, guarda la elección en `localStorage` y usa la preferencia del sistema cuando no existe una elección guardada. El botón está disponible en el header.

## Añadir una página o módulo

1. Crea el componente dentro de `src/app/features/<modulo>/`.
2. Define su ruta en `src/app/app.routes.ts`, preferiblemente con `loadComponent`.
3. Reutiliza tokens CSS de `src/styles.scss` y componentes de `src/app/shared/`.
4. Evita dependencias directas entre módulos funcionales.

## Trabajo colaborativo

Usar `main` como rama estable y ramas `feature/<modulo>-<tarea>`. Cada cambio debe entrar mediante Pull Request. Coordina modificaciones a `app.routes.ts`, `styles.scss` y componentes de `core/` para evitar conflictos. No se crean commits ni se hace push automáticamente.

## Preparación para Spring Boot

La URL base futura está centralizada en `src/environments/environment.ts` y expuesta mediante `src/app/core/http/api.config.ts`. Todavía no hay endpoints, DTOs, guards, JWT, interceptores ni tokens simulados. Los contratos deberán obtenerse del Swagger real de LegalAI.

## Pendientes

- Integrar autenticación real con Spring Security y JWT.
- Definir contratos, modelos y servicios HTTP desde Swagger.
- Implementar progresivamente clientes, expedientes, documentos y módulos de IA.
- Añadir validaciones, manejo de errores, permisos y pruebas conforme se incorporen funcionalidades.
