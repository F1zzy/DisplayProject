const statusEl = document.getElementById('status');
const apiKeyInput = document.getElementById('apiKey');
const serverUrlInput = document.getElementById('serverUrl');

const savedKey = localStorage.getItem('displayControlApiKey');
const savedUrl = localStorage.getItem('displayControlServerUrl') || window.location.origin;

apiKeyInput.value = savedKey || '';
serverUrlInput.value = savedUrl;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.className = isError ? 'remote-status remote-status--error' : 'remote-status';
}

async function apiRequest(path, options = {}) {
  const baseUrl = serverUrlInput.value.replace(/\/$/, '');
  const apiKey = apiKeyInput.value.trim();

  localStorage.setItem('displayControlApiKey', apiKey);
  localStorage.setItem('displayControlServerUrl', baseUrl);

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed (${response.status})`);
  }

  return response.json();
}

document.querySelectorAll('[data-action]').forEach((button) => {
  button.addEventListener('click', async () => {
    try {
      setStatus(`Sending ${button.dataset.action}...`);
      await apiRequest('/api/display/power', {
        method: 'POST',
        body: JSON.stringify({ action: button.dataset.action }),
      });
      setStatus(`Display set to ${button.dataset.action}`);
    } catch (error) {
      setStatus(error.message, true);
    }
  });
});

document.querySelector('[data-widget="rotate"]').addEventListener('click', async () => {
  try {
    setStatus('Rotating widget...');
    await apiRequest('/api/display/widgets/rotate', { method: 'POST', body: '{}' });
    setStatus('Widget rotated');
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelectorAll('[data-widget]').forEach((button) => {
  if (button.dataset.widget === 'rotate') return;

  button.addEventListener('click', async () => {
    try {
      setStatus(`Switching to widget ${button.dataset.widget}...`);
      await apiRequest('/api/display/widgets/set', {
        method: 'POST',
        body: JSON.stringify({ index: parseInt(button.dataset.widget, 10) }),
      });
      setStatus('Widget updated');
    } catch (error) {
      setStatus(error.message, true);
    }
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/remote/sw.js').catch(() => {});
}
