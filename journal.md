# Learning & Blocker Journal — Webhook Verification (HMAC)

**The Meridian Pivot (Northstar Retail Co.)**
**Tool/concept:** Webhook signature verification using HMAC-SHA256
**Language:** JavaScript (Node.js)

## What I was trying to learn
How a receiving server can prove that an incoming webhook actually came
from the sender it claims to be from, and wasn't forged or tampered with
in transit. The mechanism is HMAC (Hash-based Message Authentication Code):
both sides share a secret key, the sender hashes the payload with that
secret, and the receiver re-computes the hash to check it matches.

## Resources consulted
- Node.js `crypto` module docs (`createHmac`, `timingSafeEqual`)
- Stripe's webhook signature verification guide (for the general pattern —
  not copied, used to understand *why* raw body matters)
- Express docs on `express.raw()` vs `express.json()`

## Blocker 1 — Why "just parse it and compare" felt wrong
My first instinct was to let Express parse the incoming JSON normally
(`express.json()`), then `JSON.stringify()` it again to check the signature
against. The concern raised in webhook provider docs (Stripe, GitHub) is
that parsing and re-serializing a JSON body isn't guaranteed to produce
byte-for-byte the same string the sender originally signed — key order,
whitespace, or number formatting could differ depending on the libraries
involved, which would break a signature that was actually valid.

**What I did:** built a small naive version (`naive-attempt/`) to test this
myself instead of taking it on faith.

**Result:** for my simple flat test payload, the re-stringified body
matched perfectly and the signature check passed:
```
Signature from sender: 82ae51dad1e15eec3bec1099bd1116202cf2ccc305840b35be780e53f1857525
Expected signature:    82ae51dad1e15eec3bec1099bd1116202cf2ccc305840b35be780e53f1857525
Match? true
```

**What I learned from that:** the pitfall didn't show up in my toy example
because Node's JSON.stringify preserves key insertion order and I wasn't
introducing any whitespace differences. But that doesn't mean the risk is
fake — it just means it's payload- and pipeline-dependent (nested objects,
extra middleware, different JSON libraries, unicode escaping, gzip, etc.
can all change re-serialized output). Since verifying against the exact
raw bytes removes that risk entirely and costs nothing extra, I kept the
raw-body approach in the real prototype (`receiver.js`) rather than relying
on re-serialization "working out." This matches what real webhook
providers document as best practice, and I now understand *why*, not just
that I should do it.

## Blocker 2 — timingSafeEqual crashed instead of returning false
While reading `crypto.timingSafeEqual` docs, I tested what happens if the
two buffers being compared aren't the same length (e.g. a malformed or
truncated signature header):
```
Error name: RangeError
Error message: Input buffers must have the same byte length
```
It doesn't return `false` — it throws. If I hadn't caught this, a
malformed request could crash the server instead of just being rejected.

**Fix:** check `sigBuffer.length === expectedBuffer.length` first, before
calling `timingSafeEqual`, so a bad/short signature is rejected cleanly
with a 401 instead of throwing.

## Why timingSafeEqual instead of `===` at all
A normal string comparison (`===`) exits as soon as it finds the first
mismatched character. In theory an attacker who can measure tiny response
time differences could exploit that to guess a valid signature one byte
at a time. `timingSafeEqual` always compares every byte, taking the same
amount of time regardless of where the mismatch is, so it doesn't leak
that information.

## Final verification (working prototype)
Ran `receiver.js`, then `sender.js` (valid, correctly-signed payload) and
`sender-tampered.js` (payload changed after signing, same old signature
reused):

- Valid request → `200 Webhook received and verified`
- Tampered request → `401 Invalid signature`

Both matched expectations exactly.

## Time-to-completion
Roughly 1.5–2 hours from reading the first doc to a working, tested
prototype including the deliberate naive-version test.
