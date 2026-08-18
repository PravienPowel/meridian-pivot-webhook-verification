# Webhook HMAC Verification — Mini Prototype

The Meridian Pivot sprint — Northstar Retail Co.

Simulates a client system sending a webhook, and a server that verifies the
webhook really came from that client using HMAC-SHA256 signatures.

## Files
- `receiver.js` — Express server that verifies incoming webhook signatures
- `sender.js` — sends a correctly-signed, valid webhook
- `sender-tampered.js` — sends a webhook whose payload was changed after
  signing, to prove the receiver correctly rejects it
- `journal.md` — Learning & Blocker Journal
- `naive-attempt/` — an earlier, simpler version used to test an assumption
  (kept for the journal, not part of the final deliverable)

## How to run
```bash
npm install
node receiver.js
```
In a second terminal:
```bash
node sender.js            # should print: 200 Webhook received and verified
node sender-tampered.js   # should print: 401 Invalid signature
```

## How it works
1. Sender builds a JSON payload and hashes it with a shared secret key
   (HMAC-SHA256), producing a signature.
2. Sender sends the payload and signature (in an `x-signature` header)
   together.
3. Receiver reads the raw request bytes (not the parsed/reserialized JSON —
   see journal.md for why), re-computes the signature the same way, and
   compares it safely using `crypto.timingSafeEqual`.
4. Matching signature → payload accepted. Mismatch → rejected with 401.
