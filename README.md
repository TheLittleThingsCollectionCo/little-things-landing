# The Little Things Collection

Coming-soon landing page. GitHub Pages publishes `main` at thelittlethingscollection.com.

## Waitlist status

**NOT OPERATIONAL. Receiver is not deployed; WAITLIST_ENDPOINT is empty.**
The November 7 revision to existing draft PR #6 replaces false-success/local-only capture.
It has not changed the live site. Do not merge until deployment approval and real receipt verification.

### Proposed flow

The site opens a branded Apps Script-hosted signup form in a new tab. The hosted form
uses `google.script.run` rather than an opaque cross-origin fetch. The collector returns a
matching request receipt only after writing and reading back the row. The client checks
both `ok` and `requestId`. A timeout/error says receipt could not be confirmed and allows retry.
No email is stored in localStorage, passed in a URL, returned by a public list API, or emailed automatically.
This changes the signup from an inline field to a button followed by the hosted form.

## Exact proposed setup

A private Sheet was prepared November 7. Its exact link and owner are retained in the private
setup conversation, not this public repository. At creation, permission metadata showed one owner,
`shared: false`, and no anyone/domain grant. Recheck before launch. Keep general access Restricted,
do not publish the spreadsheet to the web, and do not share it with visitors.

| Setting | Value |
| --- | --- |
| Bound project | Open the private Sheet → Extensions → Apps Script |
| Server file | Replace Code.gs with `docs/waitlist-apps-script.gs` |
| HTML file | Add HTML file named `Waitlist`, paste `docs/Waitlist.html` |
| Manifest | Show appsscript.json in project settings; use `docs/appsscript.json` |
| Script timezone | America/New_York; row timestamps are UTC ISO strings |
| OAuth scope | `https://www.googleapis.com/auth/spreadsheets` only |
| Initial setup | Run `setup_` from the editor; this intentionally disables collection |
| Script property SPREADSHEET_ID | Private bound Sheet ID (setup stores this automatically) |
| Script property ENABLED | `false` until public-receiver approval; `true` for approved testing/operation |
| Sheet tab and columns | Waitlist; timestamp, email, source, page, request_id, consent |
| Deployment type | Web app — **requires owner approval before creation** |
| Execute as | Me (the approved Sheet owner) |
| Who has access | Anyone, including signed-out visitors |
| Embedding | Default Google protection; no ALLOWALL |
| Site configuration | WAITLIST_ENDPOINT = approved deployment's exact HTTPS `/exec` URL |
| Daily writes | 200 new rows per UTC day; fails visibly at capacity |
| Total writes | 10,000 data rows, then fails visibly; review capacity before this point |
| Same-address throttle | 60 seconds between new request IDs |
| Form token | Server-issued, expires after 30 minutes; earliest submission after 1.5 seconds |
| Consent | Required unchecked opt-in; stored as launch-notification-v1 |

The spreadsheet scope permits access to the owner's spreadsheets broadly. The implementation
opens only the configured Sheet. Use a dedicated business account if that broader authorization is
unacceptable. A bound web app must use an explicit Sheet ID rather than assume an active spreadsheet.
There are no Drive, Gmail, MailApp, or external-fetch permissions. Helper functions end with `_` so
they cannot be invoked through google.script.run. Never expose OAuth tokens to the page.

## Public endpoint implications and privacy

Anyone can open the form and attempt RPC submissions. The URL is public configuration, not a
password; a token or API key placed in the public website would not make it private. Public
execution runs as the owner. Sheet access remains private, and the receiver exposes no read/list endpoint.
No doPost is exposed in this revision. Arbitrary source/page fields are not accepted; the server uses
fixed values, so query strings, campaign parameters and visitor browsing URLs are not retained.

Honeypot, short-lived token, minimum fill time, locking, same-address throttle and row limits offer
basic abuse resistance. Bots can obtain tokens and consume Apps Script execution quotas, or exhaust
the daily write cap and block genuine visitors. These controls do **not** establish a trusted origin,
IP rate limit, CAPTCHA, email ownership verification or double opt-in. If abuse appears, disable
collection immediately and assess a verified CAPTCHA before increasing limits. Do not call the form
spam-proof. Cache eviction can expire a form early; visitors must then reload and retry.

Emails and consent are personal data. Do not log them, commit them to GitHub, publish Sheet exports,
or share the Sheet publicly. Prefix and text-format submitted email values to prevent formula execution;
if exporting CSV, neutralize spreadsheet formulas again at that export boundary. The public repository
contains setup and code only. Limit account/editor access, use account MFA, and honor deletion requests.
Proposed retention: delete addresses 90 days after the launch notification unless separately opted
into ongoing marketing. The signup consent authorizes a launch notification only. Deduplicate emails
and remove test rows before any eventual mailing. No outgoing mail is part of this deployment.

## Verification gates — record evidence, do not infer success

1. After receiver approval: create/version the web app deployment as above. Verify the Google
   account, permissions and exact deployment URL. Set ENABLED=true for testing.
2. In a signed-out/private browser, open the deployed `/exec` URL, wait at least 1.5 seconds,
   and submit `receipt-test-20261107@example.com` with consent. This reserved-domain address
   is a test record only; no email is sent.
3. Independently read the private Sheet through the authenticated connector. Record the exact
   row number, timestamp, email, request ID and consent, and confirm email is text with no formula.
   Confirm the on-page success matches that request. A browser/network callback alone is not evidence.
4. Test invalid address, missing consent, honeypot, expired token, disabled receiver, write failure,
   retries and timeout. Failed/ambiguous receipt must retain the form and must not claim success.
5. Prepare the exact endpoint change in this **same PR #6**. Preview its signup button through
   the hosted form and verify another uniquely identified row appears. No deployment of the live
   site occurs during preview testing.
6. Obtain separate approval for merging PR #6 / changing the public site. Merge only after the above
   evidence. After Pages publishes, test from the live domain and independently confirm its row.
   Only then report production lead capture operational.

## Current verification record (November 7, before receiver approval)

- Prepared private native Sheet with correct headers; no signup rows.
- Sheet permission and header/format readback completed via authenticated connector.
- Receiver not created/deployed; no deployment ID or `/exec` URL exists in this work.
- Local mock tests cover collector failures, retries and client receipts. They do not verify Google runtime,
  Google authorization, browser integration, quotas, or real Sheet literal-text semantics.
- All 17 local tests passed. A mobile Playwright browser check was attempted but could not start:
  the environment has no Chromium executable. Real signed-out browser verification remains required.
- End-to-end receipt: **NOT VERIFIED**. Production site: **UNCHANGED**.

Run local checks with `node --test tests/waitlist.test.cjs`.

## Disable and recover

Set Script Property ENABLED=false to stop writes immediately. Archive the deployment to stop public
access. Do not roll the website back to the old localStorage form, which falsely claimed success.
Prefer a temporary unavailable message. After code updates, create a new deployment version and
retest its `/exec` URL; the editor's latest source is not necessarily what `/exec` serves.
Never rerun setup_ during operation without intending to disable collection.

## Primary references

- https://developers.google.com/apps-script/guides/html/communication
- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/bound
- https://developers.google.com/apps-script/guides/services/quotas
- https://developers.google.com/apps-script/reference/html/x-frame-options-mode
