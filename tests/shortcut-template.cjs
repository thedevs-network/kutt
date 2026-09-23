const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), { createHash } = require("node:crypto");
module.exports = function templateTest() {
  const root = path.join(__dirname, "../examples"), build = require("../examples/ios-shortcut.cjs");
  const workflow = build(); assert.deepEqual(workflow, build(), "Template graph must be deterministic");
  const artifact = require("../examples/shortcut-artifact.json");
  const sha = file => createHash("sha256").update(fs.readFileSync(path.join(root, file))).digest("hex");
  assert.equal(sha("ios-shortcut.cjs"), artifact.source_sha256, "Rebuild/review/sign changed templates");
  assert.equal(sha(artifact.signed_file), artifact.signed_sha256, "Signed artifact drift");
  assert(fs.statSync(path.join(root, artifact.signed_file)).size > 1000);
  assert.deepEqual(workflow.WFWorkflowInputContentItemClasses, ["WFURLContentItem"]);
  assert(workflow.WFWorkflowIsDisabledOnLockScreen);
  assert.deepEqual(workflow.WFWorkflowTypes, ["ActionExtension", "MenuBar"]);
  const actions = workflow.WFWorkflowActions, identifiers = actions.map(action => action.WFWorkflowActionIdentifier);
  assert.equal(actions.filter(action => action.WFWorkflowActionIdentifier.endsWith("downloadurl")).length, 1);
  const http = actions.find(action => action.WFWorkflowActionIdentifier.endsWith("downloadurl")).WFWorkflowActionParameters;
  assert.equal(http.WFHTTPMethod, "POST"); assert.equal(http.WFHTTPBodyType, "JSON");
  assert.equal(http.WFURL.Value.attachmentsByRange['{0, 1}'].VariableName, "Kutt endpoint");
  const dict = value => Object.fromEntries(value.Value.WFDictionaryFieldValueItems.map(item => [item.WFKey.Value.string, item.WFValue.Value]));
  const headers = dict(http.WFHTTPHeaders), body = dict(http.WFJSONValues);
  assert.deepEqual(Object.keys(headers).sort(), ["Accept", "X-API-Key"]);
  assert.equal(headers['X-API-Key'].attachmentsByRange['{0, 1}'].VariableName, "Kutt token");
  assert.deepEqual(Object.keys(body).sort(), ["reuse", "target"]); assert.equal(body.reuse.string, "true");
  const choice = actions.find(action => action.WFWorkflowActionIdentifier.endsWith("choosefromlist")).WFWorkflowActionParameters;
  assert.equal(choice.WFInput.Value.VariableName, "Target"); assert.equal(choice.WFChooseFromListActionSelectMultiple, false);
  assert.equal(body.target.attachmentsByRange['{0, 1}'].OutputUUID, choice.UUID);
  assert.equal(identifiers.filter(id => id.endsWith(".exit")).length, 3);
  assert(!identifiers.some(id => /runworkflow|javascript|openurl|repeat|shellscript|getclipboard/.test(id)));
  const clipboard = actions.find(action => action.WFWorkflowActionIdentifier.endsWith("setclipboard")).WFWorkflowActionParameters;
  assert.equal(clipboard.WFLocalOnly, true);
  assert.equal(actions.find(action => action.WFWorkflowActionParameters.UUID === clipboard.WFInput.Value.OutputUUID).WFWorkflowActionParameters.WFDictionaryKey, "link");
  assert.equal(workflow.WFWorkflowImportQuestions.length, 2);
  for (const question of workflow.WFWorkflowImportQuestions) {
    assert.equal(actions[question.ActionIndex].WFWorkflowActionParameters[question.ParameterKey], question.DefaultValue);
  }
  assert(workflow.WFWorkflowImportQuestions[0].DefaultValue.startsWith("https://example.invalid/"));
  assert(!/kutt_(?:d_)?[A-Za-z0-9_-]{43}/.test(JSON.stringify(workflow)));
  const seen = new Set();
  const inspect = value => {
    if (!value || typeof value !== "object") return;
    if (value.Type === "ActionOutput") assert(seen.has(value.OutputUUID), "Dangling or future action reference");
    for (const child of Object.values(value)) inspect(child);
  };
  for (const action of actions) { inspect(action.WFWorkflowActionParameters); assert(!seen.has(action.WFWorkflowActionParameters.UUID)); seen.add(action.WFWorkflowActionParameters.UUID); }
  console.log("PASS: deterministic credential-free signed Shortcut, fixed receiver/header, URL-only input, explicit selection, action references and failure termination");
};
if (require.main === module) module.exports();
