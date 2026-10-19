const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../core.js');
const date='2026-10-16',data={techniques:[{id:'T1',name:'One'},{id:'T2',name:'Two'}]},layer=(id,type,defense,techniqueID='T1')=>({id,name:id,type,visible:true,entries:[{techniqueID,status:type==='hunt'?'finding':type==='intel'?'intelligence':'present',compensatingControl:defense,date:'2026-10-01',notes:'Original evidence'}]});
const fixture=()=>({schema:'strata-workspace',version:1,name:'Work',users:[],layers:[layer('Findings','hunt','none'),layer('Intel A','intel','unknown'),layer('SIEM','detection',null)]});
test('work starts on an exact source mapping with assignment and append-only notes',()=>{
 const original=fixture(),before=structuredClone(original),named=S.createUser(original,'Alex'),started=S.updateWork(named,'T1','Findings',{action:'start',assignee:'Alex',note:'Engineering is implementing the fix.'},date,data);
 assert.deepEqual(original,before);assert.equal(started.layers[0].entries[0].status,'finding');assert.equal(started.layers[0].entries[0].notes,'Original evidence');assert.equal(started.layers[0].entries[0].work.assignee,'Alex');assert.equal(started.layers[0].entries[0].work.status,'in_progress');assert.deepEqual(started.layers.slice(1),named.layers.slice(1));
 const noted=S.updateWork(started,'T1','Findings',{action:'add_note',note:'Retest scheduled.'},date,data);assert.equal(noted.layers[0].entries[0].work.notes.at(-1).text,'Retest scheduled.');assert.ok(noted.layers[0].entries[0].work.notes.some(n=>n.text.includes('Engineering')));
 assert.throws(()=>S.updateWork(started,'T1','SIEM',{action:'start'},date,data),/source mapping/);assert.throws(()=>S.updateWork(started,'T1','Findings',{action:'assign',assignee:'Missing'},date,data),/existing user/);
});
test('tracking one issue does not deprioritize untracked findings or independent intelligence',()=>{
 let w=S.updateWork(fixture(),'T1','Findings',{action:'start'},date,data),facts=S.analysisFacts(S.summary(w.layers,'T1'),date);assert.equal(facts.inProgress,1);assert.equal(facts.deferred,false);
 w=S.updateWork(w,'T1','Intel A',{action:'start'},date,data);facts=S.analysisFacts(S.summary(w.layers,'T1'),date);assert.equal(facts.deferred,true);assert.equal(S.summary(w.layers,'T1').huntGap,true);assert.equal(S.summary(w.layers,'T1').intelPending,true);assert.equal(S.summary(w.layers,'T1').detectionCount,1);
 w.layers.push(layer('Other assessment','hunt','none'));assert.equal(S.analysisFacts(S.summary(w.layers,'T1'),date).deferred,false);
});
test('in-progress intel-only work moves below untracked items and returns to normal priority when queued',()=>{
 let w=fixture();w.layers=[layer('Intel A','intel','none'),layer('Intel B','intel','none','T2')];w=S.updateWork(w,'T1','Intel A',{action:'start'},date,data);
 assert.deepEqual(S.analysisItems(data.techniques,w.layers,{},date).map(x=>x.t.id),['T2','T1']);assert.equal(S.analysisItems(data.techniques,w.layers,{progress:'only'},date).length,1);
 w=S.updateWork(w,'T1','Intel A',{action:'queue',note:'Needs another reviewer.'},date,data);assert.equal(S.analysisFacts(S.summary(w.layers,'T1'),date).deferred,false);assert.equal(w.layers[0].entries[0].work.status,'queued');assert.equal(w.layers[0].entries[0].notes,'Original evidence');
});
test('closure requires source coverage, retains history, and reopening does not invent a deficiency',()=>{
 let w=S.updateWork(fixture(),'T1','Findings',{action:'start',note:'Working with engineering.'},date,data),before=structuredClone(w);
 assert.throws(()=>S.updateWork(w,'T1','Findings',{action:'close',note:'Done'},date,data),/Deficiency still open/);assert.deepEqual(w,before);
 w.layers=S.recordDefense(w.layers,'T1',{layerId:'Findings',defense:'control'},date,data);w=S.updateWork(w,'T1','Findings',{action:'close',note:'Retest passed.'},date,data);
 assert.equal(w.layers[0].entries[0].work.closedOn,date);assert.equal(w.layers[0].entries[0].work.status,'closed');assert.ok(w.layers[0].entries[0].work.notes.some(n=>n.text==='Retest passed.'));assert.equal(w.layers[0].entries[0].status,'resolved');
 w=S.updateWork(w,'T1','Findings',{action:'start'},'2026-10-17',data);assert.equal(w.layers[0].entries[0].work.status,'in_progress');assert.equal(w.layers[0].entries[0].work.createdOn,date);assert.equal(w.layers[0].entries[0].work.closedOn,undefined);assert.equal(w.layers[0].entries[0].status,'resolved');
});
test('intel work closes after coverage is confirmed; an uncovered detection review remains open',()=>{
 let w=S.updateWork(fixture(),'T1','Intel A',{action:'start'},date,data);assert.throws(()=>S.updateWork(w,'T1','Intel A',{action:'close'},date,data),/awaits review/);
 w.layers=S.reviewIntelDetection(w.layers,'T1','Intel A','uncovered',date,data);assert.throws(()=>S.updateWork(w,'T1','Intel A',{action:'close'},date,data),/confirmed coverage/);
 w.layers=S.reviewIntelDetection(w.layers,'T1','Intel A','covered',date,data);w=S.updateWork(w,'T1','Intel A',{action:'close'},date,data);assert.equal(w.layers[1].entries[0].work.status,'closed');assert.equal(S.summary(w.layers,'T1').huntGap,true);
});
test('deleted users remain on current and closed assignments and cannot be resurrected by reload',()=>{
 let w=S.createUser(fixture(),'Alex');assert.throws(()=>S.createUser(w,'alex'),/unique/);assert.throws(()=>S.createUser(w,'__unassigned'),/unique/);assert.deepEqual(S.normalizeUsers(['Alex (User Deleted) ','__unassigned',' Alex ','alex']),['Alex']);w=S.updateWork(w,'T1','Findings',{action:'start',assignee:'Alex'},date,data);w=S.updateWork(w,'T1','Intel A',{action:'start',assignee:'Alex'},date,data);
 w.layers=S.reviewIntelDetection(w.layers,'T1','Intel A','covered',date,data);w=S.updateWork(w,'T1','Intel A',{action:'close'},date,data);w=S.deleteUser(w,'Alex');
 assert.deepEqual(w.users,[]);assert.equal(w.layers[0].entries[0].work.assignee,'Alex (User Deleted)');assert.equal(w.layers[1].entries[0].work.assignee,'Alex (User Deleted)');assert.equal(w.layers[1].entries[0].work.status,'closed');assert.deepEqual(S.normalizeUsers(['Alex (User Deleted)']),[]);
 w=S.createUser(w,'Blair');w=S.updateWork(w,'T1','Findings',{action:'assign',assignee:'Blair'},date,data);assert.equal(w.layers[0].entries[0].work.assignee,'Blair');assert.equal(w.layers[1].entries[0].work.assignee,'Alex (User Deleted)');
});
test('hidden source work remains available and survives mapping edits and normalization',()=>{
 let w=S.updateWork(fixture(),'T1','Findings',{action:'start',note:'Retain this work note.'},date,data);w.layers[0].visible=false;assert.equal(S.workItems(w,data,date).length,1);w=S.updateWork(w,'T1','Findings',{action:'add_note',note:'Follow-up'},date,data);
 const old=w.layers[0].entries[0].work,entries=S.bulkEntries(w.layers[0],['T1'],{status:'finding',notes:'Source context updated'},data,date);assert.deepEqual(entries[0].work,old);
 const imported=S.validateLayers(w.layers,data).layers;assert.deepEqual(imported[0].entries[0].work,old);
});
test('legacy snooze notes migrate to work without losing their reason or resuming automatically',()=>{
 const w=fixture();w.layers[0].entries[0].deficiencySnooze={until:'2099-10-30',setOn:'2026-10-16',note:'Waiting on another team.'};const migrated=S.validateLayers(w.layers,data).layers[0].entries[0];
 assert.equal(migrated.work.status,'in_progress');assert.match(migrated.work.notes[0].text,/Waiting on another team/);assert.equal(S.workInfo(migrated,'2099-11-01').status,'in_progress');assert.equal(migrated.status,'finding');
});
