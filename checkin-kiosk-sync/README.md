# Event Check-In Kiosk (Synchronous Version) - DEPRECATED

**This version is deprecated.** The badge printer vendor discontinued
the synchronous print API this was built against. Kept here only as a
reference for what the check-in flow looked like before the pivot -
do not run this in place of the current version.

Current version: `../checkin-kiosk-async`

---

Staff scan an attendee's QR code, the kiosk calls the badge printer and

## Files
- `printer-vendor.js` — stands in for the real badge printer vendor.
  Takes a couple of seconds to "print" then responds with success.
- `kiosk-service.js` — the check-in service. Calls the printer and
  waits for the response before confirming the attendee is checked in.
  Rejects a second scan of someone already checked in.

## How to run
Terminal 1:
```bash
node printer-vendor.js
```
Terminal 2:
```bash
node kiosk-service.js
```

Then check someone in:
```bash
curl -X POST http://localhost:5100/checkin -H "Content-Type: application/json" -d "{\"attendeeId\":\"att-001\"}"
```

Try the same attendee again and you'll get `already-checked-in` instead
of a second badge.

## Limitation
The kiosk sits and waits for the whole print job before responding.
If the printer is slow or the network to it is unreliable, the person
scanning is stuck waiting too, and there's nothing to do about it except
wait longer or fail.
