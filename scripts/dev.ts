import 'dotenv/config'
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServer as createViteServer } from 'vite'
import distributorsHandler from '../api/distributors.js'
import provincesHandler from '../api/regions/provinces.js'
import areasHandler from '../api/regions/areas.js'
import uploadSessionHandler from '../api/uploads/ktp/session.js'
import uploadVerifyHandler from '../api/uploads/ktp/verify.js'
import uploadCleanupHandler from '../api/uploads/ktp/cleanup.js'
import submissionsHandler from '../api/submissions.js'
import submissionLookupHandler from '../api/submissions/by-distributor.js'
import submissionUpdateHandler from '../api/submissions/[submissionId].js'
import type { ApiRequest, ApiResponse } from '../api/_lib/http.js'

type ApiHandler = (request: ApiRequest, response: ApiResponse) => Promise<unknown>

const routes = new Map<string, ApiHandler>([
  ['/api/distributors', distributorsHandler],
  ['/api/regions/provinces', provincesHandler],
  ['/api/regions/areas', areasHandler],
  ['/api/uploads/ktp/session', uploadSessionHandler],
  ['/api/uploads/ktp/verify', uploadVerifyHandler],
  ['/api/uploads/ktp/cleanup', uploadCleanupHandler],
  ['/api/submissions', submissionsHandler],
  ['/api/submissions/by-distributor', submissionLookupHandler],
])

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1024 * 1024) throw new Error('Request body exceeds 1 MB.')
    chunks.push(buffer)
  }
  if (chunks.length === 0) return undefined
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function decorateResponse(response: ServerResponse): ApiResponse {
  const apiResponse = response as ApiResponse
  apiResponse.status = (statusCode: number) => {
    apiResponse.statusCode = statusCode
    return apiResponse
  }
  apiResponse.json = (body: unknown) => {
    if (!apiResponse.headersSent) {
      apiResponse.setHeader('Content-Type', 'application/json; charset=utf-8')
    }
    apiResponse.end(JSON.stringify(body))
    return apiResponse
  }
  return apiResponse
}

function queryFrom(url: URL): ApiRequest['query'] {
  const query: ApiRequest['query'] = {}
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key)
    query[key] = values.length > 1 ? values : values[0]
  }
  return query
}

const vite = await createViteServer({
  appType: 'spa',
  server: { middlewareMode: true },
})

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  let handler = routes.get(url.pathname)
  const query = queryFrom(url)

  const submissionMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)$/)
  if (submissionMatch && submissionMatch[1] !== 'by-distributor') {
    handler = submissionUpdateHandler
    query.submissionId = decodeURIComponent(submissionMatch[1] ?? '')
  }

  if (!handler) {
    vite.middlewares(request, response)
    return
  }

  try {
    const apiRequest = request as ApiRequest
    apiRequest.query = query
    apiRequest.body = await readJsonBody(request)
    await handler(apiRequest, decorateResponse(response))
  } catch (error) {
    console.error('Local API adapter failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    if (!response.headersSent) {
      response.statusCode = 400
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
    }
    response.end(
      JSON.stringify({
        error: { code: 'REQUEST_INVALID', message: 'Permintaan JSON tidak valid.' },
      }),
    )
  }
})

const port = Number(process.env.PORT) || 5173
server.listen(port, '127.0.0.1', () => {
  console.log(`PILOK Supervisor dev server: http://localhost:${port}`)
})
