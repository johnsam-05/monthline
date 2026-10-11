# Monthline

A static monthly salary and leave calculator. It requires no build step, server-side code, database, or account. The Excel workbook parser is bundled locally in `vendor/`, so the application does not depend on a CDN.

## Run locally

Open `index.html` in a browser. For the most reliable browser storage behavior, serve this folder from a local static server such as VS Code Live Server.

## Free hosting with GitHub Pages

1. Create a GitHub repository and add the application files at the repository root: `index.html`, `app.js`, `styles.css`, `vendor/`, and optionally `monthline-holidays-2026.xlsx`.
2. In the repository, open **Settings > Pages**.
3. Select **Deploy from a branch**, choose the `main` branch and `/ (root)`, then save.
4. Wait for the Pages deployment to finish. The site URL appears in the Pages settings, usually as `https://<username>.github.io/<repository>/`.

All page assets use relative paths, so the site works from a GitHub Pages project URL without a base-path edit. The included `.nojekyll` file tells Pages to publish the static files as-is.

## Manage paid holidays

1. Select **Download Excel** to export the currently saved holiday list. The workbook contains a `Holidays` sheet and an `Instructions` sheet.
2. In Excel, edit the `Date` and `Holiday` columns on the `Holidays` sheet. Keep those headers; the `Day` column is for reference.
3. Save the edited workbook as `.xlsx`, then select **Import Excel** and choose the file.
4. Review the date/name preview. **Cancel** keeps the current holiday list. **Replace holiday list** applies the complete imported list to this browser and updates the calendar.

Import is processed locally. It replaces the entire holiday list, not just the changed rows; salary and monthly schedule/leave entries are not replaced.

## Privacy

The app has no backend or network requests. Choose the daily salary divisor that matches your employer's policy: scheduled working days (excluding paid holidays), calendar days, or a fixed 30 days. Salary and paid-leave settings carry across months, while work schedules and calendar entries remain month-specific. All settings, theme preference, and the imported holiday list are stored in browser `localStorage` for that site. Each device and browser profile has its own separate storage; data is not sent to GitHub Pages or synced to another device. Browser or site data clearing removes these saved settings. Imported Excel files are parsed locally and contain holiday dates, not salary information. Anyone can view files committed to a public repository, so do not put salary information or other personal data in the repository.