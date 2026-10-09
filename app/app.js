
import {applyRuntimeContext, updateDynamicContext} from './runtime/context.js';
import {createRouter} from './navigation/router.js';
import {initCatalog} from './features/catalog.js';
import {
  resolverSesion,
  cerrarSesion,
  procesarRetornoNativo
} from './auth/auth.js';
import {Capacitor} from '@capacitor/core';
import {App} from '@capacitor/app';
import {initLogin} from './auth/login.js';

const app = document.querySelector('.mn-app');
const loginScreen = document.querySelector('#mn-login');

if (!app || !loginScreen) {
  throw new Error('MISS NAILS: estructura principal incompleta.');
}

applyRuntimeContext(app);

const esAndroidNativo =
  Capacitor.isNativePlatform() &&
  Capacitor.getPlatform() === 'android';

/*
 * ANDROID NATIVO
 *
 * Registramos primero el listener de retorno OAuth y después
 * consultamos el enlace con el que Android pudo iniciar la app.
 *
 * Se comparte la promesa para evitar procesar dos veces el mismo
 * enlace cuando coinciden appUrlOpen y getLaunchUrl.
 *
 * PWA y escritorio no ejecutan este flujo.
 */
let retornoNativoPromise = null;

function procesarUrlNativa(url) {
  if (!url) {
    return Promise.resolve(false);
  }

  if (retornoNativoPromise) {
    return retornoNativoPromise;
  }

  retornoNativoPromise = procesarRetornoNativo(url)
    .then((procesado) => {
      if (!procesado) {
        retornoNativoPromise = null;
      }

      return procesado;
    })
    .catch(() => {
      retornoNativoPromise = null;
      return false;
    });

  return retornoNativoPromise;
}

let urlInicialNativa = Promise.resolve(null);

if (esAndroidNativo) {
  void App.addListener('appUrlOpen', ({url}) => {
    void procesarUrlNativa(url);
  }).catch(() => {});

  // Espera a conocer el enlace inicial antes de resolver la sesión.
  urlInicialNativa = App.getLaunchUrl()
    .then((launch) => launch?.url || null)
    .catch(() => null);
}

const router = createRouter(app);

const login = initLogin({
  onAuthenticated: () => mostrarAplicacion()
});

let catalogoInicializado = false;


function mostrarAplicacion(estadoSesion = null) {
  login.hide();
  app.hidden = false;
  document.body.classList.remove('mn-auth-required');

  location.hash = '#catalogo';
  router.renderView();

  if (!catalogoInicializado) {
    catalogoInicializado = true;
    initCatalog();
  }

  void actualizarCuenta(estadoSesion);
}


function mostrarLogin() {
  app.hidden = true;
  document.body.classList.add('mn-auth-required');
  login.show();
}


async function actualizarCuenta(estadoSesion = null) {
  // Reutiliza la sesión ya validada durante el arranque.
  // Solo consulta al servidor si no recibimos un estado previo.
  const estado = estadoSesion || await resolverSesion();

  // Una consulta secundaria fallida no debe ocultar el catálogo
  // ni volver a mostrar el login por sí sola.
  if (!estado.autenticada) {
    return;
  }

  const cliente = estado.cliente || {};

  const nombre = document.querySelector('.profile-copy h2');
  const correo = document.querySelector('.profile-copy p');
  const avatar = document.querySelector('.avatar');

  if (nombre) {
    nombre.textContent = cliente.nombre || 'Cliente MISS NAILS';
  }

  if (correo) {
    correo.textContent = cliente.correo || '';
  }

  if (avatar) {
    avatar.textContent = iniciales(
      cliente.nombre || cliente.correo || 'MN'
    );
  }
}


function iniciales(texto) {
  const partes = String(texto)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!partes.length) {
    return 'MN';
  }

  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }

  return (
    partes[0][0] +
    partes[partes.length - 1][0]
  ).toUpperCase();
}

document.querySelector('.logout')?.addEventListener(
  'click',
  async () => {
    await cerrarSesion();
    mostrarLogin();
  }
);

/*
 * ARRANQUE
 *
 * En Android se espera primero la comprobación del enlace inicial
 * y de cualquier retorno OAuth que ya esté procesándose.
 *
 * Si el enlace fue procesado, auth.js se encarga de la navegación
 * de retorno. No mostramos la pantalla de login durante ese flujo.
 *
 * En PWA y escritorio se conserva la comprobación web habitual.
 */
async function iniciarAplicacion() {
  if (esAndroidNativo) {
    const urlInicial = await urlInicialNativa;

    if (urlInicial) {
      const procesado = await procesarUrlNativa(urlInicial);

      if (procesado) {
        return;
      }
    }

    // El evento appUrlOpen pudo adelantarse a getLaunchUrl.
    if (retornoNativoPromise) {
      const procesado = await retornoNativoPromise;

      if (procesado) {
        return;
      }
    }
  }


  const estado = await resolverSesion();

  // Si el retorno OAuth comenzó durante la consulta de sesión,
  // espera a que termine antes de decidir qué pantalla mostrar.
  if (esAndroidNativo && retornoNativoPromise) {
    const procesado = await retornoNativoPromise;

    if (procesado) {
      return;
    }
  }

  if (estado.autenticada) {
    mostrarAplicacion(estado);
  } else {
    mostrarLogin();
  }

}

void iniciarAplicacion();

let frame = 0;

function refreshContext() {
  if (frame || app.hidden) {
    return;
  }

  frame = requestAnimationFrame(() => {
    frame = 0;
    updateDynamicContext(app);
  });
}

window.addEventListener('resize', refreshContext, {passive: true});
window.addEventListener(
  'orientationchange',
  refreshContext,
  {passive: true}
);
