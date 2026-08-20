// printer-vendor.js
// Stands in for the real badge-printer vendor's API. When you POST to
// /print, it pretends to physically print a badge, taking a couple of
// seconds, then responds with success once it's "done".

const express = require("express");
const app = express();
app.use(express.json());

const PORT = 4100;

app.post("/print", (req, res) => {
  const { attendeeId } = req.body;
  console.log(`Vendor: printing badge for ${attendeeId}...`);

  // Simulate a real printer taking a couple of seconds to physically print.
  setTimeout(() => {
    console.log(`Vendor: badge printed for ${attendeeId}`);
    res.json({ success: true, attendeeId, badgeId: `BADGE-${attendeeId}` });
  }, 2000);
});

app.listen(PORT, () => {
  console.log(`Printer vendor (sync) running on http://localhost:${PORT}`);
});
