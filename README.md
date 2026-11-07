# The Little Things Collection

Coming-soon landing page for The Little Things Collection.

- Custom domain: thelittlethingscollection.com
- Site files are the repository root, for GitHub Pages from `main` `/`.

## Waitlist

The “Notify me” form always saves the address in the visitor’s browser (`localStorage`). When `WAITLIST_ENDPOINT` in `index.html` is set, it also POSTs the signup to a Google Apps Script web app that appends a row to a Google Sheet.

`WAITLIST_ENDPOINT` is intentionally empty in the repo. Until you paste your deployed `/exec` URL, signups stay on the device only and the form still shows the usual thank-you note.

### Apps Script setup

1. Create a Google Sheet.
2. Open **Extensions → Apps Script**, replace the sample code with [`docs/waitlist-apps-script.gs`](docs/waitlist-apps-script.gs), and save.
3. Choose **Deploy → New deployment → Web app**.
4. Execute as **Me**, and set access to **Anyone**.
5. Copy the web app URL (it ends in `/exec`) into `WAITLIST_ENDPOINT` in `index.html`.

The script writes `timestamp`, `email`, `source`, and `page` to a sheet named `Waitlist`, creating that sheet and its header row if needed. A commented `MailApp.sendEmail` line can notify hello@thelittlethingscollection.com. After you change the script, deploy a new version so the `/exec` URL picks it up.
