---
name: setup-backend
description: Deploy or verify the OpFocus DevOps tracking backend (the Client_Repo__c, Org_Connection__c, Deployment__c, and Deployment_Component__c custom objects) in the OpFocus production org. Run this once to stand up the shared deployment database, or again to update or re-verify it. Use when the user asks to set up, install, deploy, or check the OpFocus DevOps backend / tracking objects / Salesforce side.
---

# Set up the OpFocus DevOps backend

This skill stands up the shared deployment database in **OpFocus's production org** (`sf` alias `OpFocus_Prod`). It deploys four custom objects that every team reads and writes: `Client_Repo__c`, `Org_Connection__c`, `Deployment__c`, and `Deployment_Component__c`. The metadata lives in this plugin under `${CLAUDE_PLUGIN_ROOT}/salesforce/` (an `sf` project).

## Before you start

1. **Confirm the CLI is present.** Run `sf --version`. If it is missing, install it (`npm install --global @salesforce/cli`) and re-check.
2. **Confirm the target org.** Run `sf org display --target-org OpFocus_Prod`. If it is not authenticated, ask the user to run `sf org login web --alias OpFocus_Prod` — do not authenticate on their behalf.
3. **This writes to production.** Deploying adds custom objects to OpFocus's real business org. It is additive and low-risk (no data is changed), but always run the validation step and get the user's explicit "go" before the real deploy.

## Steps

Run every `sf` command from `${CLAUDE_PLUGIN_ROOT}/salesforce/`.

1. **Validate first (no changes made).** Run a check-only deploy:
   ```
   sf project deploy start --dry-run --source-dir force-app --target-org OpFocus_Prod
   ```
   Report the result. If it fails, show the errors and stop — do not proceed to the real deploy.

2. **Confirm, then deploy for real.** Only after the dry run passes and the user confirms:
   ```
   sf project deploy start --source-dir force-app --target-org OpFocus_Prod
   ```

3. **Verify the objects landed.** Confirm each object is queryable:
   ```
   sf data query --query "SELECT COUNT() FROM Client_Repo__c" --target-org OpFocus_Prod
   ```
   Repeat for `Org_Connection__c`, `Deployment__c`, and `Deployment_Component__c`. A successful (zero-row) count means the object exists.

4. **Report back.** Tell the user which objects were created or updated, and that the backend is ready for the `setup-client-repo` skill to register its first client.

## Notes

- Re-running this skill is safe: `sf project deploy start` is idempotent for metadata — unchanged components are skipped.
- If the user is on a Standard Salesforce edition without a given field type, surface the specific deploy error rather than guessing.
- Field-level security: metadata-deployed custom fields are **not** visible to any profile by default (not even System Admin). The backend ships an `OpFocus_DevOps_User` permission set (object + field access to all four objects, plus access to the `BitbucketTokenVendor` Apex class) — it deploys with `force-app`. **Assign it** after deploying, or record creation fails with "No such column": `sf org assign permset --name OpFocus_DevOps_User --target-org <alias>`. Assign it to every consultant who uses the tool.
- **Bitbucket token broker (one-time credential entry).** The backend deploys a `Bitbucket_Token_Vendor` named credential and the `BitbucketTokenVendor` Apex REST endpoint (`/services/apexrest/opfocus/bitbucket-token`). This lets `bb.py` fetch short-lived Bitbucket tokens from the org instead of keeping the OAuth consumer secret on every laptop. After deploying, an admin must set the credential **in Setup → Named Credentials → Bitbucket Token Vendor → Edit**: **Username = the OAuth consumer key, Password = the OAuth consumer secret**, then Save. The secret is entered in the UI only — never in metadata or git. Verify with `sf api request rest "/services/apexrest/opfocus/bitbucket-token" --target-org <alias>` (returns a token once the credential is set; `invalid_client` means it's still a placeholder).
