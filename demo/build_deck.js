const pptxgen = require("pptxgenjs");
const { applyTheme } = require("/Users/jp/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/893eea98-00e7-48d9-a5ce-72cf0a19cc44/cbf55459-f9ba-4695-9c95-5b4dfe80ccf4/skills/pptx/scripts/apply_theme.js");

// OpFocus brand palette (from the branded template)
const NAVY = "20242F", SLATE = "333F48", BLUE = "008FDD", BLUE2 = "3A8DDD",
      GREEN = "70AE35", GREEN2 = "7AC142", INK = "333F48", MUTE = "6B7682",
      LIGHT = "F3F3F3", LINE = "D8DEE3", WHITE = "FFFFFF", RED = "C0392B";
const THEME = { name: "OpFocus", headFontFace: "Arial", bodyFontFace: "Arial",
  colors: { dk1: NAVY, lt1: WHITE, dk2: SLATE, lt2: LIGHT, accent1: BLUE, accent2: GREEN, accent3: BLUE2, accent4: GREEN2, accent5: "ED561B", accent6: "EDEF00", hlink: BLUE, folHlink: GREEN } };
const ASSET = "/Users/jp/IdeaProjects/opfocus-devops/demo/assets";
const LOGO = `${ASSET}/brand-image1.png`, THANKS = `${ASSET}/brand-image2.jpg`;

const pres = new pptxgen();
pres.defineLayout({ name: "W", width: 13.333, height: 7.5 });
pres.layout = "W";
pres.theme = { headFontFace: "Arial", bodyFontFace: "Arial" };

pres.defineSlideMaster({
  title: "TITLE", background: { color: NAVY },
  objects: [
    { rect: { x: 0.9, y: 0.65, w: 2.75, h: 0.95, fill: { color: WHITE }, rectRadius: 0.1 } },
    { image: { x: 1.1, y: 0.86, w: 2.35, h: 0.52, path: LOGO } },
    { placeholder: { options: { name: "title", type: "title", x: 0.9, y: 2.7, w: 11.5, h: 1.9, fontSize: 44, bold: true, color: WHITE, align: "left", fontFace: "Arial" }, text: " " } },
    { placeholder: { options: { name: "subtitle", type: "body", x: 0.92, y: 4.7, w: 10.8, h: 1.3, fontSize: 19, color: "C7D0DA", align: "left", fontFace: "Arial" }, text: " " } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: WHITE },
  objects: [
    { image: { x: 11.15, y: 0.42, w: 1.6, h: 0.416, path: LOGO } },
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.42, w: 10.2, h: 0.9, fontSize: 32, bold: true, color: SLATE, align: "left", fontFace: "Arial" }, text: " " } },
  ],
});
pres.defineSlideMaster({
  title: "CTA", background: { color: NAVY },
  objects: [
    { rect: { x: 0.9, y: 0.65, w: 2.75, h: 0.95, fill: { color: WHITE }, rectRadius: 0.1 } },
    { image: { x: 1.1, y: 0.86, w: 2.35, h: 0.52, path: LOGO } },
    { placeholder: { options: { name: "title", type: "title", x: 0.9, y: 2.8, w: 11.5, h: 1.6, fontSize: 42, bold: true, color: WHITE, align: "left", fontFace: "Arial" }, text: " " } },
    { placeholder: { options: { name: "subtitle", type: "body", x: 0.92, y: 4.5, w: 11, h: 1.6, fontSize: 18, color: "C7D0DA", align: "left", fontFace: "Arial" }, text: " " } },
  ],
});

const imgShadow = () => ({ type: "outer", color: "8A97AD", blur: 7, offset: 3, angle: 90, opacity: 0.45 });
function caption(slide, x, y, w, text) {
  slide.addText(text, { x, y, w, h: 0.3, fontSize: 11, italic: true, color: MUTE, align: "center", isTextBox: true, margin: 0, fontFace: "Arial" });
}

// ===== 1. TITLE =====
let s = pres.addSlide({ masterName: "TITLE" });
s.addText("Claude plugin  ·  Bitbucket  ·  Salesforce", { x: 0.92, y: 1.95, w: 10, h: 0.5, fontSize: 15, bold: true, color: GREEN2, charSpacing: 2, isTextBox: true, margin: 0 });
s.addText("Salesforce DevOps, for everyone", { placeholder: "title" });
s.addText("Promote changes and keep a clean version history — admins and developers alike, no senior developer required.", { placeholder: "subtitle" });
s.addShape("roundRect", { x: 0.92, y: 6.1, w: 3.0, h: 0.55, rectRadius: 0.1, fill: { color: BLUE }, line: { type: "none" } });
s.addText("OpFocus internal demo", { x: 0.92, y: 6.1, w: 3.0, h: 0.55, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
s.addShape("ellipse", { x: 11.5, y: -1.1, w: 3.2, h: 3.2, fill: { color: "2A3140" }, line: { type: "none" } });
s.addShape("ellipse", { x: 12.4, y: 5.6, w: 2.6, h: 2.6, fill: { color: BLUE }, line: { type: "none" }, transparency: 70 });
s.addNotes("The pitch: Salesforce DevOps any consultant can use — not just senior devs. We replace change sets with a clean Bitbucket history, driven from Claude.");

// ===== 2. PROBLEM =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Why DevOps has been a weak spot", { placeholder: "title" });
const probs = [
  ["Change sets", "Slow, manual, and they overwrite silently — the #1 way admins break production.", RED],
  ["The CI/CD push", "Salesforce wants everyone on VCS + CI/CD, but the tooling realistically needs a senior developer.", BLUE],
  ["Admins locked out", "Sys admins and non-developers can't promote cleanly, so good DevOps never reaches most of the team.", GREEN],
];
probs.forEach((p, i) => {
  const x = 0.6 + i * 4.15;
  s.addShape("roundRect", { x, y: 1.75, w: 3.85, h: 4.6, rectRadius: 0.12, fill: { color: LIGHT }, line: { color: LINE, width: 1 } });
  s.addShape("ellipse", { x: x + 0.35, y: 2.15, w: 0.7, h: 0.7, fill: { color: p[2] }, line: { type: "none" } });
  s.addText(["1", "2", "3"][i], { x: x + 0.35, y: 2.15, w: 0.7, h: 0.7, fontSize: 22, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(p[0], { x: x + 0.3, y: 3.1, w: 3.25, h: 0.6, fontSize: 21, bold: true, color: SLATE, isTextBox: true, margin: 0 });
  s.addText(p[1], { x: x + 0.3, y: 3.75, w: 3.25, h: 2.4, fontSize: 15, color: INK, isTextBox: true, margin: 0, valign: "top" });
});
s.addNotes("Frame the pain everyone recognizes: change sets overwrite silently, CI/CD needs a senior dev, and admins are shut out.");

// ===== 3. SOLUTION =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("A Claude plugin that does the heavy lifting", { placeholder: "title" });
s.addText("The consultant speaks in plain environment terms — “promote my changes from Dev to Stage.” Claude translates that into the right git and Salesforce CLI steps, under OpFocus guardrails. No git knowledge required.", { x: 0.6, y: 1.5, w: 12.1, h: 1.0, fontSize: 17, color: INK, isTextBox: true, margin: 0 });
const sol = [
  ["Everyone can promote", "Admins and devs alike — the hard part (judgment) is Claude's job.", BLUE],
  ["Clean Bitbucket VCS", "Every change captured to git with real authorship and history.", GREEN],
  ["Review with diffs", "See exactly what changed — plain-English summary plus the line diff.", BLUE2],
  ["Shared audit trail", "Every promote recorded in Salesforce, visible to every team.", GREEN2],
];
sol.forEach((p, i) => {
  const x = 0.6 + (i % 2) * 6.15, y = 2.75 + Math.floor(i / 2) * 1.85;
  s.addShape("roundRect", { x, y, w: 5.85, h: 1.65, rectRadius: 0.1, fill: { color: WHITE }, line: { color: LINE, width: 1 }, shadow: { type: "outer", color: "C7D0DC", blur: 5, offset: 2, angle: 90, opacity: 0.5 } });
  s.addShape("roundRect", { x: x + 0.28, y: y + 0.32, w: 0.16, h: 1.0, rectRadius: 0.08, fill: { color: p[2] }, line: { type: "none" } });
  s.addText(p[0], { x: x + 0.65, y: y + 0.26, w: 5.0, h: 0.5, fontSize: 19, bold: true, color: SLATE, isTextBox: true, margin: 0 });
  s.addText(p[1], { x: x + 0.65, y: y + 0.78, w: 5.0, h: 0.75, fontSize: 14, color: INK, isTextBox: true, margin: 0 });
});
s.addNotes("The core idea: Claude is the common tool everyone already uses. It applies the DevOps judgment; the consultant speaks in environments.");

// ===== 4. ARCHITECTURE =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("How it fits together", { placeholder: "title" });
function archBox(x, y, w, h, title, sub, fill, tcolor, scolor) {
  s.addShape("roundRect", { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: LINE, width: 1 } });
  s.addText(title, { x: x + 0.1, y: y + 0.12, w: w - 0.2, h: 0.45, fontSize: 15, bold: true, color: tcolor, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.1, y: y + 0.56, w: w - 0.2, h: h - 0.6, fontSize: 11.5, color: scolor, align: "center", valign: "top", isTextBox: true, margin: 0 });
}
archBox(5.1, 1.55, 3.1, 0.85, "Consultant", "admin or developer", LIGHT, SLATE, MUTE);
archBox(5.1, 2.95, 3.1, 1.0, "Claude plugin", "promote & deploy logic", BLUE, WHITE, "DCEFF9");
s.addShape("line", { x: 6.65, y: 2.4, w: 0, h: 0.55, line: { color: MUTE, width: 1.5, endArrowType: "triangle" } });
archBox(0.7, 5.0, 3.6, 1.5, "Salesforce CLI", "retrieve / deploy to the client orgs (Dev, Partial, Prod)", WHITE, SLATE, INK);
archBox(4.85, 5.0, 3.6, 1.5, "Bitbucket Cloud", "per-client repos — the code & branch history", WHITE, SLATE, INK);
archBox(9.0, 5.0, 3.65, 1.5, "OpFocus Prod Org", "deployment audit DB + the Bitbucket secret broker", NAVY, WHITE, "C7D0DA");
[2.5, 6.65, 10.8].forEach((cx) => {
  s.addShape("line", { x: 6.65, y: 3.95, w: cx - 6.65, h: 0.55, line: { color: MUTE, width: 1.5 } });
  s.addShape("line", { x: cx, y: 4.5, w: 0, h: 0.5, line: { color: MUTE, width: 1.5, endArrowType: "triangle" } });
});
s.addText("Claude orchestrates the CLI, Bitbucket, and the prod-org database — nothing new to install and maintain.", { x: 0.7, y: 6.75, w: 12, h: 0.4, fontSize: 13, italic: true, color: MUTE, isTextBox: true, margin: 0 });
s.addNotes("Claude is the brain; it drives the Salesforce CLI, Bitbucket, and the prod org. The prod org is both the audit database and the secret broker.");

// ===== 5. DAILY FLOW =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("The daily flow: capture → review → promote", { placeholder: "title" });
const flow = [
  ["Capture", "Source tracking detects exactly what the admin changed in the org.", BLUE],
  ["Review", "Claude shows every change with a plain-English summary and the line diff.", GREEN],
  ["Select", "The consultant picks what to promote — nothing is added behind their back.", BLUE2],
  ["Promote", "Validate check-only, deploy, commit to the branch, record the deployment.", GREEN2],
];
flow.forEach((p, i) => {
  const y = 1.75 + i * 1.27;
  s.addShape("ellipse", { x: 0.7, y, w: 0.95, h: 0.95, fill: { color: p[2] }, line: { type: "none" } });
  s.addText(String(i + 1), { x: 0.7, y, w: 0.95, h: 0.95, fontSize: 30, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  if (i < 3) s.addShape("line", { x: 1.17, y: y + 0.95, w: 0, h: 0.32, line: { color: LINE, width: 2 } });
  s.addText(p[0], { x: 1.95, y: y + 0.02, w: 4.4, h: 0.5, fontSize: 21, bold: true, color: SLATE, isTextBox: true, margin: 0 });
  s.addText(p[1], { x: 1.95, y: y + 0.5, w: 4.5, h: 0.7, fontSize: 14, color: INK, isTextBox: true, margin: 0, valign: "top" });
});
s.addImage({ path: `${ASSET}/04-review-ui.jpg`, x: 7.15, y: 1.65, w: 5.6, h: 4.55, sizing: { type: "crop", w: 5.6, h: 4.55, x: 0, y: 0 }, line: { color: LINE, width: 1 }, shadow: imgShadow() });
caption(s, 7.15, 6.3, 5.6, "The review screen — every change, nothing hidden");
s.addNotes("Walk the four steps. Point at the live review screen: this is what the admin actually sees.");

// ===== 6. REVIEW SCREEN =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Review every change — with the real diff", { placeholder: "title" });
s.addImage({ path: `${ASSET}/05-review-ui-diff.jpg`, x: 0.6, y: 1.55, w: 7.3, h: 5.1, line: { color: LINE, width: 1 }, shadow: imgShadow() });
caption(s, 0.6, 6.7, 7.3, "Live change-selector — Apex diff expanded");
const rev = [
  ["Plain-English summary", "“Added calculateARR() to compute ARR” — every row, always visible.", BLUE],
  ["Diff on demand", "A chevron reveals the exact red/green line diff for code.", GREEN],
  ["Who & when", "Last modified by and date, straight from the org.", BLUE2],
  ["Flags that matter", "Shared-initiative warnings and destructive deletes stand out.", GREEN2],
];
rev.forEach((p, i) => {
  const y = 1.65 + i * 1.27;
  s.addShape("roundRect", { x: 8.2, y, w: 0.16, h: 1.0, rectRadius: 0.08, fill: { color: p[2] }, line: { type: "none" } });
  s.addText(p[0], { x: 8.5, y: y - 0.02, w: 4.3, h: 0.45, fontSize: 16, bold: true, color: SLATE, isTextBox: true, margin: 0 });
  s.addText(p[1], { x: 8.5, y: y + 0.42, w: 4.3, h: 0.75, fontSize: 13, color: INK, isTextBox: true, margin: 0, valign: "top" });
});
s.addNotes("This is what change sets never gave anyone: a real review with the actual lines before you promote. The shared-initiative flag solves the entangled-changes problem.");

// ===== 7. AUDIT TRAIL =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Every promote is recorded in Salesforce", { placeholder: "title" });
s.addText("The OpFocus production org is the shared database. Each promote writes a Deployment with its source/target orgs, branch, status, and tests — and a child record per component, each with a plain-English change summary.", { x: 0.6, y: 1.45, w: 12.1, h: 0.95, fontSize: 16, color: INK, isTextBox: true, margin: 0 });
s.addImage({ path: `${ASSET}/01-deployment-record.jpg`, x: 0.9, y: 2.55, w: 3.95, h: 4.25, line: { color: LINE, width: 1 }, shadow: imgShadow() });
caption(s, 0.9, 6.85, 3.95, "Deployment record");
s.addImage({ path: `${ASSET}/02-deployment-component.jpg`, x: 5.1, y: 2.55, w: 3.95, h: 4.25, line: { color: LINE, width: 1 }, shadow: imgShadow() });
caption(s, 5.1, 6.85, 3.95, "Component + change summary");
const au = [["Who, what, where", "Source org, target org, branch, commit, who ran it.", BLUE], ["Validated → Deployed", "Status moves through the lifecycle; tests captured.", GREEN], ["Per-component detail", "Change type and a summary of what actually changed.", BLUE2]];
au.forEach((p, i) => {
  const y = 2.7 + i * 1.4;
  s.addShape("roundRect", { x: 9.35, y, w: 3.4, h: 1.2, rectRadius: 0.1, fill: { color: LIGHT }, line: { color: LINE, width: 1 } });
  s.addText(p[0], { x: 9.55, y: y + 0.13, w: 3.05, h: 0.4, fontSize: 15, bold: true, color: p[2], isTextBox: true, margin: 0 });
  s.addText(p[1], { x: 9.55, y: y + 0.52, w: 3.05, h: 0.6, fontSize: 12.5, color: INK, isTextBox: true, margin: 0, valign: "top" });
});
s.addNotes("Reporting comes free: 'show me every deploy to Acme prod this quarter' is just a Salesforce report.");

// ===== 8. SECURITY =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Secrets never touch a laptop", { placeholder: "title" });
s.addImage({ path: `${ASSET}/03-named-credential.jpg`, x: 0.6, y: 1.65, w: 6.4, h: 4.9, line: { color: LINE, width: 1 }, shadow: imgShadow() });
caption(s, 0.6, 6.6, 6.4, "The token-broker Named Credential in Setup");
s.addText("The Bitbucket OAuth secret lives only in a Named Credential in the prod org — encrypted and non-retrievable. An Apex endpoint hands out short-lived tokens to authenticated consultants. No secret file on any machine.", { x: 7.3, y: 1.75, w: 5.4, h: 1.7, fontSize: 16, color: INK, isTextBox: true, margin: 0 });
const sec = [["No secret on laptops", "Only disposable 2-hour tokens are vended.", BLUE], ["One-step offboarding", "Deactivate the Salesforce user — token access ends.", GREEN], ["Rotate in one place", "Swap the secret once; everyone keeps working.", BLUE2]];
sec.forEach((p, i) => {
  const y = 3.6 + i * 1.08;
  s.addShape("ellipse", { x: 7.35, y, w: 0.55, h: 0.55, fill: { color: p[2] }, line: { type: "none" } });
  s.addText("✓", { x: 7.35, y, w: 0.55, h: 0.55, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(p[0], { x: 8.1, y: y - 0.05, w: 4.6, h: 0.4, fontSize: 16, bold: true, color: SLATE, isTextBox: true, margin: 0 });
  s.addText(p[1], { x: 8.1, y: y + 0.33, w: 4.6, h: 0.5, fontSize: 13, color: INK, isTextBox: true, margin: 0, valign: "top" });
});
s.addNotes("The security story leadership cares about: the OAuth secret never leaves the org; offboarding is just deactivating a user.");

// ===== 9. GUARDRAILS =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Guardrails built in", { placeholder: "title" });
const g = [
  ["Validate first, always", "Every deploy runs check-only before it writes — nobody discovers a failing test by breaking an org.", BLUE],
  ["Overwrite protection", "If the target changed under you, you're warned before you clobber it.", GREEN],
  ["Deletes need typed confirmation", "Destructive changes are off by default and require typing the component name.", RED],
  ["Profiles excluded", "Impractical in VCS — the tool nudges everyone to permission sets instead.", GREEN2],
  ["Never another team's work", "A missing component is flagged, never auto-added — it may be another initiative's.", BLUE2],
  ["Default-namespace only", "Managed packages and static resources stay out of the repo.", BLUE],
];
g.forEach((p, i) => {
  const x = 0.6 + (i % 2) * 6.15, y = 1.7 + Math.floor(i / 2) * 1.68;
  s.addShape("roundRect", { x, y, w: 5.85, h: 1.5, rectRadius: 0.1, fill: { color: LIGHT }, line: { color: LINE, width: 1 } });
  s.addShape("ellipse", { x: x + 0.3, y: y + 0.45, w: 0.6, h: 0.6, fill: { color: p[2] }, line: { type: "none" } });
  s.addText("✓", { x: x + 0.3, y: y + 0.45, w: 0.6, h: 0.6, fontSize: 19, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(p[0], { x: x + 1.1, y: y + 0.2, w: 4.6, h: 0.45, fontSize: 16.5, bold: true, color: SLATE, isTextBox: true, margin: 0 });
  s.addText(p[1], { x: x + 1.1, y: y + 0.63, w: 4.6, h: 0.8, fontSize: 13, color: INK, isTextBox: true, margin: 0, valign: "top" });
});
s.addNotes("These guardrails are the difference between a toy and something you trust on client orgs.");

// ===== 10. STATUS =====
s = pres.addSlide({ masterName: "CONTENT" });
s.addText("Where it stands today", { placeholder: "title" });
s.addText("Working end to end", { x: 0.6, y: 1.5, w: 6, h: 0.5, fontSize: 20, bold: true, color: GREEN, isTextBox: true, margin: 0 });
const done = ["Plugin packaged & installable from Bitbucket", "Backend data model live in the sandbox", "Source-tracking capture + the review UI", "Validated dev → stage promote (46 components, 0 errors)", "Token broker proven — no secret on the laptop"];
done.forEach((t, i) => {
  const y = 2.15 + i * 0.72;
  s.addShape("ellipse", { x: 0.65, y: y + 0.03, w: 0.32, h: 0.32, fill: { color: GREEN }, line: { type: "none" } });
  s.addText("✓", { x: 0.65, y: y + 0.03, w: 0.32, h: 0.32, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(t, { x: 1.15, y, w: 5.3, h: 0.5, fontSize: 15, color: INK, isTextBox: true, margin: 0, valign: "middle" });
});
s.addText("Next", { x: 7.1, y: 1.5, w: 6, h: 0.5, fontSize: 20, bold: true, color: BLUE, isTextBox: true, margin: 0 });
const next = ["Roll the backend + broker to OpFocus Prod", "Onboard a pilot client repo (CRL)", "Install for a first group of consultants", "A real dev → stage deploy, then widen the rollout"];
next.forEach((t, i) => {
  const y = 2.15 + i * 0.72;
  s.addShape("roundRect", { x: 7.15, y: y + 0.03, w: 0.32, h: 0.32, rectRadius: 0.06, fill: { color: BLUE }, line: { type: "none" } });
  s.addText(String(i + 1), { x: 7.15, y: y + 0.03, w: 0.32, h: 0.32, fontSize: 13, bold: true, color: WHITE, align: "center", valign: "middle", isTextBox: true, margin: 0 });
  s.addText(t, { x: 7.65, y, w: 5.1, h: 0.5, fontSize: 15, color: INK, isTextBox: true, margin: 0, valign: "middle" });
});
s.addShape("line", { x: 6.85, y: 1.6, w: 0, h: 4.4, line: { color: LINE, width: 1 } });
s.addNotes("Be honest about status: the pilot works end to end; remaining work is rolling to prod and onboarding people.");

// ===== 11. CTA =====
s = pres.addSlide({ masterName: "CTA" });
s.addText("Ready when you are", { x: 0.92, y: 2.0, w: 10, h: 0.5, fontSize: 15, bold: true, color: GREEN2, charSpacing: 2, isTextBox: true, margin: 0 });
s.addText("Let’s promote something", { placeholder: "title" });
s.addText("Install it from Bitbucket, point it at a sandbox, and run a real capture-and-promote. Change sets, retired.", { placeholder: "subtitle" });
s.addShape("ellipse", { x: 11.6, y: 5.0, w: 3.0, h: 3.0, fill: { color: BLUE }, line: { type: "none" }, transparency: 70 });
s.addNotes("Close with the ask: let's get it installed and run a real promote together.");

// ===== 12. THANK YOU (branded) =====
s = pres.addSlide();
s.background = { color: NAVY };
s.addImage({ path: THANKS, x: 0, y: 0, w: 13.333, h: 7.5 });
s.addNotes("OpFocus branded close.");

pres.writeFile({ fileName: "/Users/jp/IdeaProjects/opfocus-devops/demo/OpFocus-DevOps-Demo.pptx" }).then(async (fn) => {
  await applyTheme("/Users/jp/IdeaProjects/opfocus-devops/demo/OpFocus-DevOps-Demo.pptx", THEME);
  console.log("wrote + themed:", fn);
});
