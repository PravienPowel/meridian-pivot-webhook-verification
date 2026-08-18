// sender-tampered.js
// Same as sender.js, but simulates an attacker (or a bug) changing the
// payload AFTER it was signed. The receiver should reject this.

const http = require("http");
const crypto = require("crypto");

const SHARED_SECRET = "northstar-super-secret-123";

const originalPayload = {
  event: "order.shipped",
  orderId: "ORD-1024",
  shippedAt: new Date().toISOString(),
};

const originalBody = JSON.stringify(originalPayload);

// Sign the ORIGINAL body...
const signature = crypto
  .createHmac("sha256", SHARED_SECRET)
  .update(originalBody)
  .digest("hex");

// ...but then sneakily change the order ID before sending.
// This mimics tampering in transit.
const tamperedPayload = { ...originalPayload, orderId: "ORD-9999" };
const tamperedBody = JSON.stringify(tamperedPayload);

console.log("Original (signed) body:", originalBody);
console.log("Tampered body actually sent:", tamperedBody);
console.log("Signature (still from the original body):", signature);

const options = {
  hostname: "localhost",
  port: 3000,
  path: "/webhook",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(tamperedBody),
    "x-signature": signature,
  },
};

const req = http.request(options, (res) => {
  console.log(`\nReceiver responded with status: ${res.statusCode}`);
  res.on("data", (chunk) => {
    console.log("Response body:", chunk.toString());
  });
});

req.write(tamperedBody);
req.end();
