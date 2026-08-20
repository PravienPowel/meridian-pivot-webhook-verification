// printer-vendor-queue.js
// Stands in for the badge printer vendor, but now working the way the
// pivot requires: instead of us calling /print and waiting, we drop a
// job on their "queue" (just an endpoint here) and they get back to us
// LATER by calling our webhook, whenever the badge is actually done.
//
// Confirmations can come back in a different order than jobs were sent -
// a fast job submitted second can finish before a slow job submitted
// first. This file deliberately uses random delays to simulate that,
// so the kiosk side has to genuinely handle out-of-order confirmations,
// not just get lucky with FIFO timing.

const express = require("express");
const http = require("http");
const crypto = require("crypto");

const app = express();
app.use(express.json());
const PORT = 4200;

// Same idea as the webhook verification prototype: a shared secret both
// sides know, used to prove the callback really came from the vendor.
const SHARED_SECRET = "solstice-print-vendor-secret";

// Where we call back to once a badge is "printed".
const KIOSK_WEBHOOK_URL = {
  hostname: "localhost",
  port: 5200,
  path: "/webhook/print-complete",
};

function sendWebhookConfirmation(jobId, attendeeId) {
  const payload = { jobId, attendeeId, status: "completed", badgeId: `BADGE-${attendeeId}` };
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac("sha256", SHARED_SECRET).update(body).digest("hex");

  const req = http.request(
    {
      ...KIOSK_WEBHOOK_URL,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        "x-signature": signature,
      },
    },
    (res) => {
      console.log(`Vendor: webhook for ${jobId} (${attendeeId}) -> kiosk responded ${res.statusCode}`);
    }
  );

  req.on("error", (err) => console.log("Vendor: webhook call failed:", err.message));
  req.write(body);
  req.end();
}

app.post("/queue/print-jobs", (req, res) => {
  const { jobId, attendeeId } = req.body;
  console.log(`Vendor: job ${jobId} queued for ${attendeeId}`);

  // Acknowledge immediately - this is the whole point of the pivot.
  // We are NOT making the kiosk wait for the print to finish.
  res.status(202).json({ accepted: true, jobId });

  // Random delay between 1-6 seconds, so jobs finish out of order.
  const delay = 1000 + Math.floor(Math.random() * 5000);
  setTimeout(() => {
    console.log(`Vendor: badge actually printed for ${attendeeId} (job ${jobId}) after ${delay}ms`);
    sendWebhookConfirmation(jobId, attendeeId);
  }, delay);
});

app.listen(PORT, () => {
  console.log(`Printer vendor (async/queue) running on http://localhost:${PORT}`);
});
