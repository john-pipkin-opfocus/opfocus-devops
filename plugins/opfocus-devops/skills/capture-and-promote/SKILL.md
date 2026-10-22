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

### 5. Overwrite check, then validate

- `sf project retrieve preview --target-org <target-alias>` — if a component in the closure also changed directly on the target, flag it and ask before overwriting.
- **Pick the test level automatically.** Salesforce only needs Apex tests when the deployment contains Apex. So: if the closure includes **any `ApexClass` or `ApexTrigger`** (any `.cls`/`.trigger` under the selection), use the target env's `test_level` from `pipeline.yml` (default `RunLocalTests`); **otherwise `NoTestRun`**. This keeps metadata-only promotes fast and avoids running the org's whole test suite for, say, a layout or a label. Use the **same** level for the dry-run and the real deploy.
- **Validate first (always):** `sf project deploy start --source-dir <closure> --target-org <target-alias> --dry-run --test-level <chosen above>`. Report status/errors. Fix or de-select on failure; don't proceed to a real deploy until validation is clean.

### 6. Open the pull request (one per deployment)

**Every** promote gets a PR, and the PR contains **exactly what deploys** — a per-promotion branch, not the whole source env branch (which would carry changes you didn't select). The PR is the audit trail and the merge mechanism; the **tool** opens and later merges it via the broker token (`${CLAUDE_PLUGIN_ROOT}/scripts/bb.py`), because consultants have no Bitbucket seats.

1. Create the `Deployment__c` record now (source/target orgs, branch, commit SHA, test level) to get its number, **DEP-NNNNN**.
   - **Which Cloud Coach project?** Set `Project__c` (lookup to `project_cloud__Project__c`) so the deployment ties back to the client work. Default to the project on the most recent deployment for this repo — `SELECT Project__c, Project__r.Name FROM Deployment__c WHERE Client_Repo__c = :repoId AND Project__c != null ORDER BY CreatedDate DESC LIMIT 1` — and confirm it with the user (offer to pick a different `project_cloud__Project__c`, e.g. by name for the client's account). If there's no prior project, ask.
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
  - Report: *"DEP-NNNNN validated, PR #N opened, submitted to <Reviewer> for approval — Pending. They've been emailed and it's on their Home page."* The reviewer reads the record (components + `Change_Summary__c` + test results) and sets `Approval_Status__c` to **Approved** (or **Rejected** + a reason in `Notes__c`). **Resume** (a later run): query the record — **Approved** → continue to step 8; **Rejected** → close the PR, stop, report the reason; **Pending** → report it's still waiting.
- **No `require_approval`**: set `Approval_Status__c = Not Required` and continue straight to step 8.

The DB enforces this: the `Deploy_Requires_Approval` validation rule blocks `Status__c = Deployed` unless `Approval_Status__c` is `Approved` or `Not Required`, so a mistaken manual edit can't skip the gate.

### 8. Deploy, then merge the PR

1. Deploy for real — step 5's command **without** `--dry-run`.
2. **On success:** set `Status__c = Deployed`, stamp `Deployed_By__c`/`Deployed_At__c`, then **merge the PR** (closes the promo branch):
   ```bash
   python3 "$BB" merge-pr <slug> <PR_ID>
   ```
   The target branch now mirrors the target org.
3. **On failure:** set `Status__c = Failed`, leave the PR **open**, and surface the errors.

### 9. Record components and report

- Write a `Deployment_Component__c` per promoted component, each with `Change_Summary__c` — a plain-English description from `git diff <target-branch>..<source-branch>` for that file (layout: fields/sections added/removed/moved; field: the attribute changed); for a component new to the target, summarize its contents.
- Report plainly: what was promoted, any structural container auto-added, what was skipped, the test outcome, the **PR link**, and the `Deployment__c` link.

## Notes

- **Profiles are never promoted.** If a user expects a profile change to move, explain that OpFocus uses permission sets, and help them put the change in a perm set instead.
- Deletions are destructive on the target — call them out and confirm.
- Validation surfaces cross-edition issues (a Developer Pro source may reference permissions a Partial target lacks). Report them; don't silently drop components.
