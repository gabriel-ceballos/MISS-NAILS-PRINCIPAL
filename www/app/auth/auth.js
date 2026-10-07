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
export function iniciarSesionFederada(proveedor) {
  const proveedorNormalizado =
    String(proveedor || '').trim().toLowerCase();

  if (!['google', 'microsoft'].includes(proveedorNormalizado)) {
    throw new Error('Proveedor de acceso no permitido.');
  }

  window.location.assign(
    `${WORKER_URL}/auth/${proveedorNormalizado}/start`
  );
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

    if (
      !respuesta.ok ||
      !json ||
      json.ok === false ||
      json.valida !== true
    ) {
      return {
        autenticada: false,
        cliente: null
      };
    }

    return {
      autenticada: true,
      cliente: json.cliente || null,
      identidad: json.identidad || null,
      sesion: json.sesion || null
    };

  } catch {
    return {
      autenticada: false,
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