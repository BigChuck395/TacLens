const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {assets,examplePath,buildSite}=require('../scripts/build-site.cjs');
function fixture(t){
  const parent=path.resolve('test-results');fs.mkdirSync(parent,{recursive:true});
  const root=fs.mkdtempSync(path.join(parent,'static-build-'));
  t.after(()=>{assert.equal(path.dirname(root),parent);fs.rmSync(root,{recursive:true,force:true});});
  for(const asset of assets)fs.copyFileSync(path.join(__dirname,'..',asset),path.join(root,asset));
  return root;
}
test('static build excludes private data, backend and reports, and generates its own testing workspace',t=>{
  const root=fixture(t);
  for(const directory of ['workspaces','backups','reports','examples']){fs.mkdirSync(path.join(root,directory));fs.writeFileSync(path.join(root,directory,directory==='examples'?'operations-showcase-workspace.json':'private.json'),'PRIVATE_DATA_SENTINEL');}
  fs.writeFileSync(path.join(root,'server.cjs'),'PRIVATE_BACKEND_SENTINEL');
  const result=buildSite({root,date:'2026-10-19'}),output=path.join(root,'_site');
  assert.equal(result.example.layers,32);assert.ok(result.example.mappings>1000);
  for(const directory of ['workspaces','backups','reports'])assert.equal(fs.existsSync(path.join(output,directory)),false);
  assert.equal(fs.existsSync(path.join(output,'server.cjs')),false);
  const text=fs.readFileSync(path.join(output,examplePath),'utf8');assert.doesNotMatch(text,/PRIVATE_DATA_SENTINEL/);assert.equal(JSON.parse(text).generatedOn,'2026-10-19');
  assert.equal(fs.readFileSync(path.join(output,'app.js'),'utf8'),fs.readFileSync(path.join(root,'app.js'),'utf8'));
  assert.equal(fs.existsSync(path.join(output,'.nojekyll')),true);
});
test('repeated builds refuse unexpected output instead of publishing or deleting it',t=>{
  const root=fixture(t);buildSite({root,date:'2026-10-19'});buildSite({root,date:'2026-10-19'});
  const privateFile=path.join(root,'_site','private-report.html');fs.writeFileSync(privateFile,'Keep private');
  assert.throws(()=>buildSite({root}),/Unexpected file/);assert.equal(fs.readFileSync(privateFile,'utf8'),'Keep private');
});
