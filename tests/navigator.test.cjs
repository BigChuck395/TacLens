const {test}=require('node:test'),assert=require('node:assert/strict');
const {navigatorSource,convertNavigator}=require('../core.js');
const data={techniques:[{id:'T1000',name:'Parent'},{id:'T1000.001',name:'Child'},{id:'T1001',name:'Other'}]};
const input={name:'Source',domain:'enterprise-attack',description:'Scope',techniques:[{techniqueID:'T1000',score:0,color:'#FF0000',comment:'First',tactic:'execution',metadata:[{name:'owner',value:'Ignore'}]},{techniqueID:'T1000',score:7,color:'#0000ff',comment:'Second',tactic:'persistence'},{techniqueID:'T1000.001',score:7,comment:''},{techniqueID:'T1001',enabled:false},{techniqueID:'T9999',score:4}]};
test('Navigator source merges exact IDs, keeps grouping hints, and reports skipped source rows',()=>{
 const s=navigatorSource(input,data);assert.equal(s.rows.length,2);assert.equal(s.disabled,1);assert.equal(s.duplicates,1);assert.deepEqual(s.unknown,['T9999']);
 assert.deepEqual(s.rows[0].comments,['First','Second']);assert.deepEqual(s.rows[0].scores,['0','7']);assert.deepEqual(s.rows[0].colors,['#ff0000','#0000ff']);assert.equal(s.rows[1].id,'T1000.001');
 assert.throws(()=>navigatorSource({...input,domain:'mobile-attack'},data));assert.throws(()=>navigatorSource({...input,techniques:[{}]},data));
});
test('one Navigator source splits into multiple types and may overlap without copying source-only fields',()=>{
 const s=navigatorSource(input,data),r=convertNavigator(s,[{name:'Deficiencies',type:'hunt',ids:['T1000'],status:'finding',compensatingControl:'no',date:'2026-10-14',overrides:{T1000:{status:'resolved',compensatingControl:'architecture',notes:'Replacement',date:'2026-10-01'}}},{name:'SIEM',type:'detection',ids:['T1000','T1000.001'],keepComments:false},{name:'Intel',type:'intel',ids:['T1000.001'],compensatingControl:'architecture',date:'2026-10-14',reviewDays:30}],data);
 assert.equal(r.layers.length,3);assert.equal(r.conversion.assigned,2);assert.equal(r.layers[0].entries[0].status,'resolved');assert.equal(r.layers[0].entries[0].notes,'Replacement');assert.equal(r.layers[0].entries[0].date,'2026-10-01');assert.equal(r.layers[0].entries[0].compensatingControl,'control');
 assert.equal(r.layers[1].entries[0].notes,'');assert.equal(r.layers[1].entries[0].status,'present');assert.equal(r.layers[2].entries[0].status,'intelligence');assert.equal(r.layers[2].metadata.reviewDays,30);
 for(const l of r.layers)for(const e of l.entries){assert.equal('score' in e,false);assert.equal('color' in e,false);assert.equal('tactic' in e,false);assert.equal('metadata' in e,false);}
});
test('comments and additional notes are optional and output is isolated from drafts',()=>{
 const source=navigatorSource(input,data),targets=[{name:'Intel',type:'intel',ids:['T1000'],notes:'Additional'}],before=JSON.stringify(targets),r=convertNavigator(source,targets,data);
 assert.equal(r.layers[0].entries[0].notes,'First\nSecond\nAdditional');assert.deepEqual(r.conversion.unassigned,['T1000.001']);assert.equal(r.layers[0].metadata.reviewDays,null);assert.equal(JSON.stringify(targets),before);
});
test('conversion rejects empty drafts, duplicate names, invalid fields, and missing review dates',()=>{
 const s=navigatorSource(input,data),base={name:'Layer',type:'hunt',ids:['T1000']};
 for(const target of [{...base,name:''},{...base,ids:[]},{...base,ids:['T9999']},{...base,status:'validated'},{...base,date:'2026-02-30'},{...base,compensatingControl:'invalid'},{...base,type:'intel',reviewDays:30}])assert.throws(()=>convertNavigator(s,[target],data));
 assert.throws(()=>convertNavigator(s,[base,{...base,name:'layer'}],data));
});
