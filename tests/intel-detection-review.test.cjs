const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../core.js');global.Strata=S;
const {assess}=require('../insights.js'),{coverageState}=require('../elt-report.js');
const data={techniques:[{id:'T1'},{id:'T1.001'}]},layer=(id,type,defense,techniqueID='T1')=>({id,name:id,type,visible:true,entries:[{techniqueID,status:type==='detection'?'present':type==='hunt'?'finding':'intelligence',compensatingControl:defense,notes:'Source context',date:'2026-10-01'}]});
const fixture=()=>[layer('intel','intel','unknown'),layer('SIEM','detection'),layer('EDR','detection')];
test('unreviewed intel with mapped detections is pending, distinct from uncovered and open deficiencies',()=>{
 const layers=fixture(),s=S.summary(layers,'T1');assert.equal(s.detected,true);assert.equal(s.detectionCount,2);assert.equal(s.intelPending,true);assert.equal(s.exposed,false);assert.equal(s.huntGap,false);assert.equal(assess(s).title,'Intel detection review');assert.equal(coverageState(s).key,'intel-pending');
 assert.equal(S.recommendationItems({layers},data).length,0);
 layers.push(layer('exercise','hunt','none'));const open=S.summary(layers,'T1');assert.equal(open.huntGap,true);assert.equal(open.conflict,false);assert.equal(coverageState(open).key,'attention');assert.equal(S.controlStatus(open.entries).label,'Detection present');
});
test('covered review saves per intel source, preserves evidence dates and never changes detection mappings or deficiencies',()=>{
 const layers=[...fixture(),layer('other intel','intel','unknown'),layer('exercise','hunt','none')],before=structuredClone(layers),updated=S.reviewIntelDetection(layers,'T1','intel','covered','2026-10-16',data);
 assert.deepEqual(layers,before);assert.equal(updated[0].entries[0].compensatingControl,'detection');assert.equal(updated[0].entries[0].date,'2026-10-01');assert.equal(updated[0].entries[0].notes,'Source context');assert.deepEqual(updated.slice(1),before.slice(1));
 const s=S.summary(updated,'T1');assert.equal(s.intelAssessments[0].state,'covered');assert.equal(s.intelAssessments[1].state,'pending');assert.equal(s.huntGap,true);assert.equal(s.detectionCount,2);
 const imported=S.validateLayers(updated,data).layers;assert.deepEqual(imported[0].entries[0].intelDetectionReview,updated[0].entries[0].intelDetectionReview);
});
test('uncovered intelligence does not turn detections negative or open a deficiency',()=>{
 const updated=S.reviewIntelDetection(fixture(),'T1','intel','uncovered','2026-10-16',data),s=S.summary(updated,'T1');assert.equal(s.intelPending,false);assert.equal(s.exposed,true);assert.equal(s.detected,true);assert.equal(s.detectionCount,2);assert.equal(s.huntGap,false);assert.equal(s.conflict,false);assert.equal(coverageState(s).key,'exposed');
 assert.equal(S.recommendationItems({layers:updated},data).length,0);
});
test('compensating controls still cover intel when detections do not',()=>{
 const layers=fixture();layers[0].entries[0].compensatingControl='control';const updated=S.reviewIntelDetection(layers,'T1','intel','uncovered','2026-10-16',data),s=S.summary(updated,'T1');assert.equal(s.controlled,true);assert.equal(s.exposed,false);assert.equal(s.intelPending,false);assert.equal(s.intelAssessments[0].state,'uncovered');
});
test('reviewed decisions return to pending when selected detection evidence changes, and can be reopened explicitly',()=>{
 const layers=S.reviewIntelDetection(fixture(),'T1','intel','covered','2026-10-16',data);assert.equal(S.summary(layers,'T1').intelPending,false);
 layers[1].entries[0].detections=['New rule'];assert.equal(S.summary(layers,'T1').intelPending,true);
 const refreshed=S.reviewIntelDetection(layers,'T1','intel','covered','2026-10-16',data);assert.equal(S.summary(refreshed,'T1').intelPending,false);
 const reopened=S.reviewIntelDetection(refreshed,'T1','intel','pending','2026-10-16',data);assert.equal(S.summary(reopened,'T1').intelPending,true);
});
test('note-only bulk and quick edits preserve reviews; exact IDs and hidden layers stay independent',()=>{
 const layers=S.reviewIntelDetection(fixture(),'T1','intel','uncovered','2026-10-16',data),review=layers[0].entries[0].intelDetectionReview;
 const bulk=S.bulkEntries(layers[0],['T1'],{status:'intelligence',notes:'Updated note'},data,'2026-10-16');assert.deepEqual(bulk[0].intelDetectionReview,review);
 const quick=S.quickUpdate(layers,'T1',{changes:[{layerId:'intel',reviewed:true}],notes:'Reviewed context',date:'2026-10-16'},data).layers;assert.deepEqual(quick[0].entries[0].intelDetectionReview,review);
 assert.equal(S.summary(layers,'T1.001').mapped,false);layers[0].visible=false;assert.equal(S.summary(layers,'T1').exposed,false);
 assert.throws(()=>S.reviewIntelDetection(layers,'T1','intel','covered','2026-10-16',data),/no longer available/);
 assert.throws(()=>S.reviewIntelDetection(fixture(),'T1','intel','covered','2026-02-30',data),/valid review date/);
});
test('intel mapping inventory separates confirmed, pending and unconfirmed coverage without duplicate counts',()=>{
 const layers=fixture(),r=S.evidenceStatistics(layers).find(x=>x.type==='intel');assert.equal(r.defended,0);assert.equal(r.pending,1);assert.equal(r.exposed,0);
 for(const decision of ['covered','uncovered']){const updated=S.reviewIntelDetection(layers,'T1','intel',decision,'2026-10-16',data),row=S.evidenceStatistics(updated).find(x=>x.type==='intel');assert.equal(row.defended+row.pending+row.exposed,row.mappings);}
});
