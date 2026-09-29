/**
 * MISS NAILS — Runtime Context
 * Detecta entorno/capacidades. No decide layouts por ancho de pantalla.
 */
export function detectRuntime(){
  const capacitor=window.Capacitor;
  if(capacitor && typeof capacitor.isNativePlatform==='function' && capacitor.isNativePlatform()) {
    const platform=typeof capacitor.getPlatform==='function' ? capacitor.getPlatform() : 'native';
    return { runtime:'native', platform:platform==='ios'?'ios':'android' };
  }
  let standalone=false;
  try { standalone=window.matchMedia('(display-mode: standalone)').matches; } catch {}
  if(!standalone && typeof navigator.standalone==='boolean') standalone=navigator.standalone;
  return { runtime:standalone?'pwa':'web', platform:'web' };
}

export function detectDisplayMode(){
  const modes=['standalone','minimal-ui','fullscreen','window-controls-overlay'];
  for(const mode of modes){
    try { if(window.matchMedia(`(display-mode: ${mode})`).matches) return mode; } catch {}
  }
  return 'browser';
}

export function detectInteraction(){
  const coarse=window.matchMedia('(pointer: coarse)').matches;
  const fine=window.matchMedia('(pointer: fine)').matches;
  const hover=window.matchMedia('(hover: hover)').matches;
  if(coarse && fine) return 'hybrid';
  if(coarse) return 'touch';
  if(hover || fine) return 'mouse-keyboard';
  return 'unknown';
}

export function applyRuntimeContext(app){
  const runtime=detectRuntime();
  app.dataset.runtime=runtime.runtime;
  app.dataset.platform=runtime.platform;
  app.dataset.displayMode=detectDisplayMode();
  app.dataset.interaction=detectInteraction();
  app.dataset.orientation=window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  return runtime;
}

export function updateDynamicContext(app){
  app.dataset.displayMode=detectDisplayMode();
  app.dataset.interaction=detectInteraction();
  app.dataset.orientation=window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
}
