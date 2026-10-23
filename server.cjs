const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname,{WorkspaceStore}=require('./workspace-store.cjs'),catalogContext={};vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),catalogContext);
const browserOnly=process.env.STRATA_STORAGE_MODE==='browser',store=new WorkspaceStore(process.env.STRATA_STORAGE_DIR||path.join(root,'workspaces'),catalogContext.ATTACK_DATA);
const allowed=new Set(['index.html','styles.css','terminology.js','core.js','work-ui.js','work-report.js','insights.js','matrix.js','elt-report.js','app.js','history.js','data.js','storage.js','favicon.ico']);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ico':'image/x-icon'};
function body(req,res,json,max,handler){let size=0,chunks=[],tooLarge=false;req.on('data',chunk=>{size+=chunk.length;if(size>max){if(!tooLarge){tooLarge=true;chunks=[];json(413,{error:'Request exceeds the storage size limit.'});}return;}chunks.push(chunk);});req.on('end',async()=>{if(tooLarge)return;try{const result=await handler(JSON.parse(Buffer.concat(chunks).toString('utf8')));json(200,result);}catch(error){json(error.status||(error.code?500:400),{error:error.message});}});}
const server=http.createServer((req,res)=>{
 const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
 if(name==='api/workspaces'||name==='api/workspace-folders'){
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  const host=req.headers.host||'',expected='http://'+host;
  if(!/^((127\.0\.0\.1)|(localhost)):\d+$/.test(host)||req.headers['sec-fetch-site']==='cross-site'||req.headers.origin&&req.headers.origin!==expected)return json(403,{error:'Workspace files can only be accessed by this local app.'});
  if(name==='api/workspaces'&&req.method==='GET'){if(browserOnly)return json(200,{mode:'browser'});const since=new URL(req.url,'http://localhost').searchParams.get('since');store.load(since).then(value=>json(200,{mode:'disk',...value})).catch(error=>json(error.status||500,{error:error.message}));return;}
  if(browserOnly||name==='api/workspaces'&&req.method!=='PUT'||name==='api/workspace-folders'&&req.method!=='POST')return json(405,{error:'Method not supported.'});
  if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(415,{error:'Expected JSON.'});
  body(req,res,json,name==='api/workspaces'?100*1024*1024:128*1024,async input=>{
   if(name==='api/workspaces'){if(!Number.isInteger(input.revision)||input.revision<0)throw Error('Invalid save revision.');return store.write(input.library,input.revision,input.fileRevisions);}
   if(input.action==='preview')return store.previewFolder(input.id,input.parent);
   if(input.action==='copy')return store.copyToFolder(input);
   if(input.action==='inspect')return store.inspectFolder(input.folder);
   if(input.action==='open')return store.openFolder(input);
   throw Error('Choose a supported workspace folder action.');
  });return;
 }
 if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);return res.end('Method not supported');}
 if(!allowed.has(name)){res.writeHead(404);return res.end('Not found');}
 fs.readFile(path.join(root,name),(err,data)=>{if(err){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':mime[path.extname(name)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);});
});
server.listen(Number(process.env.PORT||5173),'127.0.0.1',()=>console.log(`TacLens is running locally at http://127.0.0.1:${server.address().port}\nPress Ctrl+C to stop.`));
if(require.main===module){const stop=()=>{server.close(()=>process.exit(0));server.closeIdleConnections?.();};process.on('SIGINT',stop);process.on('SIGTERM',stop);}
module.exports=server;
