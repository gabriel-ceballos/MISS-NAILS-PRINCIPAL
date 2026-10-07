# MISS NAILS — MIGRACIÓN CLIENTES V2

## Tabla actual

La tabla CLIENTES existente se conserva durante la migración.

No se moverán ni renombrarán columnas existentes.

## Estructura actual

| Columna | Campo | Estado |
|---|---|---|
| A | Id Cliente | ACTIVO |
| B | Nombre | ACTIVO |
| C | Dirección | ACTIVO |
| D | Correo | ACTIVO |
| E | Telefono | ACTIVO |
| F | Rol | ACTIVO / FUTURO RBAC |
| G | Activo | ACTIVO |
| H | PasswordHash | LEGADO / MIGRACIÓN |
| I | UltimoAcceso | LEGADO / COMPATIBILIDAD |
| J | IntentosFallidos | LEGADO / COMPATIBILIDAD |
| K | Token | LEGADO |
| L | TokenExpira | LEGADO |
| M | Proveedor | LEGADO |
| N | FederatedSubject | LEGADO |
| O | SesionRevocadaEn | LEGADO / COMPATIBILIDAD |

## Regla de compatibilidad

Durante la migración:

- no eliminar columnas;
- no renombrar columnas;
- no cambiar el significado de las columnas existentes;
- no modificar datos existentes sin una operación de migración explícita;
- no utilizar columnas LEGADO para implementar nuevas funciones V2.

## ID_CLIENTE

Id Cliente continuará siendo el identificador interno principal del cliente.

Su valor deberá permanecer estable durante toda la migración.

## Correo

Correo continuará almacenándose en CLIENTES.

Sin embargo:

Correo NO será considerado la identidad primaria de autenticación.

## PasswordHash

PasswordHash se conservará temporalmente para permitir migración progresiva de contraseñas.

La nueva arquitectura deberá utilizar un mecanismo de derivación de contraseña moderno.

No se realizará una conversión masiva destructiva.

## Proveedor

Proveedor deja de ser la fuente de verdad para identidad federada.

La información de proveedor migrará progresivamente a IDENTIDADES.

## FederatedSubject

FederatedSubject deja de ser la fuente de verdad para identidad federada.

La identidad federada V2 será determinada mediante:

PROVEEDOR + ISSUER + SUBJECT

con TENANT_ID cuando corresponda.

## SesionRevocadaEn

SesionRevocadaEn se conservará temporalmente como mecanismo de compatibilidad con el sistema anterior.

No será la arquitectura definitiva de sesiones.

La arquitectura V2 utilizará SESIONES.

## Token

Token y TokenExpira se consideran campos LEGADO.

No deberán utilizarse para crear nuevas sesiones V2.

## Rol

Rol se conserva durante la transición.

Posteriormente la autorización podrá evolucionar hacia un modelo RBAC independiente.

## Regla de migración

La migración será:

CLIENTES existente
        ↓
compatibilidad
        ↓
IDENTIDADES
        ↓
SESIONES
        ↓
AUTH V2
        ↓
retirada progresiva del legado

## Prohibición

No se eliminarán:

- Token
- TokenExpira
- Proveedor
- FederatedSubject
- SesionRevocadaEn

hasta que todas las dependencias del sistema anterior hayan sido identificadas y migradas.

## Estado

Este documento define la estrategia de migración de CLIENTES.

Todavía no se modifica físicamente la hoja.
