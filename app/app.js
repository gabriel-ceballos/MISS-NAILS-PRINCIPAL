import {applyRuntimeContext, updateDynamicContext} from './runtime/context.js';
import {createRouter} from './navigation/router.js';
import {initCatalog} from './features/catalog.js';
import {resolverSesion, cerrarSesion} from './auth/auth.js';
import {initLogin} from './auth/login.js';

const app = document.querySelector('.mn-app');
const loginScreen = document.querySelector('#mn-login');

if (!app || !loginScreen) {
  throw new Error('MISS NAILS: estructura principal incompleta.');
}

applyRuntimeContext(app);

const router = createRouter(app);
const login = initLogin({
  onAuthenticated: () => mostrarAplicacion()
});

let catalogoInicializado = false;

function mostrarAplicacion() {
  login.hide();
  app.hidden = false;
  document.body.classList.remove('mn-auth-required');

  location.hash = '#catalogo';
  router.renderView();

  if (!catalogoInicializado) {
    catalogoInicializado = true;
    initCatalog();
  }

  actualizarCuenta();
}

function mostrarLogin() {
  app.hidden = true;
  document.body.classList.add('mn-auth-required');
  login.show();
}

async function actualizarCuenta() {
  const estado = await resolverSesion();
  if (!estado.autenticada) {
    mostrarLogin();
    return;
  }

  const cliente = estado.cliente || {};
  const nombre = document.querySelector('.profile-copy h2');
  const correo = document.querySelector('.profile-copy p');
  const avatar = document.querySelector('.avatar');

  if (nombre) nombre.textContent = cliente.nombre || 'Cliente MISS NAILS';
  if (correo) correo.textContent = cliente.correo || '';
  if (avatar) avatar.textContent = iniciales(cliente.nombre || cliente.correo || 'MN');
}

function iniciales(texto) {
  const partes = String(texto).trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return 'MN';
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

document.querySelector('.logout')?.addEventListener('click', async () => {
  await cerrarSesion();
  mostrarLogin();
});

resolverSesion().then(estado => {
  if (estado.autenticada) {
    mostrarAplicacion();
  } else {
    mostrarLogin();
  }
});

let frame = 0;
function refreshContext() {
  if (frame || app.hidden) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    updateDynamicContext(app);
  });
}
window.addEventListener('resize', refreshContext, {passive: true});
window.addEventListener('orientationchange', refreshContext, {passive: true});
