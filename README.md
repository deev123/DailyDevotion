# DailyDevotion

Daily Devotion is a dashboard for structured bible reading, with sections for:
- Daily psalms and readings
- Notes
- Audio bible books from youtube embeds
- And more...

All with persistent local browser storage for chapters, video and notes so you can pick up where you left off.
Currently, it uses a [free Bible API](https://bible-api.com/) to fetch chapters for passages.

## Deployment
The `gh-pages` branch is the branch served for the live site at https://deev123.github.io/DailyDevotion/.
- Contains only **browser-ready static files**

## Legacy Site
Before migrating to react, the site was written in vanilla HTML + JS + CSS.
- located in `legacy/` on the `main` branch

## React App
Currently in progress... React will be used going forwards for cleaner UI and development.
- Located in `react-app/` on the `main` branch
- Built with React + TypeScript + Vite
