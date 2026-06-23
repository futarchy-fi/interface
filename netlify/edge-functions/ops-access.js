const ACCESS_KEY_ENV = 'OPS_SIGNER_ACCESS_KEY';
const ACCESS_QUERY_PARAM = 'access';
const COOKIE_NAME = 'futarchy_ops_access';
const COOKIE_TTL_SECONDS = 24 * 60 * 60;
const COOKIE_VERSION = 'v1';

function getEnv(name) {
  if (globalThis.Netlify?.env?.get) {
    return globalThis.Netlify.env.get(name);
  }

  if (typeof Deno !== 'undefined' && Deno.env?.get) {
    return Deno.env.get(name);
  }

  return undefined;
}

function notFound() {
  return new Response('Not found', {
    status: 404,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/plain; charset=utf-8',
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

function timingSafeEqual(left = '', right = '') {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let diff = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    diff |= (leftBytes[index] || 0) ^ (rightBytes[index] || 0);
  }

  return diff === 0;
}

function base64Url(bytes) {
  let value = '';
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });

  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

async function signToken(secret, expiresAt) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`ops:${expiresAt}`));

  return base64Url(new Uint8Array(signature));
}

async function createCookieToken(secret) {
  const expiresAt = Date.now() + COOKIE_TTL_SECONDS * 1000;
  const signature = await signToken(secret, expiresAt);

  return `${COOKIE_VERSION}.${expiresAt}.${signature}`;
}

async function isCookieTokenValid(token, secret) {
  const [version, expiresAt, signature] = String(token || '').split('.');
  const expiresAtNumber = Number(expiresAt);

  if (version !== COOKIE_VERSION || !Number.isFinite(expiresAtNumber) || expiresAtNumber <= Date.now()) {
    return false;
  }

  const expectedSignature = await signToken(secret, expiresAt);

  return timingSafeEqual(signature, expectedSignature);
}

function setAccessCookieResponse(url, token) {
  const redirectUrl = new URL('/ops', url);
  const isLocalhost = redirectUrl.hostname === 'localhost' || redirectUrl.hostname === '127.0.0.1';
  const secureAttribute = isLocalhost ? '' : '; Secure';

  return new Response(null, {
    status: 302,
    headers: {
      'cache-control': 'no-store',
      location: redirectUrl.pathname,
      'set-cookie': `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/ops; Max-Age=${COOKIE_TTL_SECONDS}; HttpOnly${secureAttribute}; SameSite=Strict`,
      'x-robots-tag': 'noindex, nofollow',
    },
  });
}

export default async function opsAccess(request, context) {
  const accessKey = getEnv(ACCESS_KEY_ENV);

  if (!accessKey) {
    return notFound();
  }

  const url = new URL(request.url);
  const queryAccess = url.searchParams.get(ACCESS_QUERY_PARAM);

  if (queryAccess && timingSafeEqual(queryAccess, accessKey)) {
    const token = await createCookieToken(accessKey);

    return setAccessCookieResponse(url, token);
  }

  if (await isCookieTokenValid(context.cookies.get(COOKIE_NAME), accessKey)) {
    const response = await context.next();
    response.headers.set('x-robots-tag', 'noindex, nofollow');
    response.headers.set('cache-control', 'no-store');

    return response;
  }

  return notFound();
}

export const config = {
  path: ['/ops', '/ops/', '/ops.html', '/ops/index.html'],
};
