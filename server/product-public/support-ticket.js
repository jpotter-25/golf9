(() => {
  const loading = document.querySelector('#case-loading');
  const errorPanel = document.querySelector('#case-error');
  const errorMessage = document.querySelector('#case-error-message');
  const content = document.querySelector('#case-content');
  const thread = document.querySelector('#case-thread');
  const replyForm = document.querySelector('#reply-form');
  const replyStatus = document.querySelector('#reply-status');
  const reference = new URLSearchParams(window.location.search).get('reference') || '';
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token') || '';
  let currentTicket = null;

  function text(selector, value) {
    const node = document.querySelector(selector);
    if (node) node.textContent = value == null ? '' : String(value);
  }

  function humanStatus(value) {
    return String(value || 'open').replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  }

  function dateTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
  }

  function showError(message) {
    loading.hidden = true;
    content.hidden = true;
    errorPanel.hidden = false;
    errorMessage.textContent = message;
  }

  function renderThread(ticket) {
    thread.replaceChildren();
    const entries = Array.isArray(ticket.messages) ? ticket.messages : [];
    for (const entry of entries) {
      const article = document.createElement('article');
      const authorType = entry.authorType === 'requester' ? 'requester' : 'support';
      article.className = `thread-entry thread-entry--${authorType}`;

      const meta = document.createElement('div');
      meta.className = 'thread-meta';
      const author = document.createElement('strong');
      author.textContent = authorType === 'requester' ? 'You' : 'Potterwell Support';
      const time = document.createElement('time');
      time.dateTime = entry.createdAt || '';
      time.textContent = dateTime(entry.createdAt);
      meta.append(author, time);

      const message = document.createElement('p');
      message.textContent = entry.text || '';
      article.append(meta, message);
      thread.append(article);
    }
    if (!entries.length) {
      const empty = document.createElement('p');
      empty.className = 'thread-empty';
      empty.textContent = 'Your request is open. A support reply will appear here.';
      thread.append(empty);
    }
  }

  function render(ticket) {
    currentTicket = ticket;
    const status = humanStatus(ticket.status);
    text('#case-subject', ticket.subject || 'Support request');
    text('#case-reference', ticket.reference || reference);
    text('#case-status', status);
    text('#summary-status', status);
    text('#summary-category', humanStatus(ticket.category));
    text('#summary-created', dateTime(ticket.createdAt));
    text('#summary-updated', dateTime(ticket.updatedAt || ticket.createdAt));
    renderThread(ticket);
    const isClosed = ['resolved', 'closed'].includes(String(ticket.status || '').toLowerCase());
    replyForm.hidden = isClosed;
    loading.hidden = true;
    errorPanel.hidden = true;
    content.hidden = false;
  }

  async function loadTicket() {
    if (!reference || !token) {
      showError('This private link is incomplete. Open the full link from your support confirmation email.');
      return;
    }
    try {
      const response = await fetch(`/support/public/${encodeURIComponent(reference)}?token=${encodeURIComponent(token)}`);
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'The case could not be found.');
      render(payload.ticket);
    } catch (error) {
      showError(error instanceof Error ? error.message : 'The case could not be opened.');
    }
  }

  replyForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = replyForm.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(replyForm).entries());
    button.disabled = true;
    button.textContent = 'Sending...';
    replyStatus.textContent = '';
    try {
      const response = await fetch(`/support/public/${encodeURIComponent(reference)}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          message: values.message,
          company: values.company,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Your reply could not be sent.');
      replyForm.reset();
      replyStatus.textContent = 'Reply sent.';
      await loadTicket();
    } catch (error) {
      replyStatus.textContent = error instanceof Error ? error.message : 'Your reply could not be sent.';
    } finally {
      button.disabled = false;
      button.textContent = 'Send reply';
    }
  });

  document.querySelector('[data-support-open-new]')?.addEventListener('click', () => {
    window.location.href = '/?support=1';
  });

  loadTicket();
})();
