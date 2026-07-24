(() => {
  const dialog = document.querySelector('#support-dialog');
  const form = document.querySelector('#support-form');
  const status = document.querySelector('#support-status');
  const success = document.querySelector('#support-success');
  const reference = document.querySelector('#support-reference');
  const trackingLink = document.querySelector('#support-tracking-link');
  if (!dialog || !form || !status || !success || !reference || !trackingLink) return;

  const body = document.body;
  const endpoint = body.dataset.supportEndpoint || '/support/public';
  const source = body.dataset.supportSource || 'ninebelow';
  const submit = form.querySelector('button[type="submit"]');

  function openDialog() {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    window.setTimeout(() => form.querySelector('input[name="name"]')?.focus(), 30);
  }

  function closeDialog() {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  function resetForm() {
    form.reset();
    form.hidden = false;
    success.hidden = true;
    status.textContent = '';
    reference.textContent = '';
    trackingLink.href = '/support/ticket';
  }

  document.querySelectorAll('[data-support-open]').forEach(button => {
    button.addEventListener('click', openDialog);
  });
  document.querySelectorAll('[data-support-close]').forEach(button => {
    button.addEventListener('click', closeDialog);
  });
  document.querySelectorAll('[data-support-new]').forEach(button => {
    button.addEventListener('click', resetForm);
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) closeDialog();
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    submit.disabled = true;
    submit.textContent = 'Sending...';
    status.textContent = '';

    const values = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: source,
          source,
          website: window.location.href,
          name: values.name,
          email: values.email,
          category: values.category,
          subject: values.subject,
          message: values.message,
          company: values.company,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'We could not submit your request. Please try again.');
      if (!payload.reference || !payload.trackingUrl) {
        throw new Error('Your request was received, but its tracking link is not ready. Please try again shortly.');
      }
      reference.textContent = payload.reference;
      trackingLink.href = payload.trackingUrl;
      form.hidden = true;
      success.hidden = false;
      success.focus?.();
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'We could not submit your request. Please try again.';
    } finally {
      submit.disabled = false;
      submit.textContent = 'Submit request';
    }
  });

  const query = new URLSearchParams(window.location.search);
  if (query.get('support') === '1') openDialog();
})();
