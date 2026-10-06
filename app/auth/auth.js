const WORKER_URL =
  'https://miss-nails-api.ceballosgg2000.workers.dev/';

async function llamarWorker(accion, datos = {}) {
  const body = new URLSearchParams();
  body.set('accion', accion);
  body.set('datos', JSON.stringify(datos));

  const respuesta = await fetch(WORKER_URL, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body
  });

  let json = null;
  try {
    json = await respuesta.json();
  } catch {
    json = null;
  }

  if (!json) {
    throw new Error('El servidor no devolvió una respuesta válida.');
  }

  return {respuesta, json};
}

export async function resolverSesion() {
  try {
    const {respuesta, json} = await llamarWorker('resolverSesion');
    if (!respuesta.ok || json.ok === false || json.valida !== true) {
      return {autenticada: false, cliente: null};
    }

    return {
      autenticada: true,
      cliente: json.cliente || null,
      identidad: json.identidad || null,
      sesion: json.sesion || null
    };
  } catch {
    return {autenticada: false, cliente: null};
  }
}

export async function iniciarSesionPassword(correo, password) {
  const {respuesta, json} = await llamarWorker('login_password', {
    correo,
    password,
    plataforma: 'web',
    dispositivo: navigator.userAgent
  });

  if (!respuesta.ok || json.ok !== true || json.autenticado !== true) {
    const motivos = {
      CREDENCIALES_INVALIDAS: 'Correo o contraseña incorrectos.',
      CLIENTE_DESACTIVADO: 'Esta cuenta está desactivada.',
      CUENTA_NO_ACTIVADA: 'Esta cuenta todavía no ha sido activada.'
    };
    throw new Error(motivos[json.motivo] || json.mensaje || 'No fue posible iniciar sesión.');
  }

  return json;
}

export async function cerrarSesion() {
  try {
    await llamarWorker('cerrarSesion');
  } catch {
    // El Worker también elimina la cookie cuando la sesión ya no es válida.
  }
}
