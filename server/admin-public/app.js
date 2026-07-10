const app = document.querySelector('#app');
const template = document.querySelector('#consoleTemplate');

let selectedUser = null;
let selectedCatalogItem = null;
let catalogDraft = [];
let catalogLive = [];
let selectedClub = null;
let competitiveConfig = null;
let economyWagerTables = [];
let economyClubConfig = null;
let notificationConfig = null;
let playerSearchResults = [];
let playerSort = { key: 'displayName', direction: 'asc' };
let adminAccountsCache = [];
let adminRolesCache = [];
let mailHistory = [];
let mailCosmetics = [];
let catalogAssetRequirements = {};

const NOTIFICATION_LABELS = {
  turn: 'Your Turn',
  dailyBonus: 'Daily Bonus',
  roomInvite: 'Room Invite',
  friendRequest: 'Friend Request',
  mail: 'System Mail',
};

const PLAYER_TABLE_COLUMNS = [
  { key: 'displayName', label: 'Name', className: 'primary-cell' },
  { key: 'userId', label: 'User ID', className: 'mono-cell' },
  { key: 'level', label: 'Level', align: 'right' },
  { key: 'totalXp', label: 'XP', align: 'right' },
  { key: 'coins', label: 'Coins', align: 'right' },
  { key: 'rank', label: 'Rank' },
  { key: 'mmr', label: 'MMR', align: 'right' },
  { key: 'games', label: 'Games', align: 'right' },
  { key: 'wins', label: 'Wins', align: 'right' },
  { key: 'winRate', label: 'Win Rate', align: 'right' },
  { key: 'club', label: 'Club' },
  { key: 'moderation', label: 'Status' },
  { key: 'devices', label: 'Devices', align: 'right' },
  { key: 'lastSeen', label: 'Last Seen' },
];

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
      if (button.dataset.tab === 'mail') loadMail();
      if (button.dataset.tab === 'economy') loadEconomy();
      if (button.dataset.tab === 'notifications') loadNotifications();
      if (button.dataset.tab === 'competitive') loadCompetitive();
      if (button.dataset.tab === 'admins') loadAdmins();
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
  document.querySelector('#playerResultFilter').addEventListener('input', renderPlayerResults);
  document.querySelector('#showArchivedPlayers').addEventListener('change', searchPlayers);
  document.querySelector('#loadInvites').addEventListener('click', loadInvites);
  document.querySelector('#inviteEditor').addEventListener('submit', createInvite);
  document.querySelector('#loadTickets').addEventListener('click', loadTickets);
  document.querySelector('#loadMail').addEventListener('click', loadMail);
  document.querySelector('#mailComposer').addEventListener('submit', sendSystemMail);
  document.querySelector('#loadEconomy').addEventListener('click', loadEconomy);
  document.querySelector('#addWagerTable').addEventListener('click', addWagerTable);
  document.querySelector('#addClubPrestigeTier').addEventListener('click', addClubPrestigeTier);
  document.querySelector('#economyConfigEditor').addEventListener('submit', saveEconomyConfig);
  document.querySelector('#loadNotifications').addEventListener('click', loadNotifications);
  document.querySelector('#notificationConfigEditor').addEventListener('submit', saveNotificationConfig);
  document.querySelector('#customNotificationForm').addEventListener('submit', sendCustomNotification);
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
  document.querySelector('#catalogEditor select[name="type"]').addEventListener('change', () => renderCatalogAssetHelp());
  document.querySelector('#catalogAsset').addEventListener('change', previewCatalogAsset);
  document.querySelector('#uploadCatalogAsset').addEventListener('click', uploadCatalogAsset);
  document.querySelector('#duplicateCatalogItem').addEventListener('click', duplicateCatalogItem);
  document.querySelector('#archiveCatalogItem').addEventListener('click', archiveCatalogItem);
  document.querySelector('#loadClubs').addEventListener('click', loadClubs);
  document.querySelector('#searchClubs').addEventListener('click', loadClubs);
  document.querySelector('#clubSearch').addEventListener('keydown', event => {
    if (event.key === 'Enter') loadClubs();
  });
  document.querySelector('#loadAdmins').addEventListener('click', loadAdmins);
  document.querySelector('#adminCreateForm').addEventListener('submit', createAdmin);
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
  const archived = document.querySelector('#showArchivedPlayers')?.checked ? '1' : '0';
  const { users } = await api(`/users?q=${encodeURIComponent(q)}&archived=${archived}`);
  playerSearchResults = users || [];
  renderPlayerResults();
}

async function loadUser(userId) {
  const { user } = await api(`/users/${encodeURIComponent(userId)}`);
  selectedUser = user;
  renderUserDetail(user);
  highlightSelectedPlayerRow(user.userId);
}

function renderPlayerResults() {
  const output = document.querySelector('#playerResults');
  const countNode = document.querySelector('#playerResultCount');
  const filter = document.querySelector('#playerResultFilter')?.value.trim().toLowerCase() || '';
  const visibleUsers = playerSearchResults
    .filter(user => !filter || playerFilterText(user).includes(filter))
    .sort(comparePlayers);

  if (countNode) {
    const total = playerSearchResults.length;
    const visible = visibleUsers.length;
    countNode.textContent = total ? `${visible.toLocaleString()} of ${total.toLocaleString()} players shown` : 'No players loaded';
  }

  if (!visibleUsers.length) {
    output.innerHTML = '<div class="empty-state">No matching players found.</div>';
    return;
  }

  output.innerHTML = `
    <table class="admin-table player-table">
      <thead>
        <tr>
          ${PLAYER_TABLE_COLUMNS.map(column => `
            <th class="${column.align === 'right' ? 'numeric' : ''}">
              <button type="button" class="table-sort ${playerSort.key === column.key ? 'active' : ''}" data-sort="${escapeHtml(column.key)}">
                ${escapeHtml(column.label)}${playerSort.key === column.key ? ` ${playerSort.direction === 'asc' ? '^' : 'v'}` : ''}
              </button>
            </th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        ${visibleUsers.map(user => `
          <tr data-user-id="${escapeHtml(user.userId)}" tabindex="0" class="${selectedUser?.userId === user.userId ? 'selected' : ''}">
            ${PLAYER_TABLE_COLUMNS.map(column => `
              <td class="${column.align === 'right' ? 'numeric' : ''} ${column.className || ''}">
                ${playerCellMarkup(user, column.key)}
              </td>
            `).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  output.querySelectorAll('[data-sort]').forEach(button => {
    button.addEventListener('click', () => {
      const key = button.dataset.sort;
      playerSort = {
        key,
        direction: playerSort.key === key && playerSort.direction === 'asc' ? 'desc' : 'asc',
      };
      renderPlayerResults();
    });
  });
  output.querySelectorAll('[data-user-id]').forEach(row => {
    row.addEventListener('click', () => loadUser(row.dataset.userId));
    row.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        loadUser(row.dataset.userId);
      }
    });
  });
}

function highlightSelectedPlayerRow(userId) {
  document.querySelectorAll('#playerResults [data-user-id]').forEach(row => {
    row.classList.toggle('selected', row.dataset.userId === userId);
  });
}

function playerFilterText(user) {
  return PLAYER_TABLE_COLUMNS
    .map(column => String(playerRawValue(user, column.key) ?? ''))
    .join(' ')
    .toLowerCase();
}

function comparePlayers(a, b) {
  const direction = playerSort.direction === 'desc' ? -1 : 1;
  const left = playerSortValue(a, playerSort.key);
  const right = playerSortValue(b, playerSort.key);
  if (typeof left === 'number' && typeof right === 'number') return (left - right) * direction;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' }) * direction;
}

function playerSortValue(user, key) {
  const value = playerRawValue(user, key);
  if (value == null) return '';
  return value;
}

function playerCellMarkup(user, key) {
  const value = playerRawValue(user, key);
  if (key === 'displayName') return `<strong>${escapeHtml(value || 'Unnamed')}</strong>`;
  if (key === 'coins' || key === 'totalXp' || key === 'mmr' || key === 'games' || key === 'wins' || key === 'devices') {
    return escapeHtml(Number(value || 0).toLocaleString());
  }
  if (key === 'winRate') return escapeHtml(formatPercent(value));
  if (key === 'moderation') return `<span class="status-pill ${value === 'Clear' ? 'ok-pill' : 'danger-pill'}">${escapeHtml(value)}</span>`;
  if (key === 'lastSeen') return escapeHtml(formatLastSeen(value));
  return escapeHtml(value || '-');
}

function playerRawValue(user, key) {
  const stats = user.statistics || {};
  const games = Number(stats.gamesPlayed || 0);
  const wins = Number(stats.wins || 0);
  switch (key) {
    case 'displayName':
      return user.displayName || '';
    case 'userId':
      return user.userId || '';
    case 'level':
      return Number(user.progression?.level || 1);
    case 'totalXp':
      return Number(user.progression?.totalXp || 0);
    case 'coins':
      return Number(user.currency?.coins || 0);
    case 'rank':
      return user.competitive?.league?.name || 'Unranked';
    case 'mmr':
      return Number(user.competitive?.mmr || 0);
    case 'games':
      return games;
    case 'wins':
      return wins;
    case 'winRate':
      return games ? wins / games : 0;
    case 'club':
      return user.clubId || 'No club';
    case 'moderation':
      return moderationStatus(user);
    case 'devices':
      return Number(user.deviceCount ?? user.knownDevices?.length ?? 0);
    case 'lastSeen':
      return Number(user.lastSeenAt || 0);
    default:
      return '';
  }
}

function moderationStatus(user) {
  if (user.archived) return 'Archived';
  const moderation = user.moderation || {};
  const currentTime = Date.now();
  if (moderation.accountBannedAt) return 'Banned';
  if (Number(moderation.suspendedUntil || 0) > currentTime) return 'Suspended';
  if (Number(moderation.chatMutedUntil || 0) > currentTime) return 'Muted';
  return 'Clear';
}

function formatPercent(value) {
  return `${Math.round((Number(value || 0)) * 100)}%`;
}

function formatLastSeen(value) {
  const timestamp = Number(value || 0);
  return timestamp ? new Date(timestamp).toLocaleString() : 'Never';
}

function renderUserDetail(user) {
  const node = document.querySelector('#playerDetail');
  node.classList.remove('hidden');
  const equipped = user.inventory?.equipped || {};
  const progression = user.progression || {};
  const cosmeticOptions = cosmeticSelectOptions(user);
  node.innerHTML = `
    <h2>${escapeHtml(user.displayName)}</h2>
    <p class="muted">${escapeHtml(user.userId)}</p>
    <div class="statline">
      ${user.archived ? '<span class="chip danger-chip">Archived</span>' : ''}
      <span class="chip">Coins ${money(user.currency?.coins)}</span>
      <span class="chip">Level ${user.progression?.level ?? 1}</span>
      <span class="chip">${Number(progression.totalXp || 0).toLocaleString()} XP</span>
      <span class="chip">Wins ${user.statistics?.wins ?? 0}</span>
      <span class="chip">MMR ${user.competitive?.mmr ?? 0}</span>
    </div>
    <div class="admin-toolbox">
      <form id="playerProgressionEditor" class="card compact">
        <strong>Progression</strong>
        <p class="muted">Apply exactly one operation. Setting a level moves the player to the start of that level.</p>
        <div class="row three">
          <label>XP delta <input name="xpDelta" type="number" placeholder="+500 or -250" /></label>
          <label>Set total XP <input name="totalXp" type="number" min="0" placeholder="${Number(progression.totalXp || 0)}" /></label>
          <label>Set level <input name="level" type="number" min="1" max="500" placeholder="${Number(progression.level || 1)}" /></label>
        </div>
        <input name="reason" placeholder="Required audit reason" required />
        <button type="submit">Apply Progression</button>
      </form>
      <form id="playerCoinsEditor" class="card compact">
        <strong>Currency</strong>
        <p class="muted">Add or remove spendable coins without touching account ownership.</p>
        <div class="row two">
          <label>Coin delta <input name="amount" type="number" placeholder="+500 or -250" required /></label>
          <label>Reason <input name="reason" placeholder="Required audit reason" required /></label>
        </div>
        <button type="submit">Adjust Coins</button>
      </form>
      <form id="playerCosmeticEditor" class="card compact">
        <strong>Cosmetics</strong>
        <p class="muted">Grant, revoke, or equip any catalog item for this player.</p>
        <label>Catalog item
          <select name="cosmeticId" required>
            ${cosmeticOptions}
          </select>
        </label>
        <input name="reason" placeholder="Required audit reason" required />
        <div class="actions-inline">
          <button type="submit" name="intent" value="grant">Grant</button>
          <button type="submit" name="intent" value="equip" class="ghost">Equip</button>
          <button type="submit" name="intent" value="revoke" class="danger">Revoke</button>
        </div>
      </form>
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
      <button data-action="rename">Rename</button>
      <button data-action="password">Reset Password</button>
      <button data-action="sessions">Revoke Sessions</button>
      <button data-action="mute">Mute Chat</button>
      <button data-action="suspend">Suspend</button>
      <button data-action="ban" class="danger">Ban Account</button>
      <button data-action="deviceBan" class="danger">Ban Device</button>
      <button data-action="clear">Clear Moderation</button>
      ${user.archived
        ? '<button data-action="restore">Restore Player</button>'
        : '<button data-action="archive" class="danger">Archive Player</button>'}
    </div>
  `;
  node.querySelector('#playerProgressionEditor')?.addEventListener('submit', adjustPlayerProgression);
  node.querySelector('#playerCoinsEditor')?.addEventListener('submit', adjustPlayerCoins);
  node.querySelector('#playerCosmeticEditor')?.addEventListener('submit', adjustPlayerCosmetic);
  node.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => runUserAction(button.dataset.action)));
}

function cosmeticSelectOptions(user) {
  const cosmetics = [...(user.cosmetics || [])]
    .sort((a, b) => String(a.type || '').localeCompare(String(b.type || '')) || String(a.name || '').localeCompare(String(b.name || '')));
  if (!cosmetics.length) return '<option value="">No catalog items loaded</option>';
  return cosmetics.map(item => {
    const ownership = item.owned ? 'owned' : item.eligible ? 'eligible' : item.unlockStatus || 'locked';
    return `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} - ${escapeHtml(item.type)} - ${escapeHtml(ownership)}</option>`;
  }).join('');
}

async function adjustPlayerProgression(event) {
  event.preventDefault();
  if (!selectedUser) return;
  const form = event.currentTarget;
  const payload = { reason: form.elements.reason.value };
  const xpDelta = form.elements.xpDelta.value.trim();
  const totalXp = form.elements.totalXp.value.trim();
  const level = form.elements.level.value.trim();
  const operations = [xpDelta, totalXp, level].filter(Boolean).length;
  if (operations !== 1) {
    alert('Fill exactly one progression field: XP delta, total XP, or level.');
    return;
  }
  if (xpDelta) payload.xpDelta = Number(xpDelta);
  if (totalXp) payload.totalXp = Number(totalXp);
  if (level) payload.level = Number(level);
  await api(`/users/${selectedUser.userId}/progression/adjust`, { method: 'POST', body: JSON.stringify(payload) });
  status('Progression updated.', 'ok');
  await loadUser(selectedUser.userId);
}

async function adjustPlayerCoins(event) {
  event.preventDefault();
  if (!selectedUser) return;
  const form = event.currentTarget;
  await api(`/users/${selectedUser.userId}/coins/adjust`, {
    method: 'POST',
    body: JSON.stringify({
      amount: Number(form.elements.amount.value),
      reason: form.elements.reason.value,
    }),
  });
  status('Coins updated.', 'ok');
  await loadUser(selectedUser.userId);
}

async function adjustPlayerCosmetic(event) {
  event.preventDefault();
  if (!selectedUser) return;
  const form = event.currentTarget;
  const intent = event.submitter?.value || 'grant';
  const cosmeticId = form.elements.cosmeticId.value;
  if (!cosmeticId) return;
  const endpoint = intent === 'equip' ? 'equip' : intent === 'revoke' ? 'revoke' : 'grant';
  await api(`/users/${selectedUser.userId}/cosmetics/${endpoint}`, {
    method: 'POST',
    body: JSON.stringify({
      cosmeticId,
      reason: form.elements.reason.value,
    }),
  });
  status(`Cosmetic ${endpoint} complete.`, 'ok');
  await loadUser(selectedUser.userId);
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
    if (action === 'archive') {
      const reason = prompt('Reason for archiving this player');
      if (!reason) return;
      if (!confirm(`Archive ${selectedUser.displayName}? This disables login and game access but keeps records.`)) return;
      await api(`/users/${selectedUser.userId}/archive`, { method: 'POST', body: JSON.stringify({ reason }) });
    }
    if (action === 'restore') {
      const reason = prompt('Reason for restoring this player');
      if (!reason) return;
      await api(`/users/${selectedUser.userId}/restore`, { method: 'POST', body: JSON.stringify({ reason }) });
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

async function loadMail() {
  const data = await api('/mail');
  mailHistory = data.history || [];
  mailCosmetics = data.cosmetics || [];
  renderMailComposer();
  renderMailHistory();
}

function renderMailComposer() {
  const select = document.querySelector('#mailComposer select[name="cosmeticId"]');
  if (!select) return;
  const current = select.value;
  select.innerHTML = `
    <option value="">No cosmetic</option>
    ${mailCosmetics.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)} - ${escapeHtml(item.type)}</option>`).join('')}
  `;
  select.value = mailCosmetics.some(item => item.id === current) ? current : '';
}

function mailAttachmentLabel(attachment) {
  if (attachment.type === 'coins') return `${Number(attachment.amount || 0).toLocaleString()} coins`;
  if (attachment.type === 'cosmetic') return `Cosmetic ${attachment.cosmeticId}`;
  return attachment.type || 'Reward';
}

function renderMailHistory() {
  const output = document.querySelector('#mailHistory');
  if (!output) return;
  if (!mailHistory.length) {
    output.innerHTML = '<div class="empty-state">No mail has been sent yet.</div>';
    return;
  }
  output.replaceChildren(...mailHistory.map(entry => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="split-header">
        <div>
          <strong>${escapeHtml(entry.title)}</strong>
          <p class="muted">${escapeHtml(entry.createdByAdminName || 'system')} - ${new Date(entry.createdAt).toLocaleString()}</p>
        </div>
        <span class="chip">${Number(entry.recipientCount || 0).toLocaleString()} recipients</span>
      </div>
      <p>${escapeHtml(entry.body)}</p>
      <div class="statline">
        <span class="chip">Read ${Number(entry.readCount || 0).toLocaleString()}</span>
        <span class="chip">Claimed ${Number(entry.claimedCount || 0).toLocaleString()}</span>
        <span class="chip">Deleted ${Number(entry.deletedCount || 0).toLocaleString()}</span>
        ${(entry.attachments || []).map(item => `<span class="chip gold">${escapeHtml(mailAttachmentLabel(item))}</span>`).join('')}
        ${entry.expiresAt ? `<span class="chip">Expires ${new Date(entry.expiresAt).toLocaleDateString()}</span>` : ''}
      </div>
      <p class="muted">${(entry.recipients || []).map(item => escapeHtml(item.displayName || item.userId)).join(', ')}</p>
    `;
    return card;
  }));
}

async function sendSystemMail(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const expiresAt = form.elements.expiresAt.value ? new Date(`${form.elements.expiresAt.value}T23:59:59`).toISOString() : null;
  const payload = {
    targetType: form.elements.targetMode.value === 'single' ? 'one' : form.elements.targetMode.value,
    targetUsers: form.elements.targets.value,
    title: form.elements.title.value,
    message: form.elements.message.value,
    coins: Number(form.elements.coins.value || 0),
    cosmeticId: form.elements.cosmeticId.value || null,
    expiresAt,
    reason: form.elements.reason.value,
  };
  const data = await api('/mail', { method: 'POST', body: JSON.stringify(payload) });
  mailHistory = data.history || [];
  form.reset();
  renderMailComposer();
  renderMailHistory();
  status(`Mail sent to ${Number(data.count || 0).toLocaleString()} player${data.count === 1 ? '' : 's'}.`, 'ok');
}

async function loadEconomy() {
  const data = await api('/economy');
  economyWagerTables = [...(data.config?.wagerTables || data.economy?.catalog?.wagerTables || [])]
    .sort((a, b) => Number(a.buyIn || 0) - Number(b.buyIn || 0));
  economyClubConfig = normalizeClubConfigDraft(data.config?.clubConfig || data.economy?.catalog?.clubConfig || {});
  renderWagerTables();
  renderClubConfig();
  renderEconomyOutput(data.economy, data.config);
}

async function saveEconomyConfig(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const wagerTables = collectWagerTables();
  const clubConfig = collectClubConfig();
  const reason = form.reason.value.trim();
  if (!reason) {
    alert('Reason is required.');
    return;
  }
  const data = await api('/economy/config', {
    method: 'PATCH',
    body: JSON.stringify({ reason, config: { wagerTables, clubConfig } }),
  });
  form.reason.value = '';
  economyWagerTables = [...(data.config?.wagerTables || data.economy?.catalog?.wagerTables || [])]
    .sort((a, b) => Number(a.buyIn || 0) - Number(b.buyIn || 0));
  economyClubConfig = normalizeClubConfigDraft(data.config?.clubConfig || data.economy?.catalog?.clubConfig || {});
  renderWagerTables();
  renderClubConfig();
  renderEconomyOutput(data.economy, data.config);
  status('Economy settings saved.', 'ok');
}

function renderEconomyOutput(economy, config) {
  document.querySelector('#economyOutput').textContent = JSON.stringify({
    activeWagerBuyIns: (config?.wagerTables || economy?.catalog?.wagerTables || []).map(table => table.buyIn),
    clubConfig: config?.clubConfig || economy?.catalog?.clubConfig,
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

function normalizeClubConfigDraft(input = {}) {
  const tiers = Array.isArray(input.prestigeTiers) && input.prestigeTiers.length ? input.prestigeTiers : [
    { tier: 1, name: 'Founding Club', treasuryCost: 5000, memberCap: 15, minClubLevel: 1, minMembers: 1, minWeeklyMatches: 0, minSeasonMatches: 0, perks: ['Club tag', 'Club chat', '15 member seats'] },
    { tier: 2, name: 'Growing Club', treasuryCost: 10000, memberCap: 20, minClubLevel: 3, minMembers: 5, minWeeklyMatches: 10, minSeasonMatches: 0, perks: ['20 member seats'] },
  ];
  return {
    minJoinLevel: Number(input.minJoinLevel || 10),
    minCreateLevel: Number(input.minCreateLevel || 10),
    createCost: Number(input.createCost || 5000),
    prestigeTiers: tiers.map((tier, index) => ({
      tier: Number(tier.tier || index + 1),
      name: tier.name || `Tier ${index + 1}`,
      treasuryCost: Number(tier.treasuryCost ?? tier.cost ?? 0),
      memberCap: Number(tier.memberCap || 15),
      minClubLevel: Number(tier.minClubLevel || 1),
      minMembers: Number(tier.minMembers || 1),
      minWeeklyMatches: Number(tier.minWeeklyMatches || 0),
      minSeasonMatches: Number(tier.minSeasonMatches || 0),
      perks: Array.isArray(tier.perks) ? tier.perks : [],
    })).sort((a, b) => a.tier - b.tier),
  };
}

function renderClubConfig() {
  const form = document.querySelector('#economyConfigEditor');
  const config = economyClubConfig || normalizeClubConfigDraft();
  form.clubMinJoinLevel.value = config.minJoinLevel;
  form.clubMinCreateLevel.value = config.minCreateLevel;
  form.clubCreateCost.value = config.createCost;
  const output = document.querySelector('#clubPrestigeRows');
  output.replaceChildren(...config.prestigeTiers.map((tier, index) => {
    const row = document.createElement('div');
    row.className = 'card club-prestige-row';
    row.dataset.index = String(index);
    row.innerHTML = `
      <div class="row three">
        <label>Tier <input data-field="tier" type="number" min="1" value="${Number(tier.tier || index + 1)}" /></label>
        <label>Name <input data-field="name" value="${escapeHtml(tier.name || '')}" /></label>
        <label>Treasury cost <input data-field="treasuryCost" type="number" min="0" value="${Number(tier.treasuryCost || 0)}" /></label>
      </div>
      <div class="row three">
        <label>Member cap <input data-field="memberCap" type="number" min="1" value="${Number(tier.memberCap || 15)}" /></label>
        <label>Club level req <input data-field="minClubLevel" type="number" min="1" value="${Number(tier.minClubLevel || 1)}" /></label>
        <label>Members req <input data-field="minMembers" type="number" min="1" value="${Number(tier.minMembers || 1)}" /></label>
      </div>
      <div class="row two">
        <label>Weekly matches req <input data-field="minWeeklyMatches" type="number" min="0" value="${Number(tier.minWeeklyMatches || 0)}" /></label>
        <label>Season matches req <input data-field="minSeasonMatches" type="number" min="0" value="${Number(tier.minSeasonMatches || 0)}" /></label>
      </div>
      <label>Perks <input data-field="perks" value="${escapeHtml((tier.perks || []).join(', '))}" placeholder="Comma-separated perks" /></label>
      ${Number(tier.tier || index + 1) === 1 ? '<p class="muted">Tier 1 is the created club baseline.</p>' : `<button type="button" class="danger" data-remove-club-tier="${index}">Remove Tier</button>`}
    `;
    const remove = row.querySelector('[data-remove-club-tier]');
    if (remove) remove.addEventListener('click', () => {
      economyClubConfig = collectClubConfig();
      economyClubConfig.prestigeTiers.splice(index, 1);
      renderClubConfig();
    });
    return row;
  }));
}

function collectClubConfig() {
  const form = document.querySelector('#economyConfigEditor');
  const rows = [...document.querySelectorAll('#clubPrestigeRows .club-prestige-row')];
  const byTier = new Map();
  for (const row of rows) {
    const tier = Math.max(1, Math.floor(Number(row.querySelector('[data-field="tier"]').value || 1)));
    const memberCap = Math.max(1, Math.floor(Number(row.querySelector('[data-field="memberCap"]').value || 15)));
    byTier.set(tier, {
      tier,
      name: row.querySelector('[data-field="name"]').value.trim() || `Tier ${tier}`,
      treasuryCost: Math.max(0, Math.floor(Number(row.querySelector('[data-field="treasuryCost"]').value || 0))),
      memberCap,
      minClubLevel: Math.max(1, Math.floor(Number(row.querySelector('[data-field="minClubLevel"]').value || 1))),
      minMembers: Math.max(1, Math.min(memberCap, Math.floor(Number(row.querySelector('[data-field="minMembers"]').value || 1)))),
      minWeeklyMatches: Math.max(0, Math.floor(Number(row.querySelector('[data-field="minWeeklyMatches"]').value || 0))),
      minSeasonMatches: Math.max(0, Math.floor(Number(row.querySelector('[data-field="minSeasonMatches"]').value || 0))),
      perks: row.querySelector('[data-field="perks"]').value.split(',').map(item => item.trim()).filter(Boolean),
    });
  }
  if (!byTier.has(1)) {
    byTier.set(1, { tier: 1, name: 'Founding Club', treasuryCost: 5000, memberCap: 15, minClubLevel: 1, minMembers: 1, minWeeklyMatches: 0, minSeasonMatches: 0, perks: ['Club tag', 'Club chat', '15 member seats'] });
  }
  return {
    minJoinLevel: Math.max(1, Math.floor(Number(form.clubMinJoinLevel.value || 10))),
    minCreateLevel: Math.max(1, Math.floor(Number(form.clubMinCreateLevel.value || 10))),
    createCost: Math.max(0, Math.floor(Number(form.clubCreateCost.value || 5000))),
    prestigeTiers: [...byTier.values()].sort((a, b) => a.tier - b.tier),
  };
}

function addClubPrestigeTier() {
  economyClubConfig = collectClubConfig();
  const highest = economyClubConfig.prestigeTiers.reduce((max, tier) => Math.max(max, Number(tier.tier || 0)), 0);
  const previous = economyClubConfig.prestigeTiers.find(tier => tier.tier === highest) || economyClubConfig.prestigeTiers.at(-1) || {};
  economyClubConfig.prestigeTiers.push({
    tier: highest + 1,
    name: `Prestige ${highest + 1}`,
    treasuryCost: Math.max(10000, Number(previous.treasuryCost || 5000) * 2),
    memberCap: Number(previous.memberCap || 15) + 10,
    minClubLevel: Number(previous.minClubLevel || 1) + 3,
    minMembers: Math.max(1, Number(previous.minMembers || 1) + 5),
    minWeeklyMatches: 0,
    minSeasonMatches: Number(previous.minSeasonMatches || previous.minWeeklyMatches || 0) + 25,
    perks: [`${Number(previous.memberCap || 15) + 10} member seats`],
  });
  renderClubConfig();
}

async function loadNotifications() {
  const data = await api('/notifications');
  notificationConfig = data.config;
  renderNotifications(data.config, data.stats);
}

function renderNotifications(config, stats = {}) {
  const form = document.querySelector('#notificationConfigEditor');
  form.enabled.checked = config?.enabled !== false;
  form.customEnabled.checked = config?.custom?.enabled !== false;
  document.querySelector('#notificationStats').innerHTML = `
    <span class="chip">${Number(stats.registeredUsers || 0)} registered players</span>
    <span class="chip">${Number(stats.registeredTokens || 0)} device tokens</span>
  `;
  const rows = Object.entries(config?.types || {}).map(([type, item]) => {
    const row = document.createElement('div');
    row.className = 'card notification-row';
    row.dataset.type = type;
    row.innerHTML = `
      <label class="checkline"><input data-field="enabled" type="checkbox" ${item.enabled !== false ? 'checked' : ''} /> ${escapeHtml(NOTIFICATION_LABELS[type] || type)}</label>
      <label>Title
        <input data-field="title" value="${escapeHtml(item.title || '')}" />
      </label>
      <label>Message
        <textarea data-field="body" rows="2">${escapeHtml(item.body || '')}</textarea>
      </label>
      <p class="muted">Template variables: {roomCode}, {displayName}, {reward}, {fromDisplayName}</p>
    `;
    return row;
  });
  document.querySelector('#notificationTemplateRows').replaceChildren(...rows);
}

function collectNotificationConfig() {
  const rows = [...document.querySelectorAll('#notificationTemplateRows .notification-row')];
  const types = {};
  for (const row of rows) {
    const type = row.dataset.type;
    types[type] = {
      enabled: row.querySelector('[data-field="enabled"]').checked,
      title: row.querySelector('[data-field="title"]').value.trim(),
      body: row.querySelector('[data-field="body"]').value.trim(),
    };
  }
  const form = document.querySelector('#notificationConfigEditor');
  return {
    enabled: form.enabled.checked,
    custom: { enabled: form.customEnabled.checked },
    types,
  };
}

async function saveNotificationConfig(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const reason = form.reason.value.trim();
  if (!reason) {
    alert('Reason is required.');
    return;
  }
  await api('/notifications', {
    method: 'PATCH',
    body: JSON.stringify({ reason, config: collectNotificationConfig() }),
  });
  form.reason.value = '';
  status('Notification settings saved.', 'ok');
  await loadNotifications();
}

async function sendCustomNotification(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    target: form.target.value.trim(),
    title: form.title.value.trim(),
    body: form.body.value.trim(),
    campaignId: form.campaignId.value.trim(),
    reason: form.reason.value.trim(),
  };
  if (!payload.reason) {
    alert('Reason is required.');
    return;
  }
  const result = await api('/notifications/send', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  form.title.value = '';
  form.body.value = '';
  form.campaignId.value = '';
  form.reason.value = '';
  status(`Push queued for ${result.queued}/${result.targetedUsers} registered players.`, 'ok');
  await loadNotifications();
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
  catalogAssetRequirements = data.assetRequirements || {};
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
  form.querySelector('#catalogAsset').value = '';
  renderCatalogAssetHelp(item);
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
  const uploadType = document.querySelector('#catalogEditor select[name="type"]')?.value || selectedCatalogItem.type;
  const validation = await validateCatalogAssetFile(file, uploadType);
  if (validation.error) {
    setCatalogAssetError(validation.error);
    return;
  }
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

function assetSpecFor(type) {
  return catalogAssetRequirements[type] || null;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${Math.round(value / 1024)} KB`;
  return `${value} B`;
}

function renderCatalogAssetHelp(item = selectedCatalogItem) {
  const type = document.querySelector('#catalogEditor select[name="type"]')?.value || item?.type || '';
  const spec = assetSpecFor(type);
  const help = document.querySelector('#catalogAssetRequirement');
  const preview = document.querySelector('#catalogAssetPreview');
  setCatalogAssetError('');
  if (!help) return;
  if (!spec) {
    help.innerHTML = '<span class="chip danger-chip">No uploads supported for this item type.</span>';
  } else {
    help.innerHTML = `
      <strong>${escapeHtml(type)} asset requirements</strong>
      <p class="muted">Exact size ${spec.width}x${spec.height}. Accepted: ${(spec.mimeTypes || []).map(type => type.replace('image/', '').toUpperCase()).join(', ')}. Max ${formatBytes(spec.maxBytes)}.</p>
    `;
  }
  if (preview) {
    if (item?.asset?.url) {
      preview.classList.remove('empty');
      preview.innerHTML = `<img src="${escapeHtml(item.asset.url)}" alt="" /><span>${escapeHtml(item.asset.width || spec?.width || '?')}x${escapeHtml(item.asset.height || spec?.height || '?')}</span>`;
    } else {
      preview.classList.add('empty');
      preview.textContent = 'Choose an asset to preview it here.';
    }
  }
}

function setCatalogAssetError(message) {
  const node = document.querySelector('#catalogAssetError');
  if (node) node.textContent = message || '';
}

async function previewCatalogAsset() {
  const file = document.querySelector('#catalogAsset').files?.[0];
  const preview = document.querySelector('#catalogAssetPreview');
  setCatalogAssetError('');
  if (!file || !preview) {
    renderCatalogAssetHelp();
    return;
  }
  const validation = await validateCatalogAssetFile(file, document.querySelector('#catalogEditor select[name="type"]')?.value || selectedCatalogItem?.type);
  if (validation.error) {
    preview.classList.add('empty');
    preview.textContent = 'Asset cannot be uploaded.';
    setCatalogAssetError(validation.error);
    return;
  }
  const url = URL.createObjectURL(file);
  preview.classList.remove('empty');
  preview.innerHTML = `<img src="${url}" alt="" /><span>${validation.width}x${validation.height} - ${formatBytes(file.size)}</span>`;
}

function readImageSize(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = { width: image.naturalWidth, height: image.naturalHeight };
      URL.revokeObjectURL(url);
      resolve(size);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    image.src = url;
  });
}

async function validateCatalogAssetFile(file, type) {
  const spec = assetSpecFor(type);
  if (!spec) return { error: 'This cosmetic type does not support image uploads yet.' };
  if (!(spec.mimeTypes || []).includes(file.type)) {
    return { error: `Use ${(spec.mimeTypes || []).map(value => value.replace('image/', '').toUpperCase()).join(', ')} for this asset.` };
  }
  if (file.size > Number(spec.maxBytes || 0)) return { error: `Image is too large. Max size is ${formatBytes(spec.maxBytes)}.` };
  const size = await readImageSize(file);
  if (!size) return { error: 'Could not read this image. Try a PNG, WebP, or JPEG file.' };
  if (size.width !== spec.width || size.height !== spec.height) {
    return { error: `Image must be exactly ${spec.width}x${spec.height}. This file is ${size.width}x${size.height}.` };
  }
  return size;
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

async function loadAdmins() {
  const output = document.querySelector('#adminAccountsOutput');
  try {
    const { admins, roles, recovery } = await api('/admins');
    adminAccountsCache = admins || [];
    adminRolesCache = roles || [];
    const banner = document.querySelector('#adminRecoveryBanner');
    banner.innerHTML = `
      <span class="chip ${recovery?.enabled ? 'ok-pill' : 'danger-chip'}">Email recovery ${recovery?.enabled ? 'configured' : 'not configured'}</span>
      <span class="chip">Owner-only</span>
      <span class="chip">${adminAccountsCache.length} admin${adminAccountsCache.length === 1 ? '' : 's'}</span>
    `;
    renderAdmins();
  } catch (error) {
    output.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}

function renderAdmins() {
  const output = document.querySelector('#adminAccountsOutput');
  if (!adminAccountsCache.length) {
    output.innerHTML = '<div class="empty-state">No admin accounts loaded.</div>';
    return;
  }
  output.innerHTML = `
    <table class="admin-table admin-account-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>MFA</th>
          <th>Status</th>
          <th>Last Login</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${adminAccountsCache.map(admin => `
          <tr data-admin-id="${escapeHtml(admin.adminId)}" class="${admin.disabledAt ? 'dim' : ''}">
            <td class="primary-cell"><strong>${escapeHtml(admin.displayName)}</strong><br /><span class="muted">${escapeHtml(admin.adminId)}</span></td>
            <td>${escapeHtml(admin.email || '-')}</td>
            <td>${escapeHtml(admin.role)}</td>
            <td>${admin.mfaEnabled ? 'Required' : 'Off'}</td>
            <td>${adminStatusMarkup(admin)}</td>
            <td>${escapeHtml(admin.lastLoginAt ? new Date(admin.lastLoginAt).toLocaleString() : 'Never')}</td>
            <td>${escapeHtml(new Date(admin.createdAt).toLocaleString())}</td>
            <td>
              <div class="actions-inline">
                <button data-admin-action="edit" class="ghost">Edit</button>
                <button data-admin-action="password" class="ghost">Reset Password</button>
                <button data-admin-action="sessions" class="ghost">Revoke Sessions</button>
                <button data-admin-action="${admin.disabledAt ? 'enable' : 'disable'}" class="${admin.disabledAt ? 'ghost' : 'danger'}">${admin.disabledAt ? 'Enable' : 'Disable'}</button>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  output.querySelectorAll('[data-admin-action]').forEach(button => {
    const row = button.closest('[data-admin-id]');
    button.addEventListener('click', () => runAdminAction(row.dataset.adminId, button.dataset.adminAction));
  });
}

function adminStatusMarkup(admin) {
  if (admin.disabledAt) return '<span class="status-pill danger-pill">Disabled</span>';
  if (admin.lockedUntil && admin.lockedUntil > Date.now()) return '<span class="status-pill danger-pill">Locked</span>';
  return '<span class="status-pill ok-pill">Active</span>';
}

async function createAdmin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = {
    displayName: form.elements.displayName.value,
    email: form.elements.email.value,
    role: form.elements.role.value,
    temporaryPassword: form.elements.temporaryPassword.value || undefined,
    mfaCode: form.elements.mfaCode.value || undefined,
    mfaEnabled: form.elements.mfaEnabled.checked,
    reason: form.elements.reason.value,
  };
  const result = await api('/admins', { method: 'POST', body: JSON.stringify(payload) });
  showAdminActionOutput(result, 'Admin account created.');
  form.reset();
  form.elements.mfaEnabled.checked = true;
  await loadAdmins();
}

function showAdminActionOutput(result, title) {
  const node = document.querySelector('#adminActionOutput');
  node.classList.remove('hidden');
  const lines = [];
  if (result.temporaryPassword) lines.push(`<p><strong>Temporary password:</strong> <code>${escapeHtml(result.temporaryPassword)}</code></p>`);
  if (result.mfaCode) lines.push(`<p><strong>Temporary MFA code:</strong> <code>${escapeHtml(result.mfaCode)}</code></p>`);
  node.innerHTML = `
    <strong>${escapeHtml(title)}</strong>
    <p class="muted">Share any temporary credentials through a private channel. They are shown once here.</p>
    ${lines.join('') || '<p class="muted">No one-time credentials were generated.</p>'}
  `;
}

async function runAdminAction(adminId, action) {
  const admin = adminAccountsCache.find(item => item.adminId === adminId);
  if (!admin) return;
  try {
    if (action === 'edit') {
      const displayName = prompt('Admin name', admin.displayName);
      if (!displayName) return;
      const email = prompt('Admin email', admin.email || '');
      if (!email) return;
      const role = prompt(`Role (${adminRolesCache.map(item => item.role).join(', ')})`, admin.role);
      const mfaCode = prompt('New MFA code, or leave blank to keep current MFA code', '');
      const mfaChoice = prompt('Require MFA? Type yes or no.', admin.mfaEnabled ? 'yes' : 'no');
      if (mfaChoice == null) return;
      const mfaEnabled = !/^no$/i.test(mfaChoice.trim());
      const reason = prompt('Reason for audit log');
      if (!reason) return;
      await api(`/admins/${encodeURIComponent(adminId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName, email, role, mfaCode: mfaCode || undefined, mfaEnabled, reason }),
      });
      status('Admin account updated.', 'ok');
    }
    if (action === 'password') {
      const temporaryPassword = prompt('Temporary password, or leave blank to generate') || undefined;
      const reason = prompt('Reason for audit log');
      if (!reason) return;
      const result = await api(`/admins/${encodeURIComponent(adminId)}/password-reset`, {
        method: 'POST',
        body: JSON.stringify({ temporaryPassword, reason }),
      });
      showAdminActionOutput(result, 'Admin password reset.');
    }
    if (action === 'sessions') {
      const reason = prompt('Reason for audit log');
      if (!reason) return;
      await api(`/admins/${encodeURIComponent(adminId)}/sessions/revoke`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      status('Admin sessions revoked.', 'ok');
    }
    if (action === 'disable' || action === 'enable') {
      const reason = prompt('Reason for audit log');
      if (!reason) return;
      await api(`/admins/${encodeURIComponent(adminId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ disabled: action === 'disable', reason }),
      });
      status(`Admin account ${action === 'disable' ? 'disabled' : 'enabled'}.`, 'ok');
    }
    await loadAdmins();
  } catch (error) {
    alert(error.message);
  }
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

async function loadRecoveryConfig() {
  const statusNode = document.querySelector('#recoveryStatus');
  const toggle = document.querySelector('#toggleRecovery');
  try {
    const { enabled } = await api('/auth/recovery/config');
    statusNode.textContent = enabled
      ? 'Email recovery is configured. Use it if an admin forgets their password.'
      : 'Email recovery is not configured yet. Add SMTP settings in Railway to enable it.';
    toggle.disabled = !enabled;
    toggle.classList.toggle('dim', !enabled);
  } catch {
    statusNode.textContent = 'Could not check recovery email status.';
    toggle.disabled = true;
  }
}

function bindRecoveryControls() {
  const toggle = document.querySelector('#toggleRecovery');
  const panel = document.querySelector('#recoveryPanel');
  const message = document.querySelector('#recoveryMessage');
  toggle?.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    toggle.textContent = panel.classList.contains('hidden') ? 'Open' : 'Close';
  });
  document.querySelector('#recoveryRequestForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    try {
      const form = new FormData(event.currentTarget);
      const result = await api('/auth/recovery/request', {
        method: 'POST',
        body: JSON.stringify({ identifier: form.get('identifier') }),
      });
      message.textContent = result.message || 'If that admin account can recover by email, a code has been sent.';
    } catch (error) {
      message.textContent = error.message;
    }
  });
  document.querySelector('#recoveryCompleteForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    message.textContent = '';
    try {
      const form = new FormData(event.currentTarget);
      await api('/auth/recovery/complete', {
        method: 'POST',
        body: JSON.stringify({
          identifier: form.get('identifier'),
          code: form.get('code'),
          newPassword: form.get('newPassword'),
        }),
      });
      message.textContent = 'Password updated. Sign in with the new password.';
      event.currentTarget.reset();
    } catch (error) {
      message.textContent = error.message;
    }
  });
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

bindRecoveryControls();
loadRecoveryConfig();
api('/auth/me').then(renderConsole).catch(() => null);
