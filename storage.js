(function(root){
  'use strict';
  async function open(){
    if(location.protocol==='file:')return {mode:'browser',initialize:async()=>{},label:()=> 'Browser storage — use the local server for workspace folders'};
    let response;
    try{response=await fetch('api/workspaces',{cache:'no-store'});}catch(error){throw Error('Cannot reach the local workspace service. Start node server.cjs and retry.');}
    if(response.status===404&&!['localhost','127.0.0.1'].includes(location.hostname))return {mode:'browser',initialize:async()=>{},label:()=> 'Browser storage'};
    const initial=await response.json().catch(()=>({}));
    if(!response.ok)throw Error(initial.error||'Restart the local server to enable application workspace folders.');
    if(initial.mode==='browser')return {mode:'browser',initialize:async()=>{},label:()=> 'Browser storage'};
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
