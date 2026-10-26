---
name: setup-client-repo
description: Stand up a new client's Bitbucket repository for Salesforce DevOps — create the repo, create environment branches, seed a scoped baseline from the source-of-truth org, write pipeline.yml, enable source tracking, and register the client and its orgs in the backend. Run once per client. Use when the user wants to set up / onboard / initialize a client repo, create the Bitbucket repo for a client, or start managing a new client's org with the tool.
---

# Set up a client repo

Run once per client to make the repo the daily `capture-and-promote` skill depends on. Everything is config-driven and each destructive/outbound step is confirmed.

## Inputs

Gather these (ask if not supplied):

- **Client name** and **repo slug** (the Bitbucket repo name).
- **Environments**: for each, a display **name**, the `sf` org **alias**, and the git **branch**.
- **Package source**: one env whose installed-package list seeds the shared `.forceignore` (a client's environments carry the same managed packages; use Production or the lowest env). There is **no** single "source of truth" baseline — each branch is seeded from its *own* org, because client environments are rarely in sync and clients won't refresh sandboxes for a DevOps setup.
- **Promotion path**: the ordered list of environments.
- **Baseline scope**: use `baseline-manifest.xml` in this skill folder (a scoped default); edit per client.

**Pilot example (sandbox-only test):**

- Client: `DevOps Sandbox Pilot`, repo slug: `devops-sandbox-pilot`
- Environments: `Dev` → org `OpFocus_DevOps`, branch `dev`; `Stage` → org `Thrive_Stage`, branch `stage`
- Baseline source: `Dev` (`OpFocus_DevOps`); Promotion path: `[Dev, Stage]`
- Backend org (where records are written): `OpFocus_DevOps` (during testing; `OpFocus_Prod` in production)

## Prerequisites

- `~/.opfocus-devops/bitbucket.json` present and valid (test with `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bb.py repo-exists <anything>`).
- Every environment's `sf` org alias authenticated (`sf org display --target-org <alias>`).
- A local working directory for the clone (ask the user; default `~/opfocus-repos/<slug>`).

## Steps

### 1. Confirm the plan

Echo back the repo slug, environments → branches → orgs, baseline source, and promotion path. **Get an explicit "go" before creating anything** — the next step makes a real repo in Bitbucket.

### 2. Create the Bitbucket repo

```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bb.py create-repo <slug>
```
Idempotent — reports `exists` if it is already there. Report the repo URL.

### 3. Initialize the local clone

```
git clone "$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bb.py remote <slug>)" <workdir>
```
(The remote URL carries a short-lived token. For production this moves to a git credential helper; for sandbox testing an embedded token is fine.)

Then **prompt the user for their git identity** (the tool does not assume it) and set it on this repo only:
```
git -C <workdir> config user.name  "<name the user gives>"
git -C <workdir> config user.email "<email the user gives>"
```

The scaffolding and metadata are built in the next two steps.

### 4. Build the shared scaffolding root

Do **not** baseline from one org and copy the branches — a client's Dev, UAT, and Prod are rarely in sync, and clients won't refresh sandboxes just for a DevOps setup. Give every branch a shared **scaffolding root**, then baseline each branch from its own org. The shared root keeps the branches from being "unrelated histories"; the per-org baselines capture each environment as-is.

Write the scaffolding at the repo root (no metadata yet):
- `sfdx-project.json` (sourceApiVersion 67.0, package dir `force-app`) and `force-app/main/default/.gitkeep` — the retrieve fails if the package dir is missing, and git does not track empty directories, so the `.gitkeep` keeps the dir present on every branch cut from the root.
- `.gitignore` excluding `.sf/` and `.sfdx/` (per-clone CLI state, never committed).
- `.forceignore` (written **before** any retrieve) excluding exactly: `**/staticresources/**`; `**/profiles/**` and `*.profile-meta.xml` (profiles are never tracked — use permission sets); and `**/<ns>__*` for each managed-package namespace from `sf package installed list --target-org <package-source> --json` (the authoritative `SubscriberPackageNamespace` values). **Never guess namespaces from file names** — a guess collides with the org's own objects (e.g. excluding the org's own `Deployment__c`).
- `.opfocus/pipeline.yml` from the inputs, with `require_approval: true` on the environments that need review:
```yaml
client: <Client name>
environments:
  - { name: Dev,  branch: dev,  org: <dev-alias> }
  - { name: UAT,  branch: uat,  org: <uat-alias>,  validate_first: true, test_level: RunLocalTests }
  - { name: Prod, branch: prod, org: <prod-alias>, require_approval: true, test_level: RunLocalTests }
promotion_path: [Dev, UAT, Prod]
```

Commit this as the root on `main` and capture its SHA — every environment branch is cut from it:
```
git -C <workdir> checkout -b main
git -C <workdir> add -A && git -C <workdir> commit -m "Scaffolding root (<date>)"
ROOT=$(git -C <workdir> rev-parse HEAD)
```

### 5. Baseline each environment branch from its own org

For each environment, branch from the **root** and retrieve **that org's** actual metadata. Cutting a fresh branch from the root empties `force-app` back to the scaffolding, so each retrieve starts clean and no branch leaks metadata into another:
```
# for each environment, in promotion order:
git -C <workdir> checkout -B <branch> "$ROOT"
sf project retrieve start --manifest ${CLAUDE_PLUGIN_ROOT}/skills/setup-client-repo/baseline-manifest.xml --target-org <env-alias>
git -C <workdir> add -A && git -C <workdir> commit -m "Baseline <Env> from <env-alias> (<date>)"
# after all envs are committed, push everything including main:
git -C <workdir> push -u "$(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bb.py remote <slug>)" --all
```

Report the component count per branch. The result: all branches share the `main` root (no "unrelated histories"), each holds its own org's current state, and the drift between them is captured honestly — never reconciled on day one. Because promotes move only the selected components (a per-promotion branch cut from the target), that drift never becomes a merge conflict; and where a promoted component also differs in the target org, the drift check in `capture-and-promote` resolves it per component.

### 6. Enable / confirm source tracking

Source tracking is on by default for sandboxes and is initialized by each env's baseline retrieve. Confirm with `sf project retrieve preview --target-org <alias>` for each env (expect little or nothing right after baseline).

### 7. Register in the backend

In the backend org, create one `Client_Repo__c` and one `Org_Connection__c` per environment:
```
sf data create record --sobject Client_Repo__c --target-org <backend-alias> \
  --values "Name='<Client>' Bitbucket_Workspace__c='<ws>' Bitbucket_Repo_Slug__c='<slug>' Bitbucket_Repo_URL__c='<html url>' Default_Branch__c='<lowest-env-branch>' Active__c=true"
# capture the returned Id, then per environment:
sf data create record --sobject Org_Connection__c --target-org <backend-alias> \
  --values "Name='<alias>' Client_Repo__c='<repoId>' Org_Type__c='<type>' Org_Alias__c='<alias>' Branch__c='<branch>' Promotion_Order__c=<n> Source_Tracking_Enabled__c=true"
```

### 8. Report

Summarize: repo URL, the `main` root plus each environment branch and its component count (so the drift between envs is visible), pipeline.yml, and the backend records. Tell the user the repo is ready for `capture-and-promote`.

## Notes

- Steps 2, 5, and 7 create external/persistent state (Bitbucket repo, pushed branches, backend records) — confirm before each on the first run.
- The embedded-token remote is a sandbox convenience; production uses the OAuth consumer via a git credential helper so tokens never land in a URL.
