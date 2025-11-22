import { createServer as createHttpServer, IncomingMessage, ServerResponse } from 'http'
import { Router, createCors } from 'itty-router'
import { Env } from './env'
import { getCcipRead, getName, getNames, setName } from './handlers'

const { preflight, corsify } = createCors()
const router = Router()

router
  .all('*', preflight)
  .get('/lookup/:sender/:data.json', (req, env) => getCcipRead(req, env))
  .get('/get/:name', (req, env) => getName(req, env))
  .get('/names', (_, env) => getNames(env))
  .post('/set', (req, env) => setName(req, env))
  .all('*', () => new Response('Not found', { status: 404 }))

// Convert Node.js request to Fetch API Request
function nodeToFetch(req: IncomingMessage): Request {
  const url = `http://${req.headers.host}${req.url}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') {
      headers.set(key, value)
    } else if (Array.isArray(value)) {
      value.forEach(v => headers.append(key, v))
    }
  }
  
  return new Request(url, {
    method: req.method || 'GET',
    headers: headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? JSON.stringify((req as any).body) : undefined,
  })
}

// Convert Fetch API Response to Node.js response
async function fetchToNode(fetchResponse: Response, res: ServerResponse): Promise<void> {
  res.statusCode = fetchResponse.status
  fetchResponse.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  const body = await fetchResponse.text()
  res.end(body)
}

export function createServer(env: Env, port: number = 3000) {
  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const fetchRequest = nodeToFetch(req)
      const response = await router.handle(fetchRequest, env).then(corsify)
      await fetchToNode(response, res)
    } catch (error) {
      console.error('Server error:', error)
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: 'Internal server error' }))
    }
  })

  server.listen(port, () => {
    console.log(`ENS Subname Resolver server running on port ${port}`)
  })

  return server
}

