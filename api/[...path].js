import { Buffer } from 'node:buffer';
import process from 'node:process';

export default async function handler(request, response) {
  const backendUrl = process.env.BACKEND_URL || 'https://noema-backend-gj6y.onrender.com';

  const path = Array.isArray(request.query.path)
    ? request.query.path
    : [request.query.path].filter(Boolean);
  const incomingUrl = new URL(request.url, `https://${request.headers.host}`);
  const backendBase = backendUrl.replace(/\/$/, '').replace(/\/api$/, '');
  const targetUrl = new URL(`api/${path.map(encodeURIComponent).join('/')}`, `${backendBase}/`);
  targetUrl.search = incomingUrl.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const hasBody = !['GET', 'HEAD'].includes(request.method);
  const upstreamResponse = await fetch(targetUrl, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    duplex: hasBody ? 'half' : undefined,
  });

  response.status(upstreamResponse.status);
  upstreamResponse.headers.forEach((value, key) => {
    if (key !== 'set-cookie') response.setHeader(key, value);
  });

  const cookies = upstreamResponse.headers.getSetCookie?.() || [];
  if (cookies.length > 0) {
    response.setHeader('set-cookie', cookies);
  }

  response.send(Buffer.from(await upstreamResponse.arrayBuffer()));
}