import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';

export interface QueryResult<T = any> {
  rows: T[];
  rowCount?: number;
}

export interface DatabaseClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

class MotionDatabase implements DatabaseClient {
  private pgPool: pg.Pool | null = null;
  private pglite: PGlite | null = null;
  private isInitialized = false;

  public async init(): Promise<void> {
    if (this.isInitialized) return;

    const externalUrl = process.env.DATABASE_URL;
    if (externalUrl) {
      console.log('[Database] Connecting to external PostgreSQL via DATABASE_URL...');
      this.pgPool = new pg.Pool({
        connectionString: externalUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
      });
      // Test connectivity
      const res = await this.pgPool.query('SELECT 1 as test');
      console.log('[Database] Connected to external PostgreSQL successfully.');
    } else {
      console.log('[Database] Using embedded PostgreSQL engine (PGlite) with persistent disk storage.');
      const dataDir = path.resolve(process.cwd(), 'data', 'postgres_db');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      try {
        this.pglite = new PGlite(dataDir);
        await this.pglite.waitReady;
        console.log(`[Database] Embedded PostgreSQL initialized at ${dataDir}`);
      } catch (pgliteErr) {
        console.warn(`[Database] PGlite failed on existing dataDir. Resetting data directory...`, pgliteErr);
        try {
          fs.rmSync(dataDir, { recursive: true, force: true });
          fs.mkdirSync(dataDir, { recursive: true });
          this.pglite = new PGlite(dataDir);
          await this.pglite.waitReady;
          console.log(`[Database] Embedded PostgreSQL re-initialized cleanly at ${dataDir}`);
        } catch (fallbackErr) {
          console.warn('[Database] Falling back to in-memory PGlite instance:', fallbackErr);
          this.pglite = new PGlite();
          await this.pglite.waitReady;
          console.log('[Database] In-memory PostgreSQL instance ready.');
        }
      }
    }

    this.isInitialized = true;
  }

  public async query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.pgPool) {
      const res = await this.pgPool.query<any>(text, params);
      return { rows: res.rows as T[], rowCount: res.rowCount ?? res.rows.length };
    }

    if (this.pglite) {
      const res = await this.pglite.query<any>(text, params);
      return { rows: (res.rows || []) as T[], rowCount: res.rows?.length ?? 0 };
    }

    throw new Error('Database not initialized');
  }

  public async exec(sql: string): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }

    if (this.pgPool) {
      await this.pgPool.query(sql);
      return;
    }

    if (this.pglite) {
      await this.pglite.exec(sql);
      return;
    }

    throw new Error('Database not initialized');
  }

  public async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    if (this.pglite) {
      await this.pglite.close();
      this.pglite = null;
    }
    this.isInitialized = false;
  }
}

export const db = new MotionDatabase();
