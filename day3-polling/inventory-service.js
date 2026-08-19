// inventory-service.js
// This is the service Northstar's support tool actually talks to.
// It does NOT ask the warehouse for stock every time someone asks
// "is this in stock?" - that would be slow and hammer the warehouse API.
// Instead, it polls the warehouse every few minutes, keeps a local
// CACHE (just a plain JS object in memory), and answers queries instantly
// from that cache.

const express = require("express");
const http = require("http");

const app = express();
const PORT = 5000;

// The original spec says "poll every 5 minutes". In real production
// this would be 5 * 60 * 1000 = 300000 milliseconds. For local testing
// we let it be overridden with an environment variable so we don't
// have to wait 5 real minutes to see it work.
const POLL_INTERVAL_MS = process.env.POLL_INTERVAL_MS
  ? Number(process.env.POLL_INTERVAL_MS)
  : 5 * 60 * 1000;

// This is our cache. It starts empty until the first poll finishes.
let stockCache = {};
let lastUpdated = null;

function pollWarehouse() {
  console.log(`\nPolling warehouse API... (${new Date().toLocaleTimeString()})`);

  http.get("http://localhost:4000/warehouse/stock", (res) => {
    let rawData = "";
    res.on("data", (chunk) => (rawData += chunk));
    res.on("end", () => {
      try {
        const freshStock = JSON.parse(rawData);
        stockCache = freshStock;
        lastUpdated = new Date();
        console.log("Cache updated:", stockCache);
      } catch (err) {
        console.log("Failed to parse warehouse response:", err.message);
      }
    });
  }).on("error", (err) => {
    console.log("Could not reach warehouse API:", err.message);
  });
}

// Poll once immediately on startup, so the cache isn't empty while we
// wait for the first interval to tick.
pollWarehouse();

// Then keep polling on a timer, forever, every POLL_INTERVAL_MS.
setInterval(pollWarehouse, POLL_INTERVAL_MS);

// This is the query endpoint the support tool calls.
// Example: GET /stock/item-2
app.get("/stock/:itemId", (req, res) => {
  const itemId = req.params.itemId;

  if (!(itemId in stockCache)) {
    return res.status(404).json({ error: "Item not found in cache" });
  }

  res.json({
    itemId,
    quantity: stockCache[itemId],
    lastUpdated,
  });
});

app.listen(PORT, () => {
  console.log(`Inventory service running on http://localhost:${PORT}`);
  console.log(`Polling warehouse every ${POLL_INTERVAL_MS / 1000} seconds`);
});
