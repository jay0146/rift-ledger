const searchForm = document.getElementById('search-form');
const searchStatus = document.getElementById('search-status');
const results = document.getElementById('results');
const playerName = document.getElementById('player-name');
const playerMeta = document.getElementById('player-meta');
const metrics = document.getElementById('metrics');
const rankedGrid = document.getElementById('ranked-grid');
const matchesGrid = document.getElementById('matches-grid');

const INITIAL_SHOW = 10;
let allMatches = [];
let allChampionMap = {};

function setText(element, value, className = '') {
  element.className = className;
  element.textContent = value;
}

async function loadChampionMap() {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) => r.json());
    const latest = versions[0];
    const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`).then((r) => r.json());
    const map = {};
    for (const champ of Object.values(data.data)) {
      map[champ.name] = `https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${champ.id}.png`;
      map[champ.id] = `https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${champ.id}.png`;
    }
    return { map, profileBase: `https://ddragon.leagueoflegends.com/cdn/${latest}/img/profileicon` };
  } catch {
    return { map: {}, profileBase: '' };
  }
}

function renderMetrics(recentForm) {
  const cards = [
    { label: 'Win rate', value: recentForm.totalGames ? `${Math.round((recentForm.wins / recentForm.totalGames) * 100)}%` : '0%' },
    { label: 'KDA', value: recentForm.kda },
    { label: 'CS / min', value: recentForm.averageCsPerMin || recentForm.averageCs },
    { label: 'Record', value: `${recentForm.wins}W \u2013 ${recentForm.losses}L` }
  ];

  metrics.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <span>${card.label}</span>
          <strong>${card.value}</strong>
        </article>
      `
    )
    .join('');
}

function renderRanked(ranked) {
  if (!ranked.length) {
    rankedGrid.innerHTML = '<article class="rank-card"><span>No ranked queues found</span><strong>Unranked</strong></article>';
    return;
  }

  rankedGrid.innerHTML = ranked
    .map(
      (queue) => `
        <article class="rank-card">
          <span>${queue.queueType.replaceAll('_', ' ')}</span>
          <strong>${queue.tier} ${queue.rank}</strong>
          <em class="rank-lp">${queue.leaguePoints} LP</em>
          <p>${queue.wins}W &middot; ${queue.losses}L</p>
        </article>
      `
    )
    .join('');
}

function buildMatchCard(match, idx, championMap) {
  const iconUrl = championMap[match.championName] || championMap[match.championName.replace(/\s/g, '')] || '';
  const date = match.gameDate
    ? new Date(match.gameDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return `
    <article
      class="match-card ${match.win ? 'match-card--win' : 'match-card--loss'}"
      data-idx="${idx}"
      role="button"
      tabindex="0"
      aria-expanded="false"
    >
      <div class="match-card-header">
        ${iconUrl ? `<img class="match-champ-icon" src="${iconUrl}" alt="${match.championName}" />` : ''}
        <div class="match-card-title">
          <strong>${match.championName}</strong>
          <span class="${match.win ? 'result-positive' : 'result-negative'}">${match.win ? 'Victory' : 'Defeat'}</span>
        </div>
        <span class="match-expand-icon" aria-hidden="true">&#8250;</span>
      </div>
      <p>${match.kills}/${match.deaths}/${match.assists} KDA</p>
      <p>${match.csPerMin} CS/min &middot; ${match.damage.toLocaleString()} dmg</p>
      <p>${match.visionScore} vision &middot; ${match.gameDurationMinutes} min</p>
      ${date ? `<p class="match-date">${date}</p>` : ''}
      <div class="match-card-details">
        <div class="match-detail-row"><span>Total CS</span><strong>${match.cs}</strong></div>
        <div class="match-detail-row"><span>Damage dealt</span><strong>${match.damage.toLocaleString()}</strong></div>
        <div class="match-detail-row"><span>Vision score</span><strong>${match.visionScore}</strong></div>
        <div class="match-detail-row"><span>Duration</span><strong>${match.gameDurationMinutes} min</strong></div>
      </div>
    </article>
  `;
}

function attachCardListeners() {
  matchesGrid.querySelectorAll('.match-card').forEach((card) => {
    const toggle = () => {
      const expanded = card.classList.toggle('expanded');
      card.setAttribute('aria-expanded', String(expanded));
    };
    card.addEventListener('click', toggle);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}

function renderMatches(recentMatches, championMap, showAll = false) {
  allMatches = recentMatches;
  allChampionMap = championMap;

  const toShow = showAll ? recentMatches : recentMatches.slice(0, INITIAL_SHOW);
  const hasMore = recentMatches.length > INITIAL_SHOW && !showAll;

  matchesGrid.innerHTML = toShow
    .map((match, idx) => buildMatchCard(match, idx, championMap))
    .join('');

  attachCardListeners();

  const showMoreWrap = document.getElementById('show-more-wrap');
  if (showMoreWrap) {
    if (hasMore) {
      showMoreWrap.innerHTML = `
        <div class="matches-fade"></div>
        <button type="button" class="btn-ghost" id="show-more-btn">Show ${recentMatches.length - INITIAL_SHOW} more games</button>
      `;
      document.getElementById('show-more-btn').addEventListener('click', () => {
        renderMatches(allMatches, allChampionMap, true);
      });
    } else {
      showMoreWrap.innerHTML = '';
    }
  }
}

function renderAdvice(recentMatches, recentForm) {
  const panel = document.getElementById('advice-panel');
  if (!panel) return;

  const totalGames = recentForm.totalGames;
  if (totalGames === 0) { panel.classList.add('hidden'); return; }

  const tips = [];
  const winRate = recentForm.wins / totalGames;
  const kda = recentForm.kda === 'Perfect' ? 99 : parseFloat(recentForm.kda);
  const csPerMin = parseFloat(recentForm.averageCsPerMin || recentForm.averageCs || 0);
  const avgDeaths = parseFloat(recentForm.averageDeaths);
  const avgVision = recentMatches.length
    ? recentMatches.reduce((s, m) => s + m.visionScore, 0) / recentMatches.length
    : 0;
  const avgDamage = recentMatches.length
    ? recentMatches.reduce((s, m) => s + m.damage, 0) / recentMatches.length
    : 0;

  // Win rate
  if (winRate < 0.40) {
    tips.push({ type: 'warn', title: 'Win rate needs work', body: `At ${Math.round(winRate * 100)}% you're losing more than winning. Focus on 1-2 champions you know well and avoid playing on tilt — take breaks between losses.` });
  } else if (winRate >= 0.55) {
    tips.push({ type: 'good', title: 'Strong win rate', body: `${Math.round(winRate * 100)}% win rate is above average. Keep the pressure up and continue leveraging leads before the enemy can scale.` });
  }

  // Deaths / KDA
  if (avgDeaths > 6) {
    tips.push({ type: 'warn', title: 'Dying too often', body: `Averaging ${recentForm.averageDeaths} deaths per game. Prioritise safe trades, respect enemy burst patterns, and back off when your cooldowns are down.` });
  } else if (kda >= 3.5) {
    tips.push({ type: 'good', title: 'Strong KDA', body: `KDA of ${recentForm.kda} shows solid game sense. Use that lead to pressure objectives and carry your team.` });
  } else if (kda < 2.0 && avgDeaths > 4) {
    tips.push({ type: 'warn', title: 'KDA below 2.0', body: `KDA of ${recentForm.kda} suggests dying more than contributing. Ward river entrances before fights and play more reactively when you're even or behind.` });
  }

  // CS/min
  if (csPerMin < 4.5) {
    tips.push({ type: 'warn', title: 'CS/min needs work', body: `${csPerMin.toFixed(1)} CS/min is well below the 7+ target. Every 15 minions missed is roughly a lost item component. Grind last-hits in Practice Tool for 15 minutes a day.` });
  } else if (csPerMin < 6.5) {
    tips.push({ type: 'info', title: 'CS/min is average', body: `${csPerMin.toFixed(1)} CS/min — decent but improvable. Don't back until a wave is pushed in, and clear jungle camps between rotations to maintain gold flow.` });
  } else {
    tips.push({ type: 'good', title: 'CS/min is solid', body: `${csPerMin.toFixed(1)} CS/min puts you ahead of most players in your bracket. Strong laning foundation.` });
  }

  // Vision
  if (avgVision < 15) {
    tips.push({ type: 'warn', title: 'Vision score is very low', body: `Averaging ${avgVision.toFixed(0)} vision score. Buy a Control Ward every back — it costs 75g and can prevent a baron steal worth thousands of gold.` });
  } else if (avgVision < 25) {
    tips.push({ type: 'info', title: 'Vision could improve', body: `${avgVision.toFixed(0)} average vision score. Place trinkets proactively before objectives spawn and sweep enemy wards around dragon/baron pits.` });
  }

  // Damage
  if (avgDamage < 8000) {
    tips.push({ type: 'info', title: 'Damage output is low', body: `Averaging ${Math.round(avgDamage).toLocaleString()} damage per game. Consider whether you're grouping for teamfights and building toward the right threats — one damage item swap can double output.` });
  }

  if (tips.length === 0) {
    tips.push({ type: 'good', title: 'Looking good overall', body: 'Stats are balanced across all categories. Focus on macro — objective timing, wave management, and proactive vision to climb further.' });
  }

  panel.classList.remove('hidden');
  panel.innerHTML = `
    <div class="panel-heading">
      <p class="eyebrow">Performance review</p>
      <h2>Coaching tips</h2>
    </div>
    <div class="advice-grid">
      ${tips.map((t) => `
        <div class="advice-tip advice-tip--${t.type}">
          <strong>${t.title}</strong>
          <p>${t.body}</p>
        </div>
      `).join('')}
    </div>
  `;
}

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(searchForm);
  const query = new URLSearchParams({
    gameName: formData.get('gameName'),
    tagLine: formData.get('tagLine'),
    region: formData.get('region')
  });

  const submitBtn = searchForm.querySelector('button[type="submit"]');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span>Loading\u2026';
  }
  setText(searchStatus, 'Loading player stats\u2026', 'status-text muted');

  const [response, { map: championMap, profileBase }] = await Promise.all([
    fetch(`/api/player?${query.toString()}`),
    loadChampionMap()
  ]);

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Load stats';
  }

  const data = await response.json();

  if (!response.ok) {
    results.classList.add('hidden');
    setText(searchStatus, data.error || 'Unable to load player stats.', 'status-text');
    return;
  }

  playerName.textContent = `${data.player.gameName} #${data.player.tagLine}`;

  const profileIcon = document.getElementById('profile-icon');
  if (profileIcon && data.player.profileIconId && profileBase) {
    profileIcon.src = `${profileBase}/${data.player.profileIconId}.png`;
    profileIcon.alt = `Profile icon ${data.player.profileIconId}`;
  }

  playerMeta.innerHTML = `
    <span>Level ${data.player.summonerLevel}</span>
    <span>${data.player.region.toUpperCase()}</span>
  `;

  renderMetrics(data.recentForm);
  renderRanked(data.ranked);
  renderMatches(data.recentMatches, championMap, false);
  renderAdvice(data.recentMatches, data.recentForm);
  results.classList.remove('hidden');
  setText(searchStatus, 'Player stats loaded.', 'status-text muted');
});


async function loadChampionMap() {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) => r.json());
    const latest = versions[0];
    const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`).then((r) => r.json());
    const map = {};
    for (const champ of Object.values(data.data)) {
      map[champ.name] = `https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${champ.id}.png`;
      map[champ.id] = `https://ddragon.leagueoflegends.com/cdn/${latest}/img/champion/${champ.id}.png`;
    }
    return { map, profileBase: `https://ddragon.leagueoflegends.com/cdn/${latest}/img/profileicon` };
  } catch {
    return { map: {}, profileBase: '' };
  }
}

