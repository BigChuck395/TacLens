const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../core.js');
const date='2026-10-16',data={techniques:['T1','T2','T3','T4'].map(id=>({id,name:id}))};
const layer=(id,type,rows)=>({id,name:id,type,visible:true,entries:rows.map(([techniqueID,day,defense])=>({techniqueID,date:day,status:type==='hunt'?'finding':type==='intel'?'intelligence':'present',compensatingControl:defense,notes:'Original evidence'}))});
const fixture=()=>[layer('findings','hunt',[['T1','2026-01-01','none'],['T2','2026-09-01','none'],['T3','2026-02-01','none']]),layer('intel A','intel',[['T2','2026-10-15','none'],['T3','2026-10-16','unknown']]),layer('intel B','intel',[['T2','2026-10-14','none']]),layer('SIEM','detection',[['T3','2026-10-10']])];
test('suggested priorities use evidence counts, recency and age, with optional detection deprioritization',()=>{
 const layers=fixture(),ids=options=>S.analysisItems(data.techniques,layers,options,date).map(x=>x.t.id);
 assert.deepEqual(ids({}),['T2','T1','T3']);assert.deepEqual(ids({sort:'oldestDeficiency'}),['T1','T3','T2']);assert.deepEqual(ids({sort:'intelNewest'}),['T3','T2','T1']);assert.deepEqual(ids({sort:'intelOverlap'}),['T2','T3','T1']);
 assert.deepEqual(ids({lowerDetections:false}),['T2','T3','T1']);assert.equal(S.analysisItems(data.techniques,layers,{},date)[0].facts.intelCount,2);
});
test('analysis filters combine source overlap, intel recency, deficiency age, detection count and text',()=>{
 const layers=fixture(),find=options=>S.analysisItems(data.techniques,layers,options,date).map(x=>x.t.id);
 assert.deepEqual(find({intelDays:'7',intelOverlap:'2'}),['T2']);assert.deepEqual(find({detections:'1',openDays:'90'}),['T3']);assert.deepEqual(find({detections:'0',search:'T1'}),['T1']);
 layers[4]=layer('Second tool','detection',[['T3','2026-10-10']]);assert.deepEqual(find({detections:'2+'}),['T3']);layers[1].visible=false;assert.deepEqual(find({intelOverlap:'2'}),[]);
});
test('snoozing leaves a deficiency open, saves its reason and moves only fully deferred work to the bottom',()=>{
 const original=fixture(),before=structuredClone(original),layers=S.snoozeDeficiency(original,'T1','findings',{until:'2026-10-23',note:'Waiting on engineering'},date,data);
 assert.deepEqual(original,before);assert.equal(S.summary(layers,'T1').huntGap,true);assert.equal(S.analysisFacts(S.summary(layers,'T1'),date).deferred,true);assert.equal(layers[0].entries[0].notes,'Original evidence');
 assert.deepEqual(S.analysisItems(data.techniques,layers,{},date).map(x=>x.t.id),['T2','T3','T1']);assert.deepEqual(S.analysisItems(data.techniques,layers,{snoozed:'only'},date).map(x=>x.t.id),['T1']);assert.equal(S.analysisItems(data.techniques,layers,{snoozed:'hide'},date).length,2);
 const resumed=S.snoozeDeficiency(layers,'T1','findings',{cancel:true},date,data);assert.equal(S.analysisFacts(S.summary(resumed,'T1'),date).deferred,false);assert.equal(resumed[0].entries[0].deficiencySnooze.note,'Waiting on engineering');
});
test('snoozes expire on the resume date and never defer independent intel or another open source',()=>{
 let layers=S.snoozeDeficiency(fixture(),'T1','findings',{until:'2026-10-23',note:'Waiting'},date,data);assert.equal(S.analysisFacts(S.summary(layers,'T1'),'2026-10-23').deferred,false);
 layers.push(layer('Other findings','hunt',[['T1','2026-10-01','none']]));assert.equal(S.analysisFacts(S.summary(layers,'T1'),date).deferred,false);
 layers=S.snoozeDeficiency(layers,'T3','findings',{until:'2026-10-23',note:'Waiting on testing'},date,data);assert.equal(S.summary(layers,'T3').intelPending,true);assert.equal(S.analysisFacts(S.summary(layers,'T3'),date).deferred,false);
 assert.throws(()=>S.snoozeDeficiency(layers,'T2','findings',{until:date,note:'Waiting'},date,data),/future date/);assert.throws(()=>S.snoozeDeficiency(layers,'T2','findings',{until:'2026-10-23',note:''},date,data),/snooze/);
});
test('deficiency ages survive reviews, normalization and bulk edits; reopening starts a new episode',()=>{
 const layers=fixture(),updated=S.quickUpdate(layers,'T1',{changes:[{layerId:'findings',reviewed:true}],notes:'Still waiting',date},data).layers;
 assert.equal(updated[0].entries[0].openedOn,'2026-01-01');assert.equal(S.analysisFacts(S.summary(updated,'T1'),date).openDays,288);
 const resolved=S.recordDefense(updated,'T1',{layerId:'findings',defense:'control'},date,data);assert.equal(resolved[0].entries[0].resolvedOn,date);assert.equal(S.summary(resolved,'T1').huntGap,false);
 const reopened=S.bulkEntries(resolved[0],['T1'],{status:'finding',compensatingControl:'none'},data,'2026-10-20');assert.equal(reopened[0].openedOn,'2026-10-20');assert.equal(reopened[0].resolvedOn,undefined);
 const normalized=S.validateLayers([{...updated[0],entries:[updated[0].entries[0]]}],data).layers[0].entries[0];assert.equal(normalized.openedOn,'2026-01-01');
});
test('recording a defense updates only the chosen mapping and keeps tool counts separate',()=>{
 const layers=fixture(),copy=structuredClone(layers),updated=S.recordDefense(layers,'T2',{layerId:'findings',defense:'both',notes:'Retested'},date,data);
 assert.deepEqual(layers,copy);assert.deepEqual(updated.slice(1),copy.slice(1));assert.equal(updated[0].entries[1].status,'resolved');assert.equal(updated[0].entries[1].notes,'Original evidence\nRetested');assert.equal(S.summary(updated,'T2').detectionCount,0);
 const newLayer=S.recordDefense(layers,'T4',{layerId:'__new',defense:'control'},date,data);assert.equal(newLayer.at(-1).entries[0].status,'resolved');assert.equal(newLayer.at(-1).entries[0].openedOn,date);
 assert.throws(()=>S.recordDefense(layers,'T2',{layerId:'findings',defense:'detection',detection:'__new'},date,data),/Name/);assert.deepEqual(layers,copy);
});
test('original intel addition dates survive subsequent evidence updates',()=>{
 const layers=fixture(),first=S.recordDefense(layers,'T2',{layerId:'intel A',defense:'control'},date,data);assert.equal(first[1].entries[0].addedOn,'2026-10-15');assert.equal(first[1].entries[0].date,date);
 const entries=S.bulkEntries(first[1],['T2'],{status:'intelligence',notes:'Context updated',date:'2026-10-20'},data,'2026-10-20');assert.equal(entries[0].addedOn,'2026-10-15');
});
