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
- **Baseline source**: which environment is the source of truth to seed from (usually Production; for sandbox testing, the lowest env).
- **Promotion path**: the ordered list of environments.
- **Baseline scope**: use `baseline-manifest.xml` in this skill folder (a scoped default); edit per client.

**Pilot example (sandbox-only test):**

- Client: `DevOps Sandbox Pilot`, repo slug: `devops-sandbox-pilot`
- Environments: `Dev` → org `OpFocus_DevOps`, branch `dev`; `Stage` → org `Thrive_Stage`, branch `stage`
- Baseline source: `Dev` (`OpFocus_DevOps`); Promotion path: `[Dev, Stage]`
- Backend org (where records are written): `OpFocus_DevOps` (during testing; `OpFocus_Prod` in production)

## Prerequisites

- `~/.opfocus-devops/bitbucket.json` present and valid (test with `python3 scripts/bb.py repo-exists <anything>`).
- Every environment's `sf` org alias authenticated (`sf org display --target-org <alias>`).
- A local working directory for the clone (ask the user; default `~/opfocus-repos/<slug>`).

## Steps

### 1. Confirm the plan

Echo back the repo slug, environments → branches → orgs, baseline source, and promotion path. **Get an explicit "go" before creating anything** — the next step makes a real repo in Bitbucket.

### 2. Create the Bitbucket repo

```
python3 scripts/bb.py create-repo <slug>
```
Idempotent — reports `exists` if it is already there. Report the repo URL.

### 3. Initialize the local clone

```
git clone "$(python3 scripts/bb.py remote <slug>)" <workdir>
```
(The remote URL carries a short-lived token. For production this moves to a git credential helper; for sandbox testing an embedded token is fine.)

Then **prompt the user for their git identity** (the tool does not assume it) and set it on this repo only:
```
git -C <workdir> config user.name  "<name the user gives>"
git -C <workdir> config user.email "<email the user gives>"
```

Add the `sf` project scaffolding at the repo root: `sfdx-project.json` (sourceApiVersion 67.0, package dir `force-app`), an empty `force-app` directory (retrieve fails if the package dir is missing), and a `.gitignore` excluding `.sf/` and `.sfdx/` (the CLI's local source-tracking state is per-clone and must never be committed).

### 4. Seed the baseline (default namespace only, no static resources)

Retrieve the scoped manifest, keeping only the org's own **default-namespace** metadata. Managed-package (namespaced) components and static resources are excluded via a generated `.forceignore`.

1. **Write `<workdir>/.forceignore` BEFORE retrieving**, so excluded metadata never gets pulled. It excludes three things, and only these:
   - `**/staticresources/**` — static resources are not tracked (can be huge/binary).
   - `**/profiles/**` and `*.profile-meta.xml` — **profiles are never tracked or deployed.** They are impractical in VCS/CI-CD and OpFocus does not deploy them; use permission sets instead (best practice). This nudges consultants toward perm sets.
   - `**/<ns>__*` for each **authoritative** managed-package namespace from `sf package installed list --target-org <alias> --json` (the `SubscriberPackageNamespace` values). Managed metadata is read-only and can't be promoted.
2. Retrieve: `sf project retrieve start --manifest skills/setup-client-repo/baseline-manifest.xml --target-org <baseline-source-alias>` (run from `<workdir>`).
3. Report the final component count.

**Never infer namespaces from file names.** In Salesforce `__` is the namespace separator, but a guessing heuristic produces false positives that collide with the org's own objects — e.g. an org object `Deployment__c` wrongly matches a guessed `Deployment` namespace and gets excluded, silently dropping the org's own work. Always use `sf package installed list` for the authoritative namespace set.

### 5. Create and push the environment branches

Commit the baseline, then create every environment branch from it so all branches start identical to the source of truth:
```
git -C <workdir> checkout -b <baseline-branch>
git -C <workdir> add -A && git -C <workdir> commit -m "Baseline from <baseline source> (<date>)"
# for each other environment branch:
git -C <workdir> branch <branch>
git -C <workdir> push -u "$(python3 scripts/bb.py remote <slug>)" --all
```

### 6. Write pipeline.yml

Write `<workdir>/.opfocus/pipeline.yml` from the inputs, commit, and push:
```yaml
client: <Client name>
environments:
  - name: Dev
    branch: dev
    org: OpFocus_DevOps
  - name: Stage
    branch: stage
    org: Thrive_Stage
    validate_first: true
    test_level: RunLocalTests
promotion_path: [Dev, Stage]
baseline_source: Dev
```

### 7. Enable / confirm source tracking

Source tracking is on by default for sandboxes and is initialized by the baseline retrieve. Confirm with `sf project retrieve preview --target-org <alias>` for each env (expect little or nothing right after baseline).

### 8. Register in the backend

In the backend org, create one `Client_Repo__c` and one `Org_Connection__c` per environment:
```
sf data create record --sobject Client_Repo__c --target-org <backend-alias> \
  --values "Name='<Client>' Bitbucket_Workspace__c='<ws>' Bitbucket_Repo_Slug__c='<slug>' Bitbucket_Repo_URL__c='<html url>' Default_Branch__c='<baseline-branch>' Active__c=true"
# capture the returned Id, then per environment:
sf data create record --sobject Org_Connection__c --target-org <backend-alias> \
  --values "Name='<alias>' Client_Repo__c='<repoId>' Org_Type__c='<type>' Org_Alias__c='<alias>' Branch__c='<branch>' Promotion_Order__c=<n> Source_Tracking_Enabled__c=true"
```

### 9. Report

Summarize: repo URL, branches created, baseline component count, pipeline.yml, and the backend records. Tell the user the repo is ready for `capture-and-promote`.

## Notes

- Steps 2, 5, and 8 create external/persistent state (Bitbucket repo, pushed branches, backend records) — confirm before each on the first run.
- The embedded-token remote is a sandbox convenience; production uses the OAuth consumer via a git credential helper so tokens never land in a URL.
