# Event Check-In Kiosk (Async / Queue + Webhook Version)

Same check-in kiosk, rebuilt so it doesn't wait for the printer anymore.
A scan publishes a print job to the vendor's queue and immediately
responds "pending". The attendee only flips to "confirmed" once the
vendor's webhook calls us back to say the badge is actually done.
Confirmations can arrive in a different order than jobs were submitted,
and duplicate-scan protection has to hold through all of that.

## Files
- `printer-vendor-queue.js` — stands in for the vendor's new async
  system. Accepts a job on `/queue/print-jobs`, acknowledges it right
  away, then calls back our webhook after a random delay (1-6 seconds)
  once the badge is "done" - the random delay is deliberate, so jobs
  genuinely finish out of order instead of always matching submission
  order.
- `kiosk-service-async.js` — the pivoted kiosk. `/checkin` publishes a
  job and responds immediately with `pending`. `/webhook/print-complete`
  receives the signed confirmation from the vendor, verifies it (same
  HMAC approach as the webhook-verification prototype), and marks the
  attendee confirmed - but only if they aren't already confirmed, so a
  repeated/duplicate webhook delivery doesn't cause problems.

## How to run
Terminal 1:
```bash
node printer-vendor-queue.js
```
Terminal 2:
```bash
node kiosk-service-async.js
```

Check someone in:
```bash
curl -X POST http://localhost:5200/checkin -H "Content-Type: application/json" -d "{\"attendeeId\":\"att-001\"}"
```
This responds immediately with `pending` and a `jobId`. A few seconds
later (once the vendor's random delay finishes), check their status:
```bash
curl http://localhost:5200/status/att-001
```
It should now say `confirmed`.

Try scanning the same attendee again while they're still `pending` -
you'll get `already-pending` instead of a second print job. Try it again
once they're `confirmed` - you'll get `already-checked-in`.

## What changed from the synchronous version
- The kiosk no longer blocks on the printer. It responds instantly and
  the UI would show a pending state instead of "Checked In" right away.
- Duplicate-scan protection now has two states to guard, not one:
  someone can't be re-scanned while pending OR once confirmed.
- The webhook has to be written assuming confirmations can arrive out
  of order and can be delivered more than once, since that's how real
  async/webhook systems behave. Both are handled by tracking each job
  by its own ID and checking current status before applying an update,
  instead of assuming "next confirmation = next job in line".
