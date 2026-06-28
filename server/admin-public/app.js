const app = document.querySelector('#app');
const template = document.querySelector('#consoleTemplate');

let selectedUser = null;
let selectedCatalogItem = null;
let catalogDraft = [];
let catalogLive = [];
let selectedClub = null;
let competitiveConfig = null;
let economyWagerTables = [];

async function api(path, options = {}) {
  const isForm = options.body instanceof FormData;
  const res = await fetch(`/admin/api${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: isForm ? options.headers || {} : {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed: ${res.status}`);
  return body;
}

function status(message, tone = 'muted') {
  const node = document.querySelector('#status');
  if (!node) return;
  node.textContent = message || '';
  node.className = `status ${tone}`;
}

function money(value) {
  return `${Number(value || 0).toLocaleString()} coins`;
}

function renderConsole() {
  app.replaceChildren(template.content.cloneNode(true));
  bindTabs();
  bindConsoleActions();
  loadMetrics();
}

function bindTabs() {
  document.querySelectorAll('.tabs button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach(item => item.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      document.querySelector(`#${button.dataset.tab}`)?.classList.add('active');
      if (button.dataset.tab === 'invites') loadInvites();
      if (button.dataset.tab === 'economy') loadEconomy();
      if (button.dataset.tab === 'competitive') loadCompetitive();
    });
  });
}

function bindConsoleActions() {
  document.querySelector('#logoutButton').addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => null);
    location.reload();
  });
  document.querySelector('#searchPlayers').addEventListener('click', searchPlayers);
  document.querySelector('#playerSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') searchPlayers();
  });
  document.querySelector('#loadInvites').addEventListener('click', loadInvites);
  document.querySelector('#inviteEditor').addEventListener('submit', createInvite);
  document.querySelector('#loadTickets').addEventListener('click', loadTickets);
  document.querySelector('#loadEconomy').addEventListener('click', loadEconomy);
  document.querySelector('#addWagerTable').addEventListener('click', addWagerTable);
  document.querySelector('#economyConfigEditor').addEventListener('submit', saveEconomyConfig);
  document.querySelector('#loadCompetitive').addEventListener('click', loadCompetitive);
  document.querySelector('#publishCompetitive').addEventListener('click', publishCompetitive);
  document.querySelector('#rollbackCompetitive').addEventListener('click', rollbackCompetitive);
  document.querySelector('#competitiveConfigEditor').addEventListener('submit', saveCompetitiveDraft);
  document.querySelector('#createSeason').addEventListener('click', createCompetitiveSeason);
  document.querySelector('#loadRankedQueues').addEventListener('click', loadRankedQueues);
  document.querySelector('#competitivePlayerEditor').addEventListener('submit', adjustCompetitivePlayer);
  document.querySelector('#loadCatalog').addEventListener('click', loadCatalog);
  document.querySelector('#newCatalogItem').addEventListener('click', createCatalogItemDraft);
  document.querySelector('#publishCatalog').addEventListener('click', publishCatalog);
  document.querySelector('#catalogFilter').addEventListener('change', renderCatalog);
  document.querySelector('#catalogStateFilter').addEventListener('change', renderCatalog);
  document.querySelector('#catalogEditor').addEventListener('submit', saveCatalogItem);
  document.querySelector('#uploadCatalogAsset').addEventListener('click', uploadCatalogAsset);
  document.querySelector('#duplicateCatalogItem').addEventListener('click', duplicateCatalogItem);
  document.querySelector('#archiveCatalogItem').addEventListener('click', archiveCatalogItem);
  document.querySelector('#loadClubs').addEventListener('click', loadClubs);
  document.querySelector('#searchClubs').addEventListener('click', loadClubs);
  document.querySelector('#clubSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') loadClubs();
  });
  document.querySelector('#loadAudit').addEventListener('click', loadAudit);
}

async function loadMetrics() {
  try {
    const { metrics } = await api('/metrics');
    status(`${metrics.users} players - ${metrics.activeRooms} active rooms - ${metrics.clubs} clubs - ${metrics.openTickets} open tickets`);
  } catch {
    status('');
  }
}

async function searchPlayers() {
  const q = document.querySelector('#playerSearch').value.trim();
  const { users } = await api(`/users?q=${encodeURIComponent(q)}`);
  const output = document.querySelector('#playerResults');
  output.replaceChildren(...users.map(user => {
    const card = document.createElement('button');
    card.className = 'card ghost';
    card.innerHTML = `
      <strong>${escapeHtml(user.displayName)}</strong>
      <span class="muted">${escapeHtml(user.userId)}</span>
      <div class="statline">
        <span class="chip">Lv ${user.progression?.level ?? 1}</span>
        <span class="chip">${money(user.currency?.coins)}</span>
        <span class="chip">${user.competitive?.league?.name ?? 'Unranked'}</span>
      </div>
    `;
    card.addEventListener('click', () => loadUser(user.userId));
    return card;
  }));
}

async function loadUser(userId) {
  const { user } = await api(`/users/${encodeURIComponent(userId)}`);
  selectedUser = user;
  renderUserDetail(user);
}

function renderUserDetail(user) {
  const node = document.querySelector('#playerDetail');
  node.classList.remove('hidden');
  const equipped = user.inventory?.equipped || {};
  node.innerHTML = `
    <h2>${escapeHtml(user.displayName)}</h2>
    <p class="muted">${escapeHtml(user.userId)}</p>
    <div class="statline">
      <span class="chip">Coins ${money(user.currency?.coins)}</span>
      <span class="chip">Level ${user.progression?.level ?? 1}</span>
      <span class="chip">Wins ${user.statistics?.wins ?? 0}</span>
      <span class="chip">MMR ${user.competitive?.mmr ?? 1000}</span>
    </div>
    <div class="card">
      <strong>Equipped</strong>
      <p class="muted">Card: ${escapeHtml(equipped.cardBack || 'default')} - Icon: ${escapeHtml(equipped.avatarIcon || 'default')} - Frame: ${escapeHtml(equipped.avatarFrame || 'default')} - Accessory: ${escapeHtml(equipped.avatarAccessory || 'none')} - Title: ${escapeHtml(equipped.title || 'default')} - Table: ${escapeHtml(equipped.tableTheme || 'default')}</p>
    </div>
    <div class="card">
      <strong>Devices</strong>
      ${(user.knownDevices || []).map(device => `<p class="muted">${escapeHtml(device.platform)} - ${escapeHtml(device.deviceHash.slice(0, 14))} - ${new Date(device.lastSeenAt).toLocaleString()}</p>`).join('') || '<p class="muted">No devices recorded yet.</p>'}
    </div>
    <div class="actions">
      <button data-action="coins">Adjust Coins</button>
      <button data-action="rename">Rename</button>
      <button data-action="password">Reset Password</button>
      <button data-action="grant">Grant Cosmetic</button>
      <button data-action="revoke">Revoke Cosmetic</button>
      <button data-action="sessions">Revoke Sessions</button>
      <button data-action="mute">Mute Chat</button>
      <button data-action="suspend">Suspend</button>
      <button data-action="ban" class="danger">Ban Account</button>
      <button data-action="deviceBan" class="danger">Ban Device</button>
      <button data-action="clear">Clear Moderation</button>
    </div>
  `;
  node.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => runUserAction(button.dataset.action)));
}

async function runUserAction(action) {
  if (!selectedUser) return;
  try {
    if (action === 'coins') {
      const amount = prompt('Coin amount to add or remove, e.g. 500 or -250');
      const reason = prompt('Reason for audit log');
      await api(`/users/${selectedUser.userId}/coins/adjust`, { method: 'POST', body: JSON.stringify({ amount, reason }) });
    }
    if (action === 'rename') {
      const displayName = prompt('New display name', selectedUser.displayName);
      const reason = prompt('Reason for audit log');
      await api(`/users/${selectedUser.userId}/profile`, { method: 'PATCH', body: JSON.stringify({ displayName, reason }) });
    }
    if (action === 'password') {
      const temporaryPassword = prompt('Temporary password, or leave blank to generate') || undefined;
      const reason = prompt('Reason for audit log');
      const result = await api(`/users/${selectedUser.userId}/password-reset`, { method: 'POST', body: JSON.stringify({ temporaryPassword, reason }) });
      alert(`Temporary password: ${result.temporaryPassword}`);
    }
    if (action === 'grant' || action === 'revoke') {
      const cosmeticId = prompt('Cosmetic id');
      const reason = prompt('Reason for audit log');
      await api(`/users/${selectedUser.userId}/cosmetics/${action}`, { method: 'POST', body: JSON.stringify({ cosmeticId, reason }) });
    }
    if (action === 'sessions') {
      const reason = prompt('Reason for audit log');
      await api(`/users/${selectedUser.userId}/sessions/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });
    }
    if (['mute', 'suspend', 'ban', 'deviceBan', 'clear'].includes(action)) {
      const map = { mute: 'chat_mute', suspend: 'suspension', ban: 'account_ban', deviceBan: 'device_ban', clear: 'clear' };
      const reason = prompt('Reason for audit log');
      const durationMs = action === 'mute' || action === 'suspend' ? Number(prompt('Duration hours', '24')) * 60 * 60 * 1000 : 0;
      await api(`/users/${selectedUser.userId}/moderation`, { method: 'POST', body: JSON.stringify({ action: map[action], durationMs, reason }) });
    }
    status('Action completed.', 'ok');
    await loadUser(selectedUser.userId);
  } catch (error) {
    alert(error.message);
  }
}

async function loadInvites() {
  const { inviteRequired, invites } = await api('/invites');
  const output = document.querySelector('#inviteOutput');
  const header = document.createElement('div');
  header.className = 'card';
  header.innerHTML = `<strong>Signup gate: ${inviteRequired ? 'Invite required' : 'Open signup'}</strong><p class="muted">Set REQUIRE_INVITE_CODE=1 on staging to require these codes.</p>`;
  const cards = (invites || []).map(invite => {
    const card = document.createElement('div');
    card.className = `card ${invite.status !== 'active' ? 'dim' : ''}`;
    card.innerHTML = `
      <strong>${escapeHtml(invite.code)} <span class="chip">${escapeHtml(invite.status)}</span></strong>
      <p class="muted">${escapeHtml(invite.label)} - ${invite.remainingUses}/${invite.maxUses} remaining${invite.expiresAt ? ` - expires ${new Date(invite.expiresAt).toLocaleDateString()}` : ''}</p>
      ${invite.note ? `<p>${escapeHtml(invite.note)}</p>` : ''}
      <div class="statline">
        ${(invite.uses || []).slice(-6).map(use => `<span class="chip">${escapeHtml(use.displayName)} ${new Date(use.usedAt).toLocaleDateString()}</span>`).join('')}
      </div>
      ${invite.status === 'active' ? '<button class="danger">Disable Invite</button>' : ''}
    `;
    const disable = card.querySelector('button');
    if (disable) disable.addEventListener('click', () => disableInvite(invite.inviteId));
    return card;
  });
  output.replaceChildren(header, ...cards);
}

async function createInvite(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const expiresAtValue = form.elements.expiresAt.value;
  await api('/invites', {
    method: 'POST',
    body: JSON.stringify({
      reason,
      code: form.elements.code.value,
      label: form.elements.label.value,
      maxUses: form.elements.maxUses.value ? Number(form.elements.maxUses.value) : 1,
      expiresAt: expiresAtValue ? new Date(`${expiresAtValue}T23:59:59Z`).getTime() : null,
      note: form.elements.note.value,
    }),
  });
  form.reset();
  status('Invite created.', 'ok');
  await loadInvites();
}

async function disableInvite(inviteId) {
  const reason = prompt('Reason for disabling this invite');
  if (!reason) return;
  await api(`/invites/${encodeURIComponent(inviteId)}/disable`, { method: 'POST', body: JSON.stringify({ reason }) });
  status('Invite disabled.', 'ok');
  await loadInvites();
}

async function loadTickets() {
  const { tickets } = await api('/support/tickets');
  const output = document.querySelector('#tickets');
  output.replaceChildren(...tickets.map(ticket => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${escapeHtml(ticket.subject)}</strong>
      <p class="muted">${escapeHtml(ticket.displayName || 'Unknown')} - ${escapeHtml(ticket.status)} - ${new Date(ticket.updatedAt).toLocaleString()}</p>
      <p>${escapeHtml(ticket.message)}</p>
      <div class="row">
        <select>
          ${['open', 'in_review', 'waiting_on_player', 'resolved', 'closed'].map(status => `<option ${status === ticket.status ? 'selected' : ''}>${status}</option>`).join('')}
        </select>
        <button>Update</button>
      </div>
    `;
    card.querySelector('button').addEventListener('click', async () => {
      await api(`/support/tickets/${ticket.ticketId}`, { method: 'PATCH', body: JSON.stringify({ status: card.querySelector('select').value }) });
      loadTickets();
    });
    return card;
  }));
}

async function loadEconomy() {
  const data = await api('/economy');
  economyWagerTables = [...(data.config?.wagerTables || data.economy?.catalog?.wagerTables || [])]
    .sort((a, b) => Number(a.buyIn || 0) - Number(b.buyIn || 0));
  renderWagerTables();
  renderEconomyOutput(data.economy, data.config);
}

async function saveEconomyConfig(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const wagerTables = collectWagerTables();
  const reason = form.reason.value.trim();
  if (!reason) {
    alert('Reason is required.');
    return;
  }
  const data = await api('/economy/config', {
    method: 'PATCH',
    body: JSON.stringify({ reason, config: { wagerTables } }),
  });
  form.reason.value = '';
  economyWagerTables = [...(data.config?.wagerTables || data.economy?.catalog?.wagerTables || [])]
    .sort((a, b) => Number(a.buyIn || 0) - Number(b.buyIn || 0));
  renderWagerTables();
  renderEconomyOutput(data.economy, data.config);
  status('Wager options saved.', 'ok');
}

function renderEconomyOutput(economy, config) {
  document.querySelector('#economyOutput').textContent = JSON.stringify({
    activeWagerBuyIns: (config?.wagerTables || economy?.catalog?.wagerTables || []).map(table => table.buyIn),
    economy,
  }, null, 2);
}

function renderWagerTables() {
  const output = document.querySelector('#wagerTableRows');
  output.replaceChildren(...economyWagerTables.map((table, index) => {
    const row = document.createElement('div');
    row.className = 'card wager-row';
    row.dataset.index = String(index);
    row.innerHTML = `
      <label>Buy-in
        <input data-field="buyIn" type="number" min="0" step="1" value="${Number(table.buyIn || 0)}" />
      </label>
      <label>Label
        <input data-field="label" value="${escapeHtml(table.label || '')}" placeholder="50,000" />
      </label>
      <label>Description
        <input data-field="description" value="${escapeHtml(table.description || '')}" placeholder="Buy in for coins." />
      </label>
      <button type="button" class="danger" data-remove-wager="${index}">Remove</button>
    `;
    row.querySelector('[data-remove-wager]').addEventListener('click', () => {
      economyWagerTables.splice(index, 1);
      renderWagerTables();
    });
    return row;
  }));
}

function collectWagerTables() {
  const rows = [...document.querySelectorAll('#wagerTableRows .wager-row')];
  const byBuyIn = new Map();
  for (const row of rows) {
    const buyIn = Math.max(0, Math.floor(Number(row.querySelector('[data-field="buyIn"]').value || 0)));
    const label = row.querySelector('[data-field="label"]').value.trim() || (buyIn ? buyIn.toLocaleString() : 'Free Play');
    const description = row.querySelector('[data-field="description"]').value.trim() || (buyIn ? `Buy in for ${buyIn.toLocaleString()} coins.` : 'No entry fee. Earn coins slowly through match rewards.');
    byBuyIn.set(buyIn, {
      id: buyIn ? `wager-${buyIn}` : 'free',
      label,
      buyIn,
      description,
      enabled: true,
      sortOrder: buyIn,
    });
  }
  if (!byBuyIn.has(0)) {
    byBuyIn.set(0, {
      id: 'free',
      label: 'Free Play',
      buyIn: 0,
      description: 'No entry fee. Earn coins slowly through match rewards.',
      enabled: true,
      sortOrder: 0,
    });
  }
  return [...byBuyIn.values()].sort((a, b) => a.buyIn - b.buyIn);
}

function addWagerTable() {
  const current = collectWagerTables();
  const highest = current.reduce((max, table) => Math.max(max, Number(table.buyIn || 0)), 0);
  const nextBuyIn = highest > 0 ? highest * 2 : 50;
  economyWagerTables = [
    ...current,
    {
      id: `wager-${nextBuyIn}`,
      label: nextBuyIn.toLocaleString(),
      buyIn: nextBuyIn,
      description: `Buy in for ${nextBuyIn.toLocaleString()} coins.`,
      enabled: true,
      sortOrder: nextBuyIn,
    },
  ];
  renderWagerTables();
}

async function loadCompetitive() {
  const [overviewData, configData, queueData] = await Promise.all([
    api('/competitive/overview'),
    api('/competitive/config'),
    api('/competitive/queues'),
  ]);
  competitiveConfig = configData;
  renderCompetitiveOverview(overviewData.overview);
  renderCompetitiveConfig(configData);
  renderRankedQueues(queueData);
}

function renderCompetitiveOverview(overview) {
  const output = document.querySelector('#competitiveOverview');
  const seasonEnds = overview.season?.endsAt ? new Date(overview.season.endsAt).toLocaleString() : 'Unknown';
  const leagues = Object.entries(overview.leagueDistribution || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([league, count]) => `${escapeHtml(league)}: ${count}`)
    .join('<br />');
  output.innerHTML = `
    <div class="card"><strong>${escapeHtml(overview.season?.name || 'Active Season')}</strong><p class="muted">${escapeHtml(overview.season?.id || '')}<br />Ends ${escapeHtml(seasonEnds)}</p></div>
    <div class="card"><strong>${overview.rankedPlayers}/${overview.totalPlayers}</strong><p class="muted">Ranked players</p></div>
    <div class="card"><strong>${overview.averageMmr}</strong><p class="muted">Average MMR</p></div>
    <div class="card"><strong>${overview.activeQueues}</strong><p class="muted">Queued players</p></div>
    <div class="card"><strong>${overview.activeRankedRooms}</strong><p class="muted">Active ranked rooms</p></div>
    <div class="card"><strong>League Distribution</strong><p class="muted">${leagues || 'No players yet.'}</p></div>
  `;
}

function renderCompetitiveConfig(data) {
  const form = document.querySelector('#competitiveConfigEditor');
  const draft = data.draft || data.live;
  form.elements.placementMatchesRequired.value = draft.placementMatchesRequired;
  form.elements.placementMultiplier.value = draft.placementMultiplier;
  form.elements.strengthAdjustmentCap.value = draft.strengthAdjustmentCap;
  form.elements.performanceBonusCap.value = draft.performanceBonusCap;
  form.elements.seasonLengthDays.value = draft.seasonLengthDays;
  form.elements.rewardGraceDays.value = draft.rewardGraceDays;
  form.elements.mmrDeltas.value = JSON.stringify(draft.mmrDeltas, null, 2);
  form.elements.matchmaking.value = JSON.stringify(draft.matchmaking, null, 2);
  form.elements.leagueBands.value = JSON.stringify(draft.leagueBands, null, 2);
  form.elements.rewards.value = JSON.stringify(draft.rewards, null, 2);
  const seasons = document.querySelector('#seasonOutput');
  seasons.replaceChildren(...(data.seasons || []).map(season => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${escapeHtml(season.name)} <span class="chip">${escapeHtml(season.status)}</span></strong>
      <p class="muted">${escapeHtml(season.id)}<br />${new Date(season.startsAt).toLocaleString()} - ${new Date(season.endsAt).toLocaleString()}</p>
      <div class="actions-inline">
        <button data-season-activate="${escapeHtml(season.id)}">Activate</button>
        <button data-season-end="${escapeHtml(season.id)}" class="danger">End</button>
      </div>
    `;
    card.querySelector('[data-season-activate]').addEventListener('click', () => activateSeason(season.id));
    card.querySelector('[data-season-end]').addEventListener('click', () => endSeason(season.id));
    return card;
  }));
}

function parseJsonField(form, name) {
  try {
    return JSON.parse(form.elements[name].value || 'null');
  } catch {
    throw new Error(`${name} must be valid JSON.`);
  }
}

async function saveCompetitiveDraft(event) {
  event.preventDefault();
  try {
    const form = event.currentTarget;
    const reason = prompt('Reason for audit log');
    if (!reason) return;
    const config = {
      placementMatchesRequired: Number(form.elements.placementMatchesRequired.value),
      placementMultiplier: Number(form.elements.placementMultiplier.value),
      strengthAdjustmentCap: Number(form.elements.strengthAdjustmentCap.value),
      performanceBonusCap: Number(form.elements.performanceBonusCap.value),
      seasonLengthDays: Number(form.elements.seasonLengthDays.value),
      rewardGraceDays: Number(form.elements.rewardGraceDays.value),
      mmrDeltas: parseJsonField(form, 'mmrDeltas'),
      matchmaking: parseJsonField(form, 'matchmaking'),
      leagueBands: parseJsonField(form, 'leagueBands'),
      rewards: parseJsonField(form, 'rewards'),
    };
    await api('/competitive/config/draft', { method: 'PATCH', body: JSON.stringify({ reason, config }) });
    status('Competitive draft saved.', 'ok');
    await loadCompetitive();
  } catch (error) {
    alert(error.message);
  }
}

async function publishCompetitive() {
  const reason = prompt('Publish reason for audit log');
  if (!reason) return;
  if (!confirm('Publish competitive rule changes live? This affects ranked immediately.')) return;
  await api('/competitive/config/publish', { method: 'POST', body: JSON.stringify({ reason }) });
  status('Competitive config published.', 'ok');
  await loadCompetitive();
}

async function rollbackCompetitive() {
  const reason = prompt('Rollback reason for audit log');
  if (!reason) return;
  const versionId = prompt('Version ID to rollback to, or leave blank for latest rollback snapshot') || null;
  await api('/competitive/config/rollback', { method: 'POST', body: JSON.stringify({ reason, versionId }) });
  status('Competitive config rolled back.', 'ok');
  await loadCompetitive();
}

async function createCompetitiveSeason() {
  const name = document.querySelector('#seasonName').value.trim() || 'New Ranked Season';
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const startsAt = Date.now();
  const endsAt = startsAt + 90 * 24 * 60 * 60 * 1000;
  await api('/competitive/seasons', { method: 'POST', body: JSON.stringify({ reason, season: { name, startsAt, endsAt } }) });
  status('Season created.', 'ok');
  await loadCompetitive();
}

async function activateSeason(seasonId) {
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const confirmText = prompt(`Type ACTIVATE ${seasonId} to confirm`);
  await api(`/competitive/seasons/${encodeURIComponent(seasonId)}/activate`, {
    method: 'POST',
    body: JSON.stringify({ reason, confirm: confirmText }),
  });
  status('Season activated.', 'ok');
  await loadCompetitive();
}

async function endSeason(seasonId) {
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const confirmText = prompt(`Type END ${seasonId} to confirm`);
  await api(`/competitive/seasons/${encodeURIComponent(seasonId)}/end`, {
    method: 'POST',
    body: JSON.stringify({ reason, confirm: confirmText }),
  });
  status('Season ended and next season initialized.', 'ok');
  await loadCompetitive();
}

async function loadRankedQueues() {
  const data = await api('/competitive/queues');
  renderRankedQueues(data);
}

function renderRankedQueues(data) {
  const output = document.querySelector('#rankedQueuesOutput');
  const queueCards = (data.queues || []).map(entry => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${escapeHtml(entry.displayName)} <span class="chip">MMR ${entry.mmr}</span></strong>
      <p class="muted">${escapeHtml(entry.userId)} - ${entry.maxPlayers} players - ${entry.rounds} rounds - ${Math.round(entry.waitMs / 1000)}s waiting - range +/-${entry.searchRange}</p>
      <button data-cancel-queue="${escapeHtml(entry.userId)}" class="danger">Cancel Queue</button>
    `;
    card.querySelector('button').addEventListener('click', () => cancelRankedQueue(entry.userId));
    return card;
  });
  const roomCards = (data.rooms || []).map(room => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `<strong>Room ${escapeHtml(room.code)}</strong><p class="muted">${escapeHtml(room.status)} - ${room.players.length}/${room.maxPlayers} players - ${room.rounds} rounds</p>`;
    return card;
  });
  output.replaceChildren(...queueCards, ...roomCards);
  if (!queueCards.length && !roomCards.length) output.innerHTML = '<p class="muted">No active ranked queues or rooms.</p>';
}

async function cancelRankedQueue(userId) {
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  await api(`/competitive/queues/${encodeURIComponent(userId)}?reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
  status('Queue entry cancelled.', 'ok');
  await loadRankedQueues();
}

async function adjustCompetitivePlayer(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const userId = form.elements.userId.value.trim();
  if (!userId) return alert('Enter a player user id or display name.');
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const payload = { reason, clearHistory: form.elements.clearHistory.checked };
  ['mmr', 'seasonBestMmr', 'placementsPlayed', 'rankedGames', 'wins', 'losses'].forEach(key => {
    if (form.elements[key].value !== '') payload[key] = Number(form.elements[key].value);
  });
  const result = await api(`/users/${encodeURIComponent(userId)}/competitive/adjust`, { method: 'POST', body: JSON.stringify(payload) });
  status(`Competitive state updated for ${result.user.displayName}.`, 'ok');
  await loadCompetitive();
}

async function loadCatalog() {
  const data = await api('/catalog/cosmetics');
  catalogDraft = data.draft || data.cosmetics || [];
  catalogLive = data.live || [];
  renderCatalog();
}

function renderCatalog() {
  const typeFilter = document.querySelector('#catalogFilter')?.value || '';
  const stateFilter = document.querySelector('#catalogStateFilter')?.value || '';
  const liveIds = new Set(catalogLive.map(item => `${item.id}:${JSON.stringify(item)}`));
  const items = catalogDraft.filter(item => {
    if (typeFilter && item.type !== typeFilter) return false;
    if (stateFilter === 'enabled' && !item.enabled) return false;
    if (stateFilter === 'disabled' && item.enabled) return false;
    if (stateFilter === 'sale' && !item.sale) return false;
    if (stateFilter === 'archived' && !item.archivedAt) return false;
    return true;
  });
  const output = document.querySelector('#catalogOutput');
  output.replaceChildren(...items.map(item => {
    const card = document.createElement('button');
    const changed = !liveIds.has(`${item.id}:${JSON.stringify(item)}`);
    card.className = `card ghost catalog-card ${item.enabled ? '' : 'dim'} ${item.archivedAt ? 'danger-border' : ''}`;
    card.innerHTML = `
      <div class="catalog-preview" style="${previewStyle(item)}">${item.asset?.url ? `<img src="${escapeHtml(item.asset.url)}" alt="" />` : escapeHtml(item.visual?.mark || item.name.slice(0, 2).toUpperCase())}</div>
      <strong>${escapeHtml(item.name)}</strong>
      <p class="muted">${escapeHtml(item.id)} - ${escapeHtml(item.type)} - ${escapeHtml(item.shopCategory)}</p>
      <div class="statline">
        <span class="chip">${money(item.price)}</span>
        ${item.sale ? `<span class="chip gold">Sale ${money(item.salePrice)}</span>` : ''}
        <span class="chip">${item.enabled ? 'Enabled' : 'Disabled'}</span>
        ${changed ? '<span class="chip blue">Draft changed</span>' : ''}
      </div>
    `;
    card.addEventListener('click', () => editCatalogItem(item.id));
    return card;
  }));
}

function previewStyle(item) {
  const visual = item.visual || {};
  return [
    `background:${escapeCss(visual.backgroundColor || '#132a40')}`,
    `border-color:${escapeCss(visual.borderColor || '#55a8ff')}`,
    `color:${escapeCss(visual.textColor || visual.accentColor || '#f6f8ff')}`,
  ].join(';');
}

function editCatalogItem(id) {
  selectedCatalogItem = catalogDraft.find(item => item.id === id);
  if (!selectedCatalogItem) return;
  const form = document.querySelector('#catalogEditor');
  form.classList.remove('hidden');
  const item = selectedCatalogItem;
  for (const [key, value] of Object.entries({
    id: item.id,
    name: item.name,
    description: item.description,
    type: item.type,
    shopCategory: item.shopCategory,
    price: item.price,
    salePrice: item.salePrice,
    unlockRequirement: item.unlockRequirement || '',
    requiredMmr: item.requiredMmr ?? '',
    requiredLeague: item.requiredLeague || '',
    seasonId: item.seasonId || '',
    backgroundColor: item.visual?.backgroundColor || '',
    borderColor: item.visual?.borderColor || '',
    accentColor: item.visual?.accentColor || '',
    mark: item.visual?.mark || '',
  })) {
    if (form.elements[key]) form.elements[key].value = value;
  }
  form.elements.enabled.checked = item.enabled !== false;
  form.elements.sale.checked = !!item.sale;
  form.elements.featured.checked = !!item.featured;
}

function createCatalogItemDraft() {
  const id = prompt('New cosmetic id, lowercase with dashes');
  if (!id) return;
  const item = {
    id,
    name: id.split('-').map(part => part.slice(0, 1).toUpperCase() + part.slice(1)).join(' '),
    description: '',
    type: 'cardBack',
    shopCategory: 'coin',
    rarity: 'rare',
    price: 500,
    salePrice: 500,
    enabled: false,
    visual: { kind: 'preset', backgroundColor: '#132a40', borderColor: '#55e0a3', accentColor: '#ffd166', mark: 'G9' },
  };
  catalogDraft.unshift(item);
  renderCatalog();
  editCatalogItem(id);
}

async function saveCatalogItem(event) {
  event.preventDefault();
  if (!selectedCatalogItem) return;
  const form = event.currentTarget;
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const item = {
    id: form.elements.id.value,
    name: form.elements.name.value,
    description: form.elements.description.value,
    type: form.elements.type.value,
    shopCategory: form.elements.shopCategory.value,
    price: Number(form.elements.price.value || 0),
    salePrice: Number(form.elements.salePrice.value || 0),
    sale: form.elements.sale.checked,
    enabled: form.elements.enabled.checked,
    featured: form.elements.featured.checked,
    unlockRequirement: form.elements.unlockRequirement.value || null,
    requiredMmr: form.elements.requiredMmr.value ? Number(form.elements.requiredMmr.value) : null,
    requiredLeague: form.elements.requiredLeague.value || null,
    seasonId: form.elements.seasonId.value || null,
    visual: {
      kind: 'preset',
      type: form.elements.type.value,
      backgroundColor: form.elements.backgroundColor.value,
      borderColor: form.elements.borderColor.value,
      accentColor: form.elements.accentColor.value,
      mark: form.elements.mark.value,
    },
  };
  const result = await api(`/catalog/cosmetics/${encodeURIComponent(item.id)}`, { method: 'PATCH', body: JSON.stringify({ item, reason }) });
  catalogDraft = result.draft;
  status('Draft saved.', 'ok');
  renderCatalog();
  editCatalogItem(item.id);
}

async function uploadCatalogAsset() {
  if (!selectedCatalogItem) return;
  const file = document.querySelector('#catalogAsset').files?.[0];
  if (!file) return alert('Choose an image file first.');
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const data = await fileToBase64(file);
  await api(`/catalog/cosmetics/${encodeURIComponent(selectedCatalogItem.id)}/asset`, {
    method: 'POST',
    body: JSON.stringify({ reason, data, mimeType: file.type, originalName: file.name }),
  });
  status('Asset uploaded to draft item.', 'ok');
  await loadCatalog();
  editCatalogItem(selectedCatalogItem.id);
}

async function duplicateCatalogItem() {
  if (!selectedCatalogItem) return;
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const result = await api(`/catalog/cosmetics/${encodeURIComponent(selectedCatalogItem.id)}/duplicate`, { method: 'POST', body: JSON.stringify({ reason }) });
  catalogDraft = result.draft;
  renderCatalog();
  editCatalogItem(result.item.id);
}

async function archiveCatalogItem() {
  if (!selectedCatalogItem || !confirm(`Archive ${selectedCatalogItem.name}?`)) return;
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const result = await api(`/catalog/cosmetics/${encodeURIComponent(selectedCatalogItem.id)}/archive`, { method: 'POST', body: JSON.stringify({ reason }) });
  catalogDraft = result.draft;
  status('Draft item archived. Publish to make it live.', 'ok');
  renderCatalog();
}

async function publishCatalog() {
  const reason = prompt('Publish reason for audit log');
  if (!reason) return;
  await api('/catalog/publish', { method: 'POST', body: JSON.stringify({ reason }) });
  status('Catalog published.', 'ok');
  await loadCatalog();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function loadClubs() {
  const q = document.querySelector('#clubSearch').value.trim();
  const { clubs } = await api(`/clubs?q=${encodeURIComponent(q)}`);
  const output = document.querySelector('#clubsOutput');
  output.replaceChildren(...clubs.map(club => {
    const card = document.createElement('button');
    card.className = 'card ghost';
    card.innerHTML = `
      <strong>${escapeHtml(club.name)} [${escapeHtml(club.tag)}]</strong>
      <p class="muted">${escapeHtml(club.clubId)} - Owner: ${escapeHtml(club.ownerName)}</p>
      <div class="statline">
        <span class="chip">Lv ${club.level}</span>
        <span class="chip">${club.memberCount}/${club.memberCap} members</span>
        <span class="chip">${club.requestCount} requests</span>
        <span class="chip">Event ${club.eventScore}</span>
        ${club.adminStatus?.frozenAt ? '<span class="chip danger-chip">Frozen</span>' : ''}
      </div>
    `;
    card.addEventListener('click', () => loadClub(club.clubId));
    return card;
  }));
}

async function loadClub(clubId) {
  const { club } = await api(`/clubs/${encodeURIComponent(clubId)}`);
  selectedClub = club;
  renderClubDetail(club);
}

function renderClubDetail(club) {
  const node = document.querySelector('#clubDetail');
  node.classList.remove('hidden');
  node.innerHTML = `
    <h2>${escapeHtml(club.name)} [${escapeHtml(club.tag)}]</h2>
    <p class="muted">${escapeHtml(club.clubId)} - ${club.memberCount}/${club.memberCap} members - Level ${club.level}</p>
    <div class="statline">
      <span class="chip">XP ${Number(club.progression?.totalXp || 0).toLocaleString()}</span>
      <span class="chip">Requests ${club.joinRequests?.length || 0}</span>
      <span class="chip">Event ${club.event?.leaderboardScore || 0}</span>
      ${club.adminStatus?.frozenAt ? '<span class="chip danger-chip">Frozen</span>' : ''}
    </div>
    <div class="actions">
      <button data-club-action="identity">Edit Identity</button>
      <button data-club-action="xp">Adjust XP</button>
      <button data-club-action="announce">Admin Announcement</button>
      <button data-club-action="rewardGrant">Grant Reward</button>
      <button data-club-action="rewardRevoke">Revoke Reward</button>
      <button data-club-action="${club.adminStatus?.frozenAt ? 'unfreeze' : 'freeze'}">${club.adminStatus?.frozenAt ? 'Unfreeze' : 'Freeze'}</button>
      <button data-club-action="disband" class="danger">Emergency Disband</button>
    </div>
    <h3>Members</h3>
    <div class="list">
      ${(club.members || []).map(member => `
        <div class="card mini">
          <strong>${escapeHtml(member.displayName)} - ${escapeHtml(member.role)}</strong>
          <p class="muted">${escapeHtml(member.userId)} - ${Number(member.contributionXp || 0).toLocaleString()} contribution XP</p>
          <div class="actions-inline">
            <button data-member-role="${escapeHtml(member.userId)}">Role</button>
            <button data-member-xp="${escapeHtml(member.userId)}" class="ghost">Set XP</button>
            <button data-member-remove="${escapeHtml(member.userId)}" class="danger">Remove</button>
          </div>
        </div>
      `).join('')}
    </div>
    <h3>Requests</h3>
    <div class="list">
      ${(club.joinRequests || []).map(request => `
        <div class="card mini">
          <strong>${escapeHtml(request.displayName)}</strong>
          <p class="muted">${escapeHtml(request.message || 'No message')}</p>
        </div>
      `).join('') || '<p class="muted">No pending join requests.</p>'}
    </div>
    <h3>Announcements</h3>
    <div class="list">
      ${(club.announcements || []).slice(0, 5).map(item => `<div class="card mini"><strong>${escapeHtml(item.authorName || item.displayName || 'Club')}</strong><p>${escapeHtml(item.text)}</p></div>`).join('') || '<p class="muted">No announcements yet.</p>'}
    </div>
  `;
  node.querySelectorAll('[data-club-action]').forEach(button => button.addEventListener('click', () => runClubAction(button.dataset.clubAction)));
  node.querySelectorAll('[data-member-role]').forEach(button => button.addEventListener('click', () => updateClubMember(button.dataset.memberRole, 'role')));
  node.querySelectorAll('[data-member-xp]').forEach(button => button.addEventListener('click', () => updateClubMember(button.dataset.memberXp, 'xp')));
  node.querySelectorAll('[data-member-remove]').forEach(button => button.addEventListener('click', () => removeClubMember(button.dataset.memberRemove)));
}

async function runClubAction(action) {
  if (!selectedClub) return;
  try {
    const reason = prompt('Reason for audit log');
    if (!reason) return;
    if (action === 'identity') {
      const name = prompt('Club name', selectedClub.name);
      const tag = prompt('Club tag', selectedClub.tag);
      const motto = prompt('Club motto', selectedClub.motto || '');
      await api(`/clubs/${selectedClub.clubId}`, { method: 'PATCH', body: JSON.stringify({ reason, name, tag, motto, branding: selectedClub.branding }) });
    }
    if (action === 'xp') {
      const amount = Number(prompt('XP adjustment amount, e.g. 500 or -500', '500'));
      await api(`/clubs/${selectedClub.clubId}/xp/adjust`, { method: 'POST', body: JSON.stringify({ reason, amount }) });
    }
    if (action === 'announce') {
      const text = prompt('Announcement text');
      await api(`/clubs/${selectedClub.clubId}/announcements`, { method: 'POST', body: JSON.stringify({ reason, text }) });
    }
    if (action === 'rewardGrant' || action === 'rewardRevoke') {
      const rewardId = prompt('Reward id');
      const route = action === 'rewardGrant' ? 'grant' : 'revoke';
      await api(`/clubs/${selectedClub.clubId}/rewards/${route}`, { method: 'POST', body: JSON.stringify({ reason, rewardId }) });
    }
    if (action === 'freeze' || action === 'unfreeze') {
      await api(`/clubs/${selectedClub.clubId}/moderation`, { method: 'POST', body: JSON.stringify({ reason, action }) });
    }
    if (action === 'disband') {
      if (!confirm('Emergency disband this club? This removes every member from it.')) return;
      await api(`/clubs/${selectedClub.clubId}/moderation`, { method: 'POST', body: JSON.stringify({ reason, action: 'disband' }) });
      selectedClub = null;
      document.querySelector('#clubDetail').classList.add('hidden');
      await loadClubs();
      return;
    }
    await loadClub(selectedClub.clubId);
  } catch (error) {
    alert(error.message);
  }
}

async function updateClubMember(userId, mode) {
  if (!selectedClub) return;
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  const payload = { reason };
  if (mode === 'role') payload.role = prompt('New role: owner, officer, member, rookie', 'member');
  if (mode === 'xp') payload.contributionXp = Number(prompt('Set contribution XP', '0'));
  await api(`/clubs/${selectedClub.clubId}/members/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) });
  await loadClub(selectedClub.clubId);
}

async function removeClubMember(userId) {
  if (!selectedClub || !confirm('Remove this member from the club?')) return;
  const reason = prompt('Reason for audit log');
  if (!reason) return;
  await api(`/clubs/${selectedClub.clubId}/members/${userId}?reason=${encodeURIComponent(reason)}`, { method: 'DELETE' });
  await loadClub(selectedClub.clubId);
}

async function loadAudit() {
  const { audit } = await api('/audit');
  const output = document.querySelector('#auditOutput');
  output.replaceChildren(...audit.map(entry => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${escapeHtml(entry.action)}</strong>
      <p class="muted">${escapeHtml(entry.adminName)} - ${new Date(entry.createdAt).toLocaleString()}</p>
      <pre>${escapeHtml(JSON.stringify({ target: entry.target, details: entry.details }, null, 2))}</pre>
    `;
    return card;
  }));
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));
}

function escapeCss(value) {
  return String(value || '').replace(/[;"'(){}]/g, '');
}

document.querySelector('#loginForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const errorNode = document.querySelector('#loginError');
  errorNode.textContent = '';
  try {
    const login = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        displayName: form.get('displayName'),
        password: form.get('password'),
      }),
    });
    if (login.mfaRequired) {
      await api('/auth/mfa/verify', {
        method: 'POST',
        body: JSON.stringify({ code: form.get('mfaCode') || '000000' }),
      });
    }
    renderConsole();
  } catch (error) {
    errorNode.textContent = error.message;
  }
});

api('/auth/me').then(renderConsole).catch(() => null);
