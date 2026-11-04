'use strict';
const http=require('node:http'),https=require('node:https'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),net=require('node:net'),crypto=require('node:crypto');
const {WorkspaceStore}=require('./workspace-store.cjs'),{ApiKeys}=require('./api-auth.cjs'),{createApi,error}=require('./api.cjs');
const root=__dirname,catalogContext={};vm.runInNewContext(fs.readFileSync(path.join(root,'data.js'),'utf8'),catalogContext);
const loopback=address=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address);
function localRequest(req){
 const host=req.headers.host||'',protocol=req.socket.encrypted?'https':'http';
 return loopback(req.socket.remoteAddress)&&/^((127\.0\.0\.1)|(localhost)|(\[::1\]))(?::\d+)?$/.test(host)&&!req.headers.forwarded&&!Object.keys(req.headers).some(k=>k.startsWith('x-forwarded-'))&&req.headers['sec-fetch-site']!=='cross-site'&&(!req.headers.origin||req.headers.origin===protocol+'://'+host);
}
function readBody(req,max=10*1024*1024){return new Promise((resolve,reject)=>{
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||'')){req.resume();reject(error(415,'unsupported_media_type','Use Content-Type: application/json.'));return;}
 if(req.headers['content-encoding']&&req.headers['content-encoding']!=='identity'){req.resume();reject(error(415,'unsupported_encoding','Compressed request bodies are not supported.'));return;}
 let size=0,chunks=[],failed=false;req.on('data',chunk=>{if(failed)return;size+=chunk.length;if(size>max){failed=true;chunks=[];reject(error(413,'body_too_large','JSON request exceeds '+max+' bytes.'));return;}chunks.push(chunk);});
 req.on('end',()=>{if(failed)return;try{const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error();resolve(value);}catch{reject(error(400,'invalid_json','Send a valid JSON object.'));}});req.on('aborted',()=>reject(error(400,'request_aborted','Request was interrupted.')));req.on('error',reject);
 });}
function createServer(options={}){
 const env=options.env||process.env,host=env.TACLENS_HOST||'127.0.0.1',port=Number(env.PORT||5173),browserOnly=env.STRATA_STORAGE_MODE==='browser';
 if(!net.isIP(host))throw Error('TACLENS_HOST must be an IP address, such as 127.0.0.1 or 0.0.0.0.');if(!Number.isInteger(port)||port<0||port>65535)throw Error('PORT must be 0–65535.');
 const store=options.store||new WorkspaceStore(env.STRATA_STORAGE_DIR||path.join(root,'workspaces'),catalogContext.ATTACK_DATA),keys=options.keys||new ApiKeys(env.TACLENS_API_KEYS_FILE||path.join(store.directory,'.api-keys.json'),env.TACLENS_API_TOKEN||''),api=createApi({store,data:catalogContext.ATTACK_DATA,browserOnly});
 const keyFile=env.TACLENS_TLS_KEY,certFile=env.TACLENS_TLS_CERT;let tls;
 if(!!keyFile!==!!certFile)throw Error('Set both TACLENS_TLS_KEY and TACLENS_TLS_CERT.');
 if(keyFile)tls={key:fs.readFileSync(keyFile),cert:fs.readFileSync(certFile),minVersion:'TLSv1.2'};
 if(!loopback(host)&&!tls)throw Error('Network listening requires HTTPS: set TACLENS_TLS_KEY and TACLENS_TLS_CERT. For a TLS reverse proxy, keep TACLENS_HOST=127.0.0.1 and set TACLENS_TRUST_PROXY=1.');
 const origins=new Set((env.TACLENS_API_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean));for(const origin of origins){const url=new URL(origin);if(url.origin!==origin||!['http:','https:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('TACLENS_API_ORIGINS must contain exact HTTPS origins, or HTTP loopback origins.');}
 const allowed=new Set(['index.html','styles.css','terminology.js','core.js','work-ui.js','work-report.js','insights.js','matrix.js','elt-report.js','reports.js','app.js','history.js','data.js','storage.js','favicon.ico','api.html','api-console.js','API.md']);
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.ico':'image/x-icon','.md':'text/plain; charset=utf-8'},attempts=new Map();
 async function handler(req,res){
  const requestId=crypto.randomUUID();res.setHeader('X-Request-Id',requestId);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  const json=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(value));};
  try{
   const url=new URL(req.url,'http://localhost'),name=url.pathname.slice(1)||'index.html';
   if(url.pathname.startsWith('/api/v1/')||url.pathname==='/api/v1'){
    const forwarded=req.headers.forwarded||Object.keys(req.headers).some(k=>k.startsWith('x-forwarded-'));
    if(!req.socket.encrypted&&(!loopback(req.socket.remoteAddress)||forwarded&&!(env.TACLENS_TRUST_PROXY==='1'&&loopback(host)&&req.headers['x-forwarded-proto']==='https')))throw error(403,'https_required','Use HTTPS for network integration requests.');
    const origin=req.headers.origin,sameOrigin=(req.socket.encrypted?'https':'http')+'://'+req.headers.host;
    if(origin&&origin!==sameOrigin&&!origins.has(origin))throw error(403,'origin_not_allowed','This browser origin is not allowed.');
    if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Expose-Headers','ETag, X-Request-Id');}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, PATCH, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, If-Match','Access-Control-Max-Age':'600'});res.end();return;}
    const remote=req.socket.remoteAddress,now=Date.now(),previous=attempts.get(remote);if(previous&&previous.until>now&&previous.count>=30)throw Object.assign(error(429,'rate_limited','Too many authentication failures. Retry after one minute.'),{retryAfter:60});
    req.apiPrincipal=await keys.authenticate(req.headers.authorization);if(!req.apiPrincipal){if(attempts.size>=10000)for(const [ip,value]of attempts)if(value.until<=now)attempts.delete(ip);if(attempts.size<10000||attempts.has(remote))attempts.set(remote,{count:previous?.until>now?previous.count+1:1,until:previous?.until>now?previous.until:now+60000});throw error(401,'unauthorized','Send a valid API key in Authorization: Bearer <token>.');}attempts.delete(remote);
    if(url.pathname==='/api/v1/openapi.json'){if(req.method!=='GET')throw error(405,'method_not_allowed','Use GET.');json(200,api.spec());return;}
    const result=await api.handle(req,url,readBody),headers=result.etag?{ETag:result.etag}:{};
    if(result.html!==undefined){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8',...headers,'Content-Disposition':'attachment; filename="'+result.download+'"'});res.end(result.html);return;}
    if(result.raw){json(200,result.data,{...headers,'Content-Disposition':'attachment; filename="'+result.download+'"'});return;}
    json(result.status||200,{data:result.data,meta:{requestId,...(result.page||{}),...(result.revision!==undefined?{revision:result.revision}:{}),...(result.etag?{etag:result.etag}:{})}},headers);return;
   }
   if(name==='api/openapi.json'){if(!localRequest(req))throw error(403,'local_only','Open the console on this server, or authenticate to /api/v1/openapi.json.');if(req.method!=='GET')throw error(405,'method_not_allowed','Use GET.');json(200,api.spec());return;}
   if(name==='api/integrations'||name.startsWith('api/integrations/')){
    if(!localRequest(req))throw error(403,'local_only','Manage integration keys from the local app on this server.');
    if(name==='api/integrations'&&req.method==='GET'){json(200,{host,port:server.address()?.port||port,https:!!tls,trustProxy:env.TACLENS_TRUST_PROXY==='1',storage:browserOnly?'browser':'disk',environmentToken:!!keys.environment,keys:await keys.list()});return;}
    if(name==='api/integrations'&&req.method==='POST'){const input=await readBody(req,4096);if(Object.keys(input).some(k=>!['name','scope'].includes(k)))throw error(400,'invalid_request','Use name and scope.');json(201,await keys.create(input));return;}
    const match=/^api\/integrations\/([a-f0-9-]{36})$/.exec(name);if(match&&req.method==='DELETE'){json(200,await keys.revoke(match[1]));return;}throw error(405,'method_not_allowed','Use GET or POST on the collection, or DELETE on a key ID.');
   }
   if(name==='api/workspaces'||name==='api/workspace-folders'){
    if(!localRequest(req)){json(403,{error:'Workspace files can only be accessed by this local app. Use the authenticated /api/v1 API for integrations.'});return;}
    if(name==='api/workspaces'&&req.method==='GET'){if(browserOnly){json(200,{mode:'browser'});return;}const value=await store.load(url.searchParams.get('since'));json(200,{mode:'disk',...value});return;}
    if(browserOnly||name==='api/workspaces'&&req.method!=='PUT'||name==='api/workspace-folders'&&req.method!=='POST'){json(405,{error:'Method not supported.'});return;}
    try{const input=await readBody(req,name==='api/workspaces'?100*1024*1024:128*1024);let value;
     if(name==='api/workspaces'){if(!Number.isInteger(input.revision)||input.revision<0)throw Error('Invalid save revision.');value=await store.write(input.library,input.revision,input.fileRevisions);}
     else if(input.action==='preview')value=await store.previewFolder(input.id,input.parent);
     else if(input.action==='copy')value=await store.copyToFolder(input);
     else if(input.action==='inspect')value=await store.inspectFolder(input.folder);
     else if(input.action==='open')value=await store.openFolder(input);
     else throw Error('Choose a supported workspace folder action.');json(200,value);
    }catch(e){json(e.status||(e.code?500:400),{error:e.message});}return;
   }
   if(!localRequest(req)&&!['api.html','api-console.js','API.md','styles.css','favicon.ico'].includes(name))throw error(403,'local_only','The editor is local to this server. Integrations use /api/v1 with a Bearer token.');
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{Allow:'GET, HEAD'});res.end('Method not supported');return;}
   if(!allowed.has(name)){res.writeHead(404);res.end('Not found');return;}
   let bytes;try{bytes=await fs.promises.readFile(path.join(root,name));}catch{res.writeHead(404);res.end('Not found');return;}
   res.writeHead(200,{'Content-Type':mime[path.extname(name)],...(name==='api.html'?{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"}:{} )});res.end(req.method==='HEAD'?undefined:bytes);
  }catch(e){if(!req.complete&&!req.destroyed)req.resume();if(res.destroyed||res.writableEnded)return;const status=e.status||(e.code?500:400);if(status>=500)console.error('TacLens request '+requestId+' failed ('+(e.code||status)+').');json(status,{error:{code:e.apiCode||(status>=500?'server_error':'validation_error'),message:status>=500?'The server could not complete this request. Check the server console and workspace storage.':e.message,requestId}},{...(status===401?{'WWW-Authenticate':'Bearer realm="TacLens API"'}:{}),...(e.allow?{Allow:e.allow}:{}),...(e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})});}
 }
 const server=tls?https.createServer(tls,handler):http.createServer(handler);server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;
 async function start(){if(!loopback(host)&&!await keys.ready())throw Error('Create an integration key locally, or set TACLENS_API_TOKEN, before enabling network listening.');await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.off('error',reject);resolve();});});return server;}
 return {server,start,store,keys,api,host,port,https:!!tls};
}
if(require.main===module){let app;try{app=createServer();}catch(e){console.error(e.message);process.exitCode=1;}if(app){app.start().then(()=>console.log('TacLens is running at '+(app.https?'https':'http')+'://'+(app.host.includes(':')?'['+app.host+']':app.host)+':'+app.server.address().port+'\nAPI console: /api.html\nPress Ctrl+C to stop.')).catch(e=>{console.error(e.message);process.exitCode=1;});const stop=()=>{app.server.close(()=>process.exit(0));app.server.closeIdleConnections?.();};process.on('SIGINT',stop);process.on('SIGTERM',stop);}}
module.exports={createServer,localRequest,readBody};
