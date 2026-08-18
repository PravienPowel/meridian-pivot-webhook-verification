// Used to test the naive receiver (see journal.md, Blocker 1)
const http = require("http");
const crypto = require("crypto");

const SHARED_SECRET = "northstar-super-secret-123";
const payload = { event: "order.shipped", orderId: "ORD-1024" };
const body = JSON.stringify(payload);

const signature = crypto
  .createHmac("sha256", SHARED_SECRET)
  .update(body)
  .digest("hex");

const options = {
  hostname: "localhost",
  port: 3001,
  path: "/webhook",
  method: "POST",
  headers: { "Content-Type": "application/json", "x-signature": signature },
};

const req = http.request(options, (res) => {
  res.on("data", (d) => console.log("Response:", d.toString()));
});

req.write(body);
req.end();
