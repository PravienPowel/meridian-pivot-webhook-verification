
# Scope Delta Analysis - Check-In Kiosk Pivot

## What changed and why

The badge printer vendor killed their synchronous print API with no
extension. The kiosk had to stop waiting on the printer and instead
fire off a print job and move on, only confirming once the printer
tells us it's actually done.

## Dropped

- The direct, blocking call from the kiosk to the printer (`POST /print`
  and wait for the response). This whole approach doesn't exist anymore
  in the new version - there's no code path left that waits on the
  printer synchronously.
- The assumption that "checked in" can be shown the moment the button
  is pressed. That's gone. It's not possible anymore once printing
  happens in the background.

## Modified

- Attendee state went from two possible values (not checked in /
  checked in) to three (`none` / `pending` / `confirmed`). The extra
  state is the whole reason the pivot needed real changes and not just
  a find-and-replace.
- Duplicate-scan protection had to be rewritten. Before, it only had to
  check "is this person already confirmed?" Now it also has to check
  "is a print job already in flight for this person?" - otherwise
  someone could get scanned twice while their first badge was still
  printing and end up with two jobs queued.
- The check-in endpoint's response changed from `200 checked-in` to
  `202 pending`, since we genuinely don't know the outcome yet at the
  time we respond.

## Added

- A webhook endpoint (`/webhook/print-complete`) that didn't exist
  before. This is now how the kiosk finds out a badge is actually
  done, instead of finding out synchronously.
- HMAC signature verification on the webhook, so we're not just
  trusting that any request hitting that endpoint is really from the
  vendor. Reused the same approach from the first webhook-verification
  prototype (raw body, HMAC-SHA256, timing-safe comparison).
- A job-to-attendee mapping, so a confirmation can be matched back to
  the right attendee no matter what order it arrives in. Without this,
  out-of-order confirmations would have no reliable way to know who
  they belong to.
- An idempotency check on the webhook handler - if a confirmation
  arrives for someone already marked confirmed, it's ignored instead
  of processed again. This covers webhook retries/duplicate deliveries,
  which real systems do.

## Regression check - does duplicate-scan protection still hold?

Yes, tested directly, not assumed:
- Scanning someone while their job is still pending gets rejected
  (`already-pending`), so a second job never gets queued for the same
  person.
- Scanning someone already confirmed gets rejected (`already-checked-in`),
  same as before the pivot.
- Deliberately confirmed two jobs out of order (second job's webhook
  arrived before the first job's) - both attendees still ended up in
  the correct final state, and the one that arrived first didn't
  interfere with the one still pending.
- Sent the exact same webhook confirmation twice for one job, to
  simulate a delivery retry - the second one was correctly ignored
  instead of causing any issue.

## What this cost

The kiosk UI can no longer say "Checked In" the instant staff press the
button - there's a real, if usually short, gap between scan and
confirmation now. That's a genuine trade-off of the async model, not
something that can be avoided while still meeting the vendor's new
requirement.
