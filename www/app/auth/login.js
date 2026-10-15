import {iniciarSesionFederada, verificarActivacionFederada} from './auth.js';

const ERRORES_AUTENTICACION = {
  AUTENTICACION_CANCELADA: 'El acceso fue cancelado.',
  STATE_INVALIDO: 'La solicitud de acceso no pudo validarse. Inténtalo nuevamente.',
  TRANSACCION_INVALIDA: 'La solicitud de acceso ya no es válida. Inténtalo nuevamente.',
  TRANSACCION_EXPIRADA: 'La solicitud de acceso expiró. Inténtalo nuevamente.',
  IDENTIDAD_NO_VINCULADA: 'Esta cuenta no está vinculada a un cliente autorizado de MISS NAILS.',
  ACTIVACION_NO_DISPONIBLE: 'No fue posible iniciar la activación. Comprueba que utilizas el correo registrado y vuelve a intentarlo.',
  ACTIVACION_ENVIO_FALLIDO: 'No pudimos enviar el código de activación. Inténtalo nuevamente más tarde.',
  ACTIVACION_INTENTAR_MAS_TARDE: 'Se alcanzó el límite temporal de solicitudes. Espera un momento e inténtalo de nuevo.',
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
  const activationForm = document.querySelector('#mn-activation-form');
  const activationCode = document.querySelector('#mn-activation-code');
  const activationSubmit = document.querySelector('#mn-activation-submit');
  const activationCancel = document.querySelector('#mn-activation-cancel');
  let challengeId = '';
  let activationMode = false;

  if (!screen || !google || !microsoft || !message || !status || !activationForm || !activationCode || !activationSubmit || !activationCancel) {
    throw new Error('MISS NAILS: estructura de acceso federado incompleta.');
  }

  function mostrarMensaje(texto) {
    message.textContent = texto || '';
    message.hidden = !texto;
  }

  function bloquear(bloqueado, texto = '') {
    google.disabled = bloqueado || activationMode;
    microsoft.disabled = bloqueado || activationMode;
    activationSubmit.disabled = bloqueado;
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

  function limpiarParametrosActivacion() {
    const url = new URL(window.location.href);
    url.searchParams.delete('auth_step');
    url.searchParams.delete('challenge');
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  }

  async function enviarCodigoActivacion(event) {
    event.preventDefault();
    if (!challengeId) {
      mostrarMensaje('La solicitud de activación ya no es válida. Inicia sesión nuevamente.');
      return;
    }
    const codigo = activationCode.value.trim().toUpperCase();
    if (!/^[A-F0-9]{8}$/.test(codigo)) {
      mostrarMensaje('Escribe el código de 8 caracteres que recibiste por correo.');
      activationCode.focus();
      return;
    }
    mostrarMensaje('');
    bloquear(true, 'Verificando el código de activación…');
    try {
      await verificarActivacionFederada(challengeId, codigo);
    } catch (error) {
      mostrarMensaje(error.message || 'No fue posible verificar el código.');
      bloquear(false, 'Introduce el código enviado al correo registrado.');
      activationCode.focus();
    }
  }

  activationForm.addEventListener('submit', enviarCodigoActivacion);
  activationCancel.addEventListener('click', () => {
    challengeId = '';
    activationMode = false;
    activationForm.hidden = true;
    google.hidden = false;
    microsoft.hidden = false;
    limpiarParametrosActivacion();
    mostrarMensaje('');
    bloquear(false);
    google.focus();
  });

  google.addEventListener('click', () => entrar('google', google));
  microsoft.addEventListener('click', () => entrar('microsoft', microsoft));

  return {
    show() {
      screen.hidden = false;
      const params = new URLSearchParams(window.location.search);
      const step = params.get('auth_step');
      const candidate = params.get('challenge') || '';
      activationMode = step === 'activation' && /^[A-Za-z0-9_-]{32,128}$/.test(candidate);
      challengeId = activationMode ? candidate : '';
      activationForm.hidden = !activationMode;
      google.hidden = activationMode;
      microsoft.hidden = activationMode;
      if (activationMode) {
        bloquear(false, 'Introduce el código enviado al correo registrado.');
        mostrarMensaje('Para activar tu cuenta, introduce el código de un solo uso. Caduca en 10 minutos.');
        activationCode.value = '';
        activationCode.focus();
        return;
      }
      bloquear(false);
      const error = mensajeErrorDesdeURL();
      mostrarMensaje(error);
      if (!error) google.focus();
    },
    hide() {
      screen.hidden = true;
      activationForm.hidden = true;
      challengeId = '';
      activationMode = false;
      mostrarMensaje('');
    },
    showError(texto) {
      mostrarMensaje(texto);
    },
    onAuthenticated
  };
}
