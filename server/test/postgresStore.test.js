import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresStore } from '../postgresStore.js';

test('postgres store loads and saves economy config metadata', async () => {
  const savedQueries = [];
  const client = {
    query: async (sql, params = []) => {
      savedQueries.push({ sql, params });
      return { rows: [] };
    },
    release() {},
  };
  const pool = {
    query: async sql => {
      if (/SELECT key, value FROM golf9_meta/.test(sql)) {
        return {
          rows: [
            { key: 'rankedSeason', value: { id: 'season-one' } },
            { key: 'competitiveConfig', value: { live: { placementMatchesRequired: 5 } } },
            { key: 'economyConfig', value: { wagerTables: [{ id: 'wager-50000', buyIn: 50000 }] } },
          ],
        };
      }
      return { rows: [] };
    },
    connect: async () => client,
  };
  const store = new PostgresStore(pool);

  const loaded = await store.load();
  assert.equal(loaded.economyConfig.wagerTables[0].buyIn, 50000);

  await store.save({
    rankedSeason: { id: 'season-two' },
    competitiveConfig: { live: { placementMatchesRequired: 7 } },
    economyConfig: { wagerTables: [{ id: 'wager-25000', buyIn: 25000 }] },
  });

  const economySave = savedQueries.find(query => query.params[0] === 'economyConfig');
  assert.ok(economySave);
  assert.equal(JSON.parse(economySave.params[1]).wagerTables[0].buyIn, 25000);
});
