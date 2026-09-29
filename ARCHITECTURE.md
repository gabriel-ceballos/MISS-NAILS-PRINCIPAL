# MISS NAILS — Arquitectura de fuente única

## Fuente de verdad
- `index.html`: documento de entrada web.
- `app/`: lógica de aplicación y contexto de ejecución.
- `styles/`: presentación adaptativa.
- `assets/`: recursos fuente.
- `manifest.webmanifest`: configuración PWA relativa al origen.

## Distribución
- `www/` es un artefacto generado por `npm run build:web`.
- Capacitor consume `www/` mediante `webDir`.
- No se modifica manualmente `www/`.

## Contextos
La aplicación detecta `runtime`, `platform`, `displayMode`, `interaction` y orientación. No clasifica el dispositivo por `mobile/tablet/desktop`.

## Adaptación
El layout usa CSS, Flexbox/Grid, intrinsic sizing, `auto-fit`, `minmax()`, Container Queries y unidades dinámicas. Los umbrales que existan pertenecen al componente/contenedor que necesita reorganizarse, no a una clase de dispositivo.

## GitHub y dominio futuro
La aplicación usa rutas relativas para que el mismo artefacto pueda vivir bajo `/MAQUETA_MISSNAILS/` en GitHub Pages y bajo `/` en un dominio propio.
