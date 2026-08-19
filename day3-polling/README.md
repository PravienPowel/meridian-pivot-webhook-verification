# Day 3 — Original Build (Polling Model)

Assignment 2, "before the pivot" version. Meets the ORIGINAL spec:
poll a warehouse API every 5 minutes, cache stock, expose a query endpoint.

**This is the version Day 4's pivot will force us to change.** It's kept
here on purpose so the Scope Delta Analysis (Assignment 2) has something
real to compare the new webhook version against.

## Files
- `warehouse-api.js` — a fake stand-in for Northstar's real warehouse
  system. Returns current stock levels, with small random changes on
  each call to simulate real warehouse activity.
- `inventory-service.js` — the service we're building. Polls the
  warehouse API on a timer, keeps the latest stock in an in-memory
  cache, and exposes `GET /stock/:itemId` so the support tool can look
  up stock instantly without hitting the warehouse directly.

## How to run
Terminal 1:
```bash
node warehouse-api.js
```
Terminal 2:
```bash
node inventory-service.js
```
By default it polls every 5 minutes (`5 * 60 * 1000` ms). For quick local
testing you can override that:
```bash
# Windows CMD
set POLL_INTERVAL_MS=3000 && node inventory-service.js

# PowerShell
$env:POLL_INTERVAL_MS=3000; node inventory-service.js
```

Then query stock:
```bash
curl http://localhost:5000/stock/item-2
```

## Known limitation of this design (relevant for Day 4)
Stock can be up to 5 minutes stale, since the cache only updates on the
poll timer. If stock changes fast (e.g. flash sale), the support tool
could tell a customer "in stock" when it's actually just sold out. This
is exactly the kind of gap a webhook push model (Day 4/5) fixes, since
the warehouse notifies us the instant something changes instead of us
finding out up to 5 minutes later.
