// assets/refresh.js
// Manual score refresh: triggers the sync-scores GitHub Actions workflow via
// workflow_dispatch, polls for completion, then shows a success/fail toast.
//
// Requires assets/config.js (gitignored) with a GitHub PAT that has
// Actions: Read & Write permission on this repo.
//
// If config.js is absent or the token is blank the button is shown but
// clicking it shows a friendly error toast instead of hiding the button.

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

// ─── UI helpers ───────────────────────────────────────────────────────────────

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
  // BEM modifier names matching style.css
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

// ─── GitHub Actions helpers ────────────────────────────────────────────────────

async function triggerWorkflow(token, owner, repo, workflowId, branch) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: branch }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${text}`);
  }
}

async function pollForRun(token, owner, repo, workflowId, triggeredAt) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const deadline = Date.now() + 90_000;
  let runId = null;

  while (Date.now() < deadline) {
    await sleep(2000);
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=5`,
      { headers }
    );
    if (!res.ok) break;
    const data = await res.json();
    const newRun = data.workflow_runs?.find(r => {
      const created = new Date(r.created_at).getTime();
      return created >= triggeredAt - 2000;
    });
    if (newRun) { runId = newRun.id; break; }
  }

  if (!runId) throw new Error('Timed out waiting for workflow run to start.');

  while (Date.now() < deadline) {
    await sleep(3000);
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`,
      { headers }
    );
    if (!res.ok) break;
    const run = await res.json();
    if (run.status === 'completed') {
      if (run.conclusion === 'success') return 'success';
      throw new Error(`Workflow finished with status: ${run.conclusion}`);
    }
  }

  return 'running';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function initRefreshButton() {
  const cfg   = await loadConfig();
  const token = cfg.GITHUB_REFRESH_TOKEN || '';
  const btn   = document.getElementById('refresh-btn');
  if (!btn) return;

  // Always keep the button visible — never hide it.
  // If no token is configured, clicking shows a friendly message.
  if (!token) {
    btn.addEventListener('click', () => {
      showToast('⚙️ Refresh not configured — add a token to config.js', true);
    });
    return;
  }

  const owner      = cfg.GITHUB_OWNER      || 'dennismzanetti';
  const repo       = cfg.GITHUB_REPO       || 'world-cup-2026';
  const workflowId = cfg.GITHUB_WORKFLOW_ID || 'sync-scores.yml';
  const branch     = cfg.GITHUB_BRANCH     || 'main';

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    setRefreshState(true);
    const triggeredAt = Date.now();
    try {
      await triggerWorkflow(token, owner, repo, workflowId, branch);
      const result = await pollForRun(token, owner, repo, workflowId, triggeredAt);
      if (result === 'running') {
        showToast('✅ Sync started — scores will update shortly');
      } else {
        showToast('✅ Scores refreshed successfully');
      }
    } catch (err) {
      console.error('[refresh] error:', err);
      showToast('❌ Refresh failed — ' + err.message, true);
    } finally {
      setRefreshState(false);
    }
  });
}
