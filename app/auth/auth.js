/*
 * MISS NAILS — autenticación del navegador
 *
 * El navegador NO implementa OAuth directamente.
 * Cloudflare Worker actúa como BFF y completa OIDC.
 *
 * El navegador solamente:
 *  1) inicia el acceso federado navegando al Worker;
 *  2) consulta la sesión mediante GET /api/session;
 *  3) solicita logout mediante POST /api/logout;
 *
 * La sesión vive en una cookie HttpOnly Secure administrada
 * por el BFF. El navegador nunca recibe ni almacena el secreto
 * de sesión.
 */

import {Capacitor} from '@capacitor/core';
import {Browser} from '@capacitor/browser';

const WORKER_URL =
  'https://miss-nails-api.ceballosgg2000.workers.dev';


/**
 * Inicia autenticación federada.
 *
 * El navegador no maneja tokens ni códigos OAuth.
 * Simplemente navega al endpoint correspondiente del BFF.
 *
 * @param {string} proveedor
 */
export async function iniciarSesionFederada(proveedor) {
  const proveedorNormalizado =
    String(proveedor || '').trim().toLowerCase();

  if (!['google', 'microsoft'].includes(proveedorNormalizado)) {
    throw new Error('Proveedor de acceso no permitido.');
  }

  const esAndroidNativo =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  const destino = `${WORKER_URL}/auth/${proveedorNormalizado}/start`;

  if (esAndroidNativo) {
    // Android usa el navegador del sistema (Custom Tab), no el WebView
    // como agente OAuth. El Worker devolverá el control mediante
    // missnails://auth/callback y un ticket de un solo uso.
    await Browser.open({url: `${destino}?platform=android`});
    return;
  }

  // Escritorio y PWA conservan el flujo web actual.
  window.location.assign(destino);
}


/**
 * Resuelve la sesión actual.
 *
 * El BFF lee la cookie HttpOnly y consulta al AUTH CORE
 * de Apps Script para validar la sesión.
 *
 * No se utilizan localStorage ni sessionStorage.
 */
export async function resolverSesion() {
  try {
    const respuesta = await fetch(
      `${WORKER_URL}/api/session`,
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json'
        }
      }
    );

    let json = null;

    try {
      json = await respuesta.json();
    } catch {
      json = null;
    }

    // Una indisponibilidad del servidor no equivale a una sesión inválida.
    if (respuesta.status >= 500) {
      return { autenticada: false, errorComunicacion: true, cliente: null };
    }

    if (!respuesta.ok || !json || json.ok === false || json.valida !== true) {
      return { autenticada: false, errorComunicacion: false, cliente: null };
    }

    return {
      autenticada: true,
      cliente: json.cliente || null,
      identidad: json.identidad || null,
      sesion: json.sesion || null,
      errorComunicacion: false
    };

  } catch {
    return {
      autenticada: false,
      errorComunicacion: true,
      cliente: null
    };
  }
}


/**
 * Cierra la sesión actual.
 *
 * El Worker valida el Origin y el encabezado CSRF de protección
 * antes de revocar la sesión en Apps Script.
 */
export async function cerrarSesion() {
  try {
    const respuesta = await fetch(
      `${WORKER_URL}/api/logout`,
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          'Accept': 'application/json',
          'X-CSRF-Protection': '1'
        }
      }
    );

    let json = null;

    try {
      json = await respuesta.json();
    } catch {
      json = null;
    }

    return {
      ok: respuesta.ok && !!json && json.ok !== false,
      respuesta: json
    };

  } catch {
    return {
      ok: false,
      respuesta: null
    };
  }
}

/**
 * Procesa exclusivamente el retorno OAuth registrado para Android nativo.
 * El ticket es de un solo uso; el secreto de sesión nunca viaja en la URL.
 */
export async function procesarRetornoNativo(urlRecibida) {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return false;
  }

  let url;
  try {
    url = new URL(urlRecibida);
  } catch {
    return false;
  }

  if (url.protocol !== 'missnails:' || url.hostname !== 'auth' || url.pathname !== '/callback') {
    return false;
  }

  const error = url.searchParams.get('auth_error');
  if (error) {
    window.location.replace(`/?auth_error=${encodeURIComponent(error)}`);
    return true;
  }

  const ticket = url.searchParams.get('ticket') || '';
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(ticket)) {
    window.location.replace('/?auth_error=ERROR_AUTENTICACION');
    return true;
  }

  try {
    const respuesta = await fetch(`${WORKER_URL}/auth/native/exchange`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ticket})
    });

    const resultado = await respuesta.json().catch(() => null);
    if (!respuesta.ok || !resultado || resultado.ok !== true) {
      window.location.replace('/?auth_error=ERROR_AUTENTICACION');
      return true;
    }

    // El Worker ha colocado la cookie HttpOnly en el WebView nativo.
    // Recargar permite que el arranque normal consulte /api/session.
    window.location.replace('/?auth=ok');
    return true;
  } catch {
    window.location.replace('/?auth_error=ERROR_AUTENTICACION');
    return true;
  }
}
