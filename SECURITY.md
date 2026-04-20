# Security Policy

## Scope

This policy covers **Tile Sensor Card**, a Lovelace custom card distributed via HACS. The card runs entirely in the browser and:

- Reads Home Assistant entity state via the standard Lovelace `hass` object
- Does **not** call external services or issue authenticated HTTP requests on its own
- Does **not** persist credentials, tokens, or user data

Out of scope: Home Assistant core, the HACS frontend, the browser, and any installed Lovelace dashboard YAML.

## Supported Versions

Only the latest published release receives fixes. Check the [Releases page](https://github.com/kayloehmann/Tile-Sensor-Card/releases) for the current version.

## Reporting a Vulnerability

Please report security issues privately via **[GitHub Security Advisories](https://github.com/kayloehmann/Tile-Sensor-Card/security/advisories/new)**.

Do **not** open a regular issue or PR for a suspected vulnerability. A public report gives everyone running a vulnerable dashboard the same head-start as the author.

**Response targets:**
- Acknowledgement within 7 days
- Initial assessment within 14 days
- Fix and coordinated disclosure once a patch is available

## What counts as a vulnerability

- XSS or HTML injection through card configuration or entity attributes
- Unintended exposure of entity data beyond the current user's HA session
- Bundled third-party dependency with a known CVE

## What is out of scope

- Dashboards that expose sensitive entities to users who shouldn't see them — this is a HA permissions/ACL concern, not a card bug
- Behaviour of the underlying Home Assistant frontend or browser
- Issues that require physical access to the user's device

## Hardening recommendations for users

- Keep Home Assistant Core up to date
- Restrict `hass` user permissions via the built-in Users/Areas system
- Pin to a specific release tag in HACS if you want deterministic updates
