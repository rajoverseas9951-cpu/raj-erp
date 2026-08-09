import { NextRequest, NextResponse } from 'next/server';
import http from 'node:http';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BACKEND_IP = process.env.BACKEND_IP?.trim() || '50.6.45.3';
const BACKEND_HOST = process.env.BACKEND_HOST?.trim() || 'erp.vimawallah.com';

type Context = { params: Promise<{ path: string[] }> };

type ProxyResult = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
};

async function proxy(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const pathname = `/api/v1/${path.join('/')}${request.nextUrl.search}`;
  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : Buffer.from(await request.arrayBuffer());

  const result = await new Promise<ProxyResult>((resolve, reject) => {
    const headers: http.OutgoingHttpHeaders = {
      host: BACKEND_HOST,
      accept: request.headers.get('accept') || 'application/json',
      'user-agent': request.headers.get('user-agent') || 'Vimawallah-Vercel-Proxy',
      'x-forwarded-host': BACKEND_HOST,
      'x-forwarded-proto': 'https',
      'x-forwarded-for': request.headers.get('x-forwarded-for') || '127.0.0.1',
    };

    const authorization = request.headers.get('authorization');
    const contentType = request.headers.get('content-type');
    const cookie = request.headers.get('cookie');
    if (authorization) headers.authorization = authorization;
    if (contentType) headers['content-type'] = contentType;
    if (cookie) headers.cookie = cookie;
    if (body) headers['content-length'] = body.length;

    const upstream = http.request(
      {
        hostname: BACKEND_IP,
        port: 80,
        method,
        path: pathname,
        headers,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        response.on('end', () => {
          resolve({
            status: response.statusCode || 502,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
      },
    );

    upstream.setTimeout(15000, () => upstream.destroy(new Error('Backend request timed out')));
    upstream.on('error', reject);
    if (body) upstream.write(body);
    upstream.end();
  }).catch((error: unknown) => {
    console.error('Backend proxy failed', error);
    return null;
  });

  if (!result) {
    return NextResponse.json({ message: 'Backend is temporarily unavailable.' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(result.headers)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (['content-length', 'transfer-encoding', 'connection', 'content-encoding'].includes(lower)) continue;
    responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }

  const responseBody = new Uint8Array(result.body);
  return new NextResponse(responseBody, {
    status: result.status,
    headers: responseHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
