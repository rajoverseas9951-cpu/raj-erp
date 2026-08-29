import { NextRequest, NextResponse } from 'next/server';
import https from 'node:https';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const BACKEND_IP = process.env.BACKEND_IP?.trim() || '50.6.45.3';
const BACKEND_HOST = process.env.BACKEND_HOST?.trim() || 'api.vimawallah.com';
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 443);

type Context = { params: Promise<{ path: string[] }> };

type ProxyResult = {
  status: number;
  headers: https.IncomingHttpHeaders;
  body: Buffer;
};

async function proxy(request: NextRequest, context: Context) {
  const { path } = await context.params;
  const isPolicyOcr = path.join('/') === 'public-policy-ocr';
  const pathname = `/api/v1/${path.join('/')}${request.nextUrl.search}`;
  const method = request.method;
  const body = method === 'GET' || method === 'HEAD' ? undefined : Buffer.from(await request.arrayBuffer());

  const result = await new Promise<ProxyResult>((resolve, reject) => {
    const headers: https.OutgoingHttpHeaders = {
      host: BACKEND_HOST,
      accept: request.headers.get('accept') || 'application/json',
      'user-agent': request.headers.get('user-agent') || 'Vimawallah-Vercel-Proxy',
      'x-forwarded-host': request.nextUrl.host,
      'x-forwarded-proto': 'https',
      'x-forwarded-for': request.headers.get('x-forwarded-for') || '127.0.0.1',
    };

    const authorization = request.headers.get('authorization');
    const contentType = request.headers.get('content-type');
    const cookie = request.headers.get('cookie');
    const ocrSource = request.headers.get('x-vimawallah-source');
    const ocrToken = request.headers.get('x-vimawallah-ocr-token');

    if (authorization) headers.authorization = authorization;
    if (contentType) headers['content-type'] = contentType;
    if (cookie) headers.cookie = cookie;
    if (ocrSource) headers['x-vimawallah-source'] = ocrSource;
    if (ocrToken) headers['x-vimawallah-ocr-token'] = ocrToken;
    if (body) headers['content-length'] = body.length;

    const upstream = https.request(
      {
        hostname: BACKEND_IP,
        port: BACKEND_PORT,
        servername: BACKEND_HOST,
        method,
        path: pathname,
        headers,
        rejectUnauthorized: true,
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

    const timeoutMs = isPolicyOcr ? 115000 : 15000;
    upstream.setTimeout(timeoutMs, () => upstream.destroy(new Error(`Backend request timed out after ${timeoutMs}ms`)));
    upstream.on('error', reject);
    if (body) upstream.write(body);
    upstream.end();
  }).catch((error: unknown) => {
    console.error('Backend proxy failed', { pathname, backendHost: BACKEND_HOST, backendPort: BACKEND_PORT, error });
    return null;
  });

  if (!result) {
    return NextResponse.json({ message: 'Backend is temporarily unavailable.' }, { status: 502 });
  }

  if (result.status >= 300 && result.status < 400) {
    const location = Array.isArray(result.headers.location) ? result.headers.location[0] : result.headers.location;
    console.error('Unexpected backend redirect', { pathname, status: result.status, location });
    return NextResponse.json({ message: 'Backend routing returned an unexpected redirect.' }, { status: 502 });
  }

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(result.headers)) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (['content-length', 'transfer-encoding', 'connection', 'content-encoding', 'location'].includes(lower)) continue;
    responseHeaders.set(key, Array.isArray(value) ? value.join(', ') : String(value));
  }

  return new NextResponse(new Uint8Array(result.body), {
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
