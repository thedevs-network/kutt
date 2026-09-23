const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { mkdirSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { locale, t } = require('./browser-locale.cjs');

(async () => {
  assert.equal(process.env.KUTT_BROWSER_DISPOSABLE, '1');
  const origin = process.env.KUTT_TEST_URL, evidence = process.env.KUTT_EVIDENCE_DIR;
  assert.equal(new URL(origin).hostname, '127.0.0.1'); assert(evidence);
  mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  let page;
  const measurements = [], errors = [];
  try {
    const context = await browser.newContext({ locale, reducedMotion: 'reduce', extraHTTPHeaders: { 'Accept-Language': locale } });
    const call = async (method, route, data, status = 200) => {
      const response = await context.request.fetch(origin + route, { method, data, headers: { Accept: 'application/json' }, maxRedirects: 0 });
      assert.equal(response.status(), status, route);
      return status === 204 ? null : response.json();
    };
    const admin = await call('POST', '/api/auth/create-admin', { email: 'interface@example.invalid', password: randomBytes(32).toString('hex') }, 201);
    await context.addCookies([{ name: 'token', value: admin.token, url: origin }]);
    const link = await call('POST', '/api/links', { target: 'https://example.org/project/guide.pdf', customurl: 'ui-guide.pdf', description: 'Project guide' }, 201);
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    const settle = async () => {
      await page.waitForLoadState('networkidle');
      await page.waitForFunction(() => !document.querySelector('.htmx-request,.htmx-swapping,.htmx-settling'));
      await page.evaluate(() => document.fonts.ready);
    };
    const goto = async route => {
      const response = await page.goto(origin + route); assert.equal(response.status(), 200, route);
      await settle(); assert.equal(new URL(page.url()).pathname, route);
      assert(await page.title()); assert.equal(await page.locator('html').getAttribute('lang'), locale);
    };
    const capture = async name => {
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), name + ': page overflow');
      for (const select of await page.locator('.list-sort-select:visible').all()) {
        assert(await select.evaluate(node => {
          const style = getComputedStyle(node), context = document.createElement('canvas').getContext('2d');
          context.font = style.font;
          return context.measureText(node.selectedOptions[0].textContent.trim()).width <=
            node.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        }), name + ': selected sort text fits');
      }
      await page.screenshot({ path: path.join(evidence, name + '.png'), fullPage: true, animations: 'disabled' });
    };
    const iconPaint = async label => {
      const painted = await page.locator('.actions :is(a,button):not(:disabled) svg :is(path,polyline,line,circle,rect)').evaluateAll(nodes => {
        const rgb = v => v.match(/[\d.]+/g).map(Number);
        const lum = a => a.slice(0,3).map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((s,v,i) => s+v*[.2126,.7152,.0722][i],0);
        return nodes.filter(n => n.getClientRects().length).flatMap(n => {
          const control = n.closest('a,button'), style = getComputedStyle(n), controlStyle = getComputedStyle(control), bg = controlStyle.backgroundColor;
          if ((rgb(bg)[3] ?? 1) !== 1 || controlStyle.backgroundImage !== 'none') throw new Error('Contrast measurement requires an opaque, untextured control background');
          return ['fill','stroke'].filter(p => style[p] !== 'none').map(p => {
            const a=lum(rgb(style[p])), b=lum(rgb(bg));
            return { label: control.getAttribute('aria-label'), paint: p, foreground: style[p], background: bg, ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05) };
          });
        });
      });
      assert(painted.length >= 8, 'Measure every action, not just the outer SVG');
      for (const paint of painted) { measurements.push({ state: label, ...paint }); assert(paint.ratio >= 3, label + ': ' + JSON.stringify(paint)); }
    };
    for (const width of [1440, 1024, 768, 390, 320]) for (const theme of ['dark','light']) {
      await page.setViewportSize({width,height:900}); await page.emulateMedia({colorScheme:theme});
      await goto('/'); const label = `${locale}-${width}-${theme}`;
      await iconPaint(label);
      const geometry = await page.evaluate(() => {
        const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return {x:r.x,y:r.y,bottom:r.bottom,width:r.width,height:r.height}; };
        return { search:rect('#search'), sort:rect('.list-sort-select'), toggle:rect('#advanced'), heading:rect('#main-table-wrapper h2'), target:rect('#target') };
      });
      assert.equal(geometry.search.height,40); assert.equal(geometry.sort.height,40);
      if(width===1440) assert(Math.abs(geometry.search.bottom-geometry.sort.bottom)<=1, 'Search/sort share baseline');
      assert(geometry.heading.y-geometry.toggle.bottom <= 40, 'No dead space above recent links');
      assert(geometry.target.height<=56); assert(Math.abs(geometry.target.x-geometry.heading.x)<=1);
      for(const control of await page.locator('.actions :is(a,button):visible, .list-sort-select:visible').all()) {
        const box=await control.boundingBox(); assert(box.width>=32 && box.height>=36); assert(box.x>=0 && box.x+box.width<=width+1);
      }
      await page.locator('.actions a').first().hover(); await iconPaint(label+'-hover');
      await page.locator('.actions a').first().focus(); await iconPaint(label+'-focus');
      assert.equal(await page.locator('.actions a').first().evaluate(n=>getComputedStyle(n).outlineColor),theme==='dark'?'rgb(143, 196, 255)':'rgb(36, 91, 128)');
      await capture(label+'-home');
      await page.locator('#skip').evaluate(n => { n.value = '10'; });
      await page.locator('#search').fill('no-matching-fixture'); await settle();
      assert.equal(await page.locator('#skip').inputValue(), '0', 'Pasted search resets pagination without keyup');
      await page.waitForFunction(()=>document.querySelectorAll('tbody tr[id^="tr-"]').length===0); await capture(label+'-empty');
      await page.locator('#search').fill(''); await page.waitForFunction(()=>document.querySelectorAll('tbody tr[id^="tr-"]').length===1); await settle();
      await page.getByRole('button',{name:t('ui.edit_value',{value1:'ui-guide.pdf'}),exact:true}).click(); await settle();
      const edit=page.locator('#edit-form-'+link.id); assert(await edit.isVisible());
      await edit.locator('[name="description"]').fill('A draft'); await capture(label+'-edit');
      await edit.getByRole('button',{name:t('ui.close'),exact:true}).click(); await settle();
      await page.getByRole('button',{name:t('ui.move_value_to_trash',{value1:'ui-guide.pdf'}),exact:true}).click();
      await page.locator('#link-dialog .content').waitFor(); await capture(label+'-confirm'); await page.keyboard.press('Escape');
      await page.locator('#link-dialog').waitFor({state:'hidden'});
      for (const route of ['/settings','/settings/library','/settings/analytics','/settings/workspaces','/settings/trash','/settings/integrations','/settings/security','/settings/retention','/settings/shortcuts','/settings/health','/settings/destination-policy','/settings/domain-sharing','/settings/transfer','/admin','/admin/moderation',...['qr','routing','forwarding','history','health','tracking'].map(p=>'/link/'+p+'/'+link.id),'/stats?id='+link.id]) {
        const response=await page.goto(origin+route); assert.equal(response.status(),200,route); await settle();
        assert(await page.locator('h1,h2').count());
        if (route === '/admin' && width === 1440) {
          assert((await page.locator('thead tr.controls').boundingBox()).height < 200, 'Admin filters stay compact');
          const bottoms=await page.locator('thead th.filters select').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().bottom));
          assert(Math.max(...bottoms)-Math.min(...bottoms)<=1, 'Admin filter/sort controls align');
        }
        if (route === '/settings/library' && width >= 768) assert((await page.locator('.library-links > li').first().boundingBox()).height < 150, 'Library actions do not stretch the row');
        if (route === '/settings/analytics') {
          await page.locator('#analytics-report').waitFor({state:'visible'});
          assert.equal(await page.locator('#analytics-total').textContent(), '0');
          assert(await page.locator('.analytics-chart').isHidden());
          assert(await page.locator('#analytics-geography').isHidden());
          assert(await page.locator('.analytics-tables').isHidden());
          assert(await page.locator('#analytics-json').isVisible());
        }
        for (const select of await page.locator('select:not([multiple]):visible').all()) assert.equal(await select.evaluate(n=>getComputedStyle(n).appearance),'none',route+': a single select arrow');
        await capture(label+route.replace(/\W+/g,'-'));
      }
    }
    assert.deepEqual(errors,[]);
    writeFileSync(path.join(evidence,'paint.json'),JSON.stringify(measurements,null,2));
    console.log(`PASS ${locale}: 10 theme/width variants, 22 management pages plus home/empty/edit/confirm, alignment, spacing, actual SVG contrast, focus and single select arrows; ${measurements.length} paint checks`);
  } catch(e) { if(page) await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true}); throw e; }
  finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
