const apiKeyForm = document.getElementById('api-key-form');
const keyStatus = document.getElementById('key-status');
const keyExpiry = document.getElementById('key-expiry');

const KEY_TTL_MS = 24 * 60 * 60 * 1000;
let keyCountdownInterval = null;

function setText(element, value, className = '') {
  element.className = className;
  element.textContent = value;
}

function formatCountdown(ms) {
  if (ms <= 0) return 'Expired';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} remaining`;
}

function startKeyCountdown(savedAt) {
  if (keyCountdownInterval) {
    clearInterval(keyCountdownInterval);
    keyCountdownInterval = null;
  }

  if (!keyExpiry || !savedAt) return;

  const update = () => {
    const remaining = savedAt + KEY_TTL_MS - Date.now();
    const expired = remaining <= 0;
    keyExpiry.className = expired ? 'status-text' : 'status-text muted';
    keyExpiry.textContent = expired
      ? 'Key has expired — regenerate at developer.riotgames.com.'
      : `Key expires in ${formatCountdown(remaining)}`;
    if (expired && keyCountdownInterval) {
      clearInterval(keyCountdownInterval);
      keyCountdownInterval = null;
    }
  };

  update();
  keyCountdownInterval = setInterval(update, 1000);
}

async function loadKeyStatus() {
  try {
    const response = await fetch('/api/settings/status');
    const data = await response.json();

    if (data.managedByEnvironment) {
      apiKeyForm.querySelectorAll('textarea, input, button').forEach((f) => { f.disabled = true; });
      setText(keyStatus, 'Using backend RIOT_API_KEY from the server environment. Update that variable to change the key.', 'status-text muted');
      if (keyExpiry) keyExpiry.textContent = '';
      return;
    }

    apiKeyForm.querySelectorAll('textarea, input, button').forEach((f) => { f.disabled = false; });
    setText(
      keyStatus,
      data.hasApiKey ? 'API key saved on the server.' : 'No API key saved yet.',
      'status-text muted'
    );
    if (data.keySavedAt) {
      startKeyCountdown(data.keySavedAt);
    } else if (keyExpiry) {
      keyExpiry.textContent = '';
    }
  } catch {
    setText(keyStatus, 'Unable to verify saved key status.', 'status-text');
  }
}

apiKeyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(apiKeyForm);

  setText(keyStatus, 'Saving Riot key...', 'status-text muted');

  const response = await fetch('/api/settings/key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: formData.get('apiKey') })
  });

  const data = await response.json();
  setText(
    keyStatus,
    response.ok ? 'API key saved. You can search now.' : data.error || 'Unable to save key.',
    'status-text'
  );

  if (response.ok) {
    apiKeyForm.reset();
    loadKeyStatus();
  }
});

loadKeyStatus();
