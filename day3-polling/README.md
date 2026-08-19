# Inventory Sync (Polling Version)

A small service that keeps track of warehouse stock levels so a support
tool can answer "is this in stock?" without hitting the warehouse system
directly every time.

## Files
- `warehouse-api.js` — stands in for the real warehouse system. Returns
  current stock levels, with small random changes on each call so you
  can actually see numbers moving between polls.
- `inventory-service.js` — polls the warehouse on a timer, keeps the
  latest stock in memory (a simple cache), and exposes
  `GET /stock/:itemId` so stock can be checked instantly instead of
  waiting on a live warehouse lookup.

## How to run
Terminal 1:
node warehouse-api.js

Terminal 2:
node inventory-service.js

Default poll interval is 5 minutes. To test faster locally, override it:
# Windows CMD
set POLL_INTERVAL_MS=3000 && node inventory-service.js

Then query stock:
curl http://localhost:5000/stock/item-2

## Limitation
Stock can be up to 5 minutes out of date, since the cache only updates
when the poll timer fires. If stock changes fast, the cached number can
briefly be wrong.
