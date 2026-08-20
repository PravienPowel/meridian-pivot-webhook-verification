// kiosk-service-async.js
// The pivoted version. A scan no longer waits for the printer - it
// publishes a print job to the vendor's queue and immediately responds
// "pending". The attendee only becomes "confirmed" once the vendor's
// webhook calls us back to say the badge is actually done.
//
// Because confirmations can arrive out of order (see printer-vendor-queue.js),
// this has to be written so a late confirmation for an old job can't
// mess up a newer one, and a duplicate/repeated confirmation for the
// same job doesn't cause problems either.

const express = require("express");
const http = require("http");
const crypto = require("crypto");

const app = express();
const PORT = 5200;

const SHARED_SECRET = "solstice-print-vendor-secret";

// Attendee state: "none" | "pending" | "confirmed"
// Example: { "att-001": "confirmed" }
const attendeeStatus = {};

// Maps a jobId back to which attendee it belongs to, so when a webhook
// confirmation arrives (identified by jobId), we know who to update -
// even if confirmations arrive in a completely different order than
// the jobs were submitted in.
// Example: { "job-abc123": "att-001" }
const jobToAttendee = {};

let jobCounter = 0;
function makeJobId() {
  jobCounter += 1;
  return `job-${Date.now()}-${jobCounter}`;
}

function publishPrintJob(jobId, attendeeId) {
  const body = JSON.stringify({ jobId, attendeeId });
  const req = http.request(
    {
      hostname: "localhost",
      port: 4200,
      path: "/queue/print-jobs",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    },
    (res) => {
      console.log(`Kiosk: queue accepted job ${jobId} with status ${res.statusCode}`);
    }
  );
  req.on("error", (err) => console.log("Kiosk: failed to publish job:", err.message));
  req.write(body);
  req.end();
}

// --- Route 1: scanning an attendee's QR code ---
app.use("/checkin", express.json());
app.post("/checkin", (req, res) => {
  const { attendeeId } = req.body;

  if (!attendeeId) {
    return res.status(400).json({ error: "attendeeId is required" });
  }

  const currentStatus = attendeeStatus[attendeeId] || "none";

  // Duplicate-scan protection now has to cover TWO cases, not just one:
  // already fully checked in, OR already has a print job in flight that
  // we're still waiting to hear back about.
  if (currentStatus === "confirmed") {
    console.log(`Duplicate scan for ${attendeeId} - already checked in`);
    return res.status(409).json({ status: "already-checked-in", attendeeId });
  }

  if (currentStatus === "pending") {
    console.log(`Duplicate scan for ${attendeeId} - print already in progress`);
    return res.status(409).json({ status: "already-pending", attendeeId });
  }

  // New attendee: mark pending immediately, then fire off the job and
  // respond right away. We do NOT wait for the vendor here.
  const jobId = makeJobId();
  attendeeStatus[attendeeId] = "pending";
  jobToAttendee[jobId] = attendeeId;

  console.log(`Checking in ${attendeeId}: queued job ${jobId}, now pending`);
  publishPrintJob(jobId, attendeeId);

  return res.status(202).json({ status: "pending", attendeeId, jobId });
});

// --- Route 2: our webhook, the vendor calls this when a badge is done ---
// Uses raw body (not pre-parsed JSON) so the signature check is against
// the exact bytes the vendor signed, same lesson as the earlier
// webhook-verification prototype.
app.post(
  "/webhook/print-complete",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const rawBody = req.body;
    const signature = req.header("x-signature");

    if (!signature) {
      return res.status(400).send("Missing signature");
    }

    const expectedSignature = crypto
      .createHmac("sha256", SHARED_SECRET)
      .update(rawBody)
      .digest("hex");

    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const validSignature =
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (!validSignature) {
      console.log("Webhook: rejected, bad signature");
      return res.status(401).send("Invalid signature");
    }

    const payload = JSON.parse(rawBody.toString());
    const { jobId, attendeeId, badgeId } = payload;
    const knownAttendee = jobToAttendee[jobId];

    if (!knownAttendee) {
      // We don't recognise this job at all - ignore it rather than crash.
      console.log(`Webhook: unknown job ${jobId}, ignoring`);
      return res.status(200).send("Unknown job, ignored");
    }

    // Idempotency check: if we've already confirmed this attendee
    // (maybe this webhook got delivered twice, which real webhook
    // systems do sometimes), don't do anything weird - just acknowledge
    // and move on. This is what keeps duplicate-scan protection solid
    // even with out-of-order / repeated confirmations.
    if (attendeeStatus[knownAttendee] === "confirmed") {
      console.log(`Webhook: ${knownAttendee} already confirmed, ignoring repeat for job ${jobId}`);
      return res.status(200).send("Already confirmed, ignored");
    }

    attendeeStatus[knownAttendee] = "confirmed";
    console.log(`Webhook: ${knownAttendee} confirmed via job ${jobId}, badge ${badgeId}`);
    return res.status(200).send("Confirmed");
  }
);

// --- Route 3: just so we can check status while testing ---
app.get("/status/:attendeeId", (req, res) => {
  res.json({
    attendeeId: req.params.attendeeId,
    status: attendeeStatus[req.params.attendeeId] || "none",
  });
});

app.listen(PORT, () => {
  console.log(`Kiosk service (async/pivoted) running on http://localhost:${PORT}`);
});
