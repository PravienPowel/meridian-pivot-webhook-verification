const express = require("express");
const crypto = require("crypto");
const app = express();
const SHARED_SECRET = "northstar-super-secret-123";

app.use(express.json()); // parses body into a JS object right away

app.post("/webhook", (req, res) => {
  const bodyAsString = JSON.stringify(req.body); // re-stringify to check signature
  const signatureFromSender = req.header("x-signature");

  const expectedSignature = crypto
    .createHmac("sha256", SHARED_SECRET)
    .update(bodyAsString)
    .digest("hex");

  console.log("Signature from sender:", signatureFromSender);
  console.log("Expected signature:   ", expectedSignature);
  console.log("Match?", signatureFromSender === expectedSignature);

  res.send("checked");
});

app.listen(3001, () => console.log("Naive receiver on 3001"));
