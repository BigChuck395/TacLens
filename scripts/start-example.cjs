const path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const {WorkspaceStore}=require('../workspace-store.cjs'),{buildShowcase}=require('./build-showcase.cjs');
async function prepareExample(directory=process.env.STRATA_STORAGE_DIR||path.join(__dirname,'../workspaces')){
  const catalog={};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data.js'),'utf8'),catalog);
  const store=new WorkspaceStore(directory,catalog.ATTACK_DATA),state=await store.load();
  const before=JSON.stringify(state.library),library=state.library||{version:1,activeId:'',workspaces:[]};
  let example=library.workspaces.find(w=>w.generatedTestingWorkspace===1);
  if(!example){example={...buildShowcase(),id:randomUUID(),name:'TacLens · Testing workspace',generatedTestingWorkspace:1};library.workspaces.push(example);}
  library.activeId=example.id;
  if(JSON.stringify(library)!==before)await store.write(library,state.revision,state.fileRevisions);
  return example.id;
}
if(require.main===module)prepareExample().then(()=>{console.log('Testing workspace ready. Existing workspaces and example edits are retained.');require('../server.cjs');}).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={prepareExample};
