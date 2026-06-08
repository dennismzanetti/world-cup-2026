// World Cup 2026 App
(function() {
  'use strict';

  // --- Theme toggle ---
  const themeToggle = document.querySelector('[data-theme-toggle]');
  const html = document.documentElement;
  function setTheme(t) {
    html.setAttribute('data-theme', t);
    if (themeToggle) {
      themeToggle.setAttribute('aria-label', 'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' mode');
      themeToggle.innerHTML = t === 'dark'
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }
  }
  let currentTheme = 'dark';
  setTheme(currentTheme);
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      setTheme(currentTheme);
    });
  }

  // --- Navigation ---
  const navBtns = document.querySelectorAll('.nav-btn');
  const views = document.querySelectorAll('.view');
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('view-' + btn.dataset.view).classList.add('active');
      renderAll();
    });
  });

  // --- Points calculation ---
  function calcPoints(matches, teamName) {
    let pts = 0, w = 0, d = 0, l = 0, gf = 0, ga = 0;
    matches.forEach(m => {
      if (m.homeScore === null || m.awayScore === null) return;
      const hs = parseInt(m.homeScore), as = parseInt(m.awayScore);
      if (m.home.name === teamName) {
        gf += hs; ga += as;
        if (hs > as) { pts += 3; w++; }
        else if (hs === as) { pts += 1; d++; }
        else { l++; }
      } else if (m.away.name === teamName) {
        gf += as; ga += hs;
        if (as > hs) { pts += 3; w++; }
        else if (as === hs) { pts += 1; d++; }
        else { l++; }
      }
    });
    const played = w + d + l;
    return { pts, played, w, d, l, gf, ga, gd: gf - ga };
  }

  // --- Render Groups ---
  function renderGroups() {
    const container = document.getElementById('groups-grid');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teamsWithPts = group.teams.map(t => ({
        ...t,
        ...calcPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

      const card = document.createElement('div');
      card.className = 'group-card';
      card.innerHTML = `
        <div class="group-card-header">
          <span class="group-name">Group ${group.id}</span>
          <span class="group-count">${group.teams.length} teams</span>
        </div>
        <div class="group-teams">
          ${teamsWithPts.map((t, i) => `
            <div class="group-team-row">
              <span class="team-flag">${t.flag}</span>
              <span class="team-name">${t.name}</span>
              <span class="team-pts" title="Points">${t.pts} pts</span>
            </div>
          `).join('')}
        </div>
      `;
      container.appendChild(card);
    });
  }

  // --- Render Matches ---
  function renderMatches(filter = 'all') {
    const container = document.getElementById('matches-list');
    if (!container) return;
    container.innerHTML = '';
    const filtered = filter === 'all' ? WC_MATCHES : WC_MATCHES.filter(m => m.group === filter);
    filtered.forEach(match => {
      const card = document.createElement('div');
      card.className = 'match-card';
      card.innerHTML = `
        <div class="match-team home">
          <span class="team-flag">${match.home.flag}</span>
          <span>${match.home.name}</span>
        </div>
        <div class="match-center">
          <div class="match-score-inputs">
            <input class="score-input" type="number" min="0" max="20" value="${match.homeScore !== null ? match.homeScore : ''}" placeholder="-" data-match="${match.id}" data-side="home">
            <span class="score-sep">:</span>
            <input class="score-input" type="number" min="0" max="20" value="${match.awayScore !== null ? match.awayScore : ''}" placeholder="-" data-match="${match.id}" data-side="away">
          </div>
          <span class="match-group-badge">Group ${match.group}</span>
          <button class="btn-save" data-save="${match.id}">Save</button>
          <span class="result-saved" id="saved-${match.id}">Saved ✓</span>
        </div>
        <div class="match-team away">
          <span>${match.away.name}</span>
          <span class="team-flag">${match.away.flag}</span>
        </div>
      `;
      container.appendChild(card);
    });

    // Attach save handlers
    container.querySelectorAll('.btn-save').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.save);
        const match = WC_MATCHES.find(m => m.id === id);
        const hInput = container.querySelector(`input[data-match="${id}"][data-side="home"]`);
        const aInput = container.querySelector(`input[data-match="${id}"][data-side="away"]`);
        if (hInput.value !== '' && aInput.value !== '') {
          match.homeScore = parseInt(hInput.value);
          match.awayScore = parseInt(aInput.value);
          const saved = document.getElementById('saved-' + id);
          if (saved) { saved.style.display = 'block'; setTimeout(() => { saved.style.display = 'none'; }, 2000); }
        }
      });
    });
  }

  // --- Render Predictions ---
  function renderPredictions() {
    const container = document.getElementById('predictions-list');
    if (!container) return;
    container.innerHTML = '';
    WC_MATCHES.forEach(match => {
      const card = document.createElement('div');
      card.className = 'match-card';
      const hasResult = match.homeScore !== null && match.awayScore !== null;
      card.innerHTML = `
        <div class="match-team home">
          <span class="team-flag">${match.home.flag}</span>
          <span>${match.home.name}</span>
        </div>
        <div class="match-center">
          ${ hasResult
            ? `<div class="pred-score-display">${match.homeScore} : ${match.awayScore}</div>
               <span class="match-group-badge" style="background:var(--color-success-highlight);color:var(--color-success)">Final</span>`
            : `<div class="pred-inputs">
                 <input class="pred-input" type="number" min="0" max="20" value="${match.prediction.home !== null ? match.prediction.home : ''}" placeholder="?" data-pred="${match.id}" data-side="home">
                 <span class="score-sep">:</span>
                 <input class="pred-input" type="number" min="0" max="20" value="${match.prediction.away !== null ? match.prediction.away : ''}" placeholder="?" data-pred="${match.id}" data-side="away">
               </div>
               <span class="match-group-badge">Group ${match.group}</span>
               <button class="btn-save" data-pred-save="${match.id}" style="background:var(--color-accent)">Predict</button>`
          }
        </div>
        <div class="match-team away">
          <span>${match.away.name}</span>
          <span class="team-flag">${match.away.flag}</span>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('[data-pred-save]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.predSave);
        const match = WC_MATCHES.find(m => m.id === id);
        const hInput = container.querySelector(`input[data-pred="${id}"][data-side="home"]`);
        const aInput = container.querySelector(`input[data-pred="${id}"][data-side="away"]`);
        if (hInput && aInput && hInput.value !== '' && aInput.value !== '') {
          match.prediction.home = parseInt(hInput.value);
          match.prediction.away = parseInt(aInput.value);
          btn.textContent = 'Updated ✓';
          setTimeout(() => { btn.textContent = 'Predict'; }, 1500);
        }
      });
    });
  }

  // --- Render Standings ---
  function renderStandings() {
    const container = document.getElementById('standings-grid');
    if (!container) return;
    container.innerHTML = '';
    WC_GROUPS.forEach(group => {
      const groupMatches = WC_MATCHES.filter(m => m.group === group.id);
      const teamsWithStats = group.teams.map(t => ({
        ...t,
        ...calcPoints(groupMatches, t.name)
      })).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);

      const card = document.createElement('div');
      card.className = 'standings-card';
      card.innerHTML = `
        <div class="standings-header">Group ${group.id}</div>
        <table class="standings-table">
          <thead>
            <tr>
              <th></th><th>Team</th>
              <th title="Played">P</th><th title="Won">W</th><th title="Drawn">D</th>
              <th title="Lost">L</th><th title="Goals For">GF</th>
              <th title="Goals Against">GA</th><th title="Goal Difference">GD</th>
              <th title="Points">Pts</th>
            </tr>
          </thead>
          <tbody>
            ${teamsWithStats.map((t, i) => `
              <tr class="${i < 2 ? 'qualified' : ''}">
                <td>${t.flag}</td>
                <td>${t.name}</td>
                <td>${t.played}</td><td>${t.w}</td><td>${t.d}</td>
                <td>${t.l}</td><td>${t.gf}</td><td>${t.ga}</td>
                <td>${t.gd > 0 ? '+' + t.gd : t.gd}</td>
                <td class="pts">${t.pts}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      container.appendChild(card);
    });
  }

  // --- Group filter ---
  const groupFilter = document.getElementById('group-filter');
  if (groupFilter) {
    WC_GROUPS.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.id; opt.textContent = 'Group ' + g.id;
      groupFilter.appendChild(opt);
    });
    groupFilter.addEventListener('change', () => renderMatches(groupFilter.value));
  }

  function renderAll() {
    const activeView = document.querySelector('.nav-btn.active')?.dataset.view;
    if (activeView === 'groups') renderGroups();
    if (activeView === 'matches') renderMatches(groupFilter ? groupFilter.value : 'all');
    if (activeView === 'predictions') renderPredictions();
    if (activeView === 'standings') renderStandings();
  }

  // Initial render
  renderGroups();

})();
