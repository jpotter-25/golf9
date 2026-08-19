(() => {
  const page = document.body.dataset.earlyAccessPage || '';
  const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const privateToken = fragment.get('token') || '';
  if (privateToken) history.replaceState(null, '', window.location.pathname);

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
    return payload;
  }

  function setStatus(message, tone = 'error') {
    const node = document.querySelector('#action-status, #early-access-status');
    if (!node) return;
    node.textContent = message || '';
    node.dataset.tone = tone;
  }

  function setBusy(button, busy, label) {
    if (!button) return;
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.disabled = busy;
    button.textContent = busy ? label : button.dataset.label;
  }

  async function setupSignup() {
    const form = document.querySelector('#early-access-signup');
    const message = document.querySelector('#enrollment-message');
    const success = document.querySelector('#early-access-success');
    if (!form || !message || !success) return;
    try {
      const config = await request('/early-access/config');
      message.textContent = config.enrollmentStatus === 'open'
        ? 'Confirm your email to activate your place on the list.'
        : config.statusMessage;
      form.hidden = config.enrollmentStatus !== 'open';
    } catch {
      message.textContent = 'Early-access registration is temporarily unavailable.';
      return;
    }

    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const platforms = values.getAll('platforms');
      if (!platforms.length) return setStatus('Choose iOS, Android, or both.');
      const submit = form.querySelector('button[type="submit"]');
      setBusy(submit, true, 'Joining...');
      setStatus('');
      const query = new URLSearchParams(window.location.search);
      try {
        await request('/early-access/signups', {
          method: 'POST',
          body: JSON.stringify({
            firstName: values.get('firstName'),
            email: values.get('email'),
            platforms,
            webFuture: values.get('webFuture') === 'on',
            consent: values.get('consent') === 'on',
            ageConfirmed: values.get('ageConfirmed') === 'on',
            faxNumber__nb_ea_29: values.get('faxNumber__nb_ea_29'),
            source: query.get('source') || 'website',
            utmSource: query.get('utm_source'),
            utmMedium: query.get('utm_medium'),
            utmCampaign: query.get('utm_campaign'),
            referrer: document.referrer,
          }),
        });
        form.hidden = true;
        success.hidden = false;
        success.focus();
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(submit, false, 'Joining...');
      }
    });
  }

  function requirePrivateToken() {
    if (privateToken) return true;
    setStatus('This private link is missing or invalid. Use the latest link sent to your email.');
    document.querySelectorAll('form, button:not(.button--quiet)').forEach(node => { node.hidden = true; });
    return false;
  }

  function setupConfirmation() {
    const button = document.querySelector('#confirm-early-access');
    if (!button || !requirePrivateToken()) return;
    button.addEventListener('click', async () => {
      setBusy(button, true, 'Confirming...');
      try {
        const result = await request('/early-access/confirm', { method: 'POST', body: JSON.stringify({ token: privateToken }) });
        setStatus(result.message, 'success');
        button.hidden = true;
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(button, false, 'Confirming...');
      }
    });
  }

  async function setupPreferences() {
    const content = document.querySelector('#preferences-content');
    const loading = document.querySelector('#preferences-loading');
    const button = document.querySelector('#unsubscribe-early-access');
    if (!content || !loading || !button || !requirePrivateToken()) return;
    try {
      const result = await request('/early-access/preferences', { method: 'POST', body: JSON.stringify({ token: privateToken }) });
      document.querySelector('#preferences-email').textContent = result.signup.email;
      document.querySelector('#preferences-platforms').textContent = result.signup.platforms.map(value => value === 'web_future' ? 'Browser later' : value === 'ios' ? 'iOS' : 'Android').join(', ');
      document.querySelector('#preferences-status').textContent = result.signup.consentStatus;
      loading.hidden = true;
      content.hidden = false;
    } catch (error) {
      loading.hidden = true;
      setStatus(error.message);
      return;
    }
    button.addEventListener('click', async () => {
      if (!window.confirm('Stop all Nine Below early-access and testing email?')) return;
      setBusy(button, true, 'Unsubscribing...');
      try {
        const result = await request('/early-access/unsubscribe', { method: 'POST', body: JSON.stringify({ token: privateToken }) });
        document.querySelector('#preferences-status').textContent = 'unsubscribed';
        setStatus(result.message, 'success');
        button.hidden = true;
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(button, false, 'Unsubscribing...');
      }
    });
  }

  async function setupOnboarding() {
    const form = document.querySelector('#onboarding-form');
    if (!form || !requirePrivateToken()) return;
    try {
      const preferences = await request('/early-access/preferences', { method: 'POST', body: JSON.stringify({ token: privateToken }) });
      const platforms = preferences.signup.platforms || [];
      const guidance = document.querySelector('#onboarding-platform-guidance');
      document.querySelectorAll('[data-platform-guidance]').forEach(node => {
        node.hidden = !platforms.includes(node.dataset.platformGuidance);
      });
      if (guidance) guidance.hidden = false;
      const googlePlayField = document.querySelector('#google-play-email-field');
      if (googlePlayField) googlePlayField.hidden = !platforms.includes('android');
      form.hidden = false;
    } catch (error) {
      setStatus(error.message);
      return;
    }
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector('button[type="submit"]');
      const values = Object.fromEntries(new FormData(form).entries());
      let completed = false;
      setBusy(submit, true, 'Saving...');
      try {
        const result = await request('/early-access/onboarding', {
          method: 'POST',
          body: JSON.stringify({ ...values, token: privateToken, acknowledged: values.acknowledged === 'on' }),
        });
        form.reset();
        form.querySelectorAll('input, button').forEach(node => { node.disabled = true; });
        setStatus(result.message, 'success');
        completed = true;
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(submit, false, 'Saving...');
        if (completed) submit.disabled = true;
      }
    });
  }

  function setupFeedback() {
    const form = document.querySelector('#feedback-form');
    const success = document.querySelector('#feedback-success');
    if (!form || !success || !requirePrivateToken()) return;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const submit = form.querySelector('button[type="submit"]');
      const values = Object.fromEntries(new FormData(form).entries());
      setBusy(submit, true, 'Sending...');
      try {
        const result = await request('/early-access/feedback', { method: 'POST', body: JSON.stringify({ ...values, token: privateToken }) });
        document.querySelector('#feedback-reference').textContent = result.reference;
        document.querySelector('#feedback-tracking').href = result.trackingUrl;
        form.hidden = true;
        success.hidden = false;
      } catch (error) {
        setStatus(error.message);
      } finally {
        setBusy(submit, false, 'Sending...');
      }
    });
  }

  if (page === 'signup') setupSignup();
  if (page === 'confirm') setupConfirmation();
  if (page === 'preferences') setupPreferences();
  if (page === 'onboarding') setupOnboarding();
  if (page === 'feedback') setupFeedback();
})();
