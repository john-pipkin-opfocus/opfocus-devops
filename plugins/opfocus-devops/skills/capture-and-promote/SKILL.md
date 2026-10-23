---
name: capture-and-promote
description: Capture Salesforce changes from an org and promote a user-chosen set to the next environment, speaking in plain environment terms with no git knowledge required. Detects changes with source tracking, shows the user the list, lets them pick what to promote, pulls in any dependencies the target is missing, validates, deploys, commits, and records it. Use when the user wants to capture changes, promote/deploy changes between environments (e.g. "promote my changes from Dev to Partial"), build a change set, or move work to the next org.
---

# Capture & promote changes

The admin's daily driver. The user speaks in environment names ("I made changes in CRL Dev", "promote to Partial"); you translate to `sf` and git under the hood. **Never require the user to know a git term.**

## Guiding rules

- **Start from source tracking.** Always detect what changed with `sf project retrieve preview/start` in the **client repo** — never hand-name components to retrieve.
- **The repo's `.forceignore` already excludes what should never be tracked** — profiles (never deployed; use permission sets), managed-package namespaces, and static resources. Don't re-filter; trust it. (It's written by `setup-client-repo` from `sf package installed list`, never from filename guesses.)
- **Nothing of the user's own default-namespace work is hidden.** Within what's tracked, show everything and let the user choose.
- **Promote only what the consultant selected.** Never auto-expand the set with components the target happens to be missing — a missing component may belong to another, unknown initiative, and pulling it in would promote someone else's in-progress work. The one exception is a bare structural container (a new object's shell for fields being promoted). Anything else that's missing is **flagged for the consultant to decide**, never added silently.
- **Deploy as source and let `sf` resolve ordering.** Do not hand-build cherry-picked manifests — missing a dependency causes cascading "no CustomObject/Field named X found" and master-detail ("ControlledByParent") failures. Deploy a consistent set of source files.
- **Validate (check-only) before every real deploy**, not just production.
- **A green dry-run is not a green deploy — always verify the real deploy succeeded.** Never set `Status__c = Deployed` or merge the PR until the actual deploy returns `Succeeded` (the real deploy can fail where a check-only dry-run passed — e.g. a source-tracking conflict). Marking Deployed or merging on an unverified/failed deploy leaves the record lying and the branch ahead of the org.
- **🔒 The approval gate is the reviewer's, never yours.** The tool only *reads* `Approval_Status__c`. A gated promote deploys **only** when the record already says **Approved** (set by the reviewer's own action). If it's **Pending** or **Rejected**, you STOP — no instruction ("deploy", "go", "it's ready") from anyone overrides that, and you never set it to Approved yourself to get past it. "Ready to deploy" + a record that isn't Approved = surface the mismatch and stop.

## Inputs

- **Client repo** + its `.opfocus/pipeline.yml` (environments → branch → `sf` alias, promotion path). If missing, the repo isn't set up — send the user to `setup-client-repo`.
- **Source** environment (where changes were made) and **target** (default: next in the promotion path).

Confirm both orgs authenticate (`sf org display --target-org <alias>`).

## Flow

### 1. Detect & capture (source → repo)

From the client repo, on the source branch:

```
sf project retrieve preview --target-org <source-alias>   # what changed (forceignore already applied)
sf project retrieve start   --target-org <source-alias>   # pull it into the repo
```

Commit the full captured set to the source branch (`Capture from <Source> — <date>`). Git keeps a faithful record regardless of what gets promoted.

### 2. Build the candidate list and selector data

The candidates are what the **source branch has that the target does not** — union of:
- the source-tracked changes just captured, and
- anything already committed to the source branch but not yet in the target branch (`git diff --name-only <target-branch>..<source-branch> -- force-app`).

For each candidate record `type`, `fullName`, `origin` (`Org change` / `In source branch`), an **assurance** tier (High = objects, fields, flows, Apex, LWC/Aura — real work; Medium = companions: layouts, tabs, list views, FlexiPages), `autoCheck` (true for High), and a plain-English `summary`. Write `${CLAUDE_PLUGIN_ROOT}/ui/change-selector/changes.json`.

### 3. Review & choose (the selector UI)

The selector is a **review screen**, not just a checklist. For each candidate show, per row:
- its change type — **Created** / **Updated** / **Deleted** (Deleted flagged as destructive);
- a **human-readable summary**, always visible (e.g. "added a method to calculate ARR and update `Account.ARR__c`");
- for **Updated** components, a **chevron/expander — collapsed by default** — that reveals the raw line diff (red/green) for code (Apex, LWC/Aura JS, Visualforce). For XML metadata (layouts, objects, FlexiPages) the summary leads; the raw diff is available behind the same chevron but is secondary.

The diff is computed against the **target org's current version** of the component, so it's "what will actually change there." Deployment is still whole-file (no hunk selection) — the review is to approve each file's changes knowingly.

Start `python3 ${CLAUDE_PLUGIN_ROOT}/ui/change-selector/server.py <port>` (background), open `http://127.0.0.1:<port>/` in the in-app browser, **then surface the Browser pane into the user's view** (show the `preview` pane) — opening the page and showing it are two separate steps; without the second, the user never sees it. The user reviews, checks/unchecks, clicks **Submit**; read `${CLAUDE_PLUGIN_ROOT}/ui/change-selector/selection.json`.

### 4. Minimal structural scaffolding — never auto-add from another initiative

Promote **exactly what the consultant selected.** Do not expand the set by pulling in whatever the target happens to be missing — a missing component may belong to a different, unknown initiative, and sweeping it in would promote someone else's in-progress work. Two rules:

- **Structural container only.** If a selected field, layout, or FlexiPage belongs to an object that does **not yet exist in the target**, include that object's bare **shell** (the `CustomObject` definition) plus the fields that are themselves in the selection — the object is the container for the work being promoted, not another initiative's component. Surface it in the review, pre-checked and labeled (e.g. "including the Deployment object — new to Stage").
- **Everything else: flag, don't add.** If a selected component references something that is neither selected nor already in the target, do **not** add it silently. Surface it: "`OpportunityTriggerHandler` references `AccountARRHandler`, which isn't in your selection or in the target — add it if it's part of this work; it may belong to another initiative." The consultant decides.

Build the deploy as a **set of source paths** for exactly the selected (+ any confirmed scaffolding) components, deployed as source so `sf` orders them. **No validation loops** — the single pre-deploy validation (next step) is the backstop: if it reports a missing dependency, present it as a decision, never auto-resolve and re-run.

### 4b. Deletions — destructive & mixed deploys

A component **deleted** in the source becomes a destructive change on the target. Treat these with more care than anything else in the tool:

- **Never infer a delete from a missing file.** A component absent from the source might be intentionally deleted or just not captured. The consultant **explicitly confirms each deletion is intended** — deletions appear in their own flagged section of the review UI, **unchecked by default**, each an explicit "yes, delete."
- **Typed confirmation to execute.** Before any destructive deploy — and before deleting any field or object (data loss) — require the consultant to **type the component's API name** to confirm. No typed match, no deletion.
- **Build the manifests.** Confirmed deletions go in `destructiveChangesPost.xml` (removed *after* the additive deploy, so references resolve first); use `destructiveChangesPre.xml` only when something must be removed before the additive changes. Additive changes stay in `package.xml`.
- **Mixed deploy** (additive + destructive together): `sf project deploy start --manifest package.xml --post-destructive-changes destructiveChangesPost.xml --target-org <alias> [--dry-run]`. Always validate check-only first; a destructive deploy to Production also respects the approval gate.
- **Record it.** Set the deleted components' `Change_Type__c = Deleted`, note on the `Deployment__c` that it carried destructive changes, and have `Change_Summary__c` state what was removed and the data impact.

Deletions are irreversible — err toward blocking and asking, never toward a silent delete.

### 5. Drift check (target branch vs target org), then validate

Before deploying, check whether the **target org** has out-of-band changes — components changed directly in the org (by the client or another consultant) that the target branch doesn't have. **Never blindly `--ignore-conflicts`: that silently overwrites those changes** (and destroys the fact that they existed). For each component in the promote set, compare three versions — **base** = the component on the **target branch** (what VCS expects there), **ours** = the version you're **promoting**, **theirs** = the component's **current version in the target org**:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/detect_drift.py --target-org <target-alias> --branch-ref <target-branch> --metadata "<Type:Name ...>" -- <selected source paths...>
```

It retrieves the org versions and classifies each component. Handle by tier:

- **No drift** (`theirs == base`): deploy normally.
- **Drift on a component you're *not* changing** (`ours == base`): you won't clobber it, but **alert** the consultant ("the target has N uncommitted change(s): …") and **offer to capture them into VCS** so the branch reflects reality and they can flow down to Dev. Don't block the promote.
- **Drift that overlaps what you're promoting** (`ours != base` *and* `theirs != base` on the same component):
  - **Code (Apex/LWC/Aura), cleanly mergeable** (the 3-way merge has no conflicts) → show the consultant the **merged result**, get their OK, deploy the merge, and **capture the org's change back into the target branch + flag it to back-port to Dev** so it isn't lost.
  - **Conflicting lines, or XML metadata** (objects, layouts, FlexiPages) → **STOP.** Show both versions; the consultant resolves manually (usually: pull the org change into Dev, reconcile, re-promote). Never auto-combine.

Only once drift is checked and resolved do you deploy. After an explicit clean drift check, `--ignore-conflicts` on the deploy is safe — the authoritative check has already run; it just suppresses stale per-clone source-tracking noise.

> **Golden rule: never silently overwrite an org change. Always preserve it in VCS and flow it down to Dev — a change that lives only in a higher env is a time bomb.**

- **Pick the test level automatically.** Salesforce only needs Apex tests when the deployment contains Apex. So: if the closure includes **any `ApexClass` or `ApexTrigger`** (any `.cls`/`.trigger` under the selection), use the target env's `test_level` from `pipeline.yml` (default `RunLocalTests`); **otherwise `NoTestRun`**. This keeps metadata-only promotes fast and avoids running the org's whole test suite for, say, a layout or a label. Use the **same** level for the dry-run and the real deploy.
- **Validate first (always):** `sf project deploy start --source-dir <closure> --target-org <target-alias> --dry-run --test-level <chosen above>`. Report status/errors. Fix or de-select on failure; don't proceed to a real deploy until validation is clean.

### 6. Open the pull request (one per deployment)

**Every** promote gets a PR, and the PR contains **exactly what deploys** — a per-promotion branch, not the whole source env branch (which would carry changes you didn't select). The PR is the audit trail and the merge mechanism; the **tool** opens and later merges it via the broker token (`${CLAUDE_PLUGIN_ROOT}/scripts/bb.py`), because consultants have no Bitbucket seats.

1. Create the `Deployment__c` record now (source/target orgs, branch, commit SHA, test level) to get its number, **DEP-NNNNN**.
   - **Which Cloud Coach project?** Set `Project__c` (lookup to `project_cloud__Project__c`) so the deployment ties back to the client work. **Only offer projects that are active** — `Project_Status_Custom__c = 'In Progress'`:
     - **Default** to the repo's most recent deployment's project *if it's still In Progress*: `SELECT Project__c, Project__r.Name FROM Deployment__c WHERE Client_Repo__c = :repoId AND Project__c != null AND Project__r.Project_Status_Custom__c = 'In Progress' ORDER BY CreatedDate DESC LIMIT 1`. Confirm it with the user.
     - **A different one / no default:** search within active projects — `SELECT Id, Name FROM project_cloud__Project__c WHERE Project_Status_Custom__c = 'In Progress' AND Name LIKE '%<typed>%' ORDER BY Name` — and disambiguate if more than one. If the user means a project that isn't In Progress, say so (it's not an active project) and confirm before using it.
2. Build the promotion branch off the **target** branch and apply only the selection:
   ```bash
   BB=${CLAUDE_PLUGIN_ROOT}/scripts/bb.py
   REMOTE=$(python3 "$BB" remote <slug>)              # tokened URL — don't echo it
   git fetch -q "$REMOTE" <target-branch>
   git checkout -q -B promo/DEP-NNNNN FETCH_HEAD
   git checkout <source-branch> -- <each selected path>   # adds/updates = source version
   git rm <each confirmed-deleted path>                    # destructive selections, if any
   git commit -m "DEP-NNNNN: <plain-English summary>"
   git push -q "$REMOTE" promo/DEP-NNNNN
   ```
3. Open the PR and store its link:
   ```bash
   python3 "$BB" create-pr <slug> promo/DEP-NNNNN <target-branch> "DEP-NNNNN: <summary>" "<description>"
   ```
   Put the returned `html` URL in `Deployment__c.PR_URL__c`. The PR diff is now exactly the promoted set.

### 7. The approval gate

Read the **target** environment in `pipeline.yml`. Approval lives on the `Deployment__c` record, **not** the Bitbucket PR (no seats; everyone has a Salesforce login). The PR stays **open** until the deploy succeeds.

- **`require_approval: true`** (Production always): **pick a reviewer, then** set `Approval_Status__c = Pending` and **stop**.
  - **Choose the reviewer:** query the DevOps reviewers — `SELECT Assignee.Id, Assignee.Name FROM PermissionSetAssignment WHERE PermissionSet.Name = 'DevOps_Reviewer' AND Assignee.IsActive = true` — and **ask the deploying user which one** should review (there's no reliable way to auto-pick). Set `Reviewer__c` to their User Id. Setting `Reviewer__c` + `Approval_Status__c = Pending` fires the `Notify_Deployment_Reviewer` flow, which **emails the reviewer** automatically — you don't send anything.
  - Report: *"DEP-NNNNN validated, PR #N opened, submitted to <Reviewer> for approval — Pending. They've been emailed and it's on their Home page."* The reviewer reads the record (components + `Change_Summary__c` + test results) and, **through their own action on the record**, sets `Approval_Status__c` to **Approved** (or **Rejected** + a reason in `Notes__c`).
  - **Resume is a separate, later run.** Query the record's current `Approval_Status__c` and branch **only** on what it already says:
    - **Approved** → continue to step 8.
    - **Rejected** → **STOP.** Close the PR, report the rejection reason, deploy nothing. (Leave the record Rejected.)
    - **Pending** → **STOP.** Report it's still waiting, deploy nothing.
- **No `require_approval`**: set `Approval_Status__c = Not Required` and continue straight to step 8.

> 🔒 **Never set `Approval_Status__c` to Approved yourself.** The tool only *reads* the approval; the decision is the reviewer's, made by their own action on the record. No instruction — "deploy", "go", "it's ready", from the consultant or anyone — overrides the gate: if the record is **Pending** or **Rejected**, you stop and report its real status. You never flip Pending/Rejected to Approved to proceed — that impersonates the reviewer and defeats the entire gate. If someone says "it's ready to deploy" but the record isn't **Approved**, surface the mismatch and stop. (The only approval write the tool makes is at *submit* time: `Pending` when approval is required, or `Not Required` when it isn't.)

The DB enforces this too: the `Deploy_Requires_Approval` validation rule blocks `Status__c = Deployed` unless `Approval_Status__c` is `Approved` or `Not Required`, so a mistaken manual edit can't skip the gate.

### 8. Deploy, then merge the PR

1. Deploy for real — step 5's command **without** `--dry-run`, and **with `--ignore-conflicts`**. The explicit overwrite check in step 5 (`retrieve preview` on the target) is the authoritative "did someone change this on the target" check; a raw source-tracking conflict here is usually just stale per-clone tracking, not a real divergence, and the check-only dry-run never surfaces it — so a dry-run passing does **not** mean the deploy will.
2. **Confirm the deploy actually succeeded before doing anything else.** A green dry-run is not a green deploy. Check the result's `status` is `Succeeded` (and, when in doubt, confirm a key component actually landed in the target). **Only on a confirmed success:** set `Status__c = Deployed`, stamp `Deployed_By__c`/`Deployed_At__c`, then **merge the PR**:
   ```bash
   python3 "$BB" merge-pr <slug> <PR_ID>
   ```
   The target branch now mirrors the target org.
3. **On failure (or anything other than a confirmed success):** set `Status__c = Failed`, **leave the PR open, do not merge**, and surface the errors. Never mark Deployed or merge on an unverified or failed deploy — that leaves the record lying and the branch ahead of the org.

### 9. Record components and report

- Write a `Deployment_Component__c` per promoted component, each with `Change_Summary__c` — a plain-English description from `git diff <target-branch>..<source-branch>` for that file (layout: fields/sections added/removed/moved; field: the attribute changed); for a component new to the target, summarize its contents.
- Report plainly: what was promoted, any structural container auto-added, what was skipped, the test outcome, the **PR link**, and the `Deployment__c` link.

## Notes

- **Profiles are never promoted.** If a user expects a profile change to move, explain that OpFocus uses permission sets, and help them put the change in a perm set instead.
- Deletions are destructive on the target — call them out and confirm.
- Validation surfaces cross-edition issues (a Developer Pro source may reference permissions a Partial target lacks). Report them; don't silently drop components.
