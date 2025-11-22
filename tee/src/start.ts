import { createServer } from 'http'
import { Router, createCors } from 'itty-router'
import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Env } from './env'
import { getCcipRead, getName, getNames, setName } from './handlers'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

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
function nodeToFetch(req: any): Request {
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
    method: req.method,
    headers: headers,
    body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
  })
}

// Convert Fetch API Response to Node.js response
async function fetchToNode(fetchResponse: Response, res: any) {
  res.statusCode = fetchResponse.status
  fetchResponse.headers.forEach((value, key) => {
    res.setHeader(key, value)
  })
  const body = await fetchResponse.text()
  res.end(body)
}

// Initialize database
function initDatabase(dbPath: string) {
  // Ensure directory exists
  const db = new Database(dbPath)
  const createTablesSql = readFileSync(
    join(__dirname, '../db/create-tables.sql'),
    'utf-8'
  )
  db.exec(createTablesSql)
  return db
}

// Parse request body for POST requests
function parseBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000
const DB_PATH = process.env.DB_PATH || '/root/.my-volume/database.db'
const PRIVATE_KEY = process.env.PRIVATE_KEY

if (!PRIVATE_KEY) {
  console.error('PRIVATE_KEY environment variable is required')
  process.exit(1)
}

// Initialize database
initDatabase(DB_PATH)

const env: Env = {
  PRIVATE_KEY: PRIVATE_KEY as `0x${string}`,
  DB_PATH: DB_PATH,
}

const server = createServer(async (req, res) => {
  try {
    // Parse body for POST requests
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      req.body = await parseBody(req)
    }
    
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`ENS Subname Resolver server running on port ${PORT}`)
  console.log(`Database path: ${DB_PATH}`)
})

