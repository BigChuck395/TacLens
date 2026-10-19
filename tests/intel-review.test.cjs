const {test}=require('node:test'),assert=require('node:assert/strict');
const {intelReview,layerMetadata,validateLayers,records,summary,types}=require('../core.js');const {assess}=require('../insights.js');
test('intelligence has one assessment and legacy mappings preserve context on migration',()=>{
 assert.deepEqual(types.intel.statuses,{intelligence:'Intelligence'});
 for(const status of ['relevant','observed','historical']){
  const input={name:'Intel',type:'intel',entries:[{techniqueID:'T1000',status,notes:'Evidence',date:'2026-10-01',compensatingControl:'architecture'}]};
  const l=validateLayers([input],{techniques:[{id:'T1000'}]}).layers[0],e=l.entries[0];
  assert.equal(e.status,'intelligence');assert.match(e.notes,new RegExp(status));assert.match(e.notes,/Evidence/);assert.equal(e.date,'2026-10-01');assert.equal(e.compensatingControl,'control');
  assert.equal(validateLayers([l],{techniques:[{id:'T1000'}]}).layers[0].entries[0].notes,e.notes);
 }
});
test('review is indefinite by default, even for old mapping dates',()=>{
 assert.equal(layerMetadata({}).reviewDays,null);assert.equal(intelReview({mappingCompleted:'2000-01-01'}).due,false);
 assert.equal(intelReview({reviewDays:null,reviewedOn:'2000-01-01'}).label,'Indefinite');
});
test('review due dates use complete calendar days and trigger on the due date',()=>{
 const m={reviewDays:30,mappingCompleted:'2026-09-14'};
 assert.equal(intelReview(m,'2026-10-13').due,false);assert.equal(intelReview(m,'2026-10-14').due,true);assert.equal(intelReview(m,'2026-10-14').nextDue,'2026-10-14');
 assert.equal(intelReview({...m,reviewedOn:'2026-10-14'},'2026-10-14').nextDue,'2026-11-13');
 assert.equal(intelReview({reviewDays:1,reviewedOn:'2024-02-28'},'2024-02-29').due,true);
});
test('scheduled layers without a valid date require review, invalid intervals are indefinite',()=>{
 assert.equal(intelReview({reviewDays:30}).label,'Review date needed');assert.equal(intelReview({reviewDays:30,reviewedOn:'2026-02-30'}).due,true);
 for(const reviewDays of [0,-1,1.5,36501,'bad'])assert.equal(intelReview({reviewDays}).scheduled,false);
});
test('review schedule survives imports and due reviews never remove positive coverage',()=>{
 const layers=validateLayers([{name:'Intel',type:'intel',visible:true,metadata:{reviewDays:7,reviewedOn:'2000-01-01'},entries:[{techniqueID:'T1000',status:'intelligence',compensatingControl:'architecture'}]}],{techniques:[{id:'T1000'}]}).layers;
 const s=summary(layers,'T1000');assert.equal(s.exposed,false);assert.equal(s.controlled,true);assert.equal(assess(s).reviewDue,true);assert.equal(assess(s).attention,true);assert.equal(s.entries[0].review.days,7);
 layers[0].visible=false;assert.equal(records(layers,'T1000').length,0);assert.equal(assess(summary(layers,'T1000')).reviewDue,false);
});
