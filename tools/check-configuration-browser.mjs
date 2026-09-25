/** New acceptance checks extend all existing tests with actual rendered model materials.
 * Software WebGL may compile/upload a changed material set slowly. The 90 s navigation
 * deadline checks completion and state, not hardware animation speed or frame rate. */
export async function checkConfiguration({page,check,screenshot,state,seek,pause}) {
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await seek(page,1);
  check('All seven configurable material scopes are present',Object.values((await state(page)).materials.capabilities).every(Boolean));
  await page.evaluate(()=>{window.__phase2Canvas=document.querySelector('canvas')});
  const qualityHit = () => page.$eval('select[data-quality]',el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&el.contains(hit)});
  check('Rendering quality remains reachable above the desktop workspace',await qualityHit());
  await page.waitForFunction(()=>window.__REVUELTO__.getState().hotspots.filter(h=>h.visible).length>=2,{timeout:15000});
  check('Visible projected landmarks are interactive',await page.$$eval('[data-hotspot]:not([hidden])',els=>els.length>=2&&els.every(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit&&el.contains(hit)})));
  await page.click('[data-hotspot="headlights"]');
  await page.waitForFunction(()=>{const s=window.__REVUELTO__.getState();return s.detail==='headlights'&&!s.detailMoving},{timeout:90000});
  check('Headlight hotspot opens its panel and guided camera',Boolean(await page.$('[data-detail-card="headlights"]'))&&(await state(page)).ui.activeDetail==='headlights');
  await screenshot(page,'phase2-headlights');
  await page.click('[data-detail-card="headlights"] [data-action="lights"]');
  check('Detail action controls the actual headlights',(await state(page)).headlights.strength===0);
  await page.click('[data-detail-card="headlights"] [data-action="lights"]');
  await page.keyboard.press('Escape');
  check('Escape returns from detail and restores menu focus',(await state(page)).detail===null&&await page.evaluate(()=>document.activeElement.dataset.detailSelect==='headlights'));
  await page.click('[data-detail-select="engine"]');
  await page.waitForFunction(()=>!window.__REVUELTO__.getState().detailMoving,{timeout:90000});
  check('Rear detail hides front-facing headlight marker',!(await state(page)).hotspots.find(x=>x.id==='headlights').visible);
  await screenshot(page,'phase2-engine');
  await page.keyboard.press('Escape');
  await page.click('[data-action="toggle-hotspots"]');
  check('Landmarks can be hidden without removing the detail menu',await page.$eval('[data-hotspot-layer]',el=>el.hidden)&&Boolean(await page.$('[data-detail-select="wheels"]')));
  await page.click('[data-action="toggle-hotspots"]');
  await page.click('#tab-customize');
  const select=async(key,value)=>{await page.click(`[data-config="${key}"][data-value="${value}"]`);await pause(80);};
  await select('paint','verde');await select('paintFinish','matte');await select('carbon','polished');
  let s=await state(page);
  check('New paint and matte are applied to actual body materials',s.finish==='verde'&&s.materials.bindings.paint.every(m=>m.color==='#518239'&&m.roughness>.6&&m.clearcoat<.1));
  check('Polished carbon updates its independent roughness',s.materials.bindings.carbon.every(m=>m.roughness===.2));
  await screenshot(page,'phase2-exterior');
  await page.click('[data-config-section="wheels"]');
  await page.waitForFunction(()=>window.__REVUELTO__.getState().detail==='wheels'&&!window.__REVUELTO__.getState().detailMoving,{timeout:90000});
  await select('wheels','bronze');await select('calipers','giallo');s=await state(page);
  check('Wheel and caliper options update distinct real materials',s.materials.bindings.wheels.every(m=>m.color==='#94704b')&&s.materials.bindings.calipers.every(m=>m.color==='#e4b82c'));
  check('Wheel changes preserve selected exterior',s.configuration.paint==='verde'&&s.configuration.paintFinish==='matte');
  await screenshot(page,'phase2-wheels');
  await page.click('[data-config-section="interior"]');
  await page.waitForFunction(()=>window.__REVUELTO__.getState().detail==='cockpit'&&!window.__REVUELTO__.getState().detailMoving,{timeout:90000});
  await select('seats','ivory');await select('accents','rosso');
  check('Seat inserts and cabin trim colours are independent',(await state(page)).materials.bindings.seats[0].color==='#bfb2a0'&&(await state(page)).materials.bindings.accents[0].color==='#a62623');
  await page.click('[data-action="preview-interior"]');
  await page.waitForFunction(()=>window.__REVUELTO__.getState().cabin.mode==='inside',{timeout:90000});
  check('Configured cabin is visible with exterior focus released',(await state(page)).configuration.seats==='ivory'&&(await state(page)).detail===null);
  check('Cabin drawer receives actual pointer input',await page.$eval('.cabin-palette summary',el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&el.contains(hit)}));
  await page.click('.cabin-palette summary');
  check('Cabin drawer opens with an actual mouse click',await page.$eval('.cabin-palette',el=>el.open));
  check('Native cabin selectors are visible and hit-testable',await page.$$eval('[data-cabin-config]',els=>els.every(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&el.contains(hit)})));
  await page.focus('[data-cabin-config="accents"]');
  check('Cabin select owns keyboard focus before selection',await page.evaluate(()=>document.activeElement.matches('[data-cabin-config="accents"]')));
  await page.keyboard.press('Home');
  await page.waitForFunction(()=>window.__REVUELTO__.getState().configuration.accents==='original',{timeout:15000});
  check('Home returns the controlled cabin select to its first option',await page.$eval('[data-cabin-config="accents"]',el=>el.value==='original'));
  await page.keyboard.press('End');
  await page.waitForFunction(()=>window.__REVUELTO__.getState().configuration.accents==='ivory',{timeout:15000});
  check('End selects the last cabin option and updates its actual material',(await state(page)).materials.bindings.accents[0].color==='#bfb2a0');
  await page.focus('.cabin-palette summary');await page.keyboard.press('Space');
  check('Cabin material drawer closes with the native Space key',await page.$eval('.cabin-palette',el=>!el.open));
  await page.focus('[data-action="cabin-left"]');await page.keyboard.down('Shift');await page.keyboard.press('Tab');await page.keyboard.up('Shift');
  check('Focus trap skips closed disclosure controls',await page.evaluate(()=>document.activeElement.matches('.cabin-palette summary')));
  await page.keyboard.press('Space');await page.keyboard.press('Tab');
  check('Keyboard can reach the open cabin material controls',await page.evaluate(()=>document.activeElement.matches('[data-cabin-config="seats"]')),await page.evaluate(()=>({focused:document.activeElement.outerHTML,open:document.querySelector('.cabin-palette').open})));
  await screenshot(page,'phase2-cabin');
  await page.keyboard.press('Escape');await page.waitForFunction(()=>window.__REVUELTO__.getState().cabin.mode==='exterior',{timeout:90000});
  check('Exit returns to Customize and its original launch button',(await state(page)).ui.mode==='customize'&&await page.evaluate(()=>document.activeElement.dataset.action==='preview-interior'));
  await page.click('[data-config-section="review"]');
  check('Review contains all seven selected options',await page.$$eval('[data-build-value]',els=>els.length===7)&&await page.$eval('[data-build-value="wheels"]',el=>el.textContent==='Bronze'));
  const selection=JSON.stringify((await state(page)).configuration);
  await page.click('#tab-photo');await page.click('[data-action="clean-photo"]');await pause(300);await page.keyboard.press('Escape');
  await seek(page,0);await seek(page,1);
  check('Photo, cabin and replay preserve the complete build',JSON.stringify((await state(page)).configuration)===selection);
  check('All phase-two interactions reuse the same canvas',await page.evaluate(()=>document.querySelectorAll('canvas').length===1&&document.querySelector('canvas')===window.__phase2Canvas));
  for(const [width,height] of [[320,568],[390,844],[768,1024],[844,390]]) {
    await page.setViewport({width,height,deviceScaleFactor:1});await pause(200);await seek(page,1);await page.click('#tab-customize');
    for(const section of ['exterior','wheels','interior','review']){
      // Scroll the panel itself, not the page, before using the sticky step controls.
      await page.$eval('#panel-customize',el=>{el.scrollTop=0});
      check(`${section} step is hit-testable at ${width}x${height}`,await page.$eval(`[data-config-section="${section}"]`,el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !!hit&&el.contains(hit)}));
      await page.click(`[data-config-section="${section}"]`);
      check(`${section} step activates at ${width}x${height}`,(await state(page)).ui.configSection===section);
    }
    check(`Configuration fits without document overflow at ${width}x${height}`,await page.$eval('[data-reveal-controls]',el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&document.documentElement.scrollWidth<=innerWidth+1}));
    check(`Rendering quality receives pointer input at ${width}x${height}`,await qualityHit());
    if(width===390){await page.$eval('#panel-customize',el=>{el.scrollTop=0});await page.click('[data-config-section="exterior"]');await pause(350);await screenshot(page,'phase2-mobile');}
  }
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1});await seek(page,1);await page.click('#tab-customize');await page.$eval('#panel-customize',el=>{el.scrollTop=10000});
  await page.click('[data-action="reset-build"]');
  check('Reset Build restores every default option',JSON.stringify((await state(page)).configuration)===JSON.stringify({paint:'rosso',paintFinish:'gloss',carbon:'satin',wheels:'graphite',calipers:'rosso',seats:'original',accents:'original'}));
  await page.click('#tab-explore');await screenshot(page,'phase2-explore');
  await page.click('[data-detail-select="cockpit"]');
  await page.waitForFunction(()=>!window.__REVUELTO__.getState().detailMoving,{timeout:90000});
  await page.click('[data-action="detail-interior"]');
  await page.waitForFunction(()=>window.__REVUELTO__.getState().cabin.mode==='inside',{timeout:90000});
  check('Cockpit detail action enters the real cabin',(await state(page)).detail===null);
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>window.__REVUELTO__.getState().cabin.mode==='exterior',{timeout:90000});
  check('Contextual cabin exit restores a connected visible control',await page.evaluate(()=>{
    const el=document.activeElement,r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return el.dataset.action==='interior'&&!!hit&&el.contains(hit);
  }));
}
