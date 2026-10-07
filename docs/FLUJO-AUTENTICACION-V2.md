# MISS NAILS — FLUJO DE AUTENTICACIÓN V2

## Objetivo

Definir el flujo de autenticación de MISS NAILS para:

- Google;
- Microsoft;
- contraseña.

El resultado final de cualquier autenticación válida deberá ser:

IDENTIDAD VALIDADA
        ↓
ID_CLIENTE
        ↓
SESION
        ↓
COOKIE DE SESION

---

# 1. PRINCIPIO

La autenticación y la sesión son conceptos diferentes.

Autenticación:

¿Quién eres?

Sesión:

¿Qué conexión autorizada tiene actualmente esa identidad?

---

# 2. GOOGLE

El flujo objetivo será:

```text
USUARIO
   ↓
FRONTEND
   ↓
GOOGLE
   ↓
AUTORIZACIÓN
   ↓
WORKER / BFF
   ↓
VALIDACIÓN GOOGLE
   ↓
IDENTIDAD
   ↓
IDENTIDADES
   ↓
ID_CLIENTE
   ↓
SESIONES
   ↓
COOKIE

