const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const makeWorkspace=name=>({id:crypto.randomUUID(),schema:'strata-workspace',version:1,name,demo:true,folders:['Intelligence/Current'],tags:['intel'],layers:[{id:crypto.randomUUID(),name:'Intel mapping',type:'intel',visible:true,folder:'Intelligence/Current',metadata:{reviewDays:null},entries:[{techniqueID:'T1059.001',status:'observed',compensatingControl:'architecture',notes:'Keep this evidence',date:'2026-10-14'}]}]});
(async()=>{
 await fs.mkdir('test-results',{recursive:true});const directory=await fs.mkdtemp(path.resolve('test-results/disk-browser-'));
 process.env.PORT='5190';process.env.STRATA_STORAGE_MODE='disk';process.env.STRATA_STORAGE_DIR=directory;
 let server=require('../server.cjs');if(!server.listening)await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});const errors=[];
 const saved=page=>page.locator('#workspace-disk-status[data-phase="saved"]').waitFor();
 const get=async()=>{const response=await fetch('http://127.0.0.1:5190/api/workspaces');return response.json();};
 try{
  const a=makeWorkspace('Browser evidence'),b=makeWorkspace('Other workspace'),legacy={version:1,activeId:a.id,workspaces:[a,b]};
  const context=await browser.newContext(),page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(w=>{if(!localStorage.getItem('migration-fixture')){localStorage.setItem('strata.workspaces.v1',JSON.stringify(w));localStorage.setItem('strata.workspace.v1',JSON.stringify(w.workspaces[0]));localStorage.setItem('migration-fixture','done');}},legacy);
  await page.goto('http://127.0.0.1:5190/');await saved(page);assert.equal(await page.locator('.sample-banner').count(),0);
  let file=JSON.parse(await fs.readFile(path.join(directory,a.id,'workspace.json')));assert.equal(file.layers[0].entries[0].status,'intelligence');assert.match(file.layers[0].entries[0].notes,/Keep this evidence/);assert.equal((await get()).library.workspaces.length,2);
  await page.locator('[data-action="workspaces"]').click();await page.locator(`[data-rename-workspace="${a.id}"]`).click();await page.locator('#workspace-name').fill('Saved on disk');await page.locator('#save-workspace').click();await saved(page);assert.equal(JSON.parse(await fs.readFile(path.join(directory,a.id,'workspace.json'))).name,'Saved on disk');
  await page.locator('[data-delete-workspace="'+b.id+'"]').click();await page.locator('#confirm-delete-workspace').click();await saved(page);await page.getByRole('button',{name:'Close',exact:true}).click();await page.reload();await saved(page);assert.equal((await get()).library.workspaces.length,1);assert.ok((await fs.readdir(path.join(directory,'.trash'))).length);
  // Clearing browser data must not remove saved workspaces. Do not re-seed the test fixture on subsequent reloads.
  await page.evaluate(()=>{localStorage.clear();localStorage.setItem('migration-fixture','done');});await page.reload();await saved(page);assert.equal(await page.locator('.workspace-name').innerText(),'Saved on disk');assert.equal(await page.locator('.layer-card').count(),1);
  const clean=await browser.newContext(),cleanPage=await clean.newPage();cleanPage.on('pageerror',e=>errors.push(e.message));await cleanPage.goto('http://127.0.0.1:5190/');await saved(cleanPage);assert.equal(await cleanPage.locator('.workspace-name').innerText(),'Saved on disk');assert.equal(await cleanPage.evaluate(()=>localStorage.getItem('strata.workspaces.v1')),null);
  // A different browser's existing workspace migrates without replacing the already-saved workspace.
  const c=makeWorkspace('Another browser workspace'),legacyContext=await browser.newContext(),legacyPage=await legacyContext.newPage();legacyPage.on('pageerror',e=>errors.push(e.message));
  await legacyPage.addInitScript(w=>localStorage.setItem('strata.workspaces.v1',JSON.stringify(w)),{version:1,activeId:c.id,workspaces:[a,c]});await legacyPage.goto('http://127.0.0.1:5190/');await saved(legacyPage);assert.equal((await get()).library.workspaces.length,2);assert.equal(JSON.parse(await fs.readFile(path.join(directory,a.id,'workspace.json'))).name,'Saved on disk');
  await legacyPage.locator('[data-view="settings"]').click();await saved(legacyPage);assert.match(await legacyPage.locator('.settings-content').innerText(),/Workspace storage/);assert.ok((await legacyPage.locator('.settings-content').innerText()).includes(directory));await legacyPage.screenshot({path:'test-results/disk-workspace-settings.png',fullPage:true});
  await clean.close();await legacyContext.close();await context.close();
  // Restart the local service; only the files survive, not any browser session or server memory.
  await new Promise(r=>server.close(r));delete require.cache[require.resolve('../server.cjs')];server=require('../server.cjs');if(!server.listening)await new Promise(r=>server.once('listening',r));
  const afterRestart=await browser.newPage();afterRestart.on('pageerror',e=>errors.push(e.message));await afterRestart.goto('http://127.0.0.1:5190/');await saved(afterRestart);assert.equal((await get()).library.workspaces.length,2);
  // Remote websites cannot access workspace files, and files are never served as static assets.
  assert.equal((await fetch('http://127.0.0.1:5190/api/workspaces',{headers:{Origin:'https://example.com'}})).status,403);
  assert.equal((await fetch('http://127.0.0.1:5190/'+a.id+'/workspace.json')).status,404);
  const snapshot=await get();assert.equal((await fetch('http://127.0.0.1:5190/api/workspaces',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({library:snapshot.library,revision:snapshot.revision-1})})).status,409);
  // A failed save stays visibly failed, and retry writes the retained in-memory edits to disk.
  await afterRestart.route('**/api/workspaces',route=>route.request().method()==='PUT'?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Simulated disk write failure'})}):route.continue());
  await afterRestart.locator('[data-action="workspaces"]').click();await afterRestart.locator(`[data-rename-workspace="${c.id}"]`).click();await afterRestart.locator('#workspace-name').fill('Recovered disk save');await afterRestart.locator('#save-workspace').click();await afterRestart.locator('#workspace-disk-status[data-phase="error"]').waitFor();assert.equal(JSON.parse(await fs.readFile(path.join(directory,c.id,'workspace.json'))).name,'Another browser workspace');
  await afterRestart.unroute('**/api/workspaces');await afterRestart.getByRole('button',{name:'Close',exact:true}).click();await afterRestart.locator('[data-view="settings"]').click();await afterRestart.locator('#save-disk-now').click();await saved(afterRestart);assert.equal(JSON.parse(await fs.readFile(path.join(directory,c.id,'workspace.json'))).name,'Recovered disk save');
  assert.deepEqual(errors,[]);console.log('Disk workspaces: migrated browser data, preserved mappings, saved rename/delete, cache clearing, fresh browsers, additional-profile migration, server restart, local-only API, no demo banner.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
