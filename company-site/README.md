# Potterwell Company Site

Static source for [potterwell.com](https://potterwell.com/).

## Publishing

Upload the contents of this directory, including `.htaccess` and `.well-known`, to the `potterwell.com/public_html` directory in SiteGround. Keep the Nine Below application and API on `ninebelow.potterwell.com`; do not place application secrets or runtime data in this static site.

## Security and SEO

- No third-party scripts, analytics, cookies, or remote fonts.
- Apache security headers, compression, caching, directory-index protection, and a custom 404 page.
- Canonical metadata, Open Graph metadata, JSON-LD organization data, `robots.txt`, and `sitemap.xml`.
- The Content Security Policy contains the SHA-256 hash of the homepage JSON-LD block. Recompute the hash if that block changes.
