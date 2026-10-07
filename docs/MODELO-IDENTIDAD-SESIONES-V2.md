# MISS NAILS — MODELO DE IDENTIDAD Y SESIONES V2

## Objetivo

Separar definitivamente tres conceptos que actualmente están mezclados:

1. CLIENTE
2. IDENTIDAD
3. SESIÓN

Un cliente es la cuenta de MISS NAILS.

Una identidad es la forma mediante la cual una persona demuestra que controla esa cuenta.

Una sesión es una conexión autorizada de un dispositivo o navegador.

---

# 1. CLIENTES

La tabla CLIENTES continúa siendo la entidad principal de la cuenta.

Su identificador interno será:

ID_CLIENTE

Este identificador no deberá cambiar aunque el usuario:

- cambie de correo;
- agregue Google;
- agregue Microsoft;
- cambie contraseña;
- tenga varias sesiones;
- cierre una sesión;
- cierre todas sus sesiones.

El correo electrónico NO será la identidad principal.

---

# 2. IDENTIDADES

Se creará una estructura independiente:

IDENTIDADES

## Campos

- ID_IDENTIDAD
- ID_CLIENTE
- PROVEEDOR
- ISSUER
- SUBJECT
- TENANT_ID
- EMAIL
- EMAIL_VERIFICADO
- ACTIVA
- FECHA_VINCULACION
- ULTIMO_USO

## PROVEEDOR

Valores previstos:

- password
- google
- microsoft

En el futuro:

- passkey

---

# 3. IDENTIDAD FEDERADA

Para Google y Microsoft la identidad real estará determinada por:

PROVEEDOR + ISSUER + SUBJECT

Cuando Microsoft requiera distinguir el tenant:

PROVEEDOR + ISSUER + TENANT_ID + SUBJECT

El SUBJECT será el identificador estable proporcionado por el proveedor.

Nunca se utilizará únicamente el correo electrónico para determinar la identidad federada.

---

# 4. CORREO ELECTRÓNICO

EMAIL será un atributo de la identidad.

EMAIL no será la clave principal de autenticación.

EMAIL puede cambiar.

Una identidad federada no deberá transferirse automáticamente a otra cuenta solamente porque coincida el correo.

La vinculación de una identidad existente a una cuenta requerirá una acción autenticada y controlada.

---

# 5. RELACIÓN

La relación será:

CLIENTE
   │
   ├── IDENTIDAD PASSWORD
   │
   ├── IDENTIDAD GOOGLE
   │
   └── IDENTIDAD MICROSOFT

Un mismo CLIENTE podrá tener varias IDENTIDADES.

Ejemplo:

ID_CLIENTE = CLI-000123

Puede tener:

google
microsoft
password

Todas pertenecen al mismo cliente.

---

# 6. SESIONES

Se creará una estructura independiente:

SESIONES

## Campos

- ID_SESION
- ID_CLIENTE
- CREADA
- ULTIMA_ACTIVIDAD
- EXPIRA
- REVOCADA
- PROVEEDOR
- PLATAFORMA
- DISPOSITIVO

Campos adicionales que podrán incorporarse posteriormente:

- FECHA_REVOCACION
- MOTIVO_REVOCACION
- USER_AGENT
- IP_HASH
- VERSION

---

# 7. ID_SESION

ID_SESION será un identificador opaco.

La cookie del navegador no deberá contener:

- correo;
- nombre;
- ID_CLIENTE;
- proveedor;
- rol;
- token del proveedor;
- información personal.

La cookie únicamente identificará la sesión.

El servidor utilizará ID_SESION para recuperar la información correspondiente.

---

# 8. COOKIE

La sesión se transportará mediante cookie protegida.

Objetivos:

- HttpOnly
- Secure
- SameSite apropiado
- Path=/

Cuando la topología final lo permita se utilizará:

__Host-

La decisión definitiva sobre SameSite se tomará después de definir la arquitectura final de dominios.

---

# 9. CREACIÓN DE SESIÓN

Una sesión se crea únicamente después de una autenticación válida.

Flujo:

AUTENTICACIÓN
      ↓
IDENTIDAD VALIDADA
      ↓
ID_CLIENTE
      ↓
CREAR SESIÓN
      ↓
GENERAR ID_SESION
      ↓
GUARDAR SESIÓN
      ↓
ENVIAR COOKIE

---

# 10. VALIDACIÓN DE SESIÓN

Cada solicitud protegida deberá:

1. recibir la cookie;
2. extraer ID_SESION;
3. localizar la sesión;
4. verificar que existe;
5. verificar que no esté revocada;
6. verificar que no esté expirada;
7. obtener ID_CLIENTE;
8. continuar con autorización.

Nunca deberá confiarse en:

- ID_CLIENTE enviado por frontend;
- correo enviado por frontend;
- rol enviado por frontend;
- proveedor enviado por frontend.

---

# 11. REVOCACIÓN

Una sesión podrá ser revocada individualmente.

Ejemplo:

Usuario tiene:

SESION A
SESION B
SESION C

Puede cerrar únicamente:

SESION B

Las sesiones A y C permanecen activas.

---

# 12. CERRAR TODAS LAS SESIONES

El sistema deberá permitir:

CERRAR TODAS LAS SESIONES

Esto revocará todas las sesiones activas pertenecientes al ID_CLIENTE.

La sesión utilizada para ejecutar esta operación también deberá quedar revocada.

El frontend deberá solicitar una nueva autenticación para continuar.

---

# 13. EXPIRACIÓN

Una sesión tendrá:

CREADA
ULTIMA_ACTIVIDAD
EXPIRA

La política exacta de expiración se definirá durante la implementación.

Debe distinguirse entre:

- expiración absoluta;
- expiración por inactividad.

---

# 14. SESIONES POR DISPOSITIVO

El sistema deberá poder mostrar al usuario información comprensible como:

- dispositivo;
- plataforma;
- fecha de inicio;
- última actividad;
- sesión actual.

No se mostrará información técnica innecesaria al usuario.

---

# 15. SEGURIDAD

Nunca se almacenarán en:

localStorage
sessionStorage

los siguientes elementos:

- access tokens;
- refresh tokens;
- credenciales;
- cookies de sesión;
- secretos;
- service keys.

---

# 16. AUTORIZACIÓN

La autenticación responde:

¿QUIÉN ERES?

La autorización responde:

¿QUÉ PUEDES HACER?

No deben mezclarse.

El sistema primero determina:

ID_CLIENTE

Después determina:

PERMISOS

---

# 17. REGLA FUNDAMENTAL

El navegador NO es una autoridad.

El servidor es quien determina:

- identidad;
- sesión;
- cliente;
- permisos;
- propiedad de recursos.

---

# 18. MIGRACIÓN

El sistema actual contiene:

- autenticación por correo;
- SHA-256;
- SesionRevocadaEn;
- sesiones basadas parcialmente en localStorage;
- identidad federada basada en correo.

Estos elementos serán considerados LEGADO.

No serán eliminados todavía.

La migración seguirá:

LEGADO
   ↓
COMPATIBILIDAD
   ↓
V2
   ↓
PRUEBAS
   ↓
MIGRACIÓN
   ↓
RETIRAR LEGADO

---

# 19. ESTADO DEL MODELO

Este documento define el modelo lógico.

Todavía NO define:

- nombres definitivos de hojas;
- columnas físicas de Google Sheets;
- endpoints finales;
- funciones Apps Script;
- funciones del Worker;
- interfaz frontend;
- política definitiva de expiración;
- política definitiva de SameSite.

Esos elementos se definirán en los siguientes pasos.