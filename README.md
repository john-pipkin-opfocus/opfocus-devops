# OpFocus DevOps

A Claude plugin that lets every OpFocus consultant — admins and developers alike — capture, promote, and track Salesforce changes across client orgs while keeping a clean Bitbucket version history. It replaces change sets: Claude does the git and `sf` CLI heavy lifting under OpFocus guardrails, and the consultant speaks in plain environment terms ("promote my changes from Dev to Partial").

See the design doc for the full architecture.

## Pieces

- **`salesforce/`** — the deployment-tracking backend (custom objects) deployed into `OpFocus_Prod`. This is the shared database every team reads and writes.
- **`skills/`** — the skills Claude runs:
  - `setup-backend` — deploy/verify the tracking objects in `OpFocus_Prod` (run once).
  - (coming) `setup-client-repo` — stand up a client's Bitbucket repo, branches, baseline, and `pipeline.yml`.
  - (coming) `capture-and-promote` — the admin's daily driver.

## Requirements

- Salesforce CLI (`sf`) — installed by the plugin's setup.
- Access to `OpFocus_Prod` (`sf org login web`), aliased `OpFocus_Prod`.
- Per-client org access, authenticated with `sf org login web`, aliased `Client_Env` (e.g. `CRL_Dev`).
