import {iniciarSesionFederada} from './auth.js';

const ERRORES_AUTENTICACION = {
  AUTENTICACION_CANCELADA: 'El acceso fue cancelado.',
  STATE_INVALIDO: 'La solicitud de acceso no pudo validarse. Inténtalo nuevamente.',
  TRANSACCION_INVALIDA: 'La solicitud de acceso ya no es válida. Inténtalo nuevamente.',
  TRANSACCION_EXPIRADA: 'La solicitud de acceso expiró. Inténtalo nuevamente.',
  IDENTIDAD_NO_VINCULADA: 'Esta cuenta no está vinculada a un cliente autorizado de MISS NAILS.',
  IDENTIDAD_DESACTIVADA: 'Esta identidad de acceso está desactivada.',
  CLIENTE_DESACTIVADO: 'El acceso de este cliente está desactivado.',
  CLIENTE_NO_ENCONTRADO: 'No existe un cliente autorizado para esta identidad.',
  ERROR_AUTENTICACION: 'No fue posible completar el acceso. Inténtalo nuevamente.'
};

function mensajeErrorDesdeURL() {
  const params = new URLSearchParams(window.location.search);
  const codigo = params.get('auth_error');
  if (!codigo) return '';

  const mensaje =
    ERRORES_AUTENTICACION[codigo] ||
    'No fue posible completar el acceso. Inténtalo nuevamente.';

  params.delete('auth_error');
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
  window.history.replaceState({}, document.title, url);

  return mensaje;
}

export function initLogin({onAuthenticated}) {
  const screen = document.querySelector('#mn-login');
  const google = document.querySelector('#mn-login-google');
  const microsoft = document.querySelector('#mn-login-microsoft');
  const message = document.querySelector('#mn-login-message');
  const status = document.querySelector('#mn-login-status');

  if (!screen || !google || !microsoft || !message || !status) {
    throw new Error('MISS NAILS: estructura de acceso federado incompleta.');
  }

  function mostrarMensaje(texto) {
    message.textContent = texto || '';
    message.hidden = !texto;
  }

  function bloquear(bloqueado, texto = '') {
    google.disabled = bloqueado;
    microsoft.disabled = bloqueado;
    google.setAttribute('aria-busy', String(bloqueado));
    microsoft.setAttribute('aria-busy', String(bloqueado));
    status.textContent = texto || 'Selecciona un proveedor para continuar.';
  }

  async function entrar(proveedor, boton) {
    mostrarMensaje('');
    bloquear(true, 'Conectando con el proveedor…');
    boton.focus();

    try {
      await iniciarSesionFederada(proveedor);
    } catch (error) {
      mostrarMensaje(error.message || 'No fue posible iniciar el acceso.');
      bloquear(false);
    }
  }

  google.addEventListener('click', () => entrar('google', google));
  microsoft.addEventListener('click', () => entrar('microsoft', microsoft));

  return {
    show() {
      screen.hidden = false;
      bloquear(false);
      const error = mensajeErrorDesdeURL();
      mostrarMensaje(error);
      if (!error) google.focus();
    },
    hide() {
      screen.hidden = true;
      mostrarMensaje('');
    },
    showError(texto) {
      mostrarMensaje(texto);
    },
    onAuthenticated
  };
}
