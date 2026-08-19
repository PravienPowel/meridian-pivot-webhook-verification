// warehouse-api.js
// This PRETENDS to be Northstar's real warehouse system.
// In real life, this would be an external company's API we don't control.
// It just returns current stock counts for a few items.

const express = require("express");
const app = express();
const PORT = 4000;

// Fake stock data. We change a number every time the server restarts,
// and also nudge it slightly on each request, just so we can SEE the
// poller picking up "fresh" data over time instead of the same value forever.
let stock = {
  "item-1": 42, // e.g. "Blue T-Shirt (M)"
  "item-2": 7,  // e.g. "Wireless Mouse"
  "item-3": 0,  // e.g. "USB-C Cable" - out of stock
};

app.get("/warehouse/stock", (req, res) => {
  // Randomly bump one item's stock up or down a little, to simulate
  // real warehouse activity happening between polls.
  const items = Object.keys(stock);
  const randomItem = items[Math.floor(Math.random() * items.length)];
  const change = Math.random() > 0.5 ? 1 : -1;
  stock[randomItem] = Math.max(0, stock[randomItem] + change);

  console.log("Warehouse API was polled. Current stock:", stock);
  res.json(stock);
});

app.listen(PORT, () => {
  console.log(`Fake warehouse API running on http://localhost:${PORT}`);
});
