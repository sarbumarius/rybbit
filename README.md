<p align="center">
  <img src="https://github.com/user-attachments/assets/be982e50-8d59-471c-9fb7-e8982658a608" height="100">
    <p align="center">Open Source Web & Product Analytics</p>

<p align="center">
    <a href="https://rybbit.io" target="_blank">Website</a> |
    <a href="https://demo.rybbit.io/1" target="_blank">Demo</a> |
    <a href="https://rybbit.io/docs" target="_blank">Documentation</a> |
    <a href="https://discord.gg/DEhGb4hYBj" target="_blank">Discord</a> |
    <a href="https://github.com/rybbit-io/rybbit?tab=AGPL-3.0-1-ov-file" target="_blank">License (AGPL-3)</a> |
    <a href="https://github.com/rybbit-io/rybbit/blob/master/CONTRIBUTE.md" target="_blank">Contribute</a>
</p>
 
<a href="https://rybbit.io/" target="_blank">Rybbit</a> is the modern open source and privacy friendly alternative to Google Analytics. It takes only a couple minutes to setup and is super intuitive to use.

<p align="center">
  <strong><a href="https://demo.rybbit.io/1">🔍 View Live Demo</a></strong> - See Rybbit running on a real-life production site with over a million visits a month.
</p>

<img width="1313" height="807" alt="image" src="https://github.com/user-attachments/assets/6e39e7cd-60ea-41a7-8add-ba6af624917e" />

<hr>

## 🚀 Getting Started

There are two ways to start using Rybbit:

| Option                                                  | Description                                                   |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| **[Hosted Service](https://rybbit.io)**                 | Free tier available - the fastest way to get started          |
| **[Self-Hosting](https://rybbit.io/docs/self-hosting)** | Deploy and manage Rybbit on your own VPS for complete control |

📚 Explore our [documentation](https://rybbit.io/docs) to learn more about installation, configuration, and usage.

<hr>

## ✨ Key Features

- All key web analytics metrics including sessions, unique users, pageviews, bounce rate, session duration
- Session replays
- No cookies or user tracking - GDPR & CCPA compliant
- Customizable goals. retention, user journeys, and funnels dashboards
- Advanced filtering across 15+ dimensions
- Custom events with JSON properties
- 3 level location tracking (country -> region -> city) + advanced map visualizations
- Real time dashboard
- Support for organizations and unlimited number of sites

<hr>

## 📊 Dashboard Preview

### Main

![image](https://github.com/user-attachments/assets/9b0f75d5-1048-4ea3-95a6-22a6c70b5100)

## Session Replay

![image](https://github.com/user-attachments/assets/b06b689e-ae9a-44bf-81a5-44bce684c839)

### Realtime

![image](https://github.com/user-attachments/assets/fcaae1f3-0956-4d98-a2b8-d0bb096bcdff)

### Sessions

![image](https://github.com/user-attachments/assets/56230cfb-c88f-4274-869f-6853bf846338)

### Journeys

![image](https://github.com/user-attachments/assets/652d4011-3bef-49f7-acf7-d577c0aded8b)

### Map

![image](https://github.com/user-attachments/assets/0d331663-a290-4e3e-b97a-6793e6c4e412)

### Funnels

![image](https://github.com/user-attachments/assets/500e570c-5821-4c69-87f2-91cf1504e4b9)

### Goals

![image](https://github.com/user-attachments/assets/d337d39d-923d-4d80-8677-7921cc0bb916)

### users

![image](https://github.com/user-attachments/assets/4f92b5d0-cb43-4d72-a2e6-107a1eff3cf8)

### Errors

![image](https://github.com/user-attachments/assets/2ec82c13-4551-4f23-afee-e7d94059b221)

### Retention

![image](https://github.com/user-attachments/assets/9a193108-b928-464f-a7f3-ff2b8a572f05)

<hr>

## ⭐ Star History

[![Star History Chart](https://api.star-history.com/svg?repos=rybbit-io/rybbit&type=Date)](https://www.star-history.com/#rybbit-io/rybbit&Date)


## 🛠️ Local Dev vs Production with Docker Compose

This repo includes two ready-to-use modes for the web client:

- Development: live reload (Next.js dev server), edits update in real time
- Production: optimized Next.js build served by the production runtime

You can switch between them with a single command.

Prerequisites:
- Docker and Docker Compose v2
- A populated .env file in the project root (run ./setup.sh if needed)

Commands:
- Development (uses docker-compose.yml + docker-compose.override.yml):
  ./up-dev.sh

- Production (uses only docker-compose.yml):
  ./up-prod.sh

Notes:
- In dev, the client runs npm run dev in a container with your local client/ code mounted.
  Port mapping: host 3003 -> container 3002 (open http://localhost:3003).
- In prod, the client is built with client/Dockerfile and served on port 3002 by default.
  If you have Caddy enabled and proper DOMAIN_NAME, it will proxy 80/443 to the client/backend.
- You can still run these manually without the helper scripts:
  - Dev: docker compose up -d --build
  - Prod: docker compose -f docker-compose.yml up -d --build
