const express = require('express');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const app = express();
const port = process.env.PORT || 3000;
const envPath = path.join(__dirname, '.env.local');

const PLATFORM_ROUTING = {
  br1: 'americas',
  la1: 'americas',
  la2: 'americas',
  na1: 'americas',
  oc1: 'sea',
  kr: 'asia',
  jp1: 'asia',
  eun1: 'europe',
  euw1: 'europe',
  tr1: 'europe',
  ru: 'europe',
  ph2: 'sea',
  sg2: 'sea',
  th2: 'sea',
  tw2: 'sea',
  vn2: 'sea'
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readEnvFile() {
  if (!fs.existsSync(envPath)) {
    return {};
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  return dotenv.parse(contents);
}

function getRiotApiKeyDetails() {
  const environmentApiKey = typeof process.env.RIOT_API_KEY === 'string' ? process.env.RIOT_API_KEY.trim() : '';
  if (environmentApiKey) {
    return { apiKey: environmentApiKey, source: 'environment', keySavedAt: null };
  }

  const env = readEnvFile();
  const fileApiKey = typeof env.RIOT_API_KEY === 'string' ? env.RIOT_API_KEY.trim() : '';
  if (fileApiKey) {
    const savedAt = env.RIOT_API_KEY_SAVED_AT ? parseInt(env.RIOT_API_KEY_SAVED_AT, 10) : null;
    return { apiKey: fileApiKey, source: 'file', keySavedAt: savedAt };
  }

  return { apiKey: '', source: 'none', keySavedAt: null };
}

function saveRiotApiKey(apiKey) {
  const savedAt = Date.now();
  let contents = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

  // Update or insert RIOT_API_KEY
  const keyLine = `RIOT_API_KEY=${apiKey}`;
  if (/^RIOT_API_KEY=.*$/m.test(contents)) {
    contents = contents.replace(/^RIOT_API_KEY=.*$/m, keyLine);
  } else {
    const sep = contents.endsWith('\n') || !contents ? '' : '\n';
    contents = `${contents}${sep}${keyLine}\n`;
  }

  // Update or insert RIOT_API_KEY_SAVED_AT
  const tsLine = `RIOT_API_KEY_SAVED_AT=${savedAt}`;
  if (/^RIOT_API_KEY_SAVED_AT=.*$/m.test(contents)) {
    contents = contents.replace(/^RIOT_API_KEY_SAVED_AT=.*$/m, tsLine);
  } else {
    const sep = contents.endsWith('\n') ? '' : '\n';
    contents = `${contents}${sep}${tsLine}\n`;
  }

  fs.writeFileSync(envPath, contents, 'utf8');
}

async function riotFetch(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      'X-Riot-Token': apiKey,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    let message = `Riot API request failed with status ${response.status}.`;

    try {
      const data = await response.json();
      if (data?.status?.message) {
        message = data.status.message;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function normalizeRankedEntries(entries) {
  return entries.map((entry) => ({
    queueType: entry.queueType,
    tier: entry.tier,
    rank: entry.rank,
    leaguePoints: entry.leaguePoints,
    wins: entry.wins,
    losses: entry.losses,
    hotStreak: entry.hotStreak
  }));
}

function buildRecentForm(matches, puuid) {
  const pairs = matches
    .map((match) => ({
      participant: match.info.participants.find((p) => p.puuid === puuid),
      gameDuration: match.info.gameDuration || 0
    }))
    .filter((p) => p.participant);

  const totalGames = pairs.length;
  const wins = pairs.filter((p) => p.participant.win).length;
  const kills = pairs.reduce((sum, p) => sum + p.participant.kills, 0);
  const deaths = pairs.reduce((sum, p) => sum + p.participant.deaths, 0);
  const assists = pairs.reduce((sum, p) => sum + p.participant.assists, 0);
  const cs = pairs.reduce(
    (sum, p) => sum + p.participant.totalMinionsKilled + p.participant.neutralMinionsKilled,
    0
  );
  const totalMinutes = pairs.reduce((sum, p) => sum + p.gameDuration / 60, 0);

  return {
    totalGames,
    wins,
    losses: totalGames - wins,
    averageKills: totalGames ? (kills / totalGames).toFixed(1) : '0.0',
    averageDeaths: totalGames ? (deaths / totalGames).toFixed(1) : '0.0',
    averageAssists: totalGames ? (assists / totalGames).toFixed(1) : '0.0',
    averageCs: totalGames ? (cs / totalGames).toFixed(1) : '0.0',
    averageCsPerMin: totalMinutes > 0 ? (cs / totalMinutes).toFixed(1) : '0.0',
    kda: deaths === 0 ? 'Perfect' : ((kills + assists) / deaths).toFixed(2)
  };
}

function buildRecentMatches(matches, puuid) {
  return matches
    .map((match) => {
      const participant = match.info.participants.find((item) => item.puuid === puuid);
      if (!participant) {
        return null;
      }

      return {
        matchId: match.metadata.matchId,
        championName: participant.championName,
        queueId: match.info.queueId,
        win: participant.win,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
        csPerMin: match.info.gameDuration > 0
          ? ((participant.totalMinionsKilled + participant.neutralMinionsKilled) / (match.info.gameDuration / 60)).toFixed(1)
          : '0.0',
        damage: participant.totalDamageDealtToChampions,
        visionScore: participant.visionScore,
        gameDurationMinutes: Math.round(match.info.gameDuration / 60),
        gameDate: match.info.gameStartTimestamp || null
      };
    })
    .filter(Boolean);
}

app.get('/api/settings/status', (_req, res) => {
  const details = getRiotApiKeyDetails();
  res.json({
    hasApiKey: Boolean(details.apiKey),
    source: details.source,
    managedByEnvironment: details.source === 'environment',
    keySavedAt: details.keySavedAt
  });
});

app.post('/api/settings/key', (req, res) => {
  const existingKey = getRiotApiKeyDetails();
  if (existingKey.source === 'environment') {
    return res.status(403).json({
      error: 'This server uses a backend-managed RIOT_API_KEY. Update that environment variable instead.'
    });
  }

  const apiKey = typeof req.body.apiKey === 'string' ? req.body.apiKey.trim() : '';

  if (!apiKey) {
    return res.status(400).json({ error: 'Paste a Riot API key before saving.' });
  }

  saveRiotApiKey(apiKey);
  return res.json({ ok: true });
});

app.get('/api/player', async (req, res) => {
  const apiKeyDetails = getRiotApiKeyDetails();
  const apiKey = apiKeyDetails.apiKey;
  const gameName = typeof req.query.gameName === 'string' ? req.query.gameName.trim() : '';
  const tagLine = typeof req.query.tagLine === 'string' ? req.query.tagLine.trim() : '';
  const region = typeof req.query.region === 'string' ? req.query.region.trim().toLowerCase() : '';
  const routingRegion = PLATFORM_ROUTING[region];

  if (!apiKey) {
    return res.status(400).json({
      error: 'No Riot API key found. Set RIOT_API_KEY in the backend environment or save one in settings.'
    });
  }

  if (!gameName || !tagLine || !routingRegion) {
    return res.status(400).json({ error: 'Enter a Riot ID, tagline, and valid platform region.' });
  }

  try {
    const account = await riotFetch(
      `https://${routingRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      apiKey
    ).catch((err) => { err.step = 'account lookup'; throw err; });

    const summoner = await riotFetch(
      `https://${region}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
      apiKey
    ).catch((err) => { err.step = 'summoner lookup'; throw err; });

    const rankedEntries = await riotFetch(
      `https://${region}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`,
      apiKey
    ).catch((err) => { err.step = 'ranked data'; throw err; });

    const matchIds = await riotFetch(
      `https://${routingRegion}.api.riotgames.com/lol/match/v5/matches/by-puuid/${account.puuid}/ids?start=0&count=20`,
      apiKey
    ).catch((err) => { err.step = 'match history'; throw err; });

    const matches = [];
    for (let i = 0; i < matchIds.length; i++) {
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 150));
      const match = await riotFetch(
        `https://${routingRegion}.api.riotgames.com/lol/match/v5/matches/${matchIds[i]}`,
        apiKey
      ).catch((err) => { err.step = 'match detail'; throw err; });
      matches.push(match);
    }

    return res.json({
      player: {
        gameName: account.gameName,
        tagLine: account.tagLine,
        puuid: account.puuid,
        summonerLevel: summoner.summonerLevel,
        profileIconId: summoner.profileIconId,
        region
      },
      ranked: normalizeRankedEntries(rankedEntries),
      recentForm: buildRecentForm(matches, account.puuid),
      recentMatches: buildRecentMatches(matches, account.puuid)
    });
  } catch (error) {
    const status = error.status || 500;
    const step = error.step ? ` (failed at: ${error.step})` : '';
    console.error(`[/api/player] ${status}${step}:`, error.message);
    return res.status(status).json({
      error:
        status === 401 || status === 403
          ? `Riot returned ${status} during ${error.step || 'API call'}. Developer keys expire every 24 hours — regenerate yours at developer.riotgames.com, update .env.local, then try again.`
          : status === 429
            ? 'Riot rate limit reached. Wait a bit, then try again.'
            : `${error.message || 'Unable to load player stats.'}${step}`
    });
  }
});

const QUEUE_NAMES = {
  0: 'Custom',
  400: 'Normal Draft',
  420: 'Ranked Solo/Duo',
  430: 'Normal Blind',
  440: 'Ranked Flex',
  450: 'ARAM',
  490: 'Quick Play',
  700: 'Clash',
  830: 'Co-op vs AI (Intro)',
  840: 'Co-op vs AI (Beginner)',
  850: 'Co-op vs AI (Intermediate)',
  900: 'URF',
  1020: 'One for All',
  1300: 'Nexus Blitz',
  1400: 'Ultimate Spellbook',
  1900: 'URF'
};

app.get('/api/live', async (req, res) => {
  const apiKeyDetails = getRiotApiKeyDetails();
  const apiKey = apiKeyDetails.apiKey;
  const gameName = typeof req.query.gameName === 'string' ? req.query.gameName.trim() : '';
  const tagLine = typeof req.query.tagLine === 'string' ? req.query.tagLine.trim() : '';
  const region = typeof req.query.region === 'string' ? req.query.region.trim().toLowerCase() : '';
  const routingRegion = PLATFORM_ROUTING[region];

  if (!apiKey) {
    return res.status(400).json({ error: 'No Riot API key found. Set RIOT_API_KEY in the backend environment or save one in settings.' });
  }

  if (!gameName || !tagLine || !routingRegion) {
    return res.status(400).json({ error: 'Enter a Riot ID, tagline, and valid platform region.' });
  }

  try {
    const account = await riotFetch(
      `https://${routingRegion}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      apiKey
    );

    let liveGame;
    try {
      liveGame = await riotFetch(
        `https://${region}.api.riotgames.com/lol/spectator/v5/active-games/by-summoner/${account.puuid}`,
        apiKey
      );
    } catch (err) {
      if (err.status === 404) {
        return res.json({
          inGame: false,
          player: { gameName: account.gameName, tagLine: account.tagLine }
        });
      }
      throw err;
    }

    const mapParticipant = (p) => ({
      riotId: p.riotId || p.summonerName || 'Unknown',
      championId: p.championId,
      spell1Id: p.spell1Id,
      spell2Id: p.spell2Id,
      teamId: p.teamId,
      puuid: p.puuid
    });

    return res.json({
      inGame: true,
      player: { gameName: account.gameName, tagLine: account.tagLine },
      game: {
        gameQueueConfigId: liveGame.gameQueueConfigId,
        gameMode: QUEUE_NAMES[liveGame.gameQueueConfigId] || liveGame.gameMode || 'Unknown Mode',
        gameLength: liveGame.gameLength,
        platformId: liveGame.platformId,
        bannedChampions: (liveGame.bannedChampions || []).map((b) => ({
          championId: b.championId,
          teamId: b.teamId
        })),
        blueTeam: liveGame.participants.filter((p) => p.teamId === 100).map(mapParticipant),
        redTeam: liveGame.participants.filter((p) => p.teamId === 200).map(mapParticipant)
      }
    });
  } catch (error) {
    const status = error.status || 500;
    return res.status(status).json({
      error:
        status === 401 || status === 403
          ? 'Riot rejected the API key. Developer keys expire every 24 hours — regenerate yours at developer.riotgames.com.'
          : status === 429
            ? 'Riot rate limit reached. Wait a bit, then try again.'
            : error.message || 'Unable to load live game data.'
    });
  }
});

app.listen(port, () => {
  console.log(`League tracker running at http://localhost:${port}`);
});
