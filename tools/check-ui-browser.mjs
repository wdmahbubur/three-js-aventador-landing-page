/** Phase-one acceptance extends the existing real-model browser suite without weakening it. */
export async function checkUiFoundation({page,check,screenshot,state,seek,pause}) {
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await seek(page,1);
  check('Declarative React UI replaces the HTML-string controller',await page.$eval('.experience',el=>el.dataset.ui==='react'));
  check('Exactly three showroom tabs are available',await page.$$eval('[role="tab"]',els=>els.length===3));
  check('Explore is the default workspace',(await state(page)).ui.mode==='explore');
  await page.evaluate(()=>{window.__testCanvas=document.querySelector('canvas')});
  await page.focus('#tab-explore');await page.keyboard.press('ArrowRight');
  check('Arrow keys activate Customize and move focus',await page.evaluate(()=>document.activeElement.id==='tab-customize')&&(await state(page)).ui.mode==='customize');
  check('Only one tab is selected and tabbable',await page.$$eval('[role="tab"]',els=>els.filter(el=>el.tabIndex===0).length===1&&els.filter(el=>el.getAttribute('aria-selected')==='true').length===1));
  check('Inactive panels are hidden',await page.$$eval('[role="tabpanel"]',els=>els.filter(el=>!el.hidden).length===1));
  await page.click('[data-finish="arancio"]');
  check('React selection and WebGL finish agree',(await state(page)).ui.finish==='arancio'&&(await state(page)).finish==='arancio');
  await page.focus('#tab-customize');await page.keyboard.press('End');
  check('End activates Photo and starts composition controls',(await state(page)).ui.mode==='photo'&&(await state(page)).inspect);
  check('Mode changes keep the same single canvas',await page.evaluate(()=>document.querySelectorAll('canvas').length===1&&document.querySelector('canvas')===window.__testCanvas));
  check('Selected paint survives mode changes',(await state(page)).finish==='arancio');
  await screenshot(page,'ui-photo');
  await page.click('[data-action="clean-photo"]');
  check('Clean view hides and inerts the workspace',await page.$eval('[data-reveal-controls]',el=>el.inert&&getComputedStyle(el).visibility==='hidden'));
  check('Clean view exposes a visible escape control',await page.$eval('[data-restore-ui]',el=>!el.hidden&&el.getBoundingClientRect().top>=0));
  await page.keyboard.press('Tab');check('Clean view keyboard focus reaches the canvas',await page.evaluate(()=>document.activeElement.tagName==='CANVAS'));
  await screenshot(page,'ui-clean-view');
  await page.keyboard.press('Escape');
  check('Escape restores the Photo panel and focus',!(await state(page)).ui.cleanView&&await page.evaluate(()=>document.activeElement.dataset.action==='clean-photo'));
  await page.click('[data-action="reset-camera"]');check('Photo reset leaves orbit controls usable',(await state(page)).inspect);
  await page.focus('#tab-photo');await page.keyboard.press('Home');
  check('Home returns to Explore and releases photo camera',(await state(page)).ui.mode==='explore'&&!(await state(page)).inspect);
  await page.click('[data-action="explode"]');await page.waitForFunction(()=>window.__REVUELTO__.getState().exploded>.99,{timeout:30000});
  await page.click('#tab-customize');await page.waitForFunction(()=>window.__REVUELTO__.getState().exploded<.001,{timeout:30000});
  check('Switching workspace clears conflicting exploded state',!(await state(page)).ui.exploded);
  await screenshot(page,'ui-customize');
  for(const [width,height] of [[320,568],[390,844],[768,1024],[844,390]]) {
    await page.setViewport({width,height,deviceScaleFactor:1});await pause(250);await seek(page,1);
    for(const mode of ['explore','customize','photo']) {
      await page.click(`[data-mode-tab="${mode}"]`);
      check(`${mode} workspace fits ${width}x${height}`,await page.$eval('[data-reveal-controls]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth+1}));
    }
    if(width===390)await screenshot(page,'ui-mobile');
  }
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await seek(page,0);
  check('Replay returns to Explore while retaining the finish',(await state(page)).ui.mode==='explore'&&(await state(page)).finish==='arancio');
  await seek(page,1);await page.click('#tab-customize');await page.click('[data-action="reset-finish"]');
  check('Explicit reset restores the initial finish',(await state(page)).ui.finish==='rosso'&&(await state(page)).finish==='rosso');
  await page.click('#tab-explore');await screenshot(page,'ui-explore');
}
