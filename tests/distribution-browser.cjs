// Exercise this distribution without reading or changing installed user workspaces.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
const {buildSite}=require('../scripts/build-site.cjs'),{prepareExample}=require('../scripts/start-example.cjs');
const {WorkspaceStore}=require('../workspace-store.cjs'),S=require('../core.js');
(async()=>{
 const root=path.resolve(__dirname,'..');process.chdir(root);
 await fs.mkdir('test-results',{recursive:true});
 const directory=await fs.mkdtemp(path.join(root,'test-results','distribution-'));
 process.env.PORT='5198';process.env.STRATA_STORAGE_MODE='disk';process.env.STRATA_STORAGE_DIR=directory;
 buildSite({date:'2026-10-19'});
 const server=require('../server.cjs');if(!server.listening)await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];
 try{
  const local=await browser.newPage();local.on('pageerror',e=>errors.push(e.message));
  await local.goto('http://127.0.0.1:5198/');await local.locator('#workspace-disk-status[data-phase="saved"]').waitFor();
  const initial=await(await fetch('http://127.0.0.1:5198/api/workspaces')).json();assert.equal(initial.mode,'disk');assert.equal(initial.library.workspaces.length,1);assert.equal(initial.library.workspaces[0].layers.length,0);await local.close();
  const id=await prepareExample(directory),catalog={};vm.runInNewContext(await fs.readFile('data.js','utf8'),catalog);
  const store=new WorkspaceStore(directory,catalog.ATTACK_DATA),loaded=await store.load(),sample=loaded.library.workspaces.find(w=>w.id===id);
  assert.equal(loaded.library.workspaces.length,2);assert.equal(sample.layers.length,32);assert.equal(S.recommendationItems(sample,catalog.ATTACK_DATA).filter(x=>x.accepted).length,2);assert.equal(S.workItems(sample,catalog.ATTACK_DATA,sample.generatedOn).length,10);
  sample.layers[0].entries[0].notes='Synthetic edit retained on example startup.';await store.write(loaded.library,loaded.revision,loaded.fileRevisions);
  assert.equal(await prepareExample(directory),id);const reopened=await store.load();assert.equal(reopened.library.workspaces.length,2);assert.equal(reopened.library.workspaces.find(w=>w.id===id).layers[0].entries[0].notes,'Synthetic edit retained on example startup.');
  const withExample=await browser.newPage({viewport:{width:1440,height:1100}});withExample.on('pageerror',e=>errors.push(e.message));await withExample.goto('http://127.0.0.1:5198/');await withExample.locator('#workspace-disk-status[data-phase="saved"]').waitFor();assert.equal(await withExample.locator('.workspace-name').innerText(),'TacLens · Testing workspace');await withExample.locator('[data-view="matrix"]').click();assert.ok(await withExample.locator('.matrix-scroll').evaluate(el=>el.scrollHeight<=el.clientHeight+1));await withExample.screenshot({path:'test-results/distribution-local.png',fullPage:false});await withExample.close();
  for(const name of ['workspaces/index.json','.env','backups/private.json'])assert.equal((await fetch('http://127.0.0.1:5198/'+name)).status,404);
  const hosted=await browser.newPage({viewport:{width:1440,height:1100}});hosted.on('pageerror',e=>errors.push(e.message));const requests=[];
  const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.ico':'image/x-icon','.json':'application/json'};
  await hosted.route('**/*',async route=>{
   const url=new URL(route.request().url());requests.push(url.href);assert.equal(url.origin,'https://example.github.io');assert.ok(url.pathname.startsWith('/taclens/'));
   const relative=decodeURIComponent(url.pathname.slice('/taclens/'.length))||'index.html',file=path.resolve(root,'_site',relative),siteRoot=path.resolve(root,'_site');
   assert.ok(file.startsWith(siteRoot+path.sep));
   try{await route.fulfill({status:200,contentType:types[path.extname(file)]||'text/plain',body:await fs.readFile(file)});}catch(error){if(error.code!=='ENOENT')throw error;await route.fulfill({status:404,body:'Not found'});}
  });
  await hosted.goto('https://example.github.io/taclens/');await hosted.locator('[data-view="settings"]').click();assert.equal(await hosted.evaluate(()=>(JSON.parse(localStorage.getItem('strata.workspace.v1'))?.layers.length??0)),0);assert.match(await hosted.locator('#workspace-disk-status').innerText(),/browser/i);
  await hosted.locator('#settings-workspaces [data-action="import"]').click();await hosted.locator('#import-file').setInputFiles(path.join(root,'examples','operations-showcase-workspace.json'));await hosted.locator('#confirm-import').click();assert.equal(await hosted.evaluate(()=>JSON.parse(localStorage.getItem('strata.workspace.v1')).layers.length),32);
  await hosted.locator('[data-view="matrix"]').click();assert.ok(await hosted.locator('[data-matrix-parent]').count()>0);assert.ok(await hosted.locator('.matrix-scroll').evaluate(el=>el.scrollHeight<=el.clientHeight+1));await hosted.screenshot({path:'test-results/distribution-static.png',fullPage:false});
  await hosted.reload();assert.equal(await hosted.evaluate(()=>JSON.parse(localStorage.getItem('strata.workspace.v1')).layers.length),32);assert.ok(requests.some(url=>url.endsWith('/taclens/api/workspaces')));assert.deepEqual(errors,[]);
  console.log('Distribution: empty local startup, independent generated example, retained edits/reviews/work, protected files, static-host subpath, browser storage, example import and persistence passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
