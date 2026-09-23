const assert = require('node:assert/strict');
const { randomBytes, createHash } = require('node:crypto');
const { mkdtempSync } = require('node:fs');
const path = require('node:path'), { tmpdir } = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, '1');
  const origin = process.env.KUTT_TEST_URL; assert(origin && new URL(origin).hostname === '127.0.0.1');
  const evidence = process.env.KUTT_EVIDENCE_DIR || mkdtempSync(path.join(tmpdir(), 'kutt-shortcut-ui-'));
  const browser = await chromium.launch({ headless: true }), errors = [];
  let page;
  try {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    // Exercise clipboard wiring deterministically; native OS permission/lock
    // ceremonies are separate acceptance, not simulated as a real clipboard.
    await context.addInitScript(() => { window.testClipboard = ''; Object.defineProperty(navigator, 'clipboard', { value: {
      writeText: async value => { if (window.testClipboardUnavailable) throw new Error('Unavailable'); window.testClipboard = value; },
      readText: async () => window.testClipboard
    } }); });
    const headers = { Accept: 'application/json' };
    const setup = await context.request.post(origin + '/api/auth/create-admin', { data: { email: 'shortcut-browser@example.invalid', password: randomBytes(32).toString('hex') }, headers });
    assert.equal(setup.status(), 201, 'Refuse initialized instances');
    await context.addCookies([{ name: 'token', value: (await setup.json()).token, url: origin }]);
    page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    for (const [label, viewport] of [['desktop', {width:1440,height:1000}], ['mobile',{width:390,height:844}]]) {
      await page.setViewportSize(viewport); await page.goto(origin + '/settings');
      let releaseScript;
      const scriptGate = new Promise(resolve => { releaseScript = resolve; });
      await page.route('**/scripts/shortcuts.js', async route => { await scriptGate; await route.continue(); });
      const navigation = page.getByRole('link', {name:'iOS Shortcut',exact:true}).click();
      try {
        await page.getByRole('heading',{name:'iOS Shortcut',exact:true}).waitFor();
        assert(await page.getByRole('button',{name:'Copy API endpoint',exact:true}).isDisabled());
        assert(await page.getByRole('button',{name:'Create Shortcut token',exact:true}).isDisabled());
      } finally { releaseScript(); }
      await navigation; await page.waitForLoadState('domcontentloaded');
      await page.unroute('**/scripts/shortcuts.js');
      await page.getByRole('heading',{name:'iOS Shortcut',exact:true}).waitFor();
      const endpoint = await page.getByLabel('API endpoint',{exact:true}).inputValue();
      assert(endpoint.startsWith('https://127.0.0.1:'));
      await page.getByRole('button',{name:'Copy API endpoint',exact:true}).click();
      await page.getByText('Endpoint copied.',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),endpoint);
      await page.evaluate(()=>window.testClipboardUnavailable=true);
      await page.getByRole('button',{name:'Copy API endpoint',exact:true}).click();
      await page.getByText('Clipboard unavailable. Select and copy the field manually.',{exact:true}).waitFor();
      await page.evaluate(()=>window.testClipboardUnavailable=false);
      const downloadPromise=page.waitForEvent('download');
      await page.getByRole('link',{name:'Download Shortcut',exact:true}).click();
      const download=await downloadPromise; assert.equal(download.suggestedFilename(),'Kutt-Shorten-URL.shortcut');
      const response=await context.request.get(origin+'/api/v2/shortcuts/template');
      assert.equal(createHash('sha256').update(await response.body()).digest('hex'),require('../examples/shortcut-artifact.json').signed_sha256);
      await page.getByLabel('Shortcut name',{exact:true}).fill('Native '+label);
      const api=origin+'/api/v2/shortcuts/token';
      await page.route(api,route=>route.fulfill({status:503,contentType:'application/json',body:'{"error":"Synthetic outage"}'}));
      await page.getByRole('button',{name:'Create Shortcut token',exact:true}).click();
      await page.getByText('Synthetic outage',{exact:true}).waitFor();
      assert(!(await page.getByRole('button',{name:'Create Shortcut token',exact:true}).isDisabled()));
      await page.unroute(api);
      const pending=page.waitForResponse(r=>r.url()===api && r.request().method()==='POST');
      await page.getByRole('button',{name:'Create Shortcut token',exact:true}).click();
      const issued=await pending; assert.equal(issued.status(),201); const result=await issued.json();
      await page.getByText('Token created. Store it only in your private Shortcut.',{exact:true}).waitFor();
      const field=page.getByLabel('API token',{exact:true}); assert.equal(await field.getAttribute('type'),'password');
      assert((await field.inputValue())===result.token);
      assert(await page.getByRole('button',{name:'Create Shortcut token',exact:true}).isDisabled());
      await page.getByRole('button',{name:'Copy API token',exact:true}).click(); await page.getByText('Token copied.',{exact:true}).waitFor();
      assert((await page.evaluate(()=>navigator.clipboard.readText()))===result.token);
      await page.evaluate(()=>navigator.clipboard.writeText(''));
      await page.getByRole('button',{name:'Show API token',exact:true}).click(); assert.equal(await field.getAttribute('type'),'text');
      await page.getByRole('button',{name:'Mask API token',exact:true}).click();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(evidence,label+'-credential-masked.png'),fullPage:true});
      await page.getByRole('button',{name:'Hide credential',exact:true}).click(); assert.equal(await field.inputValue(),'');
      assert(await page.getByRole('button',{name:'Copy API token',exact:true}).isDisabled());
      const revoke=origin+'/api/v2/tokens/'+result.id;
      await page.route(revoke,route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}));
      await page.getByRole('button',{name:'Revoke this token',exact:true}).click();
      await page.getByText('Revocation failed. Retry or revoke in Settings.',{exact:true}).waitFor();
      await page.unroute(revoke); await page.getByRole('button',{name:'Revoke this token',exact:true}).click();
      await page.getByText('Token revoked.',{exact:true}).waitFor();
      assert.equal((await context.request.post(origin+'/api/v2/links',{headers:{...headers,'X-API-Key':result.token},data:{target:'https://example.com/'}})).status(),401);
      await page.reload(); assert.equal(await field.inputValue(),''); assert(!(await page.locator('#shortcut-secret').isVisible()));
      let releaseLate, lateIssued;
      const lateGate = new Promise(resolve => { releaseLate = resolve; });
      const lateReady = new Promise(resolve => { lateIssued = resolve; });
      await page.route(api, async route => {
        const response = await route.fetch(); const value = await response.json();
        lateIssued(value); await lateGate; await route.fulfill({ response });
      });
      await page.getByRole('button',{name:'Create Shortcut token',exact:true}).click();
      const late = await lateReady;
      // Exercise the BFCache lifecycle guard with a real delayed mint response;
      // this is not a claim that this browser chose to cache the document.
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
      releaseLate();
      await page.waitForFunction(() => !document.querySelector('#shortcut-create').disabled);
      await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));
      assert.equal(await field.inputValue(),''); assert(!(await page.locator('#shortcut-secret').isVisible()));
      assert(!(await page.content()).includes(late.token));
      await page.unroute(api);
      assert.equal((await context.request.delete(origin+'/api/v2/tokens/'+late.id,{headers})).status(),204);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await page.screenshot({path:path.join(evidence,label+'-setup.png'),fullPage:true});
    }
    assert.deepEqual(errors,[]);
    console.log('PASS: desktop/mobile Shortcut setup, exact download, create-only issuance, mocked clipboard wiring/failure, reveal/mask/hide, outage recovery, revoke/retry, reload and no overflow; '+evidence);
  } catch(error) { if(page) { await page.locator('#shortcut-token').evaluate(el=>el.value='').catch(()=>{}); await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true}); } console.error({evidence,errors}); throw error; }
  finally { await browser.close(); }
})().catch(error=>{ console.error(error);process.exitCode=1; });
