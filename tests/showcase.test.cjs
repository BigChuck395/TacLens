const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const S=require('../core.js');global.Strata=S;const {assess}=require('../insights.js'),workspace=require('../examples/operations-showcase-workspace.json');
test('showcase maps the current catalog and demonstrates distinct actionable states without stale thresholds',()=>{
 const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../data.js'),'utf8'),context);const data=context.ATTACK_DATA;
 assert.equal(S.validateLayers(workspace.layers,data).unknown,0);assert.equal(workspace.layers.length,32);
 assert.equal(new Set(workspace.layers.map(l=>l.id)).size,32);assert.equal(S.tacticStatistics(data,workspace.layers).filter(r=>r.mapped).length,15);
 const state=id=>S.summary(workspace.layers,id);
 assert.equal(assess(state('T1059.001')).attention,false);assert.equal(state('T1059.001').detectionCount,3);
 assert.equal(state('T1059.003').detected,false);assert.equal(state('T1059.003').exposed,true);
 assert.equal(state('T1003.001').huntGap,false);assert.equal(state('T1003.001').detected,true);
 assert.equal(state('T1567.002').controlled,true);assert.equal(state('T1567.002').detected,false);assert.equal(assess(state('T1567.002')).attention,false);
 assert.equal(state('T1078').conflict,false);assert.equal(state('T1078').detected,true);assert.equal(assess(state('T1082')).reviewDue,true);
 assert.ok(workspace.layers.some(l=>l.entries.some(e=>e.notes==='')));assert.ok(workspace.layers.some(l=>l.metadata.tags.some(t=>t.endsWith('(Tag Deleted)'))));
 assert.doesNotMatch(JSON.stringify(workspace),/below.*minimum|default.*minimum|three detections required/i);
 for(const row of S.evidenceStatistics(workspace.layers).filter(r=>r.type!=='detection'))for(const [value] of S.defenseChoicesForType(row.type))assert.ok(row.controls[value]>0,`${row.type} must demonstrate ${value}`);
 const assessmentOnly=workspace.layers.flatMap(l=>l.entries).find(e=>e.notes.startsWith('Resolved following detection implementation')&&state(e.techniqueID).detectionCount===0);assert.ok(assessmentOnly);assert.equal(state(assessmentOnly.techniqueID).detected,true);assert.equal(state(assessmentOnly.techniqueID).exposed,false);
});
test('showcase uses current choices and supplies rich data without obsolete assessments or migration prose',()=>{
 assert.ok(workspace.layers.reduce((n,l)=>n+l.entries.length,0)>1000);assert.ok(workspace.layers.every(l=>l.entries.length>0));
 for(const layer of workspace.layers)for(const entry of layer.entries){assert.ok(S.types[layer.type].statuses[entry.status]);if(layer.type==='hunt'){assert.notEqual(entry.compensatingControl,'unknown');assert.equal(entry.status,entry.compensatingControl==='none'?'finding':'resolved');assert.ok(entry.openedOn);}if(layer.type==='detection'){assert.equal(entry.status,'present');assert.equal('compensatingControl' in entry,false);}}
 assert.doesNotMatch(JSON.stringify(workspace),/disagreement|Previous assessment|not automatically|manually marked/i);
 assert.ok(workspace.layers.some(l=>l.entries.some(e=>e.detections?.length>1)));assert.ok(workspace.layers.some(l=>l.type==='detection'&&l.entries.some(e=>e.detections?.length===0)));
 const normalized=S.validateLayers(workspace.layers,{techniques:[...new Set(workspace.layers.flatMap(l=>l.entries.map(e=>e.techniqueID)))].map(id=>({id}))}).layers;
 assert.deepEqual(JSON.parse(JSON.stringify(normalized.map(l=>l.entries))),workspace.layers.map(l=>l.entries));
});
test('showcase differentiates intel review states, source overlap, architecture, and changed tool evidence',()=>{
 const state=id=>S.summary(workspace.layers,id),mixed=state('T1105');assert.equal(mixed.detectionCount,2);assert.equal(mixed.huntGap,false);assert.equal(mixed.exposed,true);assert.equal(mixed.intelPending,true);
 assert.deepEqual(mixed.intelAssessments.map(x=>x.state).sort(),['covered','pending','uncovered']);
 assert.equal(state('T1078').detectionCount,1);assert.equal(state('T1078').intelPending,true);assert.equal(state('T1059.004').intelPending,true);
 const changed=state('T1059.004').intelAssessments[0];assert.equal(changed.entry.intelDetectionReview.decision,'covered');assert.equal(changed.state,'pending');
 const protectedIntel=state('T1566.001');assert.equal(protectedIntel.detectionCount,5);assert.equal(protectedIntel.controlled,true);assert.equal(protectedIntel.exposed,false);assert.equal(protectedIntel.intelAssessments.find(x=>x.entry.compensatingControl==='control').state,'uncovered');
 assert.ok(state('T1059.003').intelAssessments.length>=2);assert.equal(state('T1059.003').detectionCount,0);
});
test('showcase demonstrates complete work lifecycle, priority reduction, accepted coverage, and schedules',()=>{
 const catalog={techniques:[...new Set(workspace.layers.flatMap(l=>l.entries.map(e=>e.techniqueID)))].map(id=>({id,name:id}))},date=workspace.generatedOn,work=S.workItems(workspace,catalog,date);
 assert.equal(work.length,10);assert.equal(work.filter(x=>x.work.status==='closed').length,2);assert.equal(work.filter(x=>x.work.status==='queued').length,1);assert.ok(work.some(x=>x.work.status==='in_progress'&&x.coverage.ready));assert.ok(work.some(x=>x.work.status==='in_progress'&&!x.work.assignee));assert.ok(work.some(x=>x.work.assignee.endsWith(' (User Deleted)')));
 assert.ok(workspace.users.length>=5);assert.equal(workspace.users.includes('Former analyst'),false);assert.ok(work.some(x=>x.work.notes.length>=4));
 assert.equal(S.analysisFacts(S.summary(workspace.layers,'T1041'),date).deferred,true);assert.equal(S.analysisFacts(S.summary(workspace.layers,'T1486'),date).deferred,false);
 const reviews=S.recommendationItems(workspace,catalog);assert.equal(reviews.filter(x=>x.accepted).length,2);assert.ok(reviews.some(x=>!x.accepted));
 const schedules=workspace.layers.filter(l=>l.type==='intel').map(l=>({layer:l,...S.intelReview(l.metadata,date)}));assert.ok(schedules.some(x=>!x.scheduled));assert.ok(schedules.some(x=>x.scheduled&&!x.due));assert.ok(schedules.some(x=>x.due&&x.layer.visible));assert.ok(schedules.some(x=>x.due&&!x.layer.visible));
 for(const x of work){const entryDate=x.layer.type==='hunt'?x.entry.openedOn:x.entry.addedOn;assert.ok(x.work.createdOn>=entryDate);assert.ok(x.work.updatedOn>=x.work.createdOn);}
});
