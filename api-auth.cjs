'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const scopes=['read','write'];
const fail=(message,status=400)=>Object.assign(Error(message),{status});
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
class ApiKeys {
 constructor(file,token=''){
  if(token&&(token.length<32||/\s/.test(token)))throw Error('TACLENS_API_TOKEN must contain at least 32 characters without whitespace.');
  this.file=path.resolve(file);this.environment=token?digest(token):'';this.queue=Promise.resolve();
 }
 async records(){
  let text;try{const stat=await fs.lstat(this.file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw Error('Invalid API key file.');text=await fs.readFile(this.file,'utf8');}catch(e){if(e.code==='ENOENT')return [];throw e;}
  const parsed=JSON.parse(text);if(parsed.version!==1||!Array.isArray(parsed.keys)||parsed.keys.length>100||parsed.keys.some(k=>!k||typeof k.id!=='string'||typeof k.name!=='string'||!scopes.includes(k.scope)||!/^[a-f0-9]{64}$/.test(k.hash)||typeof k.createdAt!=='string'))throw Error('Invalid API key registry.');return parsed.keys;
 }
 public(keys){return keys.map(({id,name,scope,createdAt})=>({id,name,scope,createdAt}));}
 async list(){return this.public(await this.records());}
 async ready(){return !!this.environment||(await this.records()).length>0;}
 async authenticate(header){
  const match=/^Bearer ([A-Za-z0-9_-]{32,512})$/.exec(header||'');if(!match)return null;
  const hash=Buffer.from(digest(match[1]),'hex');let found=null;
  for(const record of [...await this.records(),...(this.environment?[{id:'environment',name:'Environment token',scope:'write',hash:this.environment}]:[])])if(crypto.timingSafeEqual(hash,Buffer.from(record.hash,'hex')))found={id:record.id,name:record.name,scope:record.scope};
  return found;
 }
 change(callback){const task=this.queue.then(async()=>{const keys=await this.records(),result=callback(keys);await fs.mkdir(path.dirname(this.file),{recursive:true});const temporary=this.file+'.tmp-'+crypto.randomUUID();try{await fs.writeFile(temporary,JSON.stringify({version:1,keys},null,2)+'\n',{flag:'wx',mode:0o600});await fs.rename(temporary,this.file);}catch(e){await fs.unlink(temporary).catch(()=>{});throw e;}return result;});this.queue=task.catch(()=>{});return task;}
 create({name,scope}){return this.change(keys=>{if(typeof name!=='string'||!name.trim()||name.trim().length>100||/[\u0000-\u001f]/.test(name)||!scopes.includes(scope))throw fail('Choose a name of 1–100 characters and read or write access.');if(keys.length>=100)throw fail('A server supports up to 100 integration keys.');if(keys.some(k=>k.name.toLowerCase()===name.trim().toLowerCase()))throw fail('Choose a unique integration name.');const token='taclens_'+crypto.randomBytes(32).toString('base64url'),record={id:crypto.randomUUID(),name:name.trim(),scope,createdAt:new Date().toISOString(),hash:digest(token)};keys.push(record);return {...this.public([record])[0],token};});}
 revoke(id){return this.change(keys=>{const index=keys.findIndex(k=>k.id===id);if(index<0)throw fail('Integration key not found.',404);keys.splice(index,1);return {revoked:true};});}
}
module.exports={ApiKeys};
