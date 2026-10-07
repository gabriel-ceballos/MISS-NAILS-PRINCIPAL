# MISS NAILS — CONTRATO DE SEGURIDAD V2

## Objetivo

Este documento define las reglas que deberán respetar todas las implementaciones de autenticación, sesiones y autorización de MISS NAILS V2.

Estas reglas tienen prioridad sobre las implementaciones heredadas.

---

# 1. PRINCIPIO DE AUTORIDAD

El navegador nunca será una autoridad para determinar la identidad del usuario.

El servidor determinará:

- identidad;
- cliente;
- sesión;
- permisos;
- propiedad de recursos.

---

# 2. IDENTIDAD FEDERADA

Una identidad Google o Microsoft será identificada mediante los identificadores emitidos por el proveedor.

La identidad no se determinará únicamente por EMAIL.

## Google

La identidad lógica será:

PROVEEDOR
+
ISSUER
+
SUBJECT

## Microsoft

La identidad lógica será:

PROVEEDOR
+
ISSUER
+
TENANT_ID
+
SUBJECT

cuando TENANT_ID sea necesario para distinguir el contexto de identidad.

---

# 3. UNICIDAD

No podrá existir más de una identidad activa con la misma combinación lógica de proveedor e identificador.

Google:

PROVEEDOR + ISSUER + SUBJECT

Microsoft:

PROVEEDOR + ISSUER + TENANT_ID + SUBJECT

---

# 4. EMAIL

EMAIL es un atributo.

EMAIL no será una clave de identidad federada.

Una coincidencia de correo no autoriza automáticamente la vinculación de una identidad a una cuenta existente.

---

# 5. VINCULACIÓN

La vinculación de una identidad federada a un CLIENTE existente requerirá una operación autenticada.

No se permitirá:

LOGIN FEDERADO
+
EMAIL COINCIDENTE
=
VINCULACIÓN AUTOMÁTICA

---

# 6. CREACIÓN DE CLIENTE

Si una identidad federada válida no existe:

1. se valida la identidad;
2. se verifica si existe una cuenta vinculable;
3. se aplica la política de registro;
4. se crea o vincula CLIENTE;
5. se crea IDENTIDAD;
6. se crea SESIÓN.

El orden deberá ser transaccional o protegido contra ejecuciones concurrentes.

---

# 7. ID_CLIENTE

ID_CLIENTE será el identificador interno de la cuenta.

Nunca será proporcionado por el navegador como autoridad.

Si el navegador envía:

ID_CLIENTE

el servidor deberá ignorarlo para determinar la identidad autenticada.

---

# 8. SESIÓN

Toda sesión deberá pertenecer a exactamente un:

ID_CLIENTE

Una sesión no podrá cambiar de propietario.

---

# 9. ID_SESION

ID_SESION será opaco.

No deberá codificar:

- correo;
- nombre;
- ID_CLIENTE;
- proveedor;
- rol;
- información personal.

---

# 10. COOKIE

La cookie de sesión no deberá contener información de negocio.

La cookie servirá únicamente para identificar la sesión autorizada.

---

# 11. VALIDACIÓN DE SESIÓN

Antes de ejecutar una operación protegida:

1. validar cookie;
2. obtener ID_SESION;
3. buscar SESIONES;
4. comprobar existencia;
5. comprobar REVOCADA;
6. comprobar EXPIRA;
7. obtener ID_CLIENTE;
8. continuar con autorización.

---

# 12. AUTORIZACIÓN

Autenticación:

¿QUIÉN ES?

Autorización:

¿QUÉ PUEDE HACER?

La autenticación no implica automáticamente autorización para todos los recursos.

---

# 13. OWNERSHIP

Cuando un recurso pertenezca a un cliente:

CLIENTE ACTUAL
=
PROPIETARIO DEL RECURSO

La comparación deberá realizarse en servidor.

Nunca se confiará únicamente en un identificador enviado por frontend.

---

# 14. BOLA / IDOR

Todas las operaciones que reciban identificadores de recursos deberán verificar que el recurso pertenece al cliente autenticado o que el usuario posee el permiso correspondiente.

No será suficiente comprobar:

"el recurso existe".

Debe comprobarse:

"el recurso existe y el cliente actual tiene derecho a acceder a él".

---

# 15. ROLES

El campo Rol existente en CLIENTES se considera parte del sistema heredado.

Durante la migración seguirá funcionando donde sea necesario.

La arquitectura V2 podrá evolucionar hacia RBAC independiente.

El frontend nunca será autoridad para determinar el rol.

---

# 16. SESIONES MÚLTIPLES

Un CLIENTE puede tener múltiples sesiones simultáneas.

Ejemplo:

ID_CLIENTE = CLI-001

SESIONES:

SES-001 → Windows
SES-002 → Android
SES-003 → otro navegador

---

# 17. REVOCACIÓN INDIVIDUAL

Revocar:

SES-002

no deberá revocar:

SES-001
SES-003

---

# 18. REVOCACIÓN GLOBAL

"Cerrar todas las sesiones" deberá revocar todas las sesiones activas pertenecientes al ID_CLIENTE.

Después de una revocación global, el usuario deberá autenticarse nuevamente.

---

# 19. DATOS SENSIBLES

Nunca deberán almacenarse en localStorage o sessionStorage:

- access tokens;
- refresh tokens;
- credenciales;
- service keys;
- secretos;
- identificadores de sesión utilizables como credencial.

---

# 20. SERVICE KEY

La service key de comunicación entre BFF y Apps Script pertenece exclusivamente al entorno servidor.

Nunca deberá enviarse desde:

- frontend;
- JavaScript público;
- HTML;
- localStorage;
- sessionStorage;
- configuración pública de Capacitor.

---

# 21. PASSWORD

Las contraseñas no se almacenarán en texto plano.

PasswordHash existente se considera legado.

La migración deberá utilizar un mecanismo moderno de derivación de contraseñas.

---

# 22. TOKENS LEGADO

Los campos:

Token
TokenExpira

son considerados legado.

No serán utilizados para nuevas sesiones V2.

---

# 23. IDENTIDAD FEDERADA LEGADO

Los campos:

Proveedor
FederatedSubject

de CLIENTES son considerados legado.

La nueva fuente de verdad será:

IDENTIDADES

---

# 24. SESIONREVOCADAEN LEGADO

SesionRevocadaEn se conserva durante la migración.

No será la fuente definitiva de revocación.

La fuente V2 será:

SESIONES

---

# 25. CONCURRENCIA

Las operaciones de autenticación, creación de identidad y creación de sesión deberán protegerse contra ejecuciones concurrentes.

No se deberá asumir que dos solicitudes simultáneas son procesadas secuencialmente.

---

# 26. DUPLICADOS

Antes de crear una IDENTIDAD se deberá comprobar que no existe ya la identidad lógica.

La comprobación deberá realizarse en servidor.

La operación deberá estar protegida contra condiciones de carrera.

---

# 27. NO ENUMERACIÓN

Las operaciones sensibles no deberán revelar innecesariamente si:

- un correo existe;
- una cuenta está registrada;
- una identidad está vinculada;
- una cuenta está activa.

Los mensajes al usuario deberán diseñarse para evitar enumeración cuando corresponda.

---

# 28. AUDITORÍA

Las operaciones sensibles deberán poder generar eventos de seguridad.

Ejemplos:

- login;
- logout;
- login fallido;
- vinculación de identidad;
- desvinculación;
- cambio de contraseña;
- revocación de sesión;
- revocación global;
- acción administrativa.

Nunca deberán registrarse contraseñas, tokens completos o secretos.

---

# 29. REGLA DE CAMBIO

Ninguna implementación V2 podrá:

- reutilizar una función de identidad por correo sin justificarla;
- confiar en ID_CLIENTE del navegador;
- confiar en Rol del navegador;
- confiar en Proveedor del navegador;
- aceptar serviceKey del navegador;
- crear una sesión sin identidad validada.

---

# 30. REGLA DE MIGRACIÓN

El sistema legado puede continuar funcionando durante la transición.

Pero todo código nuevo deberá diseñarse contra el modelo V2.

La dirección será:

LEGADO
   ↓
COMPATIBILIDAD
   ↓
V2
   ↓
MIGRACIÓN
   ↓
VERIFICACIÓN
   ↓
RETIRADA DEL LEGADO

---

# ESTADO

Este documento define las reglas de seguridad e integridad.

Todavía no implementa:

- funciones;
- endpoints;
- OAuth;
- PKCE;
- sesiones;
- migración automática;
- frontend auth.

Esas piezas se implementarán posteriormente respetando este contrato.