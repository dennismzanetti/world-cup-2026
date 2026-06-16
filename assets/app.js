// World Cup 2026 App — Firebase-connected, data sourced entirely from Firestore
import { signUp, signIn, logOut, watchAuth } from './auth.js';
import { watchMatches, savePrediction, watchUserPredictions, updateMatchResult, saveBracketPicks, getBracketPicks } from './db.js';
import { teamName, teamDisplay } from './utils/teamData.js';
import { getTodayStr, formatDateHeader, sortStages, isFinished, stageKeyToLabel, populateMatchFilters, populatePredFilters } from './utils/filters.js';
import { calcPoints } from './utils/stats.js';
import { renderGroups, renderPredGroupStandings } from './render/groups.js';
import { renderMatches } from './render/matches.js';
import { renderPredictions, renderPredStandings } from './render/predictions.js';
import { renderKnockoutBracket, slotLabel, resolveKnockoutTeamForPreds } from './render/bracket.js';

(function () {

  // ─── State ──────────────────────────────────────────────────────────────────────────
  let currentUser      = null;
  let authResolved     = false;
  let activeTab        = 'groups';
  let activePredSubtab = 'my-picks';
  let userPredictions  = {};  // matchId → {home, away, pk?}
  let liveMatches      = [];  // ALL matches (group + knockout) from Firestore
  let unsubPredictions = null;
  let bracketPicks     = {};  // matchId (string) → 'home'|'away' (legacy, kept for backup compat)
  let bracketSaveTimer = null;

  // ─── Knockout stage round definitions ──────────────────────────────────────────
  const BRACKET_ROUNDS = [
    { label: 'Round of 32',    stage: 'Round of 32',    ids: ['r32-1','r32-2','r32-3','r32-4','r32-5','r32-6','r32-7','r32-8','r32-9','r32-10','r32-11','r32-12','r32-13','r32-14','r32-15','r32-16'] },
    { label: 'Round of 16',    stage: 'Round of 16',    ids: ['r16-1','r16-2','r16-3','r16-4','r16-5','r16-6','r16-7','r16-8'] },
    { label: 'Quarter-Finals', stage: 'Quarterfinals',  ids: ['qf-1','qf-2','qf-3','qf-4'] },
    { label: 'Semi-Finals',    stage: 'Semifinals',     ids: ['sf-1','sf-2'] },
    { label: 'Final',          stage: 'Final',          ids: ['final'] },
  ];

  const KNOCKOUT_IDS = new Set(BRACKET_ROUNDS.flatMap(r => r.ids));

  // ─── Data accessors ────────────────────────────────────────────────────────────
  function groupMatches()   { return liveMatches.filter(m => m.group && !KNOCKOUT_IDS.has(m.id)); }
  function allPredMatches() { return liveMatches.slice(); }
  function allTabMatches()  { return liveMatches.slice(); }

  function buildGroups() {
    const map = {};
    groupMatches().forEach(m => {
      const g = m.group;
      if (!g) return;
      if (!map[g]) map[g] = {};
      const hn = teamName(m.home);
      const an = teamName(m.away);
      if (hn) map[g][hn] = { name: hn };
      if (an) map[g][an] = { name: an };
    });
    return Object.keys(map).sort().map(id => ({
      id,
      teams: Object.values(map[id]).sort((a, b) => a.name.localeCompare(b.name))
    }));
  }

  function getKnockoutFixture(id) {
    return liveMatches.find(m => m.id === id) || null;
  }

  // ─── Shared context object for render modules that need app state ─────────────
  function getBracketCtx() {
    return {
      BRACKET_ROUNDS,
      currentUser,
      userPredictions,
      getKnockoutFixture,
      groupMatches,
      buildGroups,
      openModal,
    };
  }

  function getMatchCardCtx() {
    return {
      KNOCKOUT_IDS,
      currentUser,
      userPredictions,
      resolveKnockoutTeamForPreds: (src) => resolveKnockoutTeamForPreds(src, { groupMatches, buildGroups, userPredictions, getKnockoutFixture }),
      slotLabel,
      openModal,
      renderPredictions: _renderPredictions,
      renderKnockoutBracket: _renderKnockoutBracket,
      activePredSubtab: () => activePredSubtab,
    };
  }

  // ─── Thin wrappers that bind app state to module functions ────────────────────
  function _renderGroups() {
    renderGroups(buildGroups, groupMatches, document.getElementById('groups-grid'));
  }

  function _renderMatches() {
    renderMatches({ allTabMatches, getTodayStr, buildMatchCardCtx: getMatchCardCtx() });
  }

  function _renderPredictions() {
    renderPredictions({ currentUser, authResolved, allPredMatches, getTodayStr, buildMatchCardCtx: getMatchCardCtx() });
  }

  function _renderPredGroupStandings() {
    renderPredGroupStandings(buildGroups, groupMatches, userPredictions, currentUser);
  }

  function _renderPredStandings() {
    renderPredStandings(liveMatches, userPredictions, currentUser);
  }

  function _renderKnockoutBracket() {
    renderKnockoutBracket(getBracketCtx());
  }

  // ─── Modal helpers ────────────────────────────────────────────────────────────
  function openModal()  { document.getElementById('auth-modal')?.removeAttribute('hidden'); document.getElementById('auth-backdrop')?.removeAttribute('hidden'); }
  function closeModal() { document.getElementById('auth-modal')?.setAttribute('hidden', ''); document.getElementById('auth-backdrop')?.setAttribute('hidden', ''); }

  // ─── Sub-tab switching ────────────────────────────────────────────────────────
  function switchPredSubtab(id) {
    activePredSubtab = id;
    document.querySelectorAll('.sub-tab').forEach(btn => {
      const active = btn.dataset.subtab === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.sub-tab-panel').forEach(panel => {
      const active = panel.id === `subtab-${id}`;
      panel.classList.toggle('active', active);
      if (active) panel.removeAttribute('hidden');
      else        panel.setAttribute('hidden', '');
    });
    const predFilters = document.getElementById('pred-filters');
    if (predFilters) predFilters.hidden = (id !== 'my-picks');
    updateDataToolbarVisibility();
    if (id === 'my-picks')             _renderPredictions();
    if (id === 'pred-group-standings') _renderPredGroupStandings();
    if (id === 'pred-standings')       _renderPredStandings();
    if (id === 'pred-bracket')         _renderKnockoutBracket();
  }

  function updateDataToolbarVisibility() {
    const toolbar = document.getElementById('data-toolbar');
    if (!toolbar) return;
    toolbar.hidden = !(currentUser && activePredSubtab === 'my-picks');
  }

  // ─── Main tab switching ───────────────────────────────────────────────────────
  function switchTab(id) {
    activeTab = id;
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const active = btn.dataset.view === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.view').forEach(panel => {
      panel.classList.toggle('active', panel.id === `view-${id}`);
    });
    if (id === 'groups')      _renderGroups();
    if (id === 'matches')     _renderMatches();
    if (id === 'predictions') switchPredSubtab(activePredSubtab);
  }

  function renderAll() {
    if (activeTab === 'groups')      _renderGroups();
    if (activeTab === 'matches')     _renderMatches();
    if (activeTab === 'predictions') switchPredSubtab(activePredSubtab);
    if (activeTab === 'predictions' && activePredSubtab !== 'pred-bracket') {
      _renderKnockoutBracket();
    }
  }

  // ─── Auth ─────────────────────────────────────────────────────────────────────
  watchAuth(async user => {
    if (unsubPredictions) { unsubPredictions(); unsubPredictions = null; }
    currentUser  = user;
    authResolved = true;
    const userGreeting = document.getElementById('user-greeting');
    const userBar      = document.getElementById('user-bar');
    const authBtn      = document.getElementById('auth-btn');
    const signOutBtn   = document.getElementById('sign-out-btn');
    if (user) {
      if (userGreeting) userGreeting.textContent = user.email;
      userBar?.removeAttribute('hidden');
      authBtn?.setAttribute('hidden', '');
      signOutBtn?.removeAttribute('hidden');
      bracketPicks = await getBracketPicks(user.uid);
      renderAll();
      updateDataToolbarVisibility();
      unsubPredictions = watchUserPredictions(user.uid, preds => {
        userPredictions = preds || {};
        renderAll();
      });
    } else {
      if (userGreeting) userGreeting.textContent = '';
      userBar?.setAttribute('hidden', '');
      authBtn?.removeAttribute('hidden', '');
      signOutBtn?.setAttribute('hidden', '');
      userPredictions = {};
      bracketPicks    = {};
      updateDataToolbarVisibility();
      renderAll();
    }
  });

  // ─── Bracket picks persistence ────────────────────────────────────────────────
  function persistBracketPicks() {
    if (!currentUser) return;
    clearTimeout(bracketSaveTimer);
    bracketSaveTimer = setTimeout(async () => {
      try { await saveBracketPicks(currentUser.uid, bracketPicks); }
      catch (err) { console.warn('[app] saveBracketPicks error', err); }
    }, 600);
  }

  // ─── Export / Import (Backup & Restore) ──────────────────────────────────────
  function setToolbarStatus(msg, isError) {
    const el = document.getElementById('data-toolbar-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = isError ? 'var(--color-error)' : 'var(--color-success)';
    if (msg) setTimeout(() => { el.textContent = ''; }, 4000);
  }

  function handleExport() {
    if (!currentUser) return;
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      uid: currentUser.uid,
      predictions: userPredictions,
      bracketPicks: bracketPicks,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const date = new Date().toISOString().slice(0, 10);
    a.href     = url;
    a.download = `wc2026-predictions-${date}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setToolbarStatus('Exported ✓');
  }

  let pendingImport = null;

  function openImportModal() {
    document.getElementById('import-modal')?.removeAttribute('hidden');
    document.getElementById('import-backdrop')?.removeAttribute('hidden');
  }
  function closeImportModal() {
    document.getElementById('import-modal')?.setAttribute('hidden', '');
    document.getElementById('import-backdrop')?.setAttribute('hidden', '');
    pendingImport = null;
    const fileInput = document.getElementById('import-file-input');
    if (fileInput) fileInput.value = '';
  }

  function handleFileChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.predictions && !data.bracketPicks) {
          setToolbarStatus('Invalid backup file.', true);
          return;
        }
        const predCount    = Object.keys(data.predictions  || {}).length;
        const bracketCount = Object.keys(data.bracketPicks || {}).length;
        const descEl = document.getElementById('import-modal-desc');
        if (descEl) {
          descEl.textContent =
            `This will restore ${predCount} match prediction${predCount !== 1 ? 's' : ''} and ` +
            `${bracketCount} bracket pick${bracketCount !== 1 ? 's' : ''} from the backup file ` +
            `(exported ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : 'unknown date'}). ` +
            `Your current predictions will be overwritten. This cannot be undone.`;
        }
        pendingImport = data;
        openImportModal();
      } catch {
        setToolbarStatus('Could not read file — is it a valid JSON backup?', true);
      }
    };
    reader.readAsText(file);
  }

  async function confirmImport() {
    if (!currentUser || !pendingImport) return;
    closeImportModal();
    setToolbarStatus('Restoring…');
    try {
      const preds   = pendingImport.predictions  || {};
      const bracket = pendingImport.bracketPicks || {};
      const predEntries = Object.entries(preds);
      for (const [matchId, { home, away, pk }] of predEntries) {
        await savePrediction(currentUser.uid, matchId, home, away, pk);
      }
      await saveBracketPicks(currentUser.uid, bracket);
      userPredictions = { ...preds };
      bracketPicks    = { ...bracket };
      renderAll();
      setToolbarStatus(`Restored ${predEntries.length} predictions ✓`);
    } catch (err) {
      console.warn('[app] import error', err);
      setToolbarStatus('Restore failed — check console.', true);
    }
  }

  // ─── Event Listeners ──────────────────────────────────────────────────────────
  document.querySelectorAll('.nav-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.view)));
  document.querySelectorAll('.sub-tab').forEach(btn =>
    btn.addEventListener('click', () => switchPredSubtab(btn.dataset.subtab)));
  document.getElementById('auth-btn')?.addEventListener('click', openModal);
  document.getElementById('predict-signin-btn')?.addEventListener('click', openModal);
  document.getElementById('sign-out-btn')?.addEventListener('click', () => logOut());
  document.querySelectorAll('.pred-standings-signin-btn').forEach(btn => btn.addEventListener('click', openModal));
  document.getElementById('auth-close')?.addEventListener('click', closeModal);
  document.getElementById('auth-backdrop')?.addEventListener('click', closeModal);

  document.getElementById('export-btn')?.addEventListener('click', handleExport);
  document.getElementById('import-file-input')?.addEventListener('change', handleFileChosen);
  document.getElementById('import-confirm-btn')?.addEventListener('click', confirmImport);
  document.getElementById('import-cancel-btn')?.addEventListener('click', closeImportModal);
  document.getElementById('import-backdrop')?.addEventListener('click', closeImportModal);

  const authForm = document.getElementById('auth-form');
  let authFormMode = 'signin';
  authForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const errEl    = document.getElementById('auth-error');
    if (errEl) errEl.textContent = '';
    try {
      if (authFormMode === 'signup') await signUp(email, password);
      else                           await signIn(email, password);
      closeModal();
    } catch (err) { if (errEl) errEl.textContent = err.message; }
  });

  document.getElementById('auth-switch')?.addEventListener('click', () => {
    const submitBtn = document.getElementById('auth-submit');
    const toggleBtn = document.getElementById('auth-switch');
    const titleEl   = document.getElementById('auth-title');
    const subEl     = document.getElementById('auth-sub');
    if (authFormMode === 'signin') {
      authFormMode = 'signup';
      if (titleEl)   titleEl.textContent   = 'Create Account';
      if (subEl)     subEl.textContent     = 'Create an account to save your predictions.';
      if (submitBtn) submitBtn.textContent = 'Sign Up';
      if (toggleBtn) toggleBtn.textContent = 'Already have an account? Sign in';
    } else {
      authFormMode = 'signin';
      if (titleEl)   titleEl.textContent   = 'Sign In';
      if (subEl)     subEl.textContent     = 'Sign in to save your predictions.';
      if (submitBtn) submitBtn.textContent = 'Sign In';
      if (toggleBtn) toggleBtn.textContent = "Don't have an account? Sign up";
    }
  });

  document.getElementById('match-date-filter')?.addEventListener('change', _renderMatches);
  document.getElementById('match-group-filter')?.addEventListener('change', _renderMatches);
  document.getElementById('match-venue-filter')?.addEventListener('change', _renderMatches);
  document.getElementById('match-team-filter')?.addEventListener('input', _renderMatches);
  document.getElementById('pred-date-filter')?.addEventListener('change', _renderPredictions);
  document.getElementById('pred-group-filter')?.addEventListener('change', _renderPredictions);
  document.getElementById('pred-team-filter')?.addEventListener('input', _renderPredictions);

  // ─── Live match data from Firestore ───────────────────────────────────────────
  watchMatches(allMatches => {
    liveMatches = allMatches;
    populateMatchFilters(allTabMatches, getTodayStr, formatDateHeader, sortStages);
    populatePredFilters(allPredMatches, getTodayStr, formatDateHeader, sortStages);
    if (authResolved) renderAll();
  });

  window._wc = { getAllMatches() { return [...liveMatches]; } };

})();
