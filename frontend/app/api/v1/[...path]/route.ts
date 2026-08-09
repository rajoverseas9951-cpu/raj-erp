import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN?.trim() || 'http://50.6.45.3';
const BACKEND_HOST = process.env.BACKEND_HOST?.trim() || 'erp.vimawallah.com';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const upstream = new URL(`${BACKEND_ORIGIN.replace(/\/$/, '')}/api/v1/${path.join('/')}`);
  upstream.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of ['accept', 'authorization', 'content-type', 'cookie', 'user-agent']) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('host', BACKEND_HOST);
  headers.set('x-forwarded-host', BACKEND_HOST);
  headers.set('x-forwarded-proto', 'https');
  headers.set('x-forwarded-for', request.headers.get('x-forwarded-for') || '127.0.0.1');

  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

  const response = await fetch(upstream, {
    method,
    headers,
    body,
    cache: 'no-store',
    redirect: 'manual',
  });

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('transfer-encoding');

  return new NextResponse(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
