# Rift Ledger

> **100% vibe coded.** Every line of this project was written by AI (GitHub Copilot) through natural language prompts. No manual code was written.

A local League of Legends stats dashboard built with Node.js + Express. Search any Riot ID to pull ranked standings, match history, performance metrics, and personalised coaching tips — all proxied server-side so your API key never reaches the browser.

![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js)
![Riot API](https://img.shields.io/badge/Riot-API-red?logo=riotgames)
![Vibe Coded](https://img.shields.io/badge/vibe%20coded-100%25-blueviolet)

---

## Features

- **Player stats** — search by Riot ID (`gameName#tagLine`) for any region
- **Ranked standings** — solo/duo and flex queue with LP and W/L
- **Match history** — last 20 games fetched, 10 shown with a Show More button; click any card to expand full details
- **Champion icons** on every match card via Data Dragon CDN
- **CS/min** displayed per match and as an averaged metric across recent games
- **Performance metrics** — win rate, KDA, CS/min, W/L record
- **Coaching tips** — automated performance review with tips on farming, deaths, vision, damage, and win rate
- **Live game** — real-time spectator view via Spectator V5; shows both teams, champion icons, bans, and a live game timer
- **API key management** — separate settings page with a 24-hour countdown timer for dev keys
- **Backend env key support** — set `RIOT_API_KEY` in your environment and the settings page hides automatically
- **Rate limit safe** — match details fetched sequentially with a 150 ms delay to stay under Riot's 20 req/s limit

---

## Pages

| Page | Path | Description |
|---|---|---|
| Player Stats | `/` | Main dashboard |
| Live Game | `/live.html` | Real-time spectator data |
| Settings | `/settings.html` | API key + countdown timer |

---

## Run locally

```bash
# 1. Install dependencies
npm install

# 2. Start the server
node server.js

# 3. Open in browser
http://localhost:3000
```

Then go to **Settings** and paste your Riot developer key.

**Or** set it as an environment variable before starting:

```bash
# Windows PowerShell
$env:RIOT_API_KEY="RGAPI-your-key-here"
node server.js
```

---

## Project structure

```
server.js           Express server + Riot API proxy
public/
  index.html        Player stats page
  app.js            Player stats logic
  live.html         Live game page
  live.js           Live game logic
  settings.html     Settings page
  settings.js       API key management + countdown timer
  styles.css        Shared dark-theme styles
```

---

## API key notes

- **Development key** — expires every 24 hours, fine for personal use. Get one at [developer.riotgames.com](https://developer.riotgames.com).
- **Personal/production key** — requires Riot product registration for public-facing apps.
- Your key is stored in `.env.local` (gitignored) and never sent to the browser.

---

## Tech stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla HTML / CSS / JavaScript (no build step)
- **Fonts**: Space Grotesk + IBM Plex Mono (Google Fonts)
- **Data**: Riot API (account-v1, summoner-v4, league-v4, match-v5, spectator-v5) + Data Dragon CDN
