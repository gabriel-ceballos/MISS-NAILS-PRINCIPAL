import {iniciarSesionPassword} from './auth.js';

export function initLogin({onAuthenticated}) {
  const screen = document.querySelector('#mn-login');
  const form = document.querySelector('#mn-login-form');
  const email = document.querySelector('#mn-login-email');
  const password = document.querySelector('#mn-login-password');
  const submit = document.querySelector('#mn-login-submit');
  const message = document.querySelector('#mn-login-message');

  if (!screen || !form || !email || !password || !submit || !message) {
    throw new Error('MISS NAILS: estructura de login incompleta.');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    message.hidden = true;

    const correo = email.value.trim().toLowerCase();
    const clave = password.value;

    if (!correo || !clave) {
      message.textContent = 'Escribe tu correo y contraseña.';
      message.hidden = false;
      return;
    }

    submit.disabled = true;
    submit.setAttribute('aria-busy', 'true');
    submit.textContent = 'Ingresando…';

    try {
      await iniciarSesionPassword(correo, clave);
      password.value = '';
      onAuthenticated();
    } catch (error) {
      message.textContent = error.message;
      message.hidden = false;
      password.select();
    } finally {
      submit.disabled = false;
      submit.removeAttribute('aria-busy');
      submit.textContent = 'Iniciar sesión';
    }
  });

  return {
    show() {
      screen.hidden = false;
      email.focus();
    },
    hide() {
      screen.hidden = true;
    }
  };
}
