import type { IncomingMessage, ServerResponse } from 'node:http'

export const config = { api: { bodyParser: false } }

type Request = IncomingMessage & { url?: string }

const BACKEND_URL = (process.env.LYFTR_BACKEND_URL ?? 'https://test-backend-pao2.onrender.com')
  .replace(/\/+$/, '')

export default async function handler(req: Request, res: ServerResponse): Promise<void> {
  const method = req.method ?? 'GET'
  if (method !== 'GET' && method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    res.statusCode = 405
    res.end('Method not allowed')
    return
  }

  const incoming = new URL(req.url ?? '/', 'https://lyftr.local')
  const path = incoming.pathname.replace(/^\/api\/?/, '')
  if (!/^(health|chat|sessions(?:\/[^/]+\/messages)?)$/.test(path)) {
    res.statusCode = 404
    res.end('Not found')
    return
  }

  const headers: Record<string, string> = { accept: String(req.headers.accept ?? 'application/json') }
  for (const name of ['content-type', 'x-simulate-failure'] as const) {
    const value = req.headers[name]
    if (typeof value === 'string') headers[name] = value
  }

  try {
    let body: Buffer | undefined
    if (method === 'POST') {
      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
      body = Buffer.concat(chunks)
    }

    const upstream = await fetch(`${BACKEND_URL}/${path}${incoming.search}`, {
      method,
      headers,
      body,
    })
    res.statusCode = upstream.status
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('content-type', contentType)
    const cacheControl = upstream.headers.get('cache-control')
    if (cacheControl) res.setHeader('cache-control', cacheControl)
    res.end(Buffer.from(await upstream.arrayBuffer()))
  } catch {
    res.statusCode = 502
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ detail: 'The Lyftr backend could not be reached.' }))
  }
}
