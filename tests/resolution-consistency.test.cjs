const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../core.js');
const data={techniques:[{id:'T1'}]},layer=(value,status='finding')=>({id:crypto.randomUUID(),name:'Exercise',type:'hunt',visible:true,entries:[{techniqueID:'T1',status,compensatingControl:value,notes:'Original evidence',date:'2026-10-01'}]});
test('missing defenses and legacy unreviewed deficiencies remain open through bulk or quick updates',()=>{
 for(const value of ['none','unknown']){
  const input=layer(value),before=structuredClone(input);
  assert.equal(S.bulkEntries(input,['T1'],{status:'resolved',compensatingControl:value},data,'2026-10-16')[0].status,'finding');
  assert.equal(S.quickUpdate([input],'T1',{date:'2026-10-16',changes:[{layerId:input.id,status:'resolved'}]},data).layers[0].entries[0].status,'finding');assert.deepEqual(input,before);
 }
 for(const value of ['control','detection','both'])assert.equal(S.bulkEntries(layer(value),['T1'],{status:'resolved'},data,'2026-10-16')[0].status,'resolved');
});
test('legacy inconsistent resolutions reopen once while preserving the original evidence and dates',()=>{
 for(const value of ['none','unknown']){
  const original=layer(value,'resolved'),result=S.validateLayers([original],data).layers;
  assert.equal(result[0].entries[0].status,'finding');assert.match(result[0].entries[0].notes,/Previous assessment: Resolved/);assert.match(result[0].entries[0].notes,/Original evidence/);assert.equal(result[0].entries[0].date,'2026-10-01');assert.equal(original.entries[0].status,'resolved');
  assert.deepEqual(S.validateLayers(result,data).layers[0].entries,result[0].entries);
 }
});
test('every defense category has an open/resolved split that reconciles to the deficiency totals',()=>{
 const layers=[...S.defenseChoices.map(([v])=>layer(v)),...['control','detection','both'].map(v=>layer(v,'resolved'))],row=S.evidenceStatistics(layers).find(r=>r.type==='hunt');
 assert.equal(Object.values(row.defenseAssessments).reduce((n,r)=>n+r.open,0),row.open);assert.equal(Object.values(row.defenseAssessments).reduce((n,r)=>n+r.resolved,0),row.resolved);
 assert.equal(row.defenseAssessments.none.resolved,0);assert.equal(row.defenseAssessments.none.open,2);assert.equal(row.defenseAssessments.unknown,undefined);assert.equal(row.controls.unknown,0);assert.equal(row.open+row.resolved,row.mappings);
});
test('deficiencies have four defense choices while intelligence retains Not reviewed',()=>{
 assert.deepEqual(S.defenseChoicesForType('hunt').map(([v])=>v),['none','control','detection','both']);
 assert.equal(S.defenseChoicesForType('intel').find(([v])=>v==='unknown')[1],'Not reviewed');
 for(const value of [undefined,'unknown']){
  const input=layer(value),e=input.entries[0];e.openedOn='2026-09-01';e.work={status:'in_progress',assignee:'Analyst',createdOn:'2026-10-01',updatedOn:'2026-10-02',notes:[{date:'2026-10-02',text:'Waiting for retest',kind:'note'}]};
  const migrated=S.validateLayers([input],data).layers[0].entries[0];assert.equal(migrated.compensatingControl,'none');assert.equal(migrated.status,'finding');assert.equal(migrated.notes,e.notes);assert.equal(migrated.date,e.date);assert.equal(migrated.openedOn,e.openedOn);assert.deepEqual(migrated.work,e.work);
  assert.equal(S.records([input],'T1')[0].compensatingControl,'none');assert.deepEqual(S.controlStatus([{...e,type:'hunt'}]),{label:'Nothing present',tone:'absent'});
  assert.equal(S.validateLayers(S.validateLayers([input],data).layers,data).layers[0].entries[0].compensatingControl,'none');
 }
});
test('all deficiency edit paths and Navigator conversion normalize legacy Not reviewed to open',()=>{
 const input=layer('unknown');
 for(const entries of [S.bulkEntries(input,['T1'],{status:'finding'},data,'2026-10-16'),S.recordDefense([input],'T1',{layerId:input.id,defense:'unknown'},'2026-10-16',data)[0].entries,S.quickUpdate([input],'T1',{date:'2026-10-16',changes:[{layerId:input.id,reviewed:true}]},data).layers[0].entries]){
  assert.equal(entries[0].compensatingControl,'none');assert.equal(entries[0].status,'finding');assert.equal(entries[0].notes,'Original evidence');
 }
 const source=S.navigatorSource({name:'Legacy Navigator',domain:'enterprise-attack',techniques:[{techniqueID:'T1',comment:'Source notes'}]},data),converted=S.convertNavigator(source,[{name:'Converted',type:'hunt',status:'finding',ids:['T1'],compensatingControl:'unknown',keepComments:true}],data);
 assert.equal(converted.layers[0].entries[0].compensatingControl,'none');assert.equal(converted.layers[0].entries[0].status,'finding');assert.match(converted.layers[0].entries[0].notes,/Source notes/);
});
