# Your Local Shop – JS Shopping App

A runnable demo app that implements the **Object-Oriented design** from your Assignment 2 report using a small **Node/Express** backend and a **vanilla JS** frontend. It supports browsing a catalogue, managing a shopping cart, placing an order, mock payment, issuing a transaction receipt, packaging & shipping steps, and simple shipped sales statistics.

## Requirements
- **Node.js 18+** (LTS recommended)
- A code editor like **Visual Studio Code**
- (Optional) VS Code extensions:
  - ESLint (dbaeumer.vscode-eslint)
  - Prettier (esbenp.prettier-vscode)
  - REST Client (humao.rest-client) – handy for testing endpoints

## Run locally (VS Code)
1. Open the project folder in VS Code.
2. Open a terminal in VS Code.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:3000 in your browser.

## Deploy online (two easy paths)

### A) **Render** (single service, backend serves frontend)
1. Create a new **Web Service** on https://render.com
2. Connect your GitHub repo, set **Build Command** to `npm install` and **Start Command** to `npm start`.
3. Choose **Node 18+** environment. Deploy. Done.

### B) **Railway** (similar to Render)
1. Create a new project at https://railway.app, add your GitHub repo.
2. It auto-detects Node. Set start command to `npm start`. Deploy.

> You can also host just the static `public/` on Netlify/Vercel and the API on Render/Railway, but this single service setup is simplest.

## Project structure
```
yls-shopping-app/
  data/                # lightweight JSON persistence (products, orders, stats)
  public/              # static frontend (vanilla JS)
    index.html
    styles.css
    app.js
  server.js            # Node/Express API + static hosting
  package.json
```

## Notes mapping to design
- **Catalogue & Product** → `/api/products` (filter by category or search)
- **Shopping Cart** → client-side `localStorage`, validated by `/api/validate-cart`
- **Order** → `POST /api/orders` creates a submitted order and reserves inventory
- **Payment (Strategy-ready)** → `POST /api/payments` (mock gateway) transitions order to `PAID` and creates a **TransactionReceipt**
- **Packaging → Shipment** → `POST /api/orders/:id/pack` then `POST /api/orders/:id/ship` (updates **Sales Statistics** only when shipped)
- **Sales Statistics** → `GET /api/stats/sales` sums shipped revenue and top products

This mirrors the responsibilities and lifecycle in your design document.
