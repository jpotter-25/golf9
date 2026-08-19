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
  ['admin_recovery_requests', 'request_id'],
  ['account_deletion_requests', 'request_id'],
  ['support_tickets', 'ticket_id'],
  ['mail_entries', 'mail_id'],
  ['bans', 'ban_id'],
  ['invite_codes', 'invite_id'],
  ['early_access_signups', 'email_hash'],
  ['early_access_campaigns', 'campaign_id'],
  ['early_access_deliveries', 'delivery_id'],
];
const META_KEYS = ['rankedSeason', 'competitiveConfig', 'economyConfig', 'notificationConfig', 'availabilityConfig', 'afkConfig', 'forfeitConfig', 'releasePolicy', 'earlyAccessConfig'];

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
  if (key === 'request_id') return item.requestId;
  if (key === 'ticket_id') return item.ticketId;
  if (key === 'mail_id') return item.mailId;
  if (key === 'ban_id') return item.banId;
  if (key === 'invite_id') return item.inviteId;
  if (key === 'email_hash') return item.emailHash;
  if (key === 'campaign_id') return item.campaignId;
  if (key === 'delivery_id') return item.deliveryId;
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
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS golf9_early_access_signups_consent_idx
        ON golf9_early_access_signups ((data->>'consentStatus'));
      CREATE INDEX IF NOT EXISTS golf9_early_access_signups_stage_idx
        ON golf9_early_access_signups ((data->>'testerStage'));
      CREATE INDEX IF NOT EXISTS golf9_early_access_signups_signup_id_idx
        ON golf9_early_access_signups ((data->>'signupId'));
      CREATE INDEX IF NOT EXISTS golf9_early_access_signups_platforms_idx
        ON golf9_early_access_signups USING GIN ((data->'platforms'));
      CREATE INDEX IF NOT EXISTS golf9_early_access_campaigns_status_idx
        ON golf9_early_access_campaigns ((data->>'status'));
      CREATE INDEX IF NOT EXISTS golf9_early_access_deliveries_status_idx
        ON golf9_early_access_deliveries ((data->>'status'));
      CREATE INDEX IF NOT EXISTS golf9_early_access_deliveries_campaign_idx
        ON golf9_early_access_deliveries ((data->>'campaignId'));
    `);
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
      availabilityConfig: null,
      afkConfig: null,
      forfeitConfig: null,
      releasePolicy: null,
      catalog: { live: [], draft: [], versions: [] },
      clubs: [],
      admins: [],
      adminSessions: [],
      adminAudit: [],
      adminRecoveryRequests: [],
      accountDeletionRequests: [],
      supportTickets: [],
      mailEntries: [],
      bans: [],
      inviteCodes: [],
      earlyAccessConfig: null,
      earlyAccessSignups: [],
      earlyAccessCampaigns: [],
      earlyAccessDeliveries: [],
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
      else if (table === 'admin_recovery_requests') state.adminRecoveryRequests = values;
      else if (table === 'account_deletion_requests') state.accountDeletionRequests = values;
      else if (table === 'support_tickets') state.supportTickets = values;
      else if (table === 'mail_entries') state.mailEntries = values;
      else if (table === 'invite_codes') state.inviteCodes = values;
      else if (table === 'early_access_signups') state.earlyAccessSignups = values;
      else if (table === 'early_access_campaigns') state.earlyAccessCampaigns = values;
      else if (table === 'early_access_deliveries') state.earlyAccessDeliveries = values;
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
        admin_recovery_requests: state.adminRecoveryRequests || [],
        account_deletion_requests: state.accountDeletionRequests || [],
        support_tickets: state.supportTickets || [],
        mail_entries: state.mailEntries || [],
        bans: state.bans || [],
        invite_codes: state.inviteCodes || [],
        early_access_signups: state.earlyAccessSignups || [],
        early_access_campaigns: state.earlyAccessCampaigns || [],
        early_access_deliveries: state.earlyAccessDeliveries || [],
      };

      for (const [table, key] of COLLECTION_TABLES) {
        const mergeByUpdatedAt = ['early_access_signups', 'early_access_campaigns', 'early_access_deliveries'].includes(table);
        if (!mergeByUpdatedAt) await client.query(`DELETE FROM golf9_${table}`);
        for (const item of collections[table]) {
          const id = itemId(item, key);
          if (!id) continue;
          const conflictClause = mergeByUpdatedAt
            ? ` ON CONFLICT (${key}) DO UPDATE
                  SET data = EXCLUDED.data, updated_at = NOW()
                WHERE COALESCE((golf9_${table}.data->>'updatedAt')::numeric, 0)
                   <= COALESCE((EXCLUDED.data->>'updatedAt')::numeric, 0)`
            : '';
          await client.query(
            `INSERT INTO golf9_${table} (${key}, data, updated_at) VALUES ($1, $2::jsonb, NOW())${conflictClause}`,
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

  async claimEarlyAccessDelivery({ now = Date.now(), leaseMs = 5 * 60 * 1000, maxAttempts = 5 } = {}) {
    await this.migrate();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const candidate = await client.query(`
        SELECT delivery_id, data
          FROM golf9_early_access_deliveries
         WHERE (
           (data->>'status' = 'queued' AND COALESCE((data->>'nextAttemptAt')::numeric, 0) <= $1)
           OR (data->>'status' = 'sending' AND COALESCE((data->>'leaseExpiresAt')::numeric, 0) <= $1)
         )
           AND COALESCE((data->>'attempts')::integer, 0) < $2
         ORDER BY COALESCE((data->>'nextAttemptAt')::numeric, 0), updated_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
      `, [now, maxAttempts]);
      const row = candidate.rows[0];
      if (!row) {
        await client.query('COMMIT');
        return null;
      }
      const delivery = {
        ...row.data,
        status: 'sending',
        attempts: Math.max(0, Number(row.data?.attempts) || 0) + 1,
        leaseExpiresAt: now + leaseMs,
        updatedAt: now,
      };
      await client.query(`
        UPDATE golf9_early_access_deliveries
           SET data = $2::jsonb, updated_at = NOW()
         WHERE delivery_id = $1
      `, [row.delivery_id, json(delivery)]);
      const campaignResult = await client.query('SELECT data FROM golf9_early_access_campaigns WHERE campaign_id = $1', [delivery.campaignId]);
      const signupResult = await client.query("SELECT data FROM golf9_early_access_signups WHERE data->>'signupId' = $1 LIMIT 1", [delivery.signupId]);
      await client.query('COMMIT');
      return {
        delivery,
        campaign: campaignResult.rows[0]?.data || null,
        signup: signupResult.rows[0]?.data || null,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async saveEarlyAccessQueueContext({ delivery, campaign, signup }) {
    const records = [
      ['early_access_deliveries', 'delivery_id', delivery?.deliveryId, delivery],
      ['early_access_campaigns', 'campaign_id', campaign?.campaignId, campaign],
      ['early_access_signups', 'email_hash', signup?.emailHash, signup],
    ].filter(([, , id, data]) => id && data);
    if (!records.length) return;
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const [table, key, id, data] of records) {
        await client.query(`
          INSERT INTO golf9_${table} (${key}, data, updated_at)
          VALUES ($1, $2::jsonb, NOW())
          ON CONFLICT (${key}) DO UPDATE
            SET data = EXCLUDED.data, updated_at = NOW()
          WHERE COALESCE((golf9_${table}.data->>'updatedAt')::numeric, 0)
             <= COALESCE((EXCLUDED.data->>'updatedAt')::numeric, 0)
        `, [String(id), json(data)]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteEarlyAccessSignups(signupIds = []) {
    const ids = [...new Set(signupIds.map(String).filter(Boolean))];
    if (!ids.length) return;
    await this.pool.query("DELETE FROM golf9_early_access_signups WHERE data->>'signupId' = ANY($1::text[])", [ids]);
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
