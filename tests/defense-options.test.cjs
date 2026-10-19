const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../core.js');global.Strata=S;const {assess}=require('../insights.js');
const data={techniques:[{id:'T1'},{id:'T1.001'},{id:'T2'}]},layer=(type,value,id='T1')=>({id:crypto.randomUUID(),name:type,type,visible:true,entries:[{techniqueID:id,status:type==='hunt'?'finding':type==='intel'?'intelligence':'present',...(type==='detection'?{}:{compensatingControl:value}),notes:'Original evidence',date:'2026-10-01'}]});
test('five defense choices distinguish controls, detections, both, absence and unreviewed',()=>{
 assert.equal(S.defenseChoices.length,5);
 for(const [value,label] of S.defenseChoices){const layers=S.validateLayers([layer('intel',value)],data).layers,s=S.summary(layers,'T1');assert.equal(s.detected,['detection','both'].includes(value));assert.equal(s.controlled,['control','both'].includes(value));assert.equal(s.exposed,['none','unknown'].includes(value));assert.equal(s.detectionCount,0);assert.equal(S.controlStatus(s.entries).label,label);}
});
test('legacy assessments migrate using exact existing tool mappings and remain stable on reload',()=>{
 const input=[layer('hunt','yes'),layer('intel','no'),layer('intel','architecture','T1.001'),layer('detection',null)];const copy=structuredClone(input),result=S.validateLayers(input,data).layers;
 assert.equal(result[0].entries[0].compensatingControl,'both');assert.equal(result[1].entries[0].compensatingControl,'detection');assert.equal(result[2].entries[0].compensatingControl,'control');assert.match(result[0].entries[0].notes,/Original evidence/);assert.equal(result[0].entries[0].date,'2026-10-01');assert.deepEqual(input,copy);
 assert.deepEqual(S.validateLayers(result,data).layers.map(l=>l.entries),result.map(l=>l.entries));
});
test('positive detection and control assessments combine without inventing tool coverage and resolve a deficiency',()=>{
 const s=S.summary([layer('hunt','control'),layer('intel','detection')],'T1');assert.equal(s.conflict,false);assert.equal(s.detected,true);assert.equal(s.controlled,true);assert.equal(s.detectionCount,0);assert.equal(assess(s).findings,false);assert.equal(S.controlStatus(s.entries).label,'Compensating control and detection present');
 const none=S.summary([layer('intel','none'),layer('hunt','both')],'T1');assert.equal(none.conflict,false);assert.equal(none.controlled,true);
});
test('explicit assessments survive import and edits; layer counts only include selected tools',()=>{
 const input=[layer('intel','none'),layer('detection',null)];const migrated=S.validateLayers(input,data).layers;assert.equal(migrated[0].entries[0].compensatingControl,'none');assert.equal(S.summary(migrated,'T1').conflict,false);assert.equal(S.summary(migrated,'T1').detected,true);assert.equal(S.summary(migrated,'T1').exposed,true);
 const updated=S.quickUpdate(migrated,'T1',{date:'2026-10-16',changes:[{layerId:migrated[0].id,compensatingControl:'both'}]},data).layers;assert.equal(S.summary(updated,'T1').detectionCount,1);updated[1].visible=false;const s=S.summary(updated,'T1');assert.equal(s.detected,true);assert.equal(s.detectionCount,0);assert.equal(s.conflict,false);
});
test('all defense count partitions reconcile to layer mapping totals',()=>{
 const layers=S.defenseChoices.map(([value])=>layer('intel',value));layers.push(layer('detection',null));for(const row of S.evidenceStatistics(layers))assert.equal(Object.values(row.controls).reduce((a,b)=>a+b,0),row.mappings);
});
