/** Real production-build cabin UI acceptance, with software WebGL screenshots. */
import fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { checkCabin } from './check-cabin-browser.mjs';
const base = 'http://127.0.0.1:3188', output = 'public/diagnostics';
await fs.mkdir(output, { recursive: true });
const report = { passed:false, renderedInBrowser:false, checks:[], errors:[] };
let browser, server, page;
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms));
const state = page => page.evaluate(()=>window.__REVUELTO__.getState());
const check = (name,pass,detail) => { report.checks.push({name,passed:Boolean(pass),...(detail===undefined?{}:{detail})}); if(!pass)throw new Error(name); };
const screenshot = (page,name) => page.screenshot({path:`${output}/${name}.webp`,type:'webp',quality:85});
async function seek(page,p) {
  await page.evaluate(p=>window.__REVUELTO__.seek(p),p);
  await page.waitForFunction(p=>Math.abs(window.__REVUELTO__.getState().progress-p)<.000001,{timeout:30000},p);
  await pause(900);
}
try {
  server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','-p','3188'],{env:{...process.env,NODE_ENV:'production'},stdio:'ignore'});
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break;}catch{}await pause(500);}
  browser = await puppeteer.launch({executablePath:process.env.CHROMIUM_PATH||await chromium.executablePath(),args:[...chromium.args,'--enable-unsafe-swiftshader'],headless:'shell',defaultViewport:{width:1440,height:900,deviceScaleFactor:1},protocolTimeout:180000});
  page = await browser.newPage();
  page.on('pageerror',error=>report.errors.push(String(error)));
  page.on('console',message=>{if(message.type()==='error')report.errors.push(message.text());});
  await page.goto(base+'/?debug',{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__REVUELTO__?.getState().ready||window.__REVUELTO__?.getState().engineError,{timeout:180000});
  check('Actual optimized car is available',(await state(page)).ready);
  report.renderedInBrowser=true;
  await checkCabin({page,check,screenshot,state,seek,pause});
  const reduced=await browser.newPage();
  await reduced.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await reduced.goto(base+'/?debug',{waitUntil:'domcontentloaded'});
  await reduced.waitForFunction(()=>window.__REVUELTO__?.getState().ready,{timeout:180000});
  await reduced.click('[data-action="interior"]');
  check('Reduced motion enters without a camera flight',(await state(reduced)).cabin.mode==='inside');
  await reduced.click('[data-action="exit-interior"]');
  check('Reduced motion exits immediately and unlocks the page',(await state(reduced)).cabin.mode==='exterior'&&await reduced.evaluate(()=>!document.documentElement.classList.contains('cabin-locked')));
  await reduced.close();
  check('No uncaught JavaScript or shader errors in cabin',report.errors.length===0,report.errors);
  report.passed=true;
} catch(error) {
  report.error=error.stack||String(error);
  if(page)try{report.failureState=await state(page);await screenshot(page,'cabin-failure');}catch{}
  console.error('CABIN_BROWSER_FAILED',report.error);
} finally {
  if(browser)await browser.close().catch(()=>{});
  server?.kill('SIGTERM');report.completedAt=new Date().toISOString();
  await fs.writeFile(`${output}/cabin.json`,JSON.stringify(report,null,2));
  console.log('CABIN_BROWSER_REPORT',JSON.stringify(report));
  if(!report.passed&&process.env.VERCEL_ENV!=='preview')process.exitCode=1;
}
