(function(root){
  'use strict';
  const libraryKey='strata.workspaces.v1',uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const encode=workspace=>JSON.stringify(workspace,null,2)+'\n';
  const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
  const conflict=()=>Object.assign(Error('The saved workspace changed outside this window. Open its saved folder to load that version, or save your edits to a different folder.'),{conflict:true});
  function checkWorkspace(workspace){
    if(workspace?.schema!=='strata-workspace'||workspace.version!==1||!uuid.test(workspace.id)||typeof workspace.name!=='string'||!workspace.name.trim()||!Array.isArray(workspace.layers))throw Error('This folder does not contain a valid TacLens workspace.');
    const checked=Strata.validateLayers(workspace.layers,ATTACK_DATA);
    if(checked.unknown||checked.layers.length!==workspace.layers.length)throw Error('This workspace contains techniques or layers that cannot be read by this version of TacLens.');
    return workspace;
  }
  async function folderFile(directory){
    const handle=await directory.getFileHandle('workspace.json'),file=await handle.getFile();
    if(file.size>100*1024*1024)throw Error('The workspace file is larger than 100 MB.');
    const text=await file.text();return {handle,text,hash:await digest(text),workspace:checkWorkspace(JSON.parse(text))};
  }
  async function nativeFolders(){
    const fallback=reason=>({mode:'browser',initialize:async()=>{},label:()=> 'Browser storage',folderReason:reason});
    if(!root.isSecureContext||typeof root.showDirectoryPicker!=='function')return fallback('Automatic folder saves require desktop Chrome or Edge. In Firefox, use JSON import/export or the optional local server.');
    let database;
    try{database=await new Promise((resolve,reject)=>{const request=indexedDB.open('taclens.folder-storage.v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Close other TacLens windows and retry.'));});}
    catch(error){return fallback('Folder connections could not be remembered in this browser. Allow browser storage, or use JSON import/export.');}
    const transaction=(mode,action)=>new Promise((resolve,reject)=>{const tx=database.transaction('records',mode),request=action(tx.objectStore('records'));let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error||request.error);tx.onabort=()=>reject(tx.error||Error('Browser save was interrupted.'));});
    const put=value=>transaction('readwrite',records=>records.put(value)),remove=id=>transaction('readwrite',records=>records.delete(id));
    const saved=await transaction('readonly',records=>records.getAll()),links=new Map();
    const savedLibrary=saved.find(record=>record.id==='library');let cacheRevision=savedLibrary?.revision||0,lastCacheText=JSON.stringify(savedLibrary?.value||null);
    let library=savedLibrary?.value;
    if(!library)try{library=JSON.parse(localStorage.getItem(libraryKey)||'null');}catch(error){}
    if(library?.version!==1||!Array.isArray(library.workspaces))library=null;
    for(const record of saved){if(!uuid.test(record.id)||!record.handle||!record.baseText)continue;links.set(record.id,{...record,pending:null,offline:false,conflicted:false,error:''});}
    if(!library&&links.size){const workspaces=[];for(const link of links.values())try{workspaces.push(checkWorkspace(JSON.parse(link.baseText)));}catch(error){}if(workspaces.length)library={version:1,activeId:workspaces[0].id,workspaces};}
    const store={mode:'disk',directFolders:true,library,storagePath:'Folders approved in this browser',workspaceLocations:{},phase:'saved',error:'',onStatus:null,running:null,timer:null,pendingCache:false,cacheError:'',onChange:null};
    function cacheLibrary(snapshot){
      return new Promise((resolve,reject)=>{
        const tx=database.transaction('records','readwrite'),records=tx.objectStore('records'),request=records.get('library');let changedElsewhere=false;
        request.onsuccess=()=>{if((request.result?.revision||0)!==cacheRevision){changedElsewhere=true;tx.abort();return;}records.put({id:'library',value:snapshot,revision:cacheRevision+1});};
        tx.oncomplete=()=>{cacheRevision++;lastCacheText=JSON.stringify(snapshot);resolve();};
        tx.onabort=tx.onerror=()=>reject(changedElsewhere?Error('Another TacLens window changed the workspace list. Export unsaved work and reload this window.'):tx.error||Error('Browser save was interrupted.'));
      });
    }
    function updateStatus(){
      store.workspaceLocations=Object.fromEntries([...links].map(([id,link])=>[id,{directory:link.handle.name,external:true,error:link.error}]));
      const failed=[...links.values()].find(link=>link.conflicted),offline=[...links.values()].find(link=>link.offline);
      store.phase=store.cacheError||failed?'error':offline?'offline':store.pendingCache||store.running||[...links.values()].some(link=>link.pending)?'saving':'saved';
      store.error=store.cacheError||failed?.error||offline?.error||'';store.onStatus?.(store.phase,store.error);
    }
    store.label=()=>store.phase==='error'?'Workspace save needs attention':store.phase==='offline'?'Reconnect workspace folder':store.phase==='saving'?'Saving workspace…':links.has(store.library?.activeId)?'Saved to selected folder':'Saved in this browser · choose a folder';
    store.hasPending=()=>!!(store.pendingCache||store.running||store.cacheError||[...links.values()].some(link=>link.pending));
    const remember=link=>put({id:link.id,handle:link.handle,baseText:link.baseText,hash:link.hash});
    const locked=(id,work)=>navigator.locks?navigator.locks.request('taclens-workspace-'+id,work):work();
    async function write(link,text){
      await locked(link.id,async()=>{
        if(await link.handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('Folder permission is needed. Reconnect the workspace folder.');
        const current=await folderFile(link.handle);if(current.hash!==link.hash)throw conflict();
        const writer=await current.handle.createWritable({mode:'exclusive'});
        try{
          if((await folderFile(link.handle)).hash!==link.hash)throw conflict();
          const backup=await link.handle.getFileHandle('workspace.backup.json',{create:true}),backupWriter=await backup.createWritable({mode:'exclusive'});
          try{await backupWriter.write(current.text);await backupWriter.close();}catch(error){await backupWriter.abort().catch(()=>{});throw error;}
          if((await folderFile(link.handle)).hash!==link.hash)throw conflict();
          await writer.write(text);await writer.close();
        }catch(error){await writer.abort().catch(()=>{});throw error;}
        link.baseText=text;link.hash=await digest(text);await remember(link);
      });
    }
    async function refreshLink(link){
      if(await link.handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('Click Reconnect folder to allow access to '+link.handle.name+'.');
      const file=await folderFile(link.handle),cached=store.library?.workspaces.find(workspace=>workspace.id===link.id);
      if(file.workspace.id!==link.id)throw conflict();
      const edited=cached&&encode(cached)!==encode(JSON.parse(link.baseText));
      if(file.hash!==link.hash&&edited&&encode(cached)!==encode(file.workspace))throw conflict();
      if(file.hash!==link.hash){if(!edited){store.library.workspaces=store.library.workspaces.map(workspace=>workspace.id===link.id?file.workspace:workspace);store.pendingCache=true;}link.baseText=file.text;link.hash=file.hash;await remember(link);}
      const desired=store.library?.workspaces.find(workspace=>workspace.id===link.id);
      link.pending=desired&&encode(desired)!==link.baseText?encode(desired):null;link.offline=false;link.conflicted=false;link.error='';
    }
    for(const link of links.values()){
      if(!store.library?.workspaces.some(workspace=>workspace.id===link.id))continue;
      try{await refreshLink(link);}catch(error){link.conflicted=!!error.conflict;link.offline=!error.conflict;link.error=error.message;}
    }
    store.save=next=>{
      store.library=structuredClone(next);store.pendingCache=JSON.stringify(next)!==lastCacheText;store.cacheError='';
      for(const [id,link] of links){const workspace=next.workspaces.find(workspace=>workspace.id===id);if(!workspace){links.delete(id);remove(id).catch(error=>{store.cacheError=error.message;updateStatus();});continue;}const text=encode(workspace);link.pending=text===link.baseText?null:text;}
      clearTimeout(store.timer);store.timer=setTimeout(()=>store.flush(),120);updateStatus();return true;
    };
    store.flush=()=>{
      clearTimeout(store.timer);if(store.running)return store.running;
      store.running=(async()=>{
        while(store.pendingCache||[...links.values()].some(link=>link.pending&&!link.offline&&!link.conflicted)){
          if(store.pendingCache){const snapshot=structuredClone(store.library);store.pendingCache=false;try{await cacheLibrary(snapshot);store.cacheError='';}catch(error){store.pendingCache=true;store.cacheError='Could not save the browser recovery copy: '+error.message;break;}}
          for(const link of links.values()){
            if(!link.pending||link.offline||link.conflicted)continue;const text=link.pending;
            try{await write(link,text);if(link.pending===text)link.pending=null;}catch(error){link.conflicted=!!error.conflict;link.offline=!error.conflict;link.error=error.message;}
          }
        }
      })().finally(()=>{store.running=null;updateStatus();});updateStatus();return store.running;
    };
    store.initialize=async next=>{store.save(next);await store.flush();};
    store.pickFolder=()=>root.showDirectoryPicker({id:'taclens-workspace',mode:'readwrite'});
    store.previewTarget=async(id,parent)=>{
      let directory;try{directory=await parent.getDirectoryHandle(id);}catch(error){if(error.name!=='NotFoundError')throw error;}
      let occupied=false;if(directory)for await(const unused of directory.values()){occupied=true;break;}
      return {id,parent,handle:directory,target:parent.name+' / '+id,occupied,alreadyHere:!!directory&&!!links.get(id)&&await directory.isSameEntry(links.get(id).handle)};
    };
    store.copyWorkspace=async(preview,next)=>{
      if(store.running)await store.running;const workspace=checkWorkspace(next.workspaces.find(workspace=>workspace.id===preview.id));
      const checked=await store.previewTarget(preview.id,preview.parent);if(checked.occupied)throw Error('That workspace folder already contains files. Open its saved workspace, or choose a different parent folder.');
      const directory=await preview.parent.getDirectoryHandle(preview.id,{create:true});
      await locked(workspace.id,async()=>{
        for await(const unused of directory.values())throw Error('The destination changed. Choose another folder or open the existing workspace.');
        const handle=await directory.getFileHandle('workspace.json',{create:true}),writer=await handle.createWritable({mode:'exclusive'}),text=encode(workspace);
        try{if((await handle.getFile()).size)throw conflict();await writer.write(text);await writer.close();}catch(error){await writer.abort().catch(()=>{});throw error;}
        const link={id:workspace.id,handle:directory,baseText:text,hash:await digest(text),pending:null,offline:false,conflicted:false,error:''};await remember(link);links.set(workspace.id,link);
      });
      store.save(next);await store.flush();return {library:store.library};
    };
    store.inspect=async handle=>({...await folderFile(handle),directory:handle});
    store.openWorkspace=async(preview,next)=>{
      if(store.running)await store.running;const current=await folderFile(preview.directory);if(current.hash!==preview.hash)throw Error('This workspace changed after the preview. Choose the folder again.');
      const workspace=current.workspace,link={id:workspace.id,handle:preview.directory,baseText:current.text,hash:current.hash,pending:null,offline:false,conflicted:false,error:''};
      await remember(link);links.set(workspace.id,link);next=structuredClone(next);next.workspaces=next.workspaces.filter(item=>item.id!==workspace.id).concat(workspace);next.activeId=workspace.id;store.save(next);await store.flush();return {library:store.library};
    };
    store.reconnect=async id=>{
      const link=links.get(id);if(!link)return {library:store.library};
      const permission=await link.handle.requestPermission({mode:'readwrite'});if(permission!=='granted')throw Error('Folder access was not granted. Your saved files and recovery copy are kept.');
      if(store.running)await store.running;
      try{await refreshLink(link);await store.flush();}catch(error){link.conflicted=!!error.conflict;link.offline=!error.conflict;link.error=error.message;updateStatus();throw error;}
      updateStatus();return {library:store.library};
    };
    store.startPolling=onChange=>{
      store.onChange=onChange;let checking=false;
      setInterval(async()=>{
        if(checking||store.running||document.visibilityState!=='visible'||document.querySelector('dialog[open]'))return;checking=true;let changed=false;
        try{
          if(!store.hasPending()){
            const records=await transaction('readonly',entries=>entries.getAll()),next=records.find(record=>record.id==='library');
            if(next&&(next.revision||0)!==cacheRevision&&!store.hasPending()){
              store.library=structuredClone(next.value);cacheRevision=next.revision||0;lastCacheText=JSON.stringify(next.value);links.clear();
              for(const record of records)if(uuid.test(record.id)&&record.handle&&record.baseText&&next.value.workspaces.some(workspace=>workspace.id===record.id))links.set(record.id,{...record,pending:null,offline:false,conflicted:false,error:''});
              changed=true;
            }
          }
          for(const link of links.values()){
            if(link.offline||link.conflicted||link.pending)continue;const before=link.hash;
            try{await refreshLink(link);changed=changed||before!==link.hash;}catch(error){link.conflicted=!!error.conflict;link.offline=!error.conflict;link.error=error.message;}
          }
          if(changed){await store.flush();onChange(structuredClone(store.library));}updateStatus();
        }finally{checking=false;}
      },3000);
    };
    window.addEventListener('beforeunload',event=>{if(store.hasPending()){event.preventDefault();event.returnValue='';}});
    updateStatus();return store;
  }
  async function open(){
    if(location.protocol==='file:')return nativeFolders();
    let response;
    try{response=await fetch('api/workspaces',{cache:'no-store'});}catch(error){throw Error('Cannot reach the local workspace service. Start node server.cjs and retry.');}
    if(response.status===404)return nativeFolders();
    const initial=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(initial.error||'Restart the local server to enable application workspace folders.');
    if(initial.mode==='browser')return nativeFolders();
    const store={mode:'disk',library:initial.library,revision:initial.revision,storagePath:initial.storagePath,workspaceLocations:initial.workspaceLocations||{},fileRevisions:initial.fileRevisions||{},syncToken:initial.syncToken,phase:'saved',pending:null,running:null,blocked:false,timer:null,error:'',onStatus:null};
    store.metadata=result=>{store.revision=result.revision;store.storagePath=result.storagePath;store.workspaceLocations=result.workspaceLocations||store.workspaceLocations;store.fileRevisions=result.fileRevisions||store.fileRevisions;store.syncToken=result.syncToken;};
    store.label=()=>store.phase==='saving'?'Saving to disk…':store.phase==='error'?'Disk save failed':store.phase==='offline'?'Workspace folder unavailable':'Saved to application folder';
    store.notify=(phase,message='')=>{store.phase=phase;store.error=message;store.onStatus?.(phase,message);};
    store.hasPending=()=>!!(store.pending||store.running||store.phase==='error');
    store.flush=()=>{
      clearTimeout(store.timer);if(store.running)return store.running;if(store.blocked||!store.pending)return Promise.resolve();
      store.running=(async()=>{
        while(store.pending){
          const library=store.pending;store.pending=null;store.notify('saving');
          try{
            const response=await fetch('api/workspaces',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:store.revision,fileRevisions:store.fileRevisions,library})});
            const result=await response.json();if(!response.ok){store.blocked=response.status===409;throw Error(result.error||'Could not save workspace files.');}
            store.metadata(result);store.library=library;
          }catch(error){store.pending=store.pending||library;store.notify('error',error.message);return;}
        }
        store.notify('saved');
      })().finally(()=>{store.running=null;});return store.running;
    };
    store.save=library=>{store.pending=structuredClone(library);if(!store.blocked){store.notify('saving');clearTimeout(store.timer);store.timer=setTimeout(()=>store.flush(),120);}return true;};
    store.initialize=async library=>{if(JSON.stringify(store.library)===JSON.stringify(library))return;store.save(library);await store.flush();if(store.phase==='error')throw Error(store.error);};
    store.folderRequest=async(action,values)=>{await store.flush();if(store.hasPending())throw Error(store.error||'Save pending workspace changes before changing folders.');const response=await fetch('api/workspace-folders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...values})});const result=await response.json();if(!response.ok)throw Error(result.error||'Could not access the workspace folder.');if(result.library){store.metadata(result);store.library=result.library;store.notify('saved');}return result;};
    store.startPolling=onChange=>{
      let checking=false;
      setInterval(async()=>{
        if(checking||store.hasPending()||document.visibilityState!=='visible'||document.querySelector('dialog[open]'))return;
        checking=true;try{const response=await fetch('api/workspaces?since='+encodeURIComponent(store.syncToken||store.revision),{cache:'no-store'}),next=await response.json();if(!response.ok){if(!store.hasPending())store.notify('offline',next.error||'Workspace folder cannot be reached. Reconnect the drive and retry.');return;}if(!next.unchanged&&next.library&&(next.revision!==store.revision||next.syncToken!==store.syncToken)&&!store.hasPending()){store.library=next.library;store.metadata(next);onChange(next.library);}if(store.phase==='offline')store.notify('saved');}catch(error){if(!store.hasPending())store.notify('offline','The local workspace service cannot be reached. Keep this page open and restart the server.');}finally{checking=false;}
      },3000);
    };
    window.addEventListener('beforeunload',event=>{if(store.hasPending()){event.preventDefault();event.returnValue='';}});
    return store;
  }
  root.StrataStorage={open};
})(globalThis);
