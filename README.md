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

## Privacy

The app has no backend or network requests. Salary entries, theme preference, and the imported holiday list are stored in the visitor's browser on that site's origin. Imported Excel files are parsed locally. Anyone can view files committed to a public repository, so do not put salary information or other personal data in the repository.