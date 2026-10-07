# MISS NAILS — CONTRATO API V2

## Objetivo

Definir la comunicación entre:

FRONTEND
→
CLOUDFLARE WORKER / BFF
→
APPS SCRIPT
→
GOOGLE SHEETS

La finalidad es impedir que el navegador sea autoridad sobre identidad, permisos o secretos.

---

# 1. ARQUITECTURA

```text
FRONTEND
    ↓
CLOUDFLARE WORKER
    ↓
APPS SCRIPT
    ↓
GOOGLE SHEETS

