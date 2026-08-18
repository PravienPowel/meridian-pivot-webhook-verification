// sender.js
// This pretends to be the warehouse/client system sending Northstar Retail
// a webhook, like "order #123 has shipped". It signs the message with
// HMAC-SHA256 before sending it, so the receiver can verify it's real.

const http = require("http");
const crypto = require("crypto");

// Same secret as receiver.js. In real life this is shared privately
// beforehand, never sent along with the request itself.
const SHARED_SECRET = "northstar-super-secret-123";

// The message we want to send.
const payload = {
  event: "order.shipped",
  orderId: "ORD-1024",
  shippedAt: new Date().toISOString(),
};

// Turn it into a string of bytes exactly once, and reuse that same
// string both for signing AND for sending. If we stringify it twice,
// key order or spacing could differ and break the signature.
const body = JSON.stringify(payload);

// Create the signature: hash the body using our secret key.
const signature = crypto
  .createHmac("sha256", SHARED_SECRET)
  .update(body)
  .digest("hex");

console.log("Sending payload:", body);
console.log("Signature:", signature);

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/webhook",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
    "x-signature": signature,
  },
};

const req = http.request(options, (res) => {
  console.log(`\nReceiver responded with status: ${res.statusCode}`);
  res.on("data", (chunk) => {
    console.log("Response body:", chunk.toString());
  });
});

req.on("error", (err) => {
  console.error("Request failed:", err.message);
});

req.write(body);
req.end();
