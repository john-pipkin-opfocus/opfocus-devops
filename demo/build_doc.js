const fs = require("fs");
const d = require("docx");
const { Document, Packer, Paragraph, TextRun, HeadingLevel, TableOfContents, PageBreak,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, AlignmentType,
  ImageRun, LevelFormat, Header, Footer, PageNumber } = d;

const NAVY = "16213E", TEAL = "0B8FA6", INK = "26324D", MUTE = "6B7890", LINE = "D9E0E8", LIGHT = "F1F5F9";
const ASSET = "/Users/jp/IdeaProjects/opfocus-devops/demo/assets";
const TW = 9360; // 6.5" content width in DXA

const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 120 }, children: [new TextRun({ text: t, color: NAVY, bold: true })] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 80 }, children: [new TextRun({ text: t, color: TEAL, bold: true })] });
const P = (runs, opts = {}) => new Paragraph({ spacing: { after: 120, line: 276 }, ...opts, children: Array.isArray(runs) ? runs : [new TextRun({ text: runs, color: INK })] });
const T = (text, o = {}) => new TextRun({ text, color: INK, ...o });
const bullet = (text, runs) => new Paragraph({ numbering: { reference: "bl", level: 0 }, spacing: { after: 70 }, children: runs || [new TextRun({ text, color: INK })] });
const code = (text) => new Paragraph({ spacing: { after: 120 }, shading: { type: ShadingType.CLEAR, fill: LIGHT }, border: { top: { style: BorderStyle.SINGLE, size: 2, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE }, left: { style: BorderStyle.SINGLE, size: 2, color: LINE }, right: { style: BorderStyle.SINGLE, size: 2, color: LINE } }, children: [new TextRun({ text, font: "Consolas", size: 18, color: NAVY })] });

function cell(text, w, { bold = false, head = false } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: head ? { type: ShadingType.CLEAR, fill: NAVY } : { type: ShadingType.CLEAR, fill: "FFFFFF" },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: bold || head, color: head ? "FFFFFF" : INK, size: 19 })] })],
  });
}
function table(widths, rows) {
  return new Table({
    columnWidths: widths, width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: { top: { style: BorderStyle.SINGLE, size: 2, color: LINE }, bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE }, left: { style: BorderStyle.SINGLE, size: 2, color: LINE }, right: { style: BorderStyle.SINGLE, size: 2, color: LINE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE }, insideVertical: { style: BorderStyle.SINGLE, size: 2, color: LINE } },
    rows: rows.map((r, i) => new TableRow({ tableHeader: i === 0, children: r.map((c) => cell(c, widths[r.indexOf(c)], { head: i === 0 })) })),
  });
}
function figure(file, w, h, cap) {
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 40 }, children: [new ImageRun({ type: "jpg", data: fs.readFileSync(`${ASSET}/${file}`), transformation: { width: w, height: h } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: cap, italics: true, color: MUTE, size: 18 })] }),
  ];
}

const children = [];
// ---- title block ----
children.push(new Paragraph({ spacing: { before: 2600, after: 0 }, children: [new TextRun({ text: "SALESFORCE DEVOPS", color: TEAL, bold: true, size: 26, characterSpacing: 40 })] }));
children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: "Technical Solution Design", color: NAVY, bold: true, size: 52, font: "Cambria" })] }));
children.push(new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: "A Claude plugin for capturing, promoting, and tracking Salesforce changes across client orgs with a clean Bitbucket version history.", color: INK, size: 24 })] }));
children.push(new Paragraph({ children: [new TextRun({ text: "OpFocus", color: INK, bold: true, size: 22 })] }));
children.push(new Paragraph({ children: [new TextRun({ text: "Author: John Pipkin  ·  Date: 10/22/2026  ·  Status: Pilot (working end to end)", color: MUTE, size: 20 })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));
// ---- TOC ----
children.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: "Contents", color: NAVY, bold: true, size: 32, font: "Cambria" })] }));
children.push(new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// 1. Overview
children.push(H1("1. Overview"));
children.push(P("OpFocus manages many client Salesforce orgs. Salesforce is steering customers toward version control and CI/CD, but its native tooling realistically requires a senior developer, and change sets — the default promotion path for admins — are slow, manual, and overwrite silently. The result: good DevOps never reaches most of the team."));
children.push(P("This solution is a Claude plugin that lets every consultant — admins and developers alike — promote changes and keep a clean Bitbucket history, replacing change sets, without learning git or pre-installing specialized tooling. The consultant speaks in plain environment terms (“promote my changes from Dev to Stage”); Claude translates that into the correct git and Salesforce CLI operations under OpFocus guardrails. OpFocus’s own production org serves as the shared database that records every deployment."));
children.push(H2("Why a plugin, not a desktop app"));
children.push(P("Every consultant already uses Claude, so distribution and updates are solved. The hard part of Salesforce DevOps is judgment — what to retrieve, what to promote, how to avoid overwrites — which Claude does well and a fixed GUI does not. A plugin applies that judgment under OpFocus guardrails; a cross-platform desktop app would reintroduce build, sign, and update burden for no benefit."));

// 2. Goals
children.push(H1("2. Goals and Non-Goals"));
children.push(H2("Goals"));
["Any consultant, including an admin who has never used git, can promote changes and keep a clean VCS.",
 "Replace the change-set workflow end to end: capture what changed, review it, promote it to the next environment.",
 "Deploy to and from any org a consultant already has access to.",
 "Give every team shared visibility into what was deployed where, when, and by whom.",
 "Require no secret credentials stored on consultant laptops."].forEach((t) => children.push(bullet(t)));
children.push(H2("Non-Goals"));
["Not a git server or a replacement for Bitbucket — code lives in Bitbucket Cloud.",
 "Not Bitbucket Pipelines / CI automation (future).",
 "Not a centralized store of client-org credentials — each consultant authenticates the orgs they are entitled to.",
 "Not a cross-platform desktop application."].forEach((t) => children.push(bullet(t)));

// 3. Architecture
children.push(H1("3. Architecture"));
children.push(P("The consultant works entirely through Claude. The plugin orchestrates three systems:"));
children.push(table([2600, 6760], [
  ["Component", "Role"],
  ["Claude plugin (skills)", "The orchestration layer. Detects changes, builds the review, applies guardrails, drives git and the Salesforce CLI."],
  ["Salesforce CLI (sf)", "The deployment engine — retrieve and deploy metadata to/from the client orgs."],
  ["Bitbucket Cloud", "Per-client repositories: the code and branch history (the system of record for metadata)."],
  ["OpFocus production org", "The shared coordination layer: the deployment audit database and the Bitbucket secret broker."],
]));
children.push(P("The separation is deliberate: Bitbucket is the code system of record; the Salesforce org is the coordination and audit layer. No new infrastructure is introduced — both are systems OpFocus already runs."));

// 4. Data model
children.push(H1("4. Data Model"));
children.push(P("The backend is four custom objects deployed into the production org. It stores metadata about deployments, not the code itself."));
children.push(table([2700, 6660], [
  ["Object", "Purpose and key fields"],
  ["Client_Repo__c", "One per client repository. Bitbucket workspace / slug / URL, default branch, active flag."],
  ["Org_Connection__c", "Catalog of a client’s orgs and how each maps to a git branch. Client repo, org type, org alias, org id, branch, promotion order, source-tracking flag."],
  ["Deployment__c", "One per promote. Source/target org, branch, commit SHA, status (Validated → Deployed → …), test level and results, deployed by/at, PR URL, approval status, deploy request id, notes."],
  ["Deployment_Component__c", "One per component in a deployment (master-detail to Deployment). Metadata type, component name, change type (Added/Changed/Deleted), and a plain-English change summary."],
]));
children.push(P([T("Field-level security note: ", { bold: true }), T("metadata-deployed custom fields are not visible to any profile by default. The backend ships an "), T("OpFocus_DevOps_User", { font: "Consolas", size: 18 }), T(" permission set that must be assigned to each consultant.")]));
children.push(...figure("01-deployment-record.jpg", 300, 323, "Figure 1 — A Deployment record: the shared audit trail."));

// 5. Branching
children.push(H1("5. Branching Model and pipeline.yml"));
children.push(P("Each client gets its own repository inside a fixed Bitbucket project. Within a repo, the model is environment branches — one branch per org — and the topology varies by client. That variance lives in a per-repo configuration file, .opfocus/pipeline.yml, so the skills read the topology instead of hard-coding it:"));
children.push(code("client: Acme"));
children.push(code("environments:"));
children.push(code("  - { name: Dev, branch: dev, org: acme-dev }"));
children.push(code("  - { name: Stage, branch: stage, org: acme-stage, validate_first: true, test_level: RunLocalTests }"));
children.push(code("promotion_path: [Dev, Stage]"));
children.push(P("The admin never sees a git term. “I made changes in Acme Dev” becomes a retrieve + commit to the dev branch; “promote to Stage” becomes a deploy of the selected set to the Stage org, a merge, and a recorded deployment."));

// 6. Capture
children.push(H1("6. Change Detection and Capture"));
children.push(P("Capture always begins with source tracking in the client repo — the tool never hand-names components. Source tracking tells the tool exactly what changed in the org since the last sync, replacing the manual change-set component picker."));
children.push(P([T("Scope: ", { bold: true }), T("the repo’s .forceignore (written at setup from "), T("sf package installed list", { font: "Consolas", size: 18 }), T(") excludes managed-package namespaces, static resources, and profiles. Profiles are excluded entirely — impractical in VCS/CI-CD; the tool nudges consultants to permission sets instead. Namespaces are taken from the authoritative installed-package list, never guessed from file names (which collides with the org’s own objects).")]));

// 7. Review UI
children.push(H1("7. Review and Selection"));
children.push(P("Detected changes are presented in a locally served, SLDS-styled review screen (opened automatically in the Claude browser pane). It is a review, not just a checklist: each row shows its change type (Created / Updated / Deleted), who last modified it and when, and a plain-English summary. For updated code, a collapsible chevron reveals the exact red/green line diff; for XML metadata the summary leads. Shared-initiative warnings and destructive deletes are flagged. The consultant selects what to promote; that selection — and only that — is deployed."));
children.push(...figure("05-review-ui-diff.jpg", 360, 388, "Figure 2 — The review screen with an Apex diff expanded."));

// 8. Dependency handling
children.push(H1("8. Dependency Handling"));
children.push(P("The tool promotes exactly what the consultant selected. It does not auto-expand the set with whatever the target happens to be missing — a missing component may belong to another, unknown initiative, and pulling it in would promote someone else’s in-progress work."));
children.push(bullet(null, [T("Structural container only. ", { bold: true }), T("If a selected field, layout, or page belongs to an object not yet in the target, the object’s bare definition is included — it is the container for the work, not another initiative’s component.")]));
children.push(bullet(null, [T("Everything else is flagged, not added. ", { bold: true }), T("If a selected component references something neither selected nor in the target, the tool surfaces it for the consultant to decide.")]));
children.push(bullet(null, [T("No validation loops. ", { bold: true }), T("A single pre-deploy validation is the backstop; a missing dependency is reported as a decision, never auto-resolved.")]));

// 9. Destructive
children.push(H1("9. Destructive and Mixed Deployments"));
children.push(P("A component deleted in the source becomes a destructive change on the target, handled with more care than anything else:"));
children.push(bullet("A delete is never inferred from a missing file — the consultant explicitly confirms each deletion is intended (deletions are unchecked by default in the review)."));
children.push(bullet("Executing any destructive change, or deleting a field/object (data loss), requires typing the component’s API name to confirm."));
children.push(bullet("Confirmed deletions go in destructiveChangesPost.xml alongside the additive package.xml; the mixed deploy validates check-only first."));

// 10. Auth / broker
children.push(H1("10. Authentication and Secret Management"));
children.push(H2("Org authentication"));
children.push(P("Each consultant authenticates the client orgs they are entitled to with the Salesforce CLI (sf org login web). Client-org credentials are never centralized."));
children.push(H2("Bitbucket access — the token broker"));
children.push(P("Consultants are not Bitbucket workspace members (Atlassian bills per member), so they do not consume seats. The tool authenticates to Bitbucket via a single OAuth consumer. Crucially, the consumer secret is not stored on laptops: it lives only in a Named Credential in the production org (encrypted, non-retrievable). An Apex REST endpoint makes the client-credentials call through that Named Credential and returns only a short-lived token to the authenticated, permissioned consultant. bb.py fetches tokens from that endpoint via the consultant’s existing Salesforce session."));
children.push(table([3100, 6260], [
  ["Property", "Result"],
  ["No secret on laptops", "Only disposable ~2-hour tokens are vended."],
  ["One-step offboarding", "Deactivate the Salesforce user — token access ends immediately."],
  ["Central rotation", "Swap the secret once in the Named Credential; every consultant keeps working."],
]));
children.push(...figure("03-named-credential.jpg", 360, 388, "Figure 3 — The token-broker Named Credential in Setup."));

// 11. Distribution
children.push(H1("11. Distribution and Installation"));
children.push(P("The plugin is distributed from a public GitHub repository via a marketplace manifest. It holds no secrets (the Bitbucket OAuth secret lives only in the prod-org Named Credential), so consultants need no repository account and nothing to authenticate. In the Claude desktop app, a consultant clicks + → Add plugins, pastes the marketplace URL, and installs opfocus-devops. The terminal / VS Code equivalent, run once in a Claude Code session, is:"));
children.push(code("/plugin marketplace add https://github.com/john-pipkin-opfocus/opfocus-devops.git"));
children.push(code("/plugin install opfocus-devops@opfocus-marketplace"));
children.push(P("The three skills — setup-backend, setup-client-repo, and capture-and-promote — then become invokable. Active development lives in the private Bitbucket repository; GitHub is the public distribution mirror. Access to the private client code repositories is handled separately, at runtime, by the token broker — never by a per-consultant credential. (Plugins do not load in cloud sessions or under WSL; consultants use a local desktop-app, terminal, or VS Code session.)"));

// 12. Security considerations
children.push(H1("12. Security Considerations"));
children.push(bullet("The Bitbucket OAuth secret is held only in the prod-org Named Credential, never in git, a config file, or a laptop."));
children.push(bullet("The token-vendor Apex endpoint is gated by the OpFocus_DevOps_User permission set; only permissioned, authenticated users can obtain a token."));
children.push(bullet("Commit attribution uses each consultant’s git identity; the Deployment record also logs who ran each promote."));
children.push(bullet("Deletions require typed confirmation; destructive changes to production additionally respect an approval gate."));
children.push(bullet("The OAuth consumer is workspace-wide write — contained by storing it only in the prod org and rotating it on a schedule."));

// 13. Rollout
children.push(H1("13. Rollout and Open Items"));
children.push(H2("Working today"));
["Plugin packaged and installable from Bitbucket.",
 "Backend data model, permission set, and token broker deployed to the DevOps sandbox and verified.",
 "Source-tracking capture and the review UI.",
 "A validated dev → stage promote (46-component closure, zero errors).",
 "Token broker proven end to end — no secret on the laptop."].forEach((t) => children.push(bullet(t)));
children.push(H2("Next"));
["Deploy the backend + broker to the OpFocus production org and enter the credential there.",
 "Onboard a pilot client repository and run a real dev → stage deploy.",
 "Install for a first group of consultants and widen the rollout.",
 "Future: Bitbucket Pipelines for CI validation; modern External Credential model."].forEach((t) => children.push(bullet(t)));

const doc = new Document({
  creator: "OpFocus", title: "OpFocus Salesforce DevOps — Technical Solution Design",
  styles: { default: { document: { run: { font: "Calibri", size: 21, color: INK } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 30, bold: true, color: NAVY, font: "Cambria" } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: TEAL, font: "Cambria" } },
    ] },
  numbering: { config: [{ reference: "bl", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 260 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "OpFocus Salesforce DevOps — Technical Solution Design   ·   ", color: MUTE, size: 16 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTE, size: 16 })] })] }) },
    children,
  }],
});
Packer.toBuffer(doc).then((buf) => { fs.writeFileSync("/Users/jp/IdeaProjects/opfocus-devops/demo/OpFocus-DevOps-Technical-Design.docx", buf); console.log("wrote docx"); });
