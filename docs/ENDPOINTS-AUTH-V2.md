# ENDPOINTS AUTH V2 — MISS NAILS

## 1. Propósito

Este documento define el contrato externo de los endpoints de autenticación V2 de MISS NAILS.

Los endpoints serán expuestos por el Cloudflare Worker/BFF.

El frontend nunca accederá directamente a Google Apps Script para autenticación.

Arquitectura:

```text
Frontend
   ↓
Cloudflare Worker / BFF
   ↓
Auth V2
   ↓
IDENTIDADES / CLIENTES / SESIONES
   ↓
Apps Script interno
```

---

# 2. Reglas generales

Todos los endpoints `/auth/*` deberán cumplir:

- El Worker es la autoridad de autenticación.
- El navegador no determina `ID_CLIENTE`.
- El navegador no determina el rol.
- El navegador no determina el proveedor autenticado.
- El navegador nunca envía `serviceKey`.
- Los tokens de Google/Microsoft no se almacenan en `localStorage`.
- Los tokens de Google/Microsoft no se almacenan en `sessionStorage`.
- La sesión de aplicación se representa mediante cookie protegida.
- Las operaciones que modifican estado utilizan `POST`, `PUT`, `PATCH` o `DELETE`.
- No utilizar `GET` para operaciones que cambien estado.
- Las respuestas deberán utilizar el contrato:

Éxito:

```json
{
  "ok": true,
  "data": {}
}
```

Error:

```json
{
  "ok": false,
  "error": {
    "code": "CODIGO_ERROR",
    "message": "Mensaje seguro para el cliente"
  }
}
```

Las respuestas de autenticación deberán utilizar `Cache-Control: no-store`.

---

# 3. Estado de sesión

## GET /auth/session

### Propósito

Determinar si existe una sesión válida.

Este endpoint no inicia sesión y no modifica el estado de autenticación.

### Autenticación

No requiere autenticación previa.

La cookie de sesión, si existe, será enviada automáticamente por el navegador.

### Respuesta sin sesión

```json
{
  "ok": true,
  "data": {
    "authenticated": false
  }
}
```

### Respuesta con sesión

```json
{
  "ok": true,
  "data": {
    "authenticated": true,
    "user": {
      "id": "CLIENTE_ID",
      "name": "Nombre del cliente",
      "email": "correo@example.com",
      "role": "CLIENTE"
    },
    "session": {
      "id": "SESSION_ID",
      "expiresAt": "2026-10-12T18:00:00.000Z"
    }
  }
}
```

El frontend solamente recibe la información necesaria para representar la interfaz.

No recibe:

- secretos;
- serviceKey;
- tokens de proveedores;
- hashes;
- datos internos de IDENTIDADES;
- información administrativa innecesaria.

---

# 4. Google

## GET /auth/google/start

### Propósito

Iniciar autenticación mediante Google.

### Comportamiento

El Worker deberá:

1. Generar `state`.
2. Generar `nonce`.
3. Generar PKCE.
4. Guardar los datos transaccionales necesarios de forma segura.
5. Construir la solicitud de autorización.
6. Redirigir al navegador hacia Google.

### El navegador no deberá construir directamente la URL de autorización.

### No se acepta como autoridad:

- email enviado por frontend;
- ID de cliente enviado por frontend;
- rol enviado por frontend;
- identidad enviada por frontend.

---

# 5. Google callback

## GET /auth/google/callback

### Propósito

Recibir la respuesta de Google después de la autenticación.

### Parámetros esperados

```text
code
state
```

### Comportamiento

El Worker deberá:

1. Validar `state`.
2. Recuperar la transacción de autenticación.
3. Verificar que no haya expirado.
4. Intercambiar `code` por tokens mediante el flujo correspondiente.
5. Validar la identidad de Google.
6. Validar `issuer`.
7. Validar `audience`.
8. Validar `subject`.
9. Validar `email_verified`.
10. Obtener la identidad lógica:

```text
provider
issuer
subject
```

11. Buscar esa identidad en `IDENTIDADES`.
12. Resolver el `ID_CLIENTE`.
13. Verificar que el cliente esté activo.
14. Crear una sesión V2.
15. Establecer la cookie de sesión.
16. Redirigir al frontend.

### Regla crítica

El email de Google **no será utilizado como identificador primario de la identidad federada**.

La identidad será:

```text
PROVEEDOR + ISSUER + SUBJECT
```

---

# 6. Microsoft

## GET /auth/microsoft/start

### Propósito

Iniciar autenticación mediante Microsoft.

### Comportamiento

El Worker deberá:

1. Generar `state`.
2. Generar `nonce`.
3. Generar PKCE.
4. Crear la transacción de autenticación.
5. Redirigir al proveedor Microsoft.

---

# 7. Microsoft callback

## GET /auth/microsoft/callback

### Propósito

Recibir la respuesta de Microsoft.

### Parámetros esperados

```text
code
state
```

### Validaciones

El Worker deberá validar:

- `state`;
- `nonce`;
- `issuer`;
- `audience`;
- versión del token;
- tenant cuando corresponda;
- `subject`;
- información de correo disponible;
- vigencia;
- firma criptográfica.

La identidad federada será:

```text
PROVEEDOR
ISSUER
SUBJECT
TENANT_ID
```

cuando el tenant sea necesario para distinguir correctamente la identidad.

---

# 8. Login mediante contraseña

## POST /auth/password/login

### Propósito

Autenticar un cliente mediante correo y contraseña.

### Request

```json
{
  "email": "correo@example.com",
  "password": "********"
}
```

### Reglas

El Worker no confiará en:

- `idCliente`;
- `rol`;
- `activo`;
- `proveedor`;
- cualquier otro atributo enviado por el navegador.

El servidor resolverá toda la identidad.

### Resultado exitoso

Se crea una sesión V2 y se establece la cookie.

Respuesta:

```json
{
  "ok": true,
  "data": {
    "authenticated": true,
    "user": {
      "id": "CLIENTE_ID",
      "name": "Nombre",
      "email": "correo@example.com",
      "role": "CLIENTE"
    }
  }
}
```

### Error

La respuesta deberá evitar revelar si el correo existe.

Ejemplo:

```json
{
  "ok": false,
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "message": "No fue posible iniciar sesión."
  }
}
```

---

# 9. Cerrar sesión actual

## POST /auth/logout

### Propósito

Cerrar únicamente la sesión actual.

### Autenticación

Requiere una sesión válida.

### Comportamiento

El Worker deberá:

1. identificar la sesión mediante la cookie;
2. localizar la sesión en `SESIONES`;
3. marcarla como revocada;
4. registrar fecha de revocación;
5. registrar motivo;
6. invalidar la cookie del navegador.

### Respuesta

```json
{
  "ok": true,
  "data": {
    "authenticated": false
  }
}
```

---

# 10. Cerrar todas las sesiones

## POST /auth/logout-all

### Propósito

Revocar todas las sesiones activas del cliente.

### Autenticación

Requiere sesión válida.

### Comportamiento

El servidor deberá:

1. identificar al cliente mediante la sesión actual;
2. localizar sus sesiones activas;
3. revocarlas;
4. registrar fecha y motivo;
5. invalidar la sesión actual;
6. invalidar la cookie.

### Respuesta

```json
{
  "ok": true,
  "data": {
    "authenticated": false
  }
}
```

---

# 11. Listar sesiones

## GET /auth/sessions

### Propósito

Permitir al cliente consultar sus sesiones activas.

### Autenticación

Requiere sesión válida.

### Respuesta

```json
{
  "ok": true,
  "data": {
    "sessions": [
      {
        "id": "SESSION_ID",
        "createdAt": "2026-10-05T18:00:00.000Z",
        "lastActivityAt": "2026-10-05T19:30:00.000Z",
        "expiresAt": "2026-10-12T18:00:00.000Z",
        "platform": "WEB",
        "device": "Chrome",
        "current": true
      }
    ]
  }
}
```

El identificador expuesto al cliente no deberá permitir acceder a información de otro cliente.

---

# 12. Revocar una sesión

## DELETE /auth/sessions/{sessionId}

### Propósito

Revocar una sesión específica del cliente.

### Autenticación

Requiere sesión válida.

### Regla crítica

El servidor deberá verificar:

```text
SESION.ID_CLIENTE === CLIENTE_AUTENTICADO
```

antes de permitir la revocación.

Esto evita BOLA/IDOR.

### Respuesta

```json
{
  "ok": true,
  "data": {
    "revoked": true
  }
}
```

---

# 13. Activación de cuenta mediante contraseña

## POST /auth/password/activate

### Propósito

Completar la activación de una cuenta que todavía no dispone de una credencial local válida.

Este endpoint no deberá aceptar directamente un `idCliente` como autoridad.

La activación deberá utilizar un mecanismo de transacción seguro y de un solo uso.

### Estado

Pendiente de definir en la fase específica de activación/recuperación.

No implementar todavía.

---

# 14. Recuperación de contraseña

## POST /auth/password/recovery/request

### Propósito

Solicitar recuperación de contraseña.

### Regla

La respuesta no deberá revelar si el correo existe.

Ejemplo:

```json
{
  "ok": true,
  "data": {
    "accepted": true
  }
}
```

### Estado

Pendiente de definir el mecanismo de tokens de recuperación.

No implementar todavía.

---

## POST /auth/password/recovery/confirm

### Propósito

Confirmar una recuperación mediante un token transaccional válido.

### Estado

Pendiente de definir.

No implementar todavía.

---

# 15. Vinculación de una identidad adicional

La vinculación de Google o Microsoft a una cuenta existente será una operación autenticada y explícita.

No se realizará automáticamente solamente porque dos identidades tengan el mismo correo.

## POST /auth/identities/{provider}/start

Ejemplos:

```text
POST /auth/identities/google/start
POST /auth/identities/microsoft/start
```

### Requiere

Sesión autenticada.

### Propósito

Iniciar una transacción explícita de vinculación.

---

## GET /auth/identities/{provider}/callback

Recibe la respuesta del proveedor y completa la vinculación.

El servidor deberá verificar:

- sesión del cliente;
- `state`;
- `nonce`;
- PKCE;
- proveedor;
- issuer;
- subject;
- tenant cuando corresponda;
- ausencia de conflicto con otra cuenta.

---

# 16. Eliminar una identidad vinculada

## DELETE /auth/identities/{identityId}

### Propósito

Eliminar/desactivar una identidad federada vinculada.

### Regla

Nunca podrá eliminarse una identidad perteneciente a otro cliente.

El servidor deberá verificar:

```text
IDENTIDAD.ID_CLIENTE === CLIENTE_AUTENTICADO
```

Además, antes de eliminar una identidad deberá comprobarse que el cliente conserve al menos un método válido de acceso.

---

# 17. Endpoint interno Worker → Apps Script

Los endpoints públicos `/auth/*` pertenecen al BFF.

Apps Script no será expuesto como API pública de autenticación para el navegador.

El Worker utilizará acciones internas autenticadas para consultar o modificar:

```text
CLIENTES
IDENTIDADES
SESIONES
```

El navegador nunca deberá enviar:

```text
serviceKey
idCliente
ID_IDENTIDAD
ID_SESION como autoridad
Proveedor
Rol
```

El Worker será responsable de obtener estos valores a partir de la sesión y de la identidad validada.

El contrato detallado Worker → Apps Script se definirá en un documento separado.

---

# 18. Estados HTTP esperados

Los endpoints deberán utilizar códigos HTTP coherentes.

### 200

Operación exitosa.

### 201

Creación exitosa de un recurso cuando corresponda.

### 400

Solicitud inválida.

### 401

No autenticado o credenciales inválidas.

### 403

Autenticado pero sin autorización.

### 404

Recurso no encontrado cuando corresponda y sin provocar enumeración indebida.

### 409

Conflicto de identidad o estado.

### 429

Límite de solicitudes excedido.

### 500

Error interno no esperado.

Los mensajes enviados al cliente no deberán revelar detalles internos, secretos, hashes, consultas, estructura de hojas o información de otros usuarios.

---

# 19. No implementar todavía

Este documento define el contrato.

Todavía NO se deben modificar:

- `app/app.js`;
- `index.html`;
- `app/features/catalog.js`;
- `app/navigation/router.js`;
- Apps Script;
- Worker;
- Android;
- `www/`.

Primero deben cerrarse los contratos internos:

```text
Endpoints públicos
        ↓
Worker → Apps Script
        ↓
IDENTIDADES
        ↓
SESIONES
        ↓
CLIENTES
```

Después comenzará la implementación.

---

# 20. Regla de arquitectura

La autenticación V2 seguirá esta regla:

```text
EL NAVEGADOR SOLICITA.
EL WORKER VALIDA.
EL SERVIDOR RESUELVE LA IDENTIDAD.
LA SESIÓN REPRESENTA LA AUTORIZACIÓN.
APPS SCRIPT EJECUTA LAS OPERACIONES INTERNAS.
```

Nunca:

```text
NAVEGADOR → idCliente → Apps Script
```

Ni:

```text
NAVEGADOR → rol → Apps Script
```

Ni:

```text
NAVEGADOR → serviceKey → Apps Script
```

La autoridad siempre deberá permanecer del lado servidor.


