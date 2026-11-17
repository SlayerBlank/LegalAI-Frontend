# Integración de Clientes, Usuarios y Roles

## Auditoría previa — 17 de noviembre de 2026

Fuente principal: lectura del código Java en `C:/Users/luisd/IdeaProjects/LegalAI/src/main/java/pe/edu/upc/legalai`. Se inspeccionaron controladores, DTOs, servicios, interfaces, entidades, repositorios, seguridad y pruebas relacionadas. No se encontraron los documentos `CONTRATO_INTEGRACION_FRONTEND_LEGALAI.md` ni `LEGALAI_CONTEXTO_TECNICO_COMPLETO.md` en el workspace. No se leyeron archivos de secretos ni se ejecutó el backend.

| Recurso | Operaciones reales | Seguridad |
|---|---|---|
| `/api/clients` | GET lista, POST crea | Usuario activo autenticado; solo registros propios |
| `/api/clients/{id}` | GET detalle, PUT actualiza, DELETE elimina | Búsqueda por clientId y ownerUserId; ajenos devuelven 404, incluso para ADMIN |
| `/api/clients/{clientId}/cases` | GET expedientes | Valida propiedad de cliente y expedientes |
| `/api/clients/{clientId}/cases/filter` | GET con status, openedFrom, openedTo obligatorios | Misma propiedad; rango válido |
| `/api/clients/document-count` | GET conteos | Solo clientes propios |
| `/api/users/me` | GET perfil actual | Cualquier usuario activo autenticado |
| `/api/users`, `/api/users/{id}` | GET lista/detalle; PUT y DELETE por id | ADMIN, tanto en WebSecurityConfig como en métodos de servicio |
| `/api/roles`, `/api/roles/{id}` | GET lista/detalle; POST colección; PUT y DELETE por id | ADMIN, también en RolServiceImplement |

### Contratos

- ClienteRequestDTO: `clientType` obligatorio (`PERSON` o `COMPANY`), `fullNameOrCompany` obligatorio no vacío, máximo 200; `documentNumber` opcional máximo 50; `email` opcional válido máximo 150; `phone` opcional máximo 30; `address` opcional máximo 255. Respuesta: esos campos más `clientId`, `createdAt`, `updatedAt`; no contiene ownerUserId. El propietario se obtiene del contexto autenticado, nunca del formulario.
- ExpedienteResponseDTO: `caseId`, `clientId`, `title`, `description`, `status` (OPEN, IN_PROGRESS, CLOSED, ARCHIVED), `openedAt`, `closedAt`, `createdAt`, `updatedAt`.
- UsuarioUpdateRequestDTO: exclusivamente `fullName` (no vacío, máximo 150) y `email` (no vacío, válido, máximo 150). El servicio exige conservar el correo actual: es la identidad JWT. No admite roleId, status ni credenciales. Respuesta: `userId`, `roleId`, `roleName`, `fullName`, `email`, `status`, `createdAt`, `updatedAt`.
- RolRequestDTO: exclusivamente `name` (no vacío, máximo 50, `[A-Za-z][A-Za-z0-9_]*`, sin prefijo ROLE_) y `description` opcional máximo 255. Respuesta: `roleId`, `name`, `description`.
- ErrorResponse: `timestamp`, `status`, `error`, `message`, `path`. Validaciones devuelven 400 con mensajes concatenados; conflictos y restricciones de integridad 409; autenticación 401; autorización 403; recurso inexistente 404; error interno 500.

### Reglas y límites

- JWT tiene el correo como `sub`. UsuarioDetailsService obtiene el rol actual de la base de datos y construye `ROLE_` + nombre; rechaza INACTIVE. Cada usuario tiene un solo Rol (ManyToOne). AuthServiceImpl asigna USER en el registro público. No hay creación administrativa ni endpoint de asignación de roles.
- DELETE de usuario es baja lógica INACTIVE e idempotente. Prohíbe desactivar ADMIN o la cuenta autenticada. No existe reactivación. Se puede editar el nombre propio siendo ADMIN; el menú y la sesión existentes se conservan.
- Roles se normalizan a mayúsculas. ADMIN y USER están reservados: no se crean de nuevo, renombran ni eliminan. Los roles asignados, incluso a usuarios inactivos, no se renombran ni eliminan. Sí se puede editar su descripción. El backend decide finalmente y devuelve 409 ante conflictos.
- No existen entidades Permission, relaciones rol-permiso ni endpoints granulares. Las reglas verificadas de WebSecurityConfig reservan usuarios, roles y auditoría a ADMIN; `/users/me` y el resto de recursos privados requieren autenticación. Crear otro rol no le concede acceso administrativo. No hay requisito general de ROLE_USER para clientes: se exige autenticación y propiedad.
- Cliente no tiene cascade REMOVE sobre expedientes. El frontend no borra expedientes; una restricción de integridad al eliminar se muestra como 409.

### Diferencias respecto a la fase visual

Se sustituyen NATURAL/JURIDICA por PERSON/COMPANY, id por clientId, roleName del rol por name y expedientes de ejemplo por respuestas reales. Se retiran los selectores editables de rol/estado/correo en usuarios y los datos inventados. La matriz mostrará requisitos verificados de acceso, sin casillas ni guardado. Los conteos de roles se calculan desde usuarios reales, incluidos inactivos. Se conserva la estructura visual, los temas y el layout existente.

### Cambios frontend previstos

Modelos request/response; completar ClienteService y RolService; ampliar UsuarioService conservando getCurrentUser; estado HTTP y errores de presentación; tres componentes TS/HTML; guard administrativo adicional en las dos rutas, manteniendo authGuard; pruebas con HttpTestingController. LoginService, interceptor JWT, login, registro, navbar, sidebar y Dashboard permanecen sin cambios.

## Implementación entregada

- Clientes: listado, búsqueda y paginación locales sobre la respuesta autorizada; creación y actualización con los seis campos exactos del request; detalle consultado por ID; expedientes desde la API; confirmación y DELETE sin borrar relaciones desde el frontend. El formulario respeta opcionalidad y longitudes reales. Las métricas se derivan del listado recibido.
- Usuarios: listado y roles reales, cuatro métricas calculadas, filtros locales, detalle GET y edición del nombre. Correo, rol y estado son de consulta en el formulario. La baja lógica requiere confirmación y recarga los usuarios tras el 204. Se bloquean visualmente ADMIN, la propia cuenta y los ya inactivos, además de las restricciones efectivas del servidor.
- Roles: listado, selección, detalle GET, creación, edición y eliminación con confirmación. IDs y nombres proceden de respuestas reales. Los conteos se calculan usando todos los usuarios, incluidos inactivos. Si falla esa consulta, se muestra “conteo no disponible” y se bloquean renombrado y eliminación hasta verificar asociaciones. No se asume cero. La descripción es opcional y real.
- Matriz: requisitos estáticos verificados por recurso; sin permisos inventados, casillas ni guardado. No se atribuyen privilegios de USER a otros nombres de rol. La API no tiene operación para asignar roles a usuarios.
- Se mantienen `/clientes`, `/gestionusuarios` y `/roles`. Las dos últimas añaden `adminGuard`, sin alterar el authGuard del layout. El guard usa `/users/me` para comprobar el perfil vigente, reutilizando la restauración existente para evitar duplicar esa consulta. Spring Security sigue validando cada petición administrativa.
- Carga, vacío, errores de conexión y HTTP, reintentos, bloqueo de envíos duplicados y cancelación al destruir el componente. Los formularios permanecen abiertos con el mensaje del servidor ante un fallo; los éxitos se anuncian tras la respuesta HTTP. Ningún fallo activa datos ficticios.
- Se conserva la estructura de tarjetas, tablas, modales, variables de tema y reglas responsive. No se añadieron dependencias ni se duplicó el layout.

### Endpoints efectivamente utilizados

`GET/POST /api/clients`, `GET/PUT/DELETE /api/clients/{id}`, `GET /api/clients/{id}/cases`, `GET /api/users`, `GET/PUT/DELETE /api/users/{id}`, `GET /api/users/me`, `GET/POST /api/roles` y `GET/PUT/DELETE /api/roles/{id}`.

Los endpoints de filtro de expedientes y conteo documental se auditaron, pero no se solicitan desde estas pantallas: no son necesarios para sus controles actuales. No se inventaron búsquedas ni paginación remotas.

### Archivos frontend

Nuevos respecto a la fase visual:

- `src/app/models/management.ts`: request y response reales; reutiliza CurrentUserResponse.
- `src/app/services/admin.guard.ts` y `admin.guard.spec.ts`.
- `src/app/shared/management-http-state.ts`: estado de peticiones y errores ErrorResponse.
- `src/app/shared/management-dialog.directive.ts`: renombra la directiva visual anterior, conservando foco, teclado y restauración del foco; ya no utiliza nombre de demostración.
- Este informe.

Modificados respecto a la fase visual:

- `src/app/services/cliente-service.ts`, `usuario-service.ts` y `rol-service.ts`. Se conserva `UsuarioService.getCurrentUser()` y su contrato.
- TS y HTML de `cliente-component`, `gestion-usuarios` y `rol-component`; CSS de gestión de usuarios para la cuarta tarjeta. Los CSS locales de Clientes y Roles siguen usando la hoja compartida.
- `src/app/app.routes.ts`: solo el guard adicional de las dos rutas administrativas.
- `src/app/shared/management.css`: estilos compartidos de formularios deshabilitados y errores, manteniendo el presupuesto configurado.
- `src/app/shared/management.spec.ts`: reemplaza las pruebas de la fase mock por pruebas con HttpTestingController.
- `src/app/app.spec.ts`: reemplaza la expectativa obsoleta “Hello, legalai-frontend” por regresiones de navegación reales. matchMedia se simula únicamente en jsdom, sin cambiar ThemeService.

`src/app/shared/management-state.ts` se reutiliza de la fase visual. Se retiraron los archivos sin consumidores `mocks/management.mock.ts`, `models/demo-management.ts` y la directiva anterior `shared/demo-dialog.directive.ts`. No se borraron mocks de otros módulos. No quedan importaciones de mocks ni indicadores de demostración en las pantallas integradas. Los únicos registros de ejemplo restantes para estos módulos son fixtures aislados dentro de pruebas.

### Verificación ejecutada

| Verificación | Resultado y alcance |
|---|---|
| `npm.cmd run build` (equivalente a npm run build en PowerShell) | Correcta, sin advertencias; bundle inicial 413.87 kB, transferencia estimada 97.22 kB |
| `npm.cmd test -- --watch=false` | 47 pruebas aprobadas en 3 archivos |
| Transporte simulado Angular | DTOs exactos, GET/POST/PUT/DELETE, Authorization mediante el interceptor existente, no duplicación de envíos, éxito solo tras respuesta y errores 400/401/403/404/409/500/conexión |
| Presentación | Filtros/paginación, vacíos reales, modales por eventos DOM, cierre Escape, matriz sin controles de permisos, ausencia de fallback a mocks |
| Seguridad frontend | ADMIN admitido, USER y otros roles rechazados, INACTIVE rechazado, fallo de perfil bloquea acceso, 401 deriva a Login, restauración no duplica GET /me |
| Regresión de navegación | Formularios de Login y Registro accesibles; Clientes anónimo redirige mediante authGuard; Dashboard autenticado mantiene navbar y sidebar |
| HTTP real sin autenticación | GET a `http://localhost:8080/api/clients`, `/api/users`, `/api/roles`, `/api/users/me`: los cuatro respondieron 401 |
| Lecturas reales autenticadas | Pendientes: no se dispone de una sesión autenticada para ejecutar esas comprobaciones; no se extrajeron credenciales ni tokens del usuario |
| Escrituras reales | No ejecutadas; requieren autorización específica. Las pruebas de escritura anteriores usan exclusivamente HttpTestingController y no PostgreSQL |
| Navegador, claro/oscuro y responsive | Se conservaron variables y reglas CSS; pendiente revisión visual en navegador real, sin afirmar validación por captura |

PowerShell bloquea el lanzador npm.ps1 por su política de scripts; se usó npm.cmd sin cambiar esa política. La compilación y los tests se ejecutaron fuera del sandbox por el acceso de esbuild a directorios padre; esto no implicó ejecutar ni escribir en el backend.

### Casos preparados para escritura real — no ejecutados

Se solicitará autorización sobre el conjunto concreto de registros antes de ejecutar cualquiera de estos casos. No se crea una cuenta ADMIN ni se usa el registro público como alta administrativa.

1. **Cliente de prueba propio:** tras leer el listado con una sesión de prueba autorizada, POST con `clientType: PERSON`, `fullNameOrCompany: VALIDACION_INTEGRACION_20261117` y los otros cuatro campos a null. Capturar exclusivamente el clientId devuelto; consultar detalle, actualizar nombre mediante PUT, verificar con GET y, solo con autorización incluida para limpiar ese registro, confirmar DELETE y ausencia posterior. Nunca alterar IDs para explorar propiedad de terceros.
2. **Restricción de eliminación de cliente:** solo si se identifica previamente un cliente de prueba con expedientes cuya eliminación se autorice expresamente; confirmar el comportamiento real del backend y su mensaje de integridad. No crear, eliminar ni modificar expedientes para forzar el caso.
3. **Edición de usuario de prueba:** únicamente un userId de prueba indicado/autorizado, obtenido del listado; PUT con su correo actual intacto y un nombre temporal autorizado; GET de verificación y restauración del nombre original si dicha restauración también está autorizada. Sin roleId ni status en el cuerpo.
4. **Desactivación:** requiere una cuenta de prueba explícitamente seleccionada que no sea ADMIN ni la actual. Advertir antes que no hay reactivación en la API. Confirmar DELETE, GET/listado INACTIVE y rechazo del acceso de esa cuenta. No ejecutarlo sobre personas reales ni cuentas no indicadas.
5. **Rol de prueba no asignado:** verificar que no exista `QA_REVIEWER_20261117`; POST con name y description autorizados, usar el roleId devuelto, GET, PUT de descripción y nombre si sigue sin asociaciones; DELETE solo si se autoriza la limpieza y continúa sin usuarios. No asignar usuarios, puesto que no existe ese endpoint. No modificar ADMIN ni USER para ensayar conflictos.

### Limitaciones y confirmación de alcance

No están disponibles alta administrativa de usuarios, cambio de rol, cambio de correo, reactivación ni permisos granulares. No se simulan esos resultados. Las respuestas en despliegue deberán contrastarse con el código local auditado durante las pruebas autenticadas. La prueba de navegación no constituye una prueba de login o registro real contra PostgreSQL.

**El backend permaneció intacto.** Solo se leyó código; `git status --short` del repositorio backend terminó vacío. No se ejecutaron Spring Boot, Maven, Gradle, migraciones, SQL ni operaciones de escritura reales. No se leyeron .env, valores de contraseñas o claves. No se modificaron LoginService, JWT interceptor, authGuard original, Login, Registro, Dashboard, navbar o sidebar; la comprobación de diff de esos archivos no mostró cambios. No se modificó Railway. No se crearon commits ni push.
