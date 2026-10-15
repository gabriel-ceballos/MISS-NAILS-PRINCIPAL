
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const env = {
  APP_ORIGIN: 'https://app.example.com',
  APP_ORIGINS: 'https://app.example.com',
  WORKER_ORIGIN: 'https://worker.example.com',
};

test('GET /health responde correctamente', async () => {
  const request = new Request('https://worker.example.com/health', {
    method: 'GET',
    headers: { Origin: env.APP_ORIGIN },
  });

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);

  const body = await response.json();
  assert.equal(body.ok, true);
});

test('Una ruta inexistente devuelve 404', async () => {
  const request = new Request('https://worker.example.com/ruta-inexistente', {
    method: 'GET',
    headers: { Origin: env.APP_ORIGIN },
  });

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 404);

  const body = await response.json();
  assert.equal(body.ok, false);
});

test('La verificación OTP rechaza un origen no autorizado', async () => {
  const request = new Request(
    'https://worker.example.com/auth/federated/activation/verify',
    {
      method: 'POST',
      headers: {
        Origin: 'https://origen-no-autorizado.example',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        challengeId: 'desafio-invalido',
        codigo: '12345678',
      }),
    },
  );

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 403);
});

test('La verificación OTP rechaza un código con formato inválido', async () => {
  const request = new Request(
    'https://worker.example.com/auth/federated/activation/verify',
    {
      method: 'POST',
      headers: {
        Origin: env.APP_ORIGIN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        challengeId: 'desafio-invalido',
        codigo: '123',
      }),
    },
  );

  const response = await worker.fetch(request, env);
  assert.equal(response.status, 400);

  const body = await response.json();
  assert.equal(body.error, 'CODIGO_INVALIDO');
});
