// Node runs this optional test harness; the app itself opens directly from file://.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=process.env.TACLENS_BROWSER_FOLDER?path.resolve(process.env.TACLENS_BROWSER_FOLDER):path.resolve(__dirname,'..');
 await fs.mkdir('test-results',{recursive:true});
 const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],requests=[];
 async function noNetwork(page){page.on('pageerror',error=>errors.push(error.message));await page.route(/^https?:/,route=>{requests.push(route.request().url());return route.abort();});}
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});await noNetwork(page);
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);await page.locator('h1').waitFor();assert.equal(await page.locator('h1').innerText(),'Landscape');assert.match(await page.locator('#workspace-disk-status').innerText(),/Browser storage/);
  await page.locator('[data-view="settings"]').click();assert.equal(await page.locator('#settings-storage').count(),0);await page.locator('#settings-workspaces [data-action="import"]').click();await page.locator('#import-file').setInputFiles(path.join(root,'examples/operations-showcase-workspace.json'));await page.locator('#confirm-import').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('strata.workspace.v1')).layers.length),32);
  await page.locator('[data-view="matrix"]').click();assert.ok(await page.locator('.matrix-scroll').evaluate(el=>el.scrollHeight<=el.clientHeight+1));await page.locator('[data-matrix-parent="T1059"]').first().click();assert.equal(await page.locator('.matrix-tile[data-tech="T1059.001"]').first().isVisible(),true);
  await page.screenshot({path:'test-results/browser-only-file-mode.png',fullPage:false});
  for(const format of ['standard','elt']){
   await page.locator('[data-action="export-report"]').click();await page.locator('#report-format').selectOption(format);const downloading=page.waitForEvent('download');await page.locator('#download-report').click();const file=path.resolve('test-results/browser-only-'+format+'.html');await(await downloading).saveAs(file);
   const html=await fs.readFile(file,'utf8');assert.doesNotMatch(html,/<script src=|<link /);
   const report=await browser.newPage();await noNetwork(report);await report.goto(pathToFileURL(file).href);await report.locator(format==='elt'?'#elt-report h1':'#report h1').waitFor();await report.close();
  }
  await page.reload();await page.locator('h1').waitFor();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('strata.workspace.v1')).layers.length),32);
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);console.log('Browser-only: direct index.html launch without a server, example import, expandable matrix, persistence and both standalone report exports passed with all HTTP/HTTPS requests blocked.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
