import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addRequesterSupportReply,
  addSupportNote,
  adminTickets,
  createSupportTicket,
  createPublicSupportTicket,
  publicSupportTicket,
} from '../admin.js';

function request() {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'Nine Below website test' },
  };
}

test('public support tickets use private token links and expose only public conversation entries', () => {
  const store = {};
  const created = createPublicSupportTicket(store, request(), {
    product: 'ninebelow',
    website: 'https://ninebelow.potterwell.com',
    name: 'Test Player',
    email: 'player@example.com',
    category: 'gameplay',
    subject: 'Question about a match',
    message: 'I would like help understanding what happened in my match.',
  });

  assert.equal(created.error, undefined);
  assert.ok(created.accessToken);
  assert.ok(created.ticket.publicReference);
  assert.equal(created.ticket.publicAccessTokenHash, undefined);
  assert.match(store.supportTickets[0].publicAccessTokenHash, /^v1:/);
  assert.equal(JSON.stringify(store).includes(created.accessToken), false);
  assert.match(store.supportTickets[0].protectedPayloadEncrypted, /^v1\./);
  assert.equal(JSON.stringify(store).includes('player@example.com'), false);
  assert.equal(JSON.stringify(store).includes('Question about a match'), false);
  const redacted = adminTickets(store, null, { includePii: false })[0];
  assert.equal(redacted.contactEmail, null);
  assert.equal(redacted.subject, 'Protected support request');
  assert.equal(redacted.notes.length, 0);
  assert.equal(publicSupportTicket(store, created.ticket.publicReference, 'wrong-token').error.length > 0, true);

  const admin = { adminId: 'support-admin', displayName: 'Support Admin' };
  addSupportNote(store, created.ticket.ticketId, admin, 'Internal investigation details.', { public: false });
  addSupportNote(store, created.ticket.ticketId, admin, 'We are reviewing this for you.', { public: true });
  addRequesterSupportReply(store, created.ticket.publicReference, created.accessToken, {
    message: 'Thank you. Here is one more detail.',
  });

  const result = publicSupportTicket(store, created.ticket.publicReference, created.accessToken);
  assert.equal(result.error, undefined);
  assert.equal(result.ticket.reference, created.ticket.publicReference);
  assert.deepEqual(
    result.ticket.messages.map(entry => entry.text),
    [
      'I would like help understanding what happened in my match.',
      'We are reviewing this for you.',
      'Thank you. Here is one more detail.',
    ],
  );
  assert.deepEqual(
    result.ticket.messages.map(entry => entry.authorType),
    ['requester', 'admin', 'requester'],
  );
  assert.equal(JSON.stringify(result).includes('Internal investigation details.'), false);
  assert.equal(JSON.stringify(result).includes('player@example.com'), false);
});

test('requester replies are blocked after a support case is closed', () => {
  const store = {};
  const created = createPublicSupportTicket(store, request(), {
    source: 'potterwell',
    name: 'Site Visitor',
    email: 'visitor@example.com',
    subject: 'Business question',
    message: 'I have a question about working with Potterwell.',
  });
  assert.match(created.ticket.publicReference, /^PW-/);
  store.supportTickets[0].status = 'closed';

  const result = addRequesterSupportReply(
    store,
    created.ticket.publicReference,
    created.accessToken,
    { message: 'Can I add another note?' },
  );

  assert.equal(result.error, 'This support case is closed.');
});

test('authenticated users cannot allocate an unbounded number of active support tickets', () => {
  const store = {};
  const user = { userId: 'user-one', displayName: 'Player One' };
  for (let index = 0; index < 25; index += 1) {
    const created = createSupportTicket(store, request(), user, {
      subject: `Case ${index + 1}`,
      message: 'A legitimate support request with enough detail.',
    });
    assert.equal(created.error, undefined);
  }

  const refused = createSupportTicket(store, request(), user, {
    subject: 'One too many',
    message: 'This request should be refused by the active-case storage bound.',
  });
  assert.match(refused.error, /too many active support cases/i);
  assert.equal(store.supportTickets.length, 25);
});
