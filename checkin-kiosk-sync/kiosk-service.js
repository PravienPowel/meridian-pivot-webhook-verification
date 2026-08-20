// kiosk-service.js
// This is the app staff use at the door. Someone scans an attendee's QR
// code, we call it a "checkin" request. This service calls the badge
// printer vendor and WAITS for the print job to finish before telling
// staff the attendee is checked in.

const express = require("express");
const http = require("http");

const app = express();
app.use(express.json());
const PORT = 5100;

// Keeps track of who's already checked in, so scanning the same QR
// code twice doesn't print a second badge.
// Example: { "att-001": "confirmed" }
const checkins = {};

function callPrinterVendor(attendeeId) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ attendeeId });

    const req = http.request(
      {
        hostname: "localhost",
        port: 4100,
        path: "/print",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(JSON.parse(data)));
      }
    );

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

app.post("/checkin", async (req, res) => {
  const { attendeeId } = req.body;

  if (!attendeeId) {
    return res.status(400).json({ error: "attendeeId is required" });
  }

  // Duplicate-scan protection: if this attendee is already checked in,
  // don't print a second badge.
  if (checkins[attendeeId] === "confirmed") {
    console.log(`Duplicate scan for ${attendeeId} - already checked in`);
    return res.status(409).json({
      status: "already-checked-in",
      attendeeId,
    });
  }

  console.log(`Checking in ${attendeeId}, calling printer and waiting...`);

  try {
    // This is the "synchronous" part: we sit here and wait for the
    // vendor's response before doing anything else.
    const printResult = await callPrinterVendor(attendeeId);

    if (printResult.success) {
      checkins[attendeeId] = "confirmed";
      console.log(`${attendeeId} checked in. Badge: ${printResult.badgeId}`);
      return res.json({
        status: "checked-in",
        attendeeId,
        badgeId: printResult.badgeId,
      });
    } else {
      return res.status(502).json({ status: "print-failed", attendeeId });
    }
  } catch (err) {
    console.log("Error calling printer vendor:", err.message);
    return res.status(502).json({ status: "print-failed", attendeeId });
  }
});

app.listen(PORT, () => {
  console.log(`Kiosk service (sync) running on http://localhost:${PORT}`);
});
