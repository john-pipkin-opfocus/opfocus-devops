# OpFocus DevOps

A Claude Code plugin that lets every OpFocus consultant — admins and developers alike — capture, promote, and track Salesforce changes across client orgs while keeping a clean Bitbucket version history. It replaces change sets: Claude does the git and `sf` CLI heavy lifting under OpFocus guardrails, and the consultant speaks in plain environment terms ("promote my changes from Dev to Partial").

## Install

The plugin is distributed from a **public GitHub repo** (it holds no secrets — the Bitbucket OAuth secret lives only in the prod-org Named Credential), so there's nothing to authenticate and consultants don't need any repo account.

**In the Claude desktop app (Code tab):** click the **+** next to the prompt box → **Add plugins** → paste the marketplace URL below → **Sync**, then install **opfocus-devops**.

**Or from the terminal / VS Code** — in a Claude Code session:

```
/plugin marketplace add https://github.com/john-pipkin-opfocus/opfocus-devops.git
/plugin install opfocus-devops@opfocus-marketplace
```

(Shell equivalent: `claude plugin install opfocus-devops --marketplace https://github.com/john-pipkin-opfocus/opfocus-devops.git`.)

Access to the private **client code repos** is handled separately, at runtime, by the token broker — not by any per-consultant Bitbucket credential. This GitHub repo is the public **distribution** mirror; active development lives in the private Bitbucket repo.

> Plugins don't load in cloud sessions (`claude.ai/code`) or under WSL — use a local desktop-app, terminal, or VS Code session.

The three skills then become available — invoke them by asking in plain language, or directly as `/opfocus-devops:<skill>`.

### Updating

On a new release the maintainer bumps `version` in `.claude-plugin/plugin.json`. Consultants pick it up with:
```
/plugin marketplace update opfocus-marketplace
/plugin install opfocus-devops@opfocus-marketplace
```

## Skills

- **`setup-backend`** — deploy/verify the tracking objects + permission set in `OpFocus_Prod` (run once, by an admin).
- **`setup-client-repo`** — stand up a client's Bitbucket repo, branches, scoped baseline, `pipeline.yml`, and backend records (run once per client).
- **`capture-and-promote`** — the daily driver: detect changes with source tracking, review them (with line diffs) in the selector UI, promote the chosen set, validate, deploy, and record it.

## Layout

- **`salesforce/`** — the deployment-tracking backend (four custom objects + `OpFocus_DevOps_User` permission set), deployed into `OpFocus_Prod`. The shared database every team reads and writes.
- **`scripts/bb.py`** — Bitbucket helper (client-credentials token, repo create, authenticated git remote).
- **`ui/change-selector/`** — the SLDS review-and-select UI the promote flow serves locally.
- **`skills/`** — the three skills above.

## Per-consultant prerequisites

- **Salesforce CLI (`sf`)** installed.
- **Org access** authenticated with `sf org login web`: `OpFocus_Prod`, and each client org aliased `Client_Env` (e.g. `CRL_Dev`).
- **`~/.opfocus-devops/bitbucket.json`** — the OAuth-consumer credentials the tool uses to create/push client repos:
  ```json
  { "workspace": "opfocusdevtem", "project": "CO", "key": "<KEY>", "secret": "<SECRET>" }
  ```
  (The consumer is created once in Bitbucket workspace settings; ask an admin for the key/secret.)
