// assets/refresh.js
// Manual score refresh: sends a repository_dispatch event to GitHub,
// which triggers sync-scores.yml.
//
// Uses a classic PAT with only 'public_repo' scope — safe to commit.

let _config = null;

async function loadConfig() {
  if (_config) return _config;
  try {
    _config = await import('./config.js');
  } catch {
    _config = {};
  }
  return _config;
}

// ─── UI helpers ─────────────────────────────────────────────────────

function setRefreshState(spinning) {
  const btn = document.getElementById('refresh-btn');
  if (!btn) return;
  btn.classList.toggle('is-spinning', spinning);
  btn.disabled = spinning;
  btn.setAttribute('aria-label', spinning ? 'Refreshing scores…' : 'Refresh scores');
}

function showToast(message, isError = false) {
  const toast = document.getElementById('refresh-toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'refresh-toast show' + (isError ? ' refresh-toast--error' : ' refresh-toast--success');
  toast.removeAttribute('hidden');
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.setAttribute('hidden', '');
      toast.className = 'refresh-toast';
    }, 260);
  }, 5000);
}

// ─── Main entry point ─────────────────────────────────────────────────────

export async function initRefreshButton() {
  const cfg   = await loadConfig();
  const token = cfg.GITHUB_REFRESH_TOKEN || '';
  const btn   = document.getElementById('refresh-btn');
  if (!btn) return;

  if (!token) {
    btn.addEventListener('click', () => {
      showToast('⚙️ Refresh not configured — add a token to config.js', true);
    });
    return;
  }

  const owner  = cfg.GITHUB_OWNER  || 'dennismzanetti';
  const repo   = cfg.GITHUB_REPO   || 'world-cup-2026';
  const branch = cfg.GITHUB_BRANCH || 'main';

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    setRefreshState(true);
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/dispatches`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
          body: JSON.stringify({ event_type: 'sync-scores' }),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`GitHub API ${res.status}: ${text}`);
      }
      // repository_dispatch returns 204 immediately — workflow runs async
      showToast('✅ Sync triggered — scores will update in ~30 seconds');
    } catch (err) {
      console.error('[refresh] error:', err);
      showToast('❌ Refresh failed — ' + err.message, true);
    } finally {
      setRefreshState(false);
    }
  });
}
