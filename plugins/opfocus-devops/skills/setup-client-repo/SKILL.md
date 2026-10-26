---
name: setup-client-repo
description: Stand up a new client's Bitbucket repository for Salesforce DevOps — identify the client from its Cloud Coach project, make sure no repo already exists for it, create the repo, build a shared scaffolding root, baseline each environment branch from its own org, write pipeline.yml, enable source tracking, and register the client and its orgs in the backend. One repo per client (per org pipeline), spanning all the client's projects. Run once per client. Use when the user wants to set up / onboard / initialize a client repo, create the Bitbucket repo for a client, or start managing a new client's org with the tool.
---

# Set up a client repo

Run once per client to make the repo the daily `capture-and-promote` skill depends on. Everything is config-driven and each destructive/outbound step is confirmed.

**One repo per client, not per project.** A client's metadata lives in its orgs, and every one of the client's Cloud Coach projects deploys into those same Dev/UAT/Prod orgs — so they must share one source of truth. Two repos for one org pipeline means two competing baselines for the same Production org, drift detection that can't tell which branch is authoritative, and one project silently clobbering another's work on the shared org. The project is a field on each `Deployment__c` (`Project__c`), never a repo boundary, so per-project reporting already works inside one repo. The precise key is **one repo per production org / pipeline**; for almost every client that is one repo per client. Because of this, the repo is **not created until Steps 1–2 confirm the client and prove no repo already exists for it.**

## Inputs

Gather these (ask if not supplied):

- **Cloud Coach project** (or the client **Account**) — this identifies the client. The project ties to the engagement's Opportunity/Account; that Account is the authoritative client identity used to check for an existing repo and is stored on the repo.
- **Client name** and **repo slug** (the Bitbucket repo name) — default the client name from the resolved Account.
- **Environments**: for each, a display **name**, the `sf` org **alias**, and the git **branch**.
- **Package source**: one env whose installed-package list seeds the shared `.forceignore` (a client's environments carry the same managed packages; use Production or the lowest env). There is **no** single "source of truth" baseline — each branch is seeded from its *own* org, because client environments are rarely in sync and clients won't refresh sandboxes for a DevOps setup.
- **Promotion path**: the ordered list of environments.
- **Baseline scope**: use `baseline-manifest.xml` in this skill folder (a scoped default); edit per client — it lists common standard objects explicitly, add/remove as the client needs.

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

### 1. Identify the client (Cloud Coach project → Account)

Establish *which client* this is before touching Bitbucket. Ask for the Cloud Coach project (or the client Account directly) and resolve its Account:

```
# the project links to the engagement's Opportunity (and through it, the Account).
# If the lookup's API name is unknown, describe the object to find it:
#   sf sobject describe --sobject project_cloud__Project__c --target-org <backend-alias> | grep -i account
sf data query --target-org <backend-alias> --json --query \
  "SELECT Id, Name, project_cloud__Opportunity__r.AccountId, project_cloud__Opportunity__r.Account.Name \
   FROM project_cloud__Project__c WHERE Id = '<projectId>'"
```

Capture the **Account Id** and **Account Name**. Confirm with the user: "This is for **<Account Name>**, correct?" The Account Name defaults the client name. (If the project has no Opportunity/Account, ask the user for the client Account directly.)

### 2. Check for an existing repo (guard — before creating anything)

**A client gets at most one repo.** Clients often run several projects at once with different consultants, so another consultant may already have set this client up. Prove there is no repo for this client's org pipeline **before** Step 4 creates anything.

Get each environment's **org Id** (the authoritative pipeline key) and query the backend two ways:

```
# for each environment alias, read its 18-char org Id:
sf org display --target-org <env-alias> --json   # -> .result.id

# (a) by org Id — does any registered org already point at one of these orgs?
sf data query --target-org <backend-alias> --json --query \
  "SELECT Id, Org_Alias__c, Org_Id__c, Client_Repo__r.Name, Client_Repo__r.Bitbucket_Repo_Slug__c, \
          Client_Repo__r.Bitbucket_Repo_URL__c FROM Org_Connection__c \
   WHERE Org_Id__c IN (<comma-separated 'id' values>)"

# (b) by Account — is there already a repo for this client Account?
sf data query --target-org <backend-alias> --json --query \
  "SELECT Id, Name, Bitbucket_Repo_Slug__c, Bitbucket_Repo_URL__c, Active__c \
   FROM Client_Repo__c WHERE Account__c = '<accountId>'"
```

**If either query returns rows → STOP. Do not create a repo.** Report the existing repo (name, slug, URL, and which orgs/branches it already covers) and tell the user: this client already has a repo, and all projects for the client promote through it. Point them to `capture-and-promote` (and, if the new work is a new project, note that the project is chosen per deployment there — no setup needed). The only reason to continue past this point is a genuinely separate org pipeline (e.g. a distinct business-unit org the existing repo does not cover); confirm that explicitly with the user before proceeding.

**If both queries are empty → no repo exists; continue to Step 3.**

### 3. Confirm the plan

Echo back the resolved client Account, repo slug, environments → branches → orgs (with each org's Id), package source, and promotion path. **Get an explicit "go" before creating anything** — the next step makes a real repo in Bitbucket.

### 4. Create the Bitbucket repo

```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/bb.py create-repo <slug>
```
Idempotent — reports `exists` if it is already there. Report the repo URL.

### 5. Initialize the local clone

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

### 6. Build the shared scaffolding root

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

### 7. Baseline each environment branch from its own org

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

### 8. Enable / confirm source tracking

Source tracking is on by default for sandboxes and is initialized by each env's baseline retrieve. Confirm with `sf project retrieve preview --target-org <alias>` for each env (expect little or nothing right after baseline).

### 9. Register in the backend

In the backend org, create one `Client_Repo__c` (linked to the client **Account**) and one `Org_Connection__c` per environment (with each org's **Org Id**, so the existing-repo guard can find this pipeline next time):
```
sf data create record --sobject Client_Repo__c --target-org <backend-alias> \
  --values "Name='<Client>' Account__c='<accountId>' Bitbucket_Workspace__c='<ws>' Bitbucket_Repo_Slug__c='<slug>' Bitbucket_Repo_URL__c='<html url>' Default_Branch__c='<lowest-env-branch>' Active__c=true"
# capture the returned Id, then per environment:
sf data create record --sobject Org_Connection__c --target-org <backend-alias> \
  --values "Name='<alias>' Client_Repo__c='<repoId>' Org_Id__c='<org 18-char id>' Org_Type__c='<type>' Org_Alias__c='<alias>' Branch__c='<branch>' Promotion_Order__c=<n> Source_Tracking_Enabled__c=true"
```

### 10. Report

Summarize: client Account, repo URL, the `main` root plus each environment branch and its component count (so the drift between envs is visible), pipeline.yml, and the backend records (Client_Repo linked to the Account, each Org_Connection with its org Id). Tell the user the repo is ready for `capture-and-promote`.

## Notes

- Step 2 is a hard gate: a client gets **one** repo per org pipeline. Never create a second repo for a client whose orgs are already registered — reuse the existing one and promote through it.
- Steps 4, 7, and 9 create external/persistent state (Bitbucket repo, pushed branches, backend records) — confirm before each on the first run.
- The embedded-token remote is a sandbox convenience; production uses the OAuth consumer via a git credential helper so tokens never land in a URL.
