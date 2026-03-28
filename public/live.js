const liveForm = document.getElementById('live-form');
const liveStatus = document.getElementById('live-status');
const results = document.getElementById('results');
const playerName = document.getElementById('player-name');
const gameMeta = document.getElementById('game-meta');
const blueTeamEl = document.getElementById('blue-team');
const redTeamEl = document.getElementById('red-team');
const bansGrid = document.getElementById('bans-grid');
const bansPanel = document.getElementById('bans-panel');

let timerInterval = null;
let gameStartSeconds = 0;
let fetchedAt = 0;

function setText(element, value, className = '') {
  element.className = className;
  element.textContent = value;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function startTimer(gameLengthAtFetch) {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  gameStartSeconds = gameLengthAtFetch;
  fetchedAt = Date.now();

  const timerEl = document.getElementById('live-timer');
  if (!timerEl) {
    return;
  }

  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - fetchedAt) / 1000);
    timerEl.textContent = formatDuration(gameStartSeconds + elapsed);
  }, 1000);
}

async function loadChampionMap() {
  try {
    const versions = await fetch('https://ddragon.leagueoflegends.com/api/versions.json').then((r) => r.json());
    const latest = versions[0];
    const data = await fetch(`https://ddragon.leagueoflegends.com/cdn/${latest}/data/en_US/champion.json`).then((r) => r.json());
    const map = {};
    for (const champ of Object.values(data.data)) {
      map[Number(champ.key)] = { name: champ.name, imageKey: champ.id, version: latest };
    }
    return map;
  } catch {
    return {};
  }
}

function champIconUrl(entry) {
  if (!entry) return '';
  return `https://ddragon.leagueoflegends.com/cdn/${entry.version}/img/champion/${entry.imageKey}.png`;
}

function renderParticipants(container, participants, championMap, searchedPuuid) {
  container.innerHTML = participants
    .map((p) => {
      const entry = championMap[p.championId];
      const champName = entry ? entry.name : `Champion ${p.championId}`;
      const iconUrl = champIconUrl(entry);
      const isSearched = p.puuid === searchedPuuid;
      return `
        <article class="participant-card${isSearched ? ' participant-card--highlight' : ''}">
          ${iconUrl ? `<img class="champ-icon" src="${iconUrl}" alt="${champName}" />` : ''}
          <div class="participant-info">
            <strong>${champName}</strong>
            <span>${p.riotId}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function renderBans(bans, championMap) {
  if (!bans.length) {
    bansPanel.classList.add('hidden');
    return;
  }

  bansPanel.classList.remove('hidden');
  const blueBans = bans.filter((b) => b.teamId === 100);
  const redBans = bans.filter((b) => b.teamId === 200);

  const renderGroup = (list, label) => {
    if (!list.length) return '';
    const icons = list.map((b) => {
      const entry = championMap[b.championId];
      const name = entry ? entry.name : `#${b.championId}`;
      const url = champIconUrl(entry);
      return url
        ? `<div class="ban-icon-wrap"><img class="ban-icon" src="${url}" alt="${name}" title="${name}" /></div>`
        : `<span>${name}</span>`;
    }).join('');
    return `<div class="ban-group"><span class="ban-label">${label}</span><div class="ban-icons">${icons}</div></div>`;
  };

  bansGrid.innerHTML = renderGroup(blueBans, 'Blue') + renderGroup(redBans, 'Red');
}

liveForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  results.classList.add('hidden');

  const formData = new FormData(liveForm);
  const query = new URLSearchParams({
    gameName: formData.get('gameName'),
    tagLine: formData.get('tagLine'),
    region: formData.get('region')
  });

  setText(liveStatus, 'Checking live game...', 'status-text muted');

  const [response, championMap] = await Promise.all([
    fetch(`/api/live?${query.toString()}`),
    loadChampionMap()
  ]);

  const data = await response.json();

  if (!response.ok) {
    setText(liveStatus, data.error || 'Unable to check live game.', 'status-text');
    return;
  }

  playerName.textContent = `${data.player.gameName} #${data.player.tagLine}`;

  if (!data.inGame) {
    setText(liveStatus, `${data.player.gameName} is not currently in a game.`, 'status-text muted');
    return;
  }

  const g = data.game;
  gameMeta.innerHTML = `
    <span>${g.gameMode}</span>
    <span><span class="live-dot"></span> LIVE <span id="live-timer">${formatDuration(g.gameLength)}</span></span>
    <span>${g.platformId}</span>
  `;

  const searchedPuuid = data.game.blueTeam.concat(data.game.redTeam)
    .find((p) => {
      const [name] = (p.riotId || '').split('#');
      return name.toLowerCase() === formData.get('gameName').toLowerCase();
    })?.puuid || '';

  renderParticipants(blueTeamEl, g.blueTeam, championMap, searchedPuuid);
  renderParticipants(redTeamEl, g.redTeam, championMap, searchedPuuid);
  renderBans(g.bannedChampions, championMap);

  results.classList.remove('hidden');
  setText(liveStatus, 'Live game loaded.', 'status-text muted');

  startTimer(g.gameLength);
});
