const GOOGLE_ISSUER = 'https://accounts.google.com';
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

const MICROSOFT_AUTHORITY = 'https://login.microsoftonline.com/common/oauth2/v2.0';
const MICROSOFT_AUTH_ENDPOINT = `${MICROSOFT_AUTHORITY}/authorize`;
const MICROSOFT_TOKEN_ENDPOINT = `${MICROSOFT_AUTHORITY}/token`;
const MICROSOFT_JWKS_URL = 'https://login.microsoftonline.com/common/discovery/v2.0/keys';
const MICROSOFT_ISSUER_PREFIX = 'https://login.microsoftonline.com/';

const SESSION_COOKIE = '__Host-mn_session';
const OAUTH_COOKIE = '__Host-mn_oauth_state';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const OAUTH_TTL_SECONDS = 10 * 60;
const MAX_CLOCK_SKEW_SECONDS = 60;
const CSRF_HEADER = 'X-CSRF-Protection';
const CSRF_VALUE = '1';

const SECURITY_HEADERS = {
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

let jwksCache = new Map();

function text(value) {
  return String(value ?? '').trim();
}

function base64UrlEncode(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function randomToken(bytes = 32) {
  const data = new Uint8Array(bytes);
  crypto.getRandomValues(data);
  return base64UrlEncode(data);
}

async function sha256Base64Url(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function parseJwt(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('JWT_INVALIDO');

  let header;
  let payload;

  try {
    header = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(parts[0]))
    );
    payload = JSON.parse(
      new TextDecoder().decode(base64UrlDecode(parts[1]))
    );
  } catch {
    throw new Error('JWT_INVALIDO');
  }

  return {
    header,
    payload,
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: base64UrlDecode(parts[2]),
  };
}

function secureEqual(a, b) {
  const aa = new TextEncoder().encode(String(a));
  const bb = new TextEncoder().encode(String(b));

  if (aa.length !== bb.length) return false;

  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getAllowedOrigins(env) {
  return String(env.APP_ORIGINS || env.APP_ORIGIN || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin, env) {
  return !!origin && getAllowedOrigins(env).includes(origin);
}

function validateOrigin(request, env) {
  return isAllowedOrigin(request.headers.get('Origin'), env);
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = isAllowedOrigin(origin, env);
  const headers = {
    ...SECURITY_HEADERS,
    Vary: 'Origin',
  };

  if (allowed) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    headers['Access-Control-Allow-Headers'] =
      'Content-Type, Accept, X-CSRF-Protection';
    headers['Access-Control-Max-Age'] = '600';
  }

  return headers;
}

function jsonResponse(request, env, body, status = 200, extraHeaders = {}) {
  const headers = new Headers(corsHeaders(request, env));
  headers.set('Content-Type', 'application/json; charset=utf-8');

  for (const [key, value] of Object.entries(extraHeaders)) {
    headers.set(key, value);
  }

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function redirectResponse(location, extraHeaders = {}) {
  const headers = new Headers(SECURITY_HEADERS);
  headers.set('Location', location);

  for (const [key, value] of Object.entries(extraHeaders)) {
    if (key.toLowerCase() === 'set-cookie' && Array.isArray(value)) {
      for (const cookie of value) headers.append('Set-Cookie', cookie);
    } else {
      headers.set(key, value);
    }
  }

  return new Response(null, {
    status: 302,
    headers,
  });
}

function parseCookie(request, name) {
  const header = request.headers.get('Cookie') || '';

  for (const piece of header.split(';')) {
    const [key, ...rest] = piece.trim().split('=');
    if (key === name) return rest.join('=');
  }

  return '';
}

function sessionCookie(value) {
  return [
    `${SESSION_COOKIE}=${value}`,
    `Max-Age=${SESSION_TTL_SECONDS}`,
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=None',
  ].join('; ');
}

function clearSessionCookie() {
  return [
    `${SESSION_COOKIE}=`,
    'Max-Age=0',
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=None',
  ].join('; ');
}

function oauthCookie(value) {
  return [
    `${OAUTH_COOKIE}=${value}`,
    `Max-Age=${OAUTH_TTL_SECONDS}`,
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');
}

function clearOauthCookie() {
  return [
    `${OAUTH_COOKIE}=`,
    'Max-Age=0',
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
  ].join('; ');
}

function workerOrigin(env) {
  const value = text(env.WORKER_ORIGIN);
  if (!value || !/^https:\/\//i.test(value)) {
    throw new Error('WORKER_ORIGIN_INVALIDO');
  }
  return value.replace(/\/$/, '');
}

function callbackUrl(env, provider) {
  return `${workerOrigin(env)}/auth/${provider}/callback`;
}

function appRedirectUrl(env, params = {}) {
  const origin = text(env.APP_ORIGIN);
  if (!origin || !/^https:\/\//i.test(origin)) {
    throw new Error('APP_ORIGIN_INVALIDO');
  }

  const path = text(env.APP_PATH || '/');
  const safePath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(safePath, origin);

  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, value);
  }

  return url.toString();
}

function oauthReturnUrl(env, transaction, params = {}) {
  if (transaction?.platform === 'android') {
    const url = new URL('missnails://auth/callback');
    for (const [key, value] of Object.entries(params)) {
      if (value != null) url.searchParams.set(key, value);
    }
    return url.toString();
  }
  return appRedirectUrl(env, params);
}

function requireConfig(env, names) {
  for (const name of names) {
    if (!text(env[name])) {
      throw new Error(`CONFIG_FALTANTE:${name}`);
    }
  }
}

function requireCsrf(request, env) {
  if (!validateOrigin(request, env)) {
    return false;
  }

  return request.headers.get(CSRF_HEADER) === CSRF_VALUE;
}

async function saveOAuthTransaction(env, transaction) {
  const id = randomToken(24);
  const stub = env.OAUTH_STATE_STORE.get(
    env.OAUTH_STATE_STORE.idFromName(id)
  );

  await stub.fetch('https://oauth-state/store', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id,
      ...transaction,
      expiresAt: Date.now() + OAUTH_TTL_SECONDS * 1000,
    }),
  });

  return id;
}

async function consumeOAuthTransaction(env, id) {
  if (!id) return null;

  const stub = env.OAUTH_STATE_STORE.get(
    env.OAUTH_STATE_STORE.idFromName(id)
  );

  const response = await stub.fetch('https://oauth-state/consume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });

  if (!response.ok) return null;
  return await response.json();
}

function buildGoogleAuthorizeUrl(env, state, nonce, codeChallenge) {
  const url = new URL(GOOGLE_AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', callbackUrl(env, 'google'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

function buildMicrosoftAuthorizeUrl(env, state, nonce, codeChallenge) {
  const url = new URL(MICROSOFT_AUTH_ENDPOINT);
  url.searchParams.set('client_id', env.MICROSOFT_CLIENT_ID);
  url.searchParams.set('redirect_uri', callbackUrl(env, 'microsoft'));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('response_mode', 'query');
  url.searchParams.set('scope', 'openid profile email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('prompt', 'select_account');
  return url.toString();
}

async function startOAuth(request, env, provider) {
  const required = provider === 'google'
    ? [
        'GOOGLE_CLIENT_ID',
        'GOOGLE_CLIENT_SECRET',
        'WORKER_ORIGIN',
        'APP_ORIGIN',
        'APPS_SCRIPT_URL',
        'MISS_NAILS_SERVICE_KEY',
      ]
    : [
        'MICROSOFT_CLIENT_ID',
        'MICROSOFT_CLIENT_SECRET',
        'WORKER_ORIGIN',
        'APP_ORIGIN',
        'MICROSOFT_ALLOWED_TENANTS',
        'APPS_SCRIPT_URL',
        'MISS_NAILS_SERVICE_KEY',
      ];

  requireConfig(env, required);

  const requestUrl = new URL(request.url);
  const platform = requestUrl.searchParams.get('platform') === 'android' ? 'android' : 'web';
  const nonce = randomToken(32);
  const codeVerifier = randomToken(48);
  const codeChallenge = await sha256Base64Url(codeVerifier);

  const transactionId = await saveOAuthTransaction(env, {
    nonce,
    codeVerifier,
    provider,
    platform,
    redirectUri: callbackUrl(env, provider),
    createdAt: Date.now(),
  });

  const authorizeUrl = provider === 'google'
    ? buildGoogleAuthorizeUrl(env, transactionId, nonce, codeChallenge)
    : buildMicrosoftAuthorizeUrl(env, transactionId, nonce, codeChallenge);

  return redirectResponse(authorizeUrl, {
    'Set-Cookie': oauthCookie(transactionId),
  });
}

async function exchangeCode(env, provider, code, transaction) {
  const endpoint = provider === 'google'
    ? GOOGLE_TOKEN_ENDPOINT
    : MICROSOFT_TOKEN_ENDPOINT;

  const clientId = provider === 'google'
    ? env.GOOGLE_CLIENT_ID
    : env.MICROSOFT_CLIENT_ID;

  const clientSecret = provider === 'google'
    ? env.GOOGLE_CLIENT_SECRET
    : env.MICROSOFT_CLIENT_SECRET;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: transaction.redirectUri,
    code_verifier: transaction.codeVerifier,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  });

  const raw = await response.text();
  let json = {};

  try {
    json = JSON.parse(raw);
  } catch {
    json = {};
  }

  if (!response.ok || !json.id_token) {
    throw new Error('TOKEN_EXCHANGE_RECHAZADO');
  }

  return json;
}

async function fetchJwks(url) {
  const cached = jwksCache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;

  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error('JWKS_NO_DISPONIBLE');
  }

  const json = await response.json();
  const keys = Array.isArray(json.keys) ? json.keys : [];

  if (!keys.length) throw new Error('JWKS_SIN_CLAVES');

  jwksCache.set(url, {
    keys,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  return keys;
}

async function verifyJwtSignature(token, jwksUrl) {
  const parsed = parseJwt(token);

  if (parsed.header.alg !== 'RS256' || !parsed.header.kid) {
    throw new Error('ALGORITMO_JWT_NO_PERMITIDO');
  }

  let keys = await fetchJwks(jwksUrl);
  let jwk = keys.find(key => key.kid === parsed.header.kid);

  if (!jwk) {
    jwksCache.delete(jwksUrl);
    keys = await fetchJwks(jwksUrl);
    jwk = keys.find(key => key.kid === parsed.header.kid);
  }

  if (!jwk || jwk.kty !== 'RSA') {
    throw new Error('CLAVE_JWT_NO_PERMITIDA');
  }

  if (jwk.alg && jwk.alg !== 'RS256') {
    throw new Error('ALGORITMO_CLAVE_NO_PERMITIDO');
  }

  if (jwk.use && jwk.use !== 'sig') {
    throw new Error('USO_CLAVE_NO_PERMITIDO');
  }

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    parsed.signature,
    new TextEncoder().encode(parsed.signingInput)
  );

  if (!valid) throw new Error('FIRMA_JWT_INVALIDA');
  return parsed;
}

function validateTimeClaims(payload) {
  const now = nowSeconds();
  const exp = Number(payload.exp);

  if (!Number.isFinite(exp) || now >= exp) {
    throw new Error('ID_TOKEN_EXPIRADO');
  }

  if (payload.nbf != null) {
    const nbf = Number(payload.nbf);
    if (!Number.isFinite(nbf) || now + MAX_CLOCK_SKEW_SECONDS < nbf) {
      throw new Error('ID_TOKEN_AUN_NO_VALIDO');
    }
  }

  if (payload.iat != null) {
    const iat = Number(payload.iat);
    if (!Number.isFinite(iat) || iat > now + MAX_CLOCK_SKEW_SECONDS) {
      throw new Error('ID_TOKEN_IAT_INVALIDO');
    }
  }
}

function validateAudience(payload, clientId) {
  const audiences = Array.isArray(payload.aud)
    ? payload.aud
    : [payload.aud];

  if (audiences.length !== 1 || audiences[0] !== clientId) {
    throw new Error('AUDIENCE_JWT_INVALIDA');
  }

  if (payload.azp != null && payload.azp !== clientId) {
    throw new Error('AZP_JWT_INVALIDO');
  }
}

function validateSubject(payload) {
  if (!payload.sub || typeof payload.sub !== 'string' || payload.sub.length > 255) {
    throw new Error('SUBJECT_JWT_INVALIDO');
  }
}

function validateGoogle(payload, transaction, env) {
  if (payload.iss !== GOOGLE_ISSUER) {
    throw new Error('ISSUER_GOOGLE_INVALIDO');
  }

  validateAudience(payload, env.GOOGLE_CLIENT_ID);
  validateTimeClaims(payload);
  validateSubject(payload);

  if (!secureEqual(payload.nonce || '', transaction.nonce)) {
    throw new Error('NONCE_GOOGLE_INVALIDO');
  }

  if (payload.email_verified !== true) {
    throw new Error('EMAIL_GOOGLE_NO_VERIFICADO');
  }

  const email = text(payload.email).toLowerCase();
  if (!email) throw new Error('EMAIL_GOOGLE_AUSENTE');

  return {
    proveedor: 'GOOGLE',
    issuer: GOOGLE_ISSUER,
    subject: payload.sub,
    tenantId: '',
    email,
    emailVerificado: true,
  };
}

function allowedMicrosoftTenants(env) {
  return String(env.MICROSOFT_ALLOWED_TENANTS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
}

function isGuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateMicrosoftKeyIssuer(jwk, tenantId, issuer) {
  if (!jwk.issuer) return true;

  const normalized = String(jwk.issuer).replace('{tenantid}', tenantId);
  return normalized === issuer;
}

async function validateMicrosoft(token, transaction, env) {
  const parsed = parseJwt(token);
  const payload = parsed.payload;
  const tid = text(payload.tid).toLowerCase();

  if (!isGuid(tid)) {
    throw new Error('TENANT_MICROSOFT_INVALIDO');
  }

if (!allowedMicrosoftTenants(env).includes(tid)) {
  console.error(
    'MICROSOFT_TENANT_DIAGNOSTICO',
    JSON.stringify({
      tid_recibido: tid,
      tenants_permitidos: allowedMicrosoftTenants(env),
    })
  );

  throw new Error('TENANT_MICROSOFT_NO_AUTORIZADO');
}

  if (payload.ver !== '2.0') {
    throw new Error('VERSION_MICROSOFT_NO_PERMITIDA');
  }

  const expectedIssuer = `${MICROSOFT_ISSUER_PREFIX}${tid}/v2.0`;

  if (payload.iss !== expectedIssuer) {
    throw new Error('ISSUER_MICROSOFT_INVALIDO');
  }

  validateAudience(payload, env.MICROSOFT_CLIENT_ID);
  validateTimeClaims(payload);
  validateSubject(payload);

  if (!secureEqual(payload.nonce || '', transaction.nonce)) {
    throw new Error('NONCE_MICROSOFT_INVALIDO');
  }

  let keys = await fetchJwks(MICROSOFT_JWKS_URL);
  let jwk = keys.find(key => key.kid === parsed.header.kid);

  if (!jwk || !validateMicrosoftKeyIssuer(jwk, tid, expectedIssuer)) {
    jwksCache.delete(MICROSOFT_JWKS_URL);
    keys = await fetchJwks(MICROSOFT_JWKS_URL);
    const refreshed = keys;
    const refreshedKey = refreshed.find(key => key.kid === parsed.header.kid);

    if (!refreshedKey || !validateMicrosoftKeyIssuer(refreshedKey, tid, expectedIssuer)) {
      throw new Error('CLAVE_MICROSOFT_NO_CORRESPONDE_ISSUER');
    }
  }

  await verifyJwtSignature(token, MICROSOFT_JWKS_URL);

  const email = text(
    payload.email || payload.preferred_username
  ).toLowerCase();

  if (!email) {
    throw new Error('EMAIL_MICROSOFT_AUSENTE');
  }

  return {
    proveedor: 'MICROSOFT',
    issuer: expectedIssuer,
    subject: payload.sub,
    tenantId: tid,
    email,
    emailVerificado: true,
  };

}

async function validateIdentityToken(token, transaction, env) {
  if (transaction.provider === 'google') {
    const parsed = await verifyJwtSignature(token, GOOGLE_JWKS_URL);
    return validateGoogle(parsed.payload, transaction, env);
  }

  if (transaction.provider === 'microsoft') {
    return validateMicrosoft(token, transaction, env);
  }

  throw new Error('PROVEEDOR_NO_PERMITIDO');
}

async function callAppsScript(env, action, data) {
  requireConfig(env, ['APPS_SCRIPT_URL', 'MISS_NAILS_SERVICE_KEY']);

  const body = new URLSearchParams();
  body.set('accion', action);
  body.set(
    'datos',
    JSON.stringify({
      ...data,
      serviceKey: env.MISS_NAILS_SERVICE_KEY,
    })
  );

  const response = await fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      Accept: 'application/json',
    },
    body,
  });

  const raw = await response.text();
  let json = {};

  try {
    json = JSON.parse(raw);
  } catch {
    json = {};
  }

  return {
    status: response.status,
    json,
  };
}

async function loginFederated(env, identity, request) {
  const platform =
    request.headers.get('Sec-CH-UA-Platform') || 'web';

  const device =
    request.headers.get('User-Agent') || '';

  const result = await callAppsScript(
    env,
    'auth_v2_login_federado',
    {
      ...identity,
      plataforma: text(platform).slice(0, 100),
      dispositivo: text(device).slice(0, 200),
    }
  );

console.log('AUTH_DIAGNOSTICO', JSON.stringify({
  etapa: 'auth_v2_login_federado',
  status: result.status,
  ok: result.json?.ok === true,
  autenticado: result.json?.autenticado === true,
  motivo: text(result.json?.motivo),
  mensaje: text(result.json?.mensaje),
  diagnostico: result.json?.diagnostico || null,
  tieneSesion: !!result.json?.sesion,
  tieneSessionSecret:
    !!text(result.json?.sesion?.sessionSecret),
  proveedor: text(identity?.proveedor),
}));

  if (
    result.status < 200 ||
    result.status >= 300 ||
    result.json.ok !== true ||
    result.json.autenticado !== true
  ) {
    const reason =
      result.json.motivo ||
      'AUTENTICACION_RECHAZADA';

    throw new Error(reason);
  }

  const sessionSecret =
    text(result.json?.sesion?.sessionSecret);

  if (!sessionSecret) {
    console.log(
      'AUTH_DIAGNOSTICO',
      JSON.stringify({
        etapa: 'session_secret',
        resultado: 'AUSENTE',
      })
    );

    throw new Error('SESSION_SECRET_AUSENTE');
  }

  console.log(
    'AUTH_DIAGNOSTICO',
    JSON.stringify({
      etapa: 'session_secret',
      resultado: 'OK',
    })
  );

  return result.json;
}

function mapAuthError(error) {
  const code = text(error?.message);

  const direct = new Set([
    'IDENTIDAD_NO_VINCULADA',
    'IDENTIDAD_DESACTIVADA',
    'CLIENTE_NO_ENCONTRADO',
    'CLIENTE_DESACTIVADO',
    'ERROR_AUTH_V2',
    'SERVICE_KEY_INVALIDA',
    'SESSION_SECRET_AUSENTE',
    'AUTENTICACION_RECHAZADA',
  ]);

  if (direct.has(code)) return code;

  if (code === 'AUTENTICACION_CANCELADA') return code;

  // Durante diagnóstico: conservar el código técnico
  // para identificar exactamente dónde está fallando.
  if (code) {
    return code.slice(0, 80);
  }

  return 'ERROR_AUTENTICACION';
}

async function handleOAuthCallback(request, env, provider) {
  const url = new URL(request.url);
  const transactionId = text(url.searchParams.get('state'));
  const cookieState = parseCookie(request, OAUTH_COOKIE);

  if (!transactionId || !cookieState || !secureEqual(transactionId, cookieState)) {
    return redirectResponse(
      appRedirectUrl(env, { auth_error: 'STATE_INVALIDO' }),
      { 'Set-Cookie': clearOauthCookie() }
    );
  }

  const transaction = await consumeOAuthTransaction(env, transactionId);

  if (!transaction) {
    return redirectResponse(
      appRedirectUrl(env, { auth_error: 'TRANSACCION_EXPIRADA' }),
      { 'Set-Cookie': clearOauthCookie() }
    );
  }

  if (transaction.provider !== provider) {
    return redirectResponse(
      oauthReturnUrl(env, transaction, { auth_error: 'TRANSACCION_INVALIDA' }),
      { 'Set-Cookie': clearOauthCookie() }
    );
  }

  const error = text(url.searchParams.get('error'));

  if (error) {
    const errorCode = error === 'access_denied'
      ? 'AUTENTICACION_CANCELADA'
      : 'ERROR_AUTENTICACION';

    return redirectResponse(
      oauthReturnUrl(env, transaction, { auth_error: errorCode }),
      { 'Set-Cookie': clearOauthCookie() }
    );
  }

  const code = text(url.searchParams.get('code'));

  if (!code) {
    return redirectResponse(
      oauthReturnUrl(env, transaction, { auth_error: 'ERROR_AUTENTICACION' }),
      { 'Set-Cookie': clearOauthCookie() }
    );
  }

  try {
    const tokens = await exchangeCode(env, provider, code, transaction);
    const identity = await validateIdentityToken(
      tokens.id_token,
      transaction,
      env
    );
    const result = await loginFederated(env, identity, request);
    const sessionSecret = result.sesion.sessionSecret;

    if (transaction.platform === 'android') {
      // La cookie del navegador externo no está disponible en el WebView.
      // Se entrega un ticket aleatorio, efímero y de un solo uso para que
      // el WebView reciba la cookie HttpOnly sin exponer el secreto.
      const ticket = await saveOAuthTransaction(env, {
        type: 'native_handoff',
        sessionSecret,
        platform: 'android',
        createdAt: Date.now(),
      });
      return redirectResponse(
        oauthReturnUrl(env, transaction, {ticket}),
        {'Set-Cookie': clearOauthCookie()}
      );
    }

    return redirectResponse(
      appRedirectUrl(env, { auth: 'ok' }),
      {
        'Set-Cookie': [
          sessionCookie(sessionSecret),
          clearOauthCookie(),
        ],
      }
    );
} catch (error) {

  console.error(
    'AUTH_DIAGNOSTICO',
    JSON.stringify({
      etapa: 'oauth_callback',
      provider,
      error: mapAuthError(error)
    })
  );
    return redirectResponse(
      oauthReturnUrl(env, transaction, { auth_error: mapAuthError(error) }),
      { 'Set-Cookie': clearOauthCookie() }
    );
  }
}

async function handleNativeHandoffExchange(request, env) {
  if (request.method !== 'POST' || !validateOrigin(request, env)) {
    return jsonResponse(request, env, {ok: false, error: 'ORIGEN_NO_AUTORIZADO'}, 403);
  }

  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return jsonResponse(request, env, {ok: false, error: 'CONTENT_TYPE_INVALIDO'}, 415);
  }

  const body = await request.json().catch(() => ({}));
  const ticket = text(body.ticket);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(ticket)) {
    return jsonResponse(request, env, {ok: false, error: 'TICKET_INVALIDO'}, 400);
  }

  const handoff = await consumeOAuthTransaction(env, ticket);
  if (!handoff || handoff.type !== 'native_handoff' || handoff.platform !== 'android' || !text(handoff.sessionSecret)) {
    return jsonResponse(request, env, {ok: false, error: 'TICKET_EXPIRADO'}, 401);
  }

  return jsonResponse(
    request,
    env,
    {ok: true},
    200,
    {'Set-Cookie': sessionCookie(handoff.sessionSecret)}
  );
}

async function resolveSession(request, env) {
  const secret = parseCookie(request, SESSION_COOKIE);

  if (!secret) {
    return {
      ok: true,
      autenticado: false,
      valida: false,
    };
  }

  const result = await callAppsScript(
    env,
    'auth_v2_resolver_sesion',
    { sessionSecret: secret }
  );

  if (
    result.status < 200 ||
    result.status >= 300 ||
    result.json.valida !== true
  ) {
    return {
      ok: true,
      autenticado: false,
      valida: false,
      motivo: result.json.motivo || 'SESION_INVALIDA',
    };
  }

  return {
    ok: true,
    autenticado: true,
    valida: true,
    cliente: result.json.cliente || null,
    identidad: result.json.identidad || null,
    sesion: result.json.sesion || null,
  };
}

async function handleSession(request, env) {
  if (!validateOrigin(request, env)) {
    return jsonResponse(
      request,
      env,
      { ok: false, autenticado: false, valida: false, motivo: 'ORIGEN_NO_AUTORIZADO' },
      403
    );
  }

  try {
    return jsonResponse(request, env, await resolveSession(request, env));
  } catch {
    return jsonResponse(
      request,
      env,
      { ok: false, autenticado: false, valida: false, motivo: 'ERROR_SESION' },
      502
    );
  }
}

async function handleActivity(request, env) {
  if (!requireCsrf(request, env)) {
    return jsonResponse(
      request,
      env,
      { ok: false, motivo: 'CSRF_RECHAZADO' },
      403
    );
  }

  const secret = parseCookie(request, SESSION_COOKIE);
  if (!secret) {
    return jsonResponse(
      request,
      env,
      { ok: false, motivo: 'SESION_INVALIDA' },
      401
    );
  }

  try {
    const result = await callAppsScript(
      env,
      'auth_v2_actividad',
      { sessionSecret: secret }
    );

    return jsonResponse(
      request,
      env,
      result.json,
      result.status >= 200 && result.status < 600 ? result.status : 502
    );
  } catch {
    return jsonResponse(
      request,
      env,
      { ok: false, motivo: 'ERROR_SESION' },
      502
    );
  }
}

async function handleLogout(request, env) {
  if (!requireCsrf(request, env)) {
    return jsonResponse(
      request,
      env,
      { ok: false, cerrada: false, motivo: 'CSRF_RECHAZADO' },
      403
    );
  }

  const secret = parseCookie(request, SESSION_COOKIE);

  if (!secret) {
    return jsonResponse(
      request,
      env,
      { ok: true, cerrada: true, yaCerrada: true },
      200,
      { 'Set-Cookie': clearSessionCookie() }
    );
  }

  try {
    const result = await callAppsScript(
      env,
      'auth_v2_cerrar_sesion',
      {
        sessionSecret: secret,
        motivo: 'LOGOUT_USUARIO',
      }
    );

    if (result.status < 200 || result.status >= 300 || result.json.ok !== true) {
      return jsonResponse(
        request,
        env,
        { ok: false, cerrada: false, motivo: 'LOGOUT_NO_CONFIRMADO' },
        502
      );
    }

    return jsonResponse(
      request,
      env,
      { ok: true, cerrada: true },
      200,
      { 'Set-Cookie': clearSessionCookie() }
    );
  } catch {
    return jsonResponse(
      request,
      env,
      { ok: false, cerrada: false, motivo: 'ERROR_LOGOUT' },
      502
    );
  }
}

async function proxyBusinessAction(request, env, action, input = {}) {
  const secret = parseCookie(request, SESSION_COOKIE);

  if (action !== 'productos' && !secret) {
    throw new Error('SESION_INVALIDA');
  }

  let session = null;

  if (secret) {
    session = await resolveSession(request, env);
    if (!session.autenticado) throw new Error('SESION_INVALIDA');
  }

  const data = {
    ...input,
  };

  if (secret && session) {
    data.sessionSecret = secret;
    data.idCliente = session.cliente?.idCliente || '';
    data.correo = session.cliente?.correo || '';
    data.inicioSesion = Date.parse(session.sesion?.creada || '') || Date.now();
  }

  const result = await callAppsScript(env, action, data);
  return result.json;
}

async function handleLegacyBusiness(request, env) {
  if (!validateOrigin(request, env)) {
    return jsonResponse(
      request,
      env,
      { ok: false, mensaje: 'Origen no autorizado.' },
      403
    );
  }

  const contentType = request.headers.get('Content-Type') || '';
  let body = {};

  if (contentType.includes('application/json')) {
    body = await request.json().catch(() => ({}));
  } else if (contentType.includes('application/x-www-form-urlencoded')) {
    const rawBody = await request.text();
    const form = new URLSearchParams(rawBody);
    const raw = text(form.get('datos'));
    try {
      body = {
        accion: text(form.get('accion')),
        datos: raw ? JSON.parse(raw) : {},
      };
    } catch {
      body = {
        accion: text(form.get('accion')),
        datos: {},
      };
    }
  } else {
    return jsonResponse(
      request,
      env,
      { ok: false, mensaje: 'Content-Type no permitido.' },
      415
    );
  }

  const action = text(body.accion);
  const datos = body.datos && typeof body.datos === 'object'
    ? body.datos
    : {};

  const businessActions = new Set([
    'productos',
    'obtenerCarrito',
    'agregarAlCarrito',
    'cambiarCantidadCarrito',
    'eliminarDelCarrito',
    'vaciarCarrito',
  ]);

  if (!businessActions.has(action)) {
    return jsonResponse(
      request,
      env,
      { ok: false, mensaje: 'Acción no permitida.' },
      400
    );
  }

  if (action !== 'productos' && !requireCsrf(request, env)) {
    return jsonResponse(
      request,
      env,
      { ok: false, mensaje: 'Protección CSRF requerida.' },
      403
    );
  }

  try {
    const result = await proxyBusinessAction(request, env, action, datos);
    return jsonResponse(
      request,
      env,
      result,
      result?.ok === false ? 400 : 200
    );
  } catch (error) {
    if (error.message === 'SESION_INVALIDA') {
      return jsonResponse(
        request,
        env,
        { ok: false, motivo: 'SESION_INVALIDA' },
        401
      );
    }

    return jsonResponse(
      request,
      env,
      { ok: false, mensaje: 'No fue posible completar la operación.' },
      502
    );
  }
}

function healthResponse(request, env) {
  return jsonResponse(request, env, {
    ok: true,
    servicio: 'MISS NAILS BFF',
    version: 'FEDERATED-BFF-V2',
  });
}

export class OAuthStateStore {
  constructor(ctx) {
    this.ctx = ctx;
  }

  async fetch(request) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const payload = await request.json().catch(() => ({}));
    const id = text(payload.id);

    if (!id) {
      return new Response('Bad Request', { status: 400 });
    }

    const key = `oauth:${id}`;
    const path = new URL(request.url).pathname;

    if (path.endsWith('/store')) {
      await this.ctx.storage.put(key, payload);
      return new Response('ok');
    }

    if (path.endsWith('/consume')) {
      const value = await this.ctx.storage.get(key);

      if (!value) {
        return new Response('not found', { status: 404 });
      }

      await this.ctx.storage.delete(key);

      if (!value.expiresAt || value.expiresAt < Date.now()) {
        return new Response('not found', { status: 404 });
      }

      return new Response(JSON.stringify(value), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      if (url.pathname === '/health' && request.method === 'GET') {
        return healthResponse(request, env);
      }

      if (url.pathname === '/' && request.method === 'GET') {
        return healthResponse(request, env);
      }

      if (url.pathname === '/auth/google/start' && request.method === 'GET') {
        return await startOAuth(request, env, 'google');
      }

      if (url.pathname === '/auth/google/callback' && request.method === 'GET') {
        return await handleOAuthCallback(request, env, 'google');
      }

      if (url.pathname === '/auth/microsoft/start' && request.method === 'GET') {
        return await startOAuth(request, env, 'microsoft');
      }

      if (url.pathname === '/auth/microsoft/callback' && request.method === 'GET') {
        return await handleOAuthCallback(request, env, 'microsoft');
      }

      if (url.pathname === '/auth/native/exchange' && request.method === 'POST') {
        return await handleNativeHandoffExchange(request, env);
      }

      if (url.pathname === '/api/session' && request.method === 'GET') {
        return await handleSession(request, env);
      }

      if (url.pathname === '/api/activity' && request.method === 'POST') {
        return await handleActivity(request, env);
      }

      if (url.pathname === '/api/logout' && request.method === 'POST') {
        return await handleLogout(request, env);
      }

      // Compatibilidad exclusiva con el catálogo/carrito existente.
      // El antiguo contrato de autenticación /api + accion ya no existe.
      if ((url.pathname === '/' || url.pathname === '/api') && request.method === 'POST') {
        return await handleLegacyBusiness(request, env);
      }

      if (request.method === 'OPTIONS') {
        if (!validateOrigin(request, env)) {
          return new Response(null, {
            status: 403,
            headers: SECURITY_HEADERS,
          });
        }

        return new Response(null, {
          status: 204,
          headers: corsHeaders(request, env),
        });
      }

      return jsonResponse(
        request,
        env,
        { ok: false, mensaje: 'Ruta no encontrada.' },
        404
      );
    } catch (error) {
      return jsonResponse(
        request,
        env,
        { ok: false, mensaje: 'Error interno del BFF.' },
        500
      );
    }
  },
};
