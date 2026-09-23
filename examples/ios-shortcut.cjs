// Auditable native Shortcuts template. No account data or credentials belong here.
function build() {
  const actions = [], questions = [];
  let sequence = 0;
  const uuid = () => `496ABB91-B908-4452-95C6-${(++sequence).toString(16).padStart(12, '0')}`;
  const attachment = value => ({ Value: value, WFSerializationType: 'WFTextTokenAttachment' });
  const input = attachment({ Type: 'ExtensionInput' });
  const variable = name => attachment({ Type: 'Variable', VariableName: name });
  const text = value => typeof value === 'string' ? { Value: { string: value }, WFSerializationType: 'WFTextTokenString' } :
    { Value: { string: '\ufffc', attachmentsByRange: { '{0, 1}': value.Value } }, WFSerializationType: 'WFTextTokenString' };
  const dictionary = values => ({ WFSerializationType: 'WFDictionaryFieldValue', Value: { WFDictionaryFieldValueItems:
    Object.entries(values).map(([key, value]) => ({ WFItemType: 0, WFKey: text(key), WFValue: text(value) })) } });
  const add = (name, params = {}) => {
    const id = uuid();
    actions.push({ WFWorkflowActionIdentifier: 'is.workflow.actions.' + name, WFWorkflowActionParameters: { UUID: id, ...params } });
    return attachment({ Type: 'ActionOutput', OutputUUID: id, OutputName: name });
  };
  const set = (name, value) => add('setvariable', { WFVariableName: name, WFInput: value });
  const condition = (value, code) => {
    const group = uuid();
    add('conditional', { GroupingIdentifier: group, WFControlFlowMode: 0, WFCondition: code, WFInput: { Type: 'Variable', Variable: value } });
    return mode => add('conditional', { GroupingIdentifier: group, WFControlFlowMode: mode });
  };
  const error = message => { add('alert', { WFAlertActionTitle: 'Kutt: no link copied', WFAlertActionMessage: message, WFAlertActionCancelButtonShown: false }); add('exit'); };
  const setting = (name, placeholder, question) => {
    const index = actions.length;
    const output = add('gettext', { WFTextActionText: placeholder });
    questions.push({ ActionIndex: index, Category: 'Parameter', ParameterKey: 'WFTextActionText', DefaultValue: placeholder, Text: question });
    set(name, output);
  };
  add('comment', { WFCommentActionText: 'Kutt scoped-token example. Set the exact HTTPS API endpoint and create-only token from Settings > iOS Shortcut. Never share a configured copy containing your token. Only the endpoint receives the token; the shared URL is JSON data, never the request endpoint. No automatic retries. Check Library after an ambiguous timeout.' });
  setting('Kutt endpoint', 'https://example.invalid/api/v2/links', 'Paste the exact HTTPS API endpoint from your Kutt iOS Shortcut settings. Do not use a short link or SSO URL.');
  setting('Kutt token', 'REPLACE_WITH_CREATE_ONLY_SCOPED_TOKEN', 'Paste your own 30-day, default-domain, create-only token. Never use an administrator or legacy API key.');
  set('Target', input);
  const missing = condition(variable('Target'), 101);
  set('Target', add('ask', { WFAskActionPrompt: 'URL to shorten', WFInputType: 'URL', WFAllowsMultilineText: false }));
  missing(2);
  // The share sheet accepts URLs only; manual entry uses the native URL type.
  // Choose explicitly when an app supplies multiple URLs, without fetching them.
  const none = condition(variable('Target'), 101);
  error('No URL was supplied. Share a web URL or enter one when prompted.'); none(2);
  const target = add('choosefromlist', { WFInput: variable('Target'), WFChooseFromListActionPrompt: 'URL to shorten', WFChooseFromListActionSelectMultiple: false });
  const response = add('downloadurl', { WFURL: text(variable('Kutt endpoint')), WFHTTPMethod: 'POST', WFHTTPBodyType: 'JSON',
    WFHTTPHeaders: dictionary({ 'X-API-Key': variable('Kutt token'), Accept: 'application/json' }),
    WFJSONValues: dictionary({ target, reuse: 'true' }), ShowHeaders: true });
  const failed = add('getvalueforkey', { WFInput: response, WFDictionaryKey: 'error', WFGetDictionaryValueType: 'Value' });
  const failure = condition(failed, 100);
  error('Kutt rejected the request. Check token expiry, default-domain access and the API endpoint. Inspect the Library before retrying a timeout.'); failure(2);
  const link = add('getvalueforkey', { WFInput: response, WFDictionaryKey: 'link', WFGetDictionaryValueType: 'Value' });
  const absent = condition(link, 101);
  error('The response did not contain a short link. Check the API endpoint and WAF logs; do not disable authentication.'); absent(2);
  add('setclipboard', { WFInput: link, WFLocalOnly: true });
  add('alert', { WFAlertActionTitle: 'Short link copied', WFAlertActionMessage: text(link), WFAlertActionCancelButtonShown: false });
  return { WFWorkflowName: 'Kutt - Shorten URL', WFWorkflowClientVersion: '3218.0.4.100', WFWorkflowMinimumClientVersion: 900,
    WFWorkflowMinimumClientVersionString: '900', WFWorkflowHasShortcutInputVariables: true, WFWorkflowHasOutputFallback: false,
    WFWorkflowIcon: { WFWorkflowIconGlyphNumber: 59685, WFWorkflowIconStartColor: 463140863 },
    WFWorkflowInputContentItemClasses: ['WFURLContentItem'], WFWorkflowOutputContentItemClasses: [],
    WFWorkflowIsDisabledOnLockScreen: true, WFWorkflowTypes: ['ActionExtension', 'MenuBar'], WFQuickActionSurfaces: [],
    WFWorkflowImportQuestions: questions, WFWorkflowActions: actions };
}
module.exports = build;
if (require.main === module) console.log(JSON.stringify(build(), null, 2));
