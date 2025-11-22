import { CamelCasePlugin, Kysely } from 'kysely'
import Database from 'better-sqlite3'
import type { Database as SqliteDatabase } from 'better-sqlite3'
import { Env } from '../env'
import { NameInKysely } from '../models'

export interface AppDatabase {
  names: NameInKysely
}

// Simple kysely adapter for better-sqlite3
class SqliteDriver {
  private db: SqliteDatabase

  constructor(db: SqliteDatabase) {
    this.db = db
  }

  async init() {}

  async acquireConnection() {
    return {
      executeQuery: async (query: { sql: string; parameters: readonly unknown[] }) => {
        try {
          const stmt = this.db.prepare(query.sql)
          const result = stmt.all(...(query.parameters as any[]))
          return { rows: result }
        } catch (error) {
          console.error('Query error:', error)
          throw error
        }
      },
      releaseConnection: async () => {},
    }
  }

  async beginTransaction() {
    return {
      executeQuery: async (query: { sql: string; parameters: readonly unknown[] }) => {
        const stmt = this.db.prepare(query.sql)
        const result = stmt.all(...(query.parameters as any[]))
        return { rows: result }
      },
      commit: async () => {},
      rollback: async () => {},
    }
  }

  async destroy() {
    this.db.close()
  }
}

// Create a custom dialect that uses our driver
function createSqliteDialect(db: SqliteDatabase) {
  const driver = new SqliteDriver(db)
  
  return {
    createAdapter() {
      return {
        createQueryCompiler() {
          return {
            compileQuery(query: any) {
              // Kysely will provide the compiled query
              return query
            },
          }
        },
        createDriver() {
          return driver
        },
      }
    },
  } as any
}

export function createKysely(env: Env): Kysely<AppDatabase> {
  const sqlite = new Database(env.DB_PATH || '/root/.my-volume/database.db')
  const dialect = createSqliteDialect(sqlite)
  
  return new Kysely<AppDatabase>({
    dialect,
    plugins: [new CamelCasePlugin()],
  })
}
