---
name: rollback
description: Roll back a Salesforce deployment, restoring the target org and branch to their state before that deployment. Reverts the deployment's merge in git, redeploys the prior version of each updated/deleted component, and destructively deletes components the deployment created — through the same validation, pull-request, and approval gate as a promote. Use when the user wants to undo, revert, or roll back a deployment/promote (e.g. "roll back DEP-00042", "undo the last deploy to Stage").
---

# Roll back a deployment

Undo one deployment, returning the target org to its pre-deployment state. The user speaks in plain terms ("undo the last deploy to Stage", "roll back DEP-00042"); you translate to `sf` and git. A rollback **is itself a deployment** — it goes through the same validate → PR → approval gate → deploy → merge path as a promote, and is recorded as its own `Deployment__c` linked to the original.

**Why git, not Salesforce:** Salesforce has no native undo for a finished deploy. But every promote is a PR merged into the target branch, so the component's state *before* the deployment is the target branch right before that merge. Reverting the merge restores exactly those files.

## 1. Identify the deployment

Find the `Deployment__c` to reverse (DEP-NNNNN). It must be `Status__c = Deployed` and target the env the user means. Load its `Deployment_Component__c` children (name, type, `Change_Type__c`) — that's the set to reverse.

## 2. Locate the merge and check for drift

- Find the deployment's **merge commit** on the target branch (`Merge_SHA__c` if recorded; otherwise `git log <target-branch> --merges` for the one that merged `promo/DEP-NNNNN`).
- **Drift check:** for each component, compare the target org's current version to what the deployment left. If something changed it **since** this deployment, a rollback may clobber that newer work — list the drifted components and get an explicit go-ahead before continuing.

## 3. Build the rollback branch

```bash
BB=${CLAUDE_PLUGIN_ROOT}/scripts/bb.py
REMOTE=$(python3 "$BB" remote <slug>)
git fetch -q "$REMOTE" <target-branch>
git checkout -q -B rollback/DEP-NNNNN FETCH_HEAD
git revert -m 1 --no-edit <merge-sha>     # restores the files to their pre-deployment state
```

The revert's diff is exactly the inverse of the original promote.

## 4. Classify each component (this is where rollback can destroy data)

- **Updated / Deleted-in-original** → the revert already restored the prior file. Deploy it (additive) — for a re-create of something the original deleted, same thing.
- **Created-in-original** (new to the target) → it must be **destructively deleted** (it didn't exist before). This is **data-loss territory**: deleting a field or object removes any data entered since the deploy.
  - Warn explicitly, per component, what data is lost.
  - Require the user to **type the component's API name** to confirm each destructive delete (same gate as a destructive promote). Unconfirmed → leave it in place and flag it; the rollback is then partial, and say so.
  - Put confirmed deletes in `destructiveChangesPost.xml`; keep the restored additive components in `package.xml`.

## 5. Validate

Dry-run the mixed deploy against the target, check-only:
```bash
sf project deploy start --manifest package.xml --post-destructive-changes destructiveChangesPost.xml \
  --target-org <target-alias> --dry-run --test-level <auto>
```
Fix or stop on failure; don't proceed until clean.

`<auto>` = the same rule as a promote: if the rollback set includes any `ApexClass`/`ApexTrigger`, use the target env's `test_level` from `pipeline.yml` (default `RunLocalTests`); otherwise `NoTestRun`. Use the same level for the dry-run and the real deploy.

## 6. Record, open the reverse PR, and gate

1. Create a **rollback `Deployment__c`**: `Rolls_Back__c` = the original record, source/target, `Status__c = Validated`, `Test_Level__c`, and `Project__c` copied from the original (a rollback belongs to the same project).
2. Push `rollback/DEP-NNNNN` and open the PR into the target branch (`bb.py create-pr`); store `PR_URL__c`.
3. **Approval gate (same as a promote):** if the target env has `require_approval: true`, pick a reviewer (ask the user to choose a `DevOps_Reviewer` permission-set holder; set `Reviewer__c`), set `Approval_Status__c = Pending`, and **stop** — *"Rollback of DEP-NNNNN validated, PR #N opened, submitted to <Reviewer> — Pending."* Setting the reviewer + Pending emails them automatically (the `Notify_Deployment_Reviewer` flow). Otherwise `Approval_Status__c = Not Required` and continue. On **resume**, branch only on the record's current `Approval_Status__c`: **Approved** → continue; **Rejected** → STOP, close the PR, report the reason; **Pending** → STOP, report it's waiting. The `Deploy_Requires_Approval` validation rule enforces it.
   > 🔒 **Never set `Approval_Status__c` to Approved yourself** — not even when told "it's ready to deploy". The tool only reads it; approval is the reviewer's own action. If the record isn't Approved, you stop and report its real status.

## 7. Execute

1. Deploy for real (step 5's command without `--dry-run`, with `--ignore-conflicts`).
2. **Confirm the deploy returned `Succeeded` before anything else** (a green dry-run is not a green deploy). **Only then:** set the rollback record `Status__c = Deployed`, stamp `Deployed_By__c`/`Deployed_At__c`; **merge the reverse PR** (`bb.py merge-pr`); set the **original** deployment's `Status__c = Rolled Back`. (A picklist value with a space needs inner quotes in `sf data update`: `--values "Status__c='Rolled Back'"`, or the CLI errors "Malformed key=value pair.")
3. **On failure (or anything but a confirmed success):** rollback record `Status__c = Failed`, leave the PR open (do not merge), surface the errors.

## 8. Record components and report

- Write a `Deployment_Component__c` per reversed component on the rollback record, with `Change_Summary__c` (restored to prior version / deleted as it was created by DEP-NNNNN).
- Report plainly: what was restored, what was deleted (and the data impact), what was skipped or left in place, the PR link, and both `Deployment__c` links.

## Limits (be honest)

- **Data is not version-controlled** — a rollback restores *metadata*, never data. Records created/edited since the deploy stay as they are; data in a field being deleted is gone.
- A deployment that other work was built on top of may not roll back cleanly — the drift check (step 2) is the warning, not a guarantee.
- Profiles are never involved (the tool doesn't promote them).
