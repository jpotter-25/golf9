import type { AlertButton, AlertOptions } from 'react-native';

type AlertRequest = {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
};

const requests: AlertRequest[] = [];
let active = false;
let nextId = 0;

function presentNext(): void {
  if (active || !requests.length || typeof document === 'undefined' || !document.body) return;
  active = true;
  const request = requests.shift()!;
  const choices = request.buttons?.length ? request.buttons : [{ text: 'OK' }];
  const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const previousOverflow = document.body.style.overflow;
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', zIndex: '2147483647', background: 'rgba(5, 10, 22, 0.82)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box',
  });
  const dialog = document.createElement('div');
  const id = `ninebelow-alert-${++nextId}`;
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  if (request.message) dialog.setAttribute('aria-describedby', `${id}-message`);
  Object.assign(dialog.style, {
    width: '100%', maxWidth: '440px', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto',
    background: '#243655', color: '#F7FAFC', border: '1px solid #60799A', borderRadius: '12px',
    padding: '24px', boxSizing: 'border-box', boxShadow: '0 16px 64px rgba(0,0,0,0.4)',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  });
  const title = document.createElement('h2');
  title.id = `${id}-title`;
  title.textContent = request.title || 'Nine Below';
  Object.assign(title.style, { margin: '0', fontSize: '24px', lineHeight: '1.25', overflowWrap: 'anywhere' });
  dialog.appendChild(title);
  if (request.message) {
    const message = document.createElement('p');
    message.id = `${id}-message`;
    message.textContent = request.message;
    Object.assign(message.style, { margin: '16px 0 0', lineHeight: '1.5', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
    dialog.appendChild(message);
  }
  const actions = document.createElement('div');
  Object.assign(actions.style, { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' });
  dialog.appendChild(actions);
  overlay.appendChild(dialog);

  const background = Array.from(document.body.children)
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map(element => ({ element, inert: element.inert }));
  const buttons: HTMLButtonElement[] = [];
  let closed = false;
  const close = (callback?: () => void) => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('keyup', onKeyUp, true);
    document.removeEventListener('focusin', keepFocusInside, true);
    overlay.remove();
    background.forEach(({ element, inert }) => { element.inert = inert; });
    document.body.style.overflow = previousOverflow;
    active = false;
    if (previousFocus?.isConnected) previousFocus.focus();
    try {
      callback?.();
    } finally {
      presentNext();
    }
  };
  const dismiss = () => {
    if (request.options?.cancelable === true) close(request.options.onDismiss);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
    } else if (event.key === 'Tab') {
      event.preventDefault();
      const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const offset = event.shiftKey ? -1 : 1;
      buttons[(current + offset + buttons.length) % buttons.length].focus();
    }
  };
  const onKeyUp = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    // Consume Escape before an underlying React Native Web Modal handles it.
    event.preventDefault();
    event.stopPropagation();
    dismiss();
  };
  const keepFocusInside = (event: FocusEvent) => {
    if (!overlay.contains(event.target as Node)) buttons[0]?.focus();
  };
  choices.forEach(choice => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = choice.text || 'OK';
    const destructive = choice.style === 'destructive';
    const cancel = choice.style === 'cancel';
    Object.assign(button.style, {
      minHeight: '44px', padding: '11px 16px', borderRadius: '8px', cursor: 'pointer',
      border: `1px solid ${destructive ? '#FF858F' : '#60799A'}`, font: 'inherit', fontWeight: '700',
      color: destructive ? '#FFB0B7' : cancel ? '#F7FAFC' : '#1A2943',
      background: destructive || cancel ? '#20344F' : '#67E0B0',
    });
    button.addEventListener('click', () => close(choice.onPress));
    buttons.push(button);
    actions.appendChild(button);
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) dismiss();
  });
  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
  background.forEach(({ element }) => { element.inert = true; });
  document.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('focusin', keepFocusInside, true);
  const preferred = choices.findIndex(choice => choice.isPreferred);
  const cancel = choices.findIndex(choice => choice.style === 'cancel');
  const ordinary = choices.findIndex(choice => choice.style !== 'destructive');
  buttons[preferred >= 0 ? preferred : cancel >= 0 ? cancel : ordinary >= 0 ? ordinary : 0].focus();
}

// React Native Web's Alert is a no-op. Keep every action and callback available
// for browser confirmations, including dialogs with more than two choices.
export const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions): void {
    requests.push({ title, message, buttons, options });
    presentNext();
  },
};
