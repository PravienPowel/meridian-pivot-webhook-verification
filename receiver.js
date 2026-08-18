// receiver.js
// This is our "Northstar Retail" server. It waits for a webhook
// (a message sent from another service) and checks that the message
// really came from a trusted sender, using HMAC signature verification.

const express = require("express");
const crypto = require("crypto");

const app = express();
const PORT = 3000;

// This secret must be the SAME on both the sender side and receiver side.
// In a real app this would come from an environment variable, not hardcoded.
const SHARED_SECRET = "northstar-super-secret-123";

// IMPORTANT (this was my big blocker, see journal.md):
// We need the RAW body bytes to check the signature, not the parsed JSON.
// If we let express.json() parse it first, re-stringifying it can produce
// a slightly different string than what the sender actually signed,
// and the signature check fails even when everything is correct.
// So we use express.raw() to grab the body exactly as it arrived.
app.use(express.raw({ type: "application/json" }));

app.post("/webhook", (req, res) => {
  const rawBody = req.body; // this is a Buffer of the exact bytes sent
  const signatureFromSender = req.header("x-signature");

  console.log("\n--- New webhook received ---");
  console.log("Raw body:", rawBody.toString());
  console.log("Signature header:", signatureFromSender);

  if (!signatureFromSender) {
    console.log("Rejected: no signature header found.");
    return res.status(400).send("Missing signature");
  }

  // Recompute the signature ourselves, using the same secret and same bytes.
  const expectedSignature = crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(rawBody)
    .digest("hex");

  console.log("Expected signature:", expectedSignature);

  // Compare safely. We use timingSafeEqual instead of "===" because
  // comparing secret-derived strings with === can leak timing info
  // to an attacker. Both strings must be the same length first,
  // or timingSafeEqual will throw an error.
  const sigBuffer = Buffer.from(signatureFromSender, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  const isValid =
    sigBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(sigBuffer, expectedBuffer);

  if (!isValid) {
    console.log("Rejected: signature does not match.");
    return res.status(401).send("Invalid signature");
  }

  // Only now do we trust the payload enough to parse and use it.
  const payload = JSON.parse(rawBody.toString());
  console.log("Accepted! Payload:", payload);

  res.status(200).send("Webhook received and verified");
});

app.listen(PORT, () => {
  console.log(`Receiver listening on http://localhost:${PORT}`);
});
