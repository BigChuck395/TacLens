const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),os=require('node:os');
const {validateLayers,folderPath,activeTags,normalizeUsers}=require('./core.js');
const History=require('./history.js');
const Terms=require('./terminology.js');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail=(message,status=400)=>Object.assign(Error(message),{status});
function absoluteFolder(value){if(typeof value!=='string'||!value.trim()||value.length>32760||value.includes('\0')||!path.isAbsolute(value.trim())||/^\\\\[?.]\\/.test(value.trim()))throw fail('Enter a full folder path, such as Z:\\TacLens or \\\\server\\share\\TacLens.');return path.resolve(value.trim());}
const samePath=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
class WorkspaceStore {
 constructor(directory,catalog){this.directory=path.resolve(directory);this.catalog=catalog;this.queue=Promise.resolve();}
 child(...parts){const target=path.resolve(this.directory,...parts),relative=path.relative(this.directory,target);if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Invalid workspace path.');return target;}
 enqueue(work){const task=this.queue.then(work);this.queue=task.catch(()=>{});return task;}
 async regular(file,fresh=false){const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Workspace files must be regular files.');return fs.readFile(file,{encoding:'utf8',flag:fresh?'rs':'r'});}
 async folder(id){if(!uuid.test(id))throw Error('Invalid workspace ID.');const directory=this.child(id);await fs.mkdir(directory,{recursive:true});await this.checkDirectory(directory);return directory;}
 async checkDirectory(directory){const stat=await fs.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink())throw Error('Workspace storage must be a directory, not a link.');}
 async atomic(file,text){const temporary=file+'.tmp-'+crypto.randomUUID();try{await fs.writeFile(temporary,text,{flag:'wx',mode:0o600});await fs.rename(temporary,file);}catch(error){await fs.unlink(temporary).catch(()=>{});throw error;}}
 async index(){
  let index;try{index=JSON.parse(await this.regular(this.child('index.json')));}catch(error){if(error.code==='ENOENT'){const entries=await fs.readdir(this.directory,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});if(entries.some(e=>uuid.test(e.name)))throw Error('The workspace index is missing, but workspace folders exist. Restore index.json from a backup before continuing.');return null;}throw error;}
  if(index.version!==1||!Number.isInteger(index.revision)||!Array.isArray(index.ids)||index.ids.length>100||index.ids.some(id=>!uuid.test(id))||new Set(index.ids).size!==index.ids.length)throw Error('Workspace index is invalid. No data was overwritten.');
  if(index.locations!==undefined&&(!index.locations||typeof index.locations!=='object'||Array.isArray(index.locations)||Object.entries(index.locations).some(([id,folder])=>!index.ids.includes(id)||!uuid.test(id)||typeof folder!=='string')))throw Error('Workspace folder locations are invalid.');
  for(const folder of Object.values(index.locations||{}))absoluteFolder(folder);
  return index;
 }
 directoryFor(index,id){return index?.locations?.[id]?absoluteFolder(index.locations[id]):this.child(id);}
 location(index,id){const directory=this.directoryFor(index,id);return {directory,parent:path.dirname(directory),external:!samePath(directory,this.child(id))};}
 async fileState(index,id,contents=true){
  const directory=this.directoryFor(index,id),file=path.join(directory,'workspace.json');
  try{await this.checkDirectory(directory);const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('workspace.json must be a regular file.');const text=contents?await fs.readFile(file,{encoding:'utf8',flag:this.location(index,id).external?'rs':'r'}):null;return {directory,text,hash:text===null?null:crypto.createHash('sha256').update(text).digest('hex'),stamp:[id,directory,stat.size,stat.mtimeMs,stat.ctimeMs,stat.ino]};}
  catch(error){throw fail('Cannot access workspace “'+(index.names?.[id]||id)+'” in '+directory+': '+error.message+'. Reconnect the drive and retry. Its saved data has not been replaced.',503);}
 }
 token(index,files){return crypto.createHash('sha256').update(JSON.stringify([index.revision,index.activeId,files.map(f=>f.stamp)])).digest('hex');}
 async read(givenIndex){
  const index=givenIndex===undefined?await this.index():givenIndex;if(!index)return {library:null,revision:0,storagePath:this.directory,workspaceLocations:{},fileRevisions:{},syncToken:'empty'};
  const files=await Promise.all(index.ids.map(id=>this.fileState(index,id))),workspaces=files.map((file,i)=>{const id=index.ids[i],workspace=JSON.parse(file.text);if(String(workspace.id).toLowerCase()!==id.toLowerCase())throw Error('Workspace folder and file IDs disagree.');return {...workspace,id};});
  if(!workspaces.some(w=>w.id===index.activeId))throw Error('The active workspace is missing.');
  return {library:{version:1,activeId:index.activeId,workspaces},revision:index.revision,storagePath:this.directory,workspaceLocations:Object.fromEntries(index.ids.map(id=>[id,this.location(index,id)])),fileRevisions:Object.fromEntries(index.ids.map((id,i)=>[id,files[i].hash])),syncToken:this.token(index,files)};
 }
 async revision(){return (await this.index())?.revision||0;}
 load(since=null){return this.enqueue(async()=>{const index=await this.index();if(since!==null&&index){if(typeof since==='number'||/^\d+$/.test(String(since))){if(Number(since)===index.revision)return {unchanged:true,revision:index.revision};}else{const files=await Promise.all(index.ids.map(id=>this.fileState(index,id,false))),syncToken=this.token(index,files);if(since===syncToken)return {unchanged:true,revision:index.revision,syncToken};}}return this.read(index);});}
 normalize(library){
  if(library?.version!==1||!Array.isArray(library.workspaces)||!library.workspaces.length||library.workspaces.length>100)throw Error('Expected 1–100 workspaces.');
  const ids=new Set();const workspaces=library.workspaces.map(w=>{
   if(!w||!uuid.test(w.id)||ids.has(w.id.toLowerCase())||w.schema!=='strata-workspace'||w.version!==1||typeof w.name!=='string'||!w.name.trim()||w.name.length>160)throw Error('Invalid workspace identity or name.');ids.add(w.id.toLowerCase());
   const checked=validateLayers(w.layers,this.catalog);if(checked.unknown)throw Error('Workspace contains unknown technique IDs.');
   const layerIds=new Set();const layers=checked.layers.map((l,i)=>{const id=w.layers[i]?.id?.toLowerCase();if(!uuid.test(id)||layerIds.has(id))throw Error('Invalid or duplicate layer ID.');layerIds.add(id);return {...l,id};});
   return {...w,terminology:Terms.normalize(w.terminology),changeHistory:History.normalize(w.changeHistory),changeTrackingSince:History.iso(w.changeTrackingSince),id:w.id.toLowerCase(),name:w.name.trim(),folders:[...new Set((w.folders||[]).map(folderPath).filter(Boolean))],tags:activeTags(w.tags,layers),users:normalizeUsers(w.users),collapsedFolders:(w.collapsedFolders||[]).map(folderPath).filter(Boolean),layers};
  });const activeId=String(library.activeId||'').toLowerCase();if(!ids.has(activeId))throw Error('Choose an existing active workspace.');return {version:1,activeId,workspaces};
 }
 async withLock(directory,work){
  const directoryLock=path.join(directory,'.taclens-write.lock'),ownerFile=path.join(directoryLock,'owner.json'),owner=crypto.randomUUID();
  try{await fs.mkdir(directoryLock,{mode:0o700});}catch(error){if(error.code==='EEXIST')throw fail('Workspace storage is busy in '+directory+'. Retry after the other save finishes. If no TacLens session is saving, check the .taclens-write.lock folder before removing a leftover lock.',423);throw error;}
  try{await fs.writeFile(ownerFile,JSON.stringify({owner,host:os.hostname(),pid:process.pid,startedAt:new Date().toISOString()}),{flag:'wx',mode:0o600});return await work();}
  finally{try{const saved=JSON.parse(await fs.readFile(ownerFile,'utf8'));if(saved.owner===owner){await fs.unlink(ownerFile);await fs.rmdir(directoryLock);}}catch(error){}}
 }
 async rootLock(work){await fs.mkdir(this.directory,{recursive:true});await this.checkDirectory(this.directory);return this.withLock(this.directory,work);}
 async locks(directories,work){const dirs=[...new Set(directories)].sort();const next=i=>i===dirs.length?work():this.withLock(dirs[i],()=>next(i+1));return next(0);}
 assertRevision(expected,actual){if(!Number.isInteger(expected)||expected!==actual)throw fail('Another session saved newer workspace data. Export your pending changes, then reload before continuing.',409);}
 assertFileRevision(expected,actual,required=false){if((required||expected!==undefined)&&expected!==actual)throw fail('This workspace changed in another session or computer. Export your pending changes and reload before saving over the shared copy.',409);}
 async writeIndex(previous,library,locations={}){
  if(previous)await this.atomic(this.child('index.backup.json'),JSON.stringify(previous,null,2)+'\n');
  const index={version:1,revision:(previous?.revision||0)+1,activeId:library.activeId,ids:library.workspaces.map(w=>w.id),names:Object.fromEntries(library.workspaces.map(w=>[w.id,w.name])),locations:Object.fromEntries(library.workspaces.filter(w=>locations[w.id]).map(w=>[w.id,locations[w.id]]))};
  await this.atomic(this.child('index.json'),JSON.stringify(index,null,2)+'\n');return index;
 }
 metadata(loaded){const {library,...metadata}=loaded;return metadata;}
 write(library,revision,fileRevisions){return this.enqueue(()=>this.commit(library,revision,fileRevisions));}
 async commit(input,revision,fileRevisions){
  const library=this.normalize(input);
  return this.rootLock(async()=>{
   const index=await this.index(),previous=await this.read(index);this.assertRevision(revision,previous.revision);
   const before=new Map((previous.library?.workspaces||[]).map(w=>[w.id,w])),changed=library.workspaces.filter(w=>!before.has(w.id)||JSON.stringify(before.get(w.id))!==JSON.stringify(w));
   const directories=[];for(const w of changed){if(!before.has(w.id)){const dir=await this.folder(w.id);try{await fs.lstat(path.join(dir,'workspace.json'));throw fail('A saved copy already exists for this workspace. Open its folder instead of overwriting it.',409);}catch(error){if(error.code!=='ENOENT')throw error;}}directories.push(this.directoryFor(index,w.id));}
   await this.locks(directories,async()=>{
    const oldFiles=new Map();for(const w of changed)if(before.has(w.id)){const old=await this.fileState(index,w.id);this.assertFileRevision(fileRevisions?.[w.id],old.hash,this.location(index,w.id).external);oldFiles.set(w.id,old);}
    for(const w of changed){const dir=this.directoryFor(index,w.id),old=oldFiles.get(w.id);if(old)await this.atomic(path.join(dir,'workspace.backup.json'),old.text);await this.atomic(path.join(dir,'workspace.json'),JSON.stringify(w,null,2)+'\n');}
    await this.writeIndex(index,library,index?.locations||{});
   });
   for(const id of before.keys())if(!library.workspaces.some(w=>w.id===id)&&!this.location(index,id).external){await fs.mkdir(this.child('.trash'),{recursive:true});await fs.rename(this.child(id),this.child('.trash',id+'-'+crypto.randomUUID())).catch(()=>{});}
   return this.metadata(await this.read());
  });
 }
 async writableFolder(input){
  const folder=absoluteFolder(input);await this.checkDirectory(folder);const real=await fs.realpath(folder),probe=path.join(real,'.taclens-check-'+crypto.randomUUID());let handle;
  try{handle=await fs.open(probe,'wx',0o600);await handle.writeFile('TacLens folder access check');}finally{if(handle){await handle.close();await fs.unlink(probe);}}
  return real;
 }
 previewFolder(id,parent){return this.enqueue(async()=>{
  const state=await this.read(),workspace=state.library?.workspaces.find(w=>w.id===id);if(!workspace)throw fail('Choose an existing workspace.');const folder=await this.writableFolder(parent),target=path.join(folder,id);let exists=false;try{await fs.lstat(target);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
  return {id,name:workspace.name,layers:workspace.layers.length,mappings:workspace.layers.reduce((n,l)=>n+l.entries.length,0),parent:folder,target,current:state.workspaceLocations[id].directory,alreadyHere:samePath(target,state.workspaceLocations[id].directory),targetExists:exists,revision:state.revision,fileRevision:state.fileRevisions[id]};
 });}
 copyToFolder({id,parent,revision,fileRevision}){return this.enqueue(()=>this.rootLock(async()=>{
  const index=await this.index(),state=await this.read(index);this.assertRevision(revision,state.revision);const workspace=state.library?.workspaces.find(w=>w.id===id);if(!workspace)throw fail('Choose an existing workspace.');
  const folder=await this.writableFolder(parent),target=path.join(folder,id),source=this.directoryFor(index,id);if(samePath(target,source))throw fail('This workspace already uses that folder.');
  return this.withLock(source,async()=>{
   const original=await this.fileState(index,id);this.assertFileRevision(fileRevision,original.hash,true);
   try{await fs.mkdir(target);}catch(error){if(error.code==='EEXIST')throw fail('The destination workspace folder already exists. Open that saved folder or choose a different parent folder. Nothing was overwritten.',409);throw error;}
   let linked=false;const written=[];
   try{
    let backup;try{backup=await this.regular(path.join(source,'workspace.backup.json'));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(backup!==undefined){await this.atomic(path.join(target,'workspace.backup.json'),backup);written.push('workspace.backup.json');}
    await this.atomic(path.join(target,'workspace.json'),original.text);written.push('workspace.json');
    await this.writeIndex(index,state.library,{...(index.locations||{}),[id]:target});linked=true;
    return {...await this.read(),previousFolder:source};
   }catch(error){if(!linked){for(const name of written)await fs.unlink(path.join(target,name)).catch(()=>{});await fs.rmdir(target).catch(()=>{});}throw error;}
  });
 }));}
 async inspect(input){
  const directory=await this.writableFolder(input),text=await this.regular(path.join(directory,'workspace.json'),true),raw=JSON.parse(text);
  const workspace=this.normalize({version:1,activeId:raw.id,workspaces:[raw]}).workspaces[0];
  return {workspace,directory,fileRevision:crypto.createHash('sha256').update(text).digest('hex')};
 }
 inspectFolder(folder){return this.enqueue(async()=>{const index=await this.index(),found=await this.inspect(folder),listed=!!index?.ids.includes(found.workspace.id);return {id:found.workspace.id,name:found.workspace.name,layers:found.workspace.layers.length,mappings:found.workspace.layers.reduce((n,l)=>n+l.entries.length,0),folder:found.directory,fileRevision:found.fileRevision,revision:index?.revision||0,alreadyListed:listed,alreadyHere:listed&&samePath(this.directoryFor(index,found.workspace.id),found.directory)};});}
 openFolder({folder,revision,fileRevision}){return this.enqueue(()=>this.rootLock(async()=>{
  const index=await this.index();this.assertRevision(revision,index?.revision||0);const directory=await this.writableFolder(folder);
  return this.withLock(directory,async()=>{const found=await this.inspect(directory);this.assertFileRevision(fileRevision,found.fileRevision,true);const workspaces=(index?.ids||[]).filter(id=>id!==found.workspace.id).map(id=>({id,name:index.names?.[id]||id})).concat(found.workspace);if(workspaces.length>100)throw fail('A library supports up to 100 workspaces.');const library={version:1,activeId:found.workspace.id,workspaces};await this.writeIndex(index,library,{...(index?.locations||{}),[found.workspace.id]:directory});return this.read();});
 }));}
}
module.exports={WorkspaceStore,absoluteFolder};
