# MISS NAILS — BLUEPRINT V2

## Estado

En construcción.

Este documento define la arquitectura objetivo de MISS NAILS antes de realizar modificaciones estructurales al proyecto.

## Regla principal

La implementación se realizará por capas y mediante checkpoints.

No se modificará una funcionalidad estable sin que exista una razón arquitectónica definida.

## Arquitectura objetivo

```text
                    ┌──────────────────────┐
                    │      FRONTEND        │
                    │ Web / PWA / Android  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │       AUTH V2        │
                    │ estado de identidad  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ MISS NAILS BFF       │
                    │ Cloudflare Worker     │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┴─────────────┐
                 ▼                           ▼
        ┌────────────────┐          ┌────────────────┐
        │ IDENTIDADES    │          │   SESIONES     │
        │ identidad real │          │ sesiones reales│
        └───────┬────────┘          └───────┬────────┘
                └──────────────┬────────────┘
                               ▼
                    ┌──────────────────────┐
                    │      CLIENTES        │
                    │   ID_CLIENTE         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ AUTORIZACIÓN         │
                    │ ownership / RBAC     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   APPS SCRIPT        │
                    │   API de negocio     │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    GOOGLE SHEETS     │
                    └──────────────────────┘




