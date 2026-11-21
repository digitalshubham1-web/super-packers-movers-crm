# Super Packers and Movers CRM

A CRM for a packers-and-movers business: leads (list and board), follow-up tasks, calendar, WhatsApp inbox, calling lists, quotations, GST invoices, payments, reports, team and settings.

## Stack
React 19, TypeScript, Vite, Tailwind CSS v4, zustand, recharts. It is a static single-page app and deploys to Vercel as is (`vercel.json` rewrites all routes to `index.html`).

## Run locally
```
npm install
npm run dev
```

## Important: this version stores data in the browser
All data is saved in the visitor's own browser (localStorage). There is no server, sign-in or shared team data yet.
WhatsApp, calling, AI agents, email and integrations are complete screens that simulate sending; each says so on the page. They need a backend and the matching accounts (WhatsApp Business API, a telephony provider, a mailbox, an AI model key) to work for real.

Use Settings → Data to export a backup, import one, or reset to the sample data.
