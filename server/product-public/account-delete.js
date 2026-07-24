(() => {
  const passwordForm = document.querySelector('#password-delete-form');
  const emailForm = document.querySelector('#email-delete-form');
  const passwordStatus = document.querySelector('#password-delete-status');
  const emailStatus = document.querySelector('#email-delete-status');
  const verificationFields = document.querySelector('#verification-fields');
  const confirmCodeButton = document.querySelector('#confirm-code-button');
  const success = document.querySelector('#deletion-success');
  let deletionRequestId = '';

  async function send(path, body) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The request could not be completed.');
    return payload;
  }

  function showSuccess() {
    document.querySelector('.deletion-options').hidden = true;
    document.querySelector('.deletion-warning').hidden = true;
    success.hidden = false;
    success.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  passwordForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = passwordForm.querySelector('button[type="submit"]');
    const values = Object.fromEntries(new FormData(passwordForm).entries());
    button.disabled = true;
    button.textContent = 'Deleting...';
    passwordStatus.textContent = '';
    try {
      await send('/account/delete/password', values);
      passwordForm.reset();
      showSuccess();
    } catch (error) {
      passwordStatus.textContent = error instanceof Error ? error.message : 'Account deletion failed.';
    } finally {
      button.disabled = false;
      button.textContent = 'Permanently delete account';
    }
  });

  emailForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const button = document.querySelector('#request-code-button');
    const values = Object.fromEntries(new FormData(emailForm).entries());
    button.disabled = true;
    button.textContent = 'Sending...';
    emailStatus.textContent = '';
    try {
      const payload = await send('/account/delete/request', {
        displayName: values.displayName,
        email: values.email,
      });
      deletionRequestId = payload.requestId || '';
      verificationFields.hidden = false;
      emailForm.querySelector('input[name="code"]').required = true;
      emailForm.querySelector('input[name="confirmation"]').required = true;
      emailStatus.textContent = payload.message;
    } catch (error) {
      emailStatus.textContent = error instanceof Error ? error.message : 'The code could not be sent.';
    } finally {
      button.disabled = false;
      button.textContent = 'Send another code';
    }
  });

  confirmCodeButton?.addEventListener('click', async () => {
    const values = Object.fromEntries(new FormData(emailForm).entries());
    confirmCodeButton.disabled = true;
    confirmCodeButton.textContent = 'Deleting...';
    emailStatus.textContent = '';
    try {
      await send('/account/delete/confirm', {
        requestId: deletionRequestId,
        code: values.code,
        confirmation: values.confirmation,
      });
      emailForm.reset();
      showSuccess();
    } catch (error) {
      emailStatus.textContent = error instanceof Error ? error.message : 'Account deletion failed.';
    } finally {
      confirmCodeButton.disabled = false;
      confirmCodeButton.textContent = 'Permanently delete account';
    }
  });
})();
