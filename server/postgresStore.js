import { Pool } from 'pg';

const COLLECTION_TABLES = [
  ['users', 'user_id'],
  ['sessions', 'token'],
  ['results', 'result_id'],
  ['clubs', 'club_id'],
  ['catalog_live', 'item_id'],
  ['catalog_draft', 'item_id'],
  ['catalog_versions', 'version_id'],
  ['admins', 'admin_id'],
  ['admin_sessions', 'token'],
  ['admin_audit', 'audit_id'],
  ['support_tickets', 'ticket_id'],
  ['bans', 'ban_id'],
  ['invite_codes', 'invite_id'],
];
const META_KEYS = ['rankedSeason', 'competitiveConfig', 'economyConfig', 'notificationConfig'];

function json(value) {
  return JSON.stringify(value ?? null);
}

function itemId(item, key) {
  if (key === 'user_id') return item.userId;
  if (key === 'result_id') return item.resultId;
  if (key === 'club_id') return item.clubId;
  if (key === 'item_id') return item.id;
  if (key === 'version_id') return item.versionId;
  if (key === 'admin_id') return item.adminId;
  if (key === 'audit_id') return item.auditId;
  if (key === 'ticket_id') return item.ticketId;
  if (key === 'ban_id') return item.banId;
  if (key === 'invite_id') return item.inviteId;
  return item[key];
}

export function createPostgresStore(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) return null;
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === '0' ? false : { rejectUnauthorized: false },
    max: Number(process.env.DATABASE_POOL_SIZE || 5),
  });
  return new PostgresStore(pool);
}

export class PostgresStore {
  constructor(pool) {
    this.pool = pool;
    this.pendingSave = null;
    this.pendingStateFactory = null;
    this.lastSave = Promise.resolve();
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS golf9_meta (
        key TEXT PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    for (const [table, key] of COLLECTION_TABLES) {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS golf9_${table} (
          ${key} TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }
  }

  async load() {
    await this.migrate();
    const state = {
      users: [],
      sessions: [],
      results: [],
      rankedSeason: null,
      competitiveConfig: null,
      economyConfig: null,
      notificationConfig: null,
      catalog: { live: [], draft: [], versions: [] },
      clubs: [],
      admins: [],
      adminSessions: [],
      adminAudit: [],
      supportTickets: [],
      bans: [],
      inviteCodes: [],
    };

    const meta = await this.pool.query('SELECT key, value FROM golf9_meta');
    for (const row of meta.rows) {
      if (META_KEYS.includes(row.key)) state[row.key] = row.value;
    }

    for (const [table] of COLLECTION_TABLES) {
      const rows = await this.pool.query(`SELECT data FROM golf9_${table}`);
      const values = rows.rows.map(row => row.data);
      if (table === 'catalog_live') state.catalog.live = values;
      else if (table === 'catalog_draft') state.catalog.draft = values;
      else if (table === 'catalog_versions') state.catalog.versions = values;
      else if (table === 'admin_sessions') state.adminSessions = values;
      else if (table === 'admin_audit') state.adminAudit = values;
      else if (table === 'support_tickets') state.supportTickets = values;
      else if (table === 'invite_codes') state.inviteCodes = values;
      else state[table] = values;
    }

    return state;
  }

  async save(state) {
    await this.migrate();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const key of META_KEYS) {
        await client.query(`
          INSERT INTO golf9_meta (key, value, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
        `, [key, json(state[key])]);
      }

      const collections = {
        users: state.users || [],
        sessions: state.sessions || [],
        results: state.results || [],
        clubs: state.clubs || [],
        catalog_live: state.catalog?.live || [],
        catalog_draft: state.catalog?.draft || [],
        catalog_versions: state.catalog?.versions || [],
        admins: state.admins || [],
        admin_sessions: state.adminSessions || [],
        admin_audit: state.adminAudit || [],
        support_tickets: state.supportTickets || [],
        bans: state.bans || [],
        invite_codes: state.inviteCodes || [],
      };

      for (const [table, key] of COLLECTION_TABLES) {
        await client.query(`DELETE FROM golf9_${table}`);
        for (const item of collections[table]) {
          const id = itemId(item, key);
          if (!id) continue;
          await client.query(
            `INSERT INTO golf9_${table} (${key}, data, updated_at) VALUES ($1, $2::jsonb, NOW())`,
            [String(id), json(item)]
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  scheduleSave(stateFactory) {
    if (this.pendingSave) clearTimeout(this.pendingSave);
    this.pendingStateFactory = stateFactory;
    this.pendingSave = setTimeout(() => {
      this.pendingSave = null;
      const snapshot = this.pendingStateFactory();
      this.pendingStateFactory = null;
      this.lastSave = this.lastSave
        .then(() => this.save(snapshot))
        .catch(error => {
          console.error('Postgres save failed:', error);
        });
    }, Number(process.env.DATABASE_SAVE_DEBOUNCE_MS || 150));
  }

  async flush() {
    if (this.pendingSave) {
      clearTimeout(this.pendingSave);
      this.pendingSave = null;
      const snapshot = this.pendingStateFactory?.();
      this.pendingStateFactory = null;
      if (snapshot) {
        this.lastSave = this.lastSave
          .then(() => this.save(snapshot))
          .catch(error => {
            console.error('Postgres save failed:', error);
          });
      }
    }
    await this.lastSave;
  }

  async close() {
    await this.flush();
    await this.pool.end();
  }
}
