const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {summary,validateLayers,escape,bulkEntries,matchesLayer,moveLayer,moveFolder,categoryStatus} = require('../core.js');
const context = {}; vm.runInNewContext(fs.readFileSync(require.resolve('../data.js'),'utf8'),context);
const data = context.ATTACK_DATA;
const layer = (type,status,id='T1059.001',visible=true) => ({id:type,name:type,type,visible,entries:[{techniqueID:id,status}]});
const tagged=(type,value,id='T1059.001',visible=true)=>{const l=layer(type,type==='hunt'?'resolved':'relevant',id,visible);l.entries[0].compensatingControl=value;return l;};
const {assess}=require('../insights.js');
test('comparison insights separate exposure, control tags, open assessments, defenses and conflicts',()=>{
  const insight=layers=>assess(summary(layers,'T1059.001'));
  assert.equal(insight([layer('intel','relevant')]).title,'Intel without confirmed coverage');
  assert.equal(insight([tagged('intel','yes')]).controlled,true);
  const both=insight([layer('detection','present'),layer('hunt','finding')]);assert.equal(both.findings,true);assert.equal(both.defended,true);assert.equal(both.title,'Unresolved deficiency');
  assert.equal(insight([layer('detection','present')]).attention,false);
  assert.equal(insight([tagged('hunt','yes'),tagged('intel','no')]).title,'Compensating control present');
  assert.equal(insight([layer('intel','historical')]).attention,true);
});
test('official catalog has valid unique IDs and tactics, including sub-techniques',()=>{
  assert.ok(data.techniques.length>600); assert.equal(new Set(data.techniques.map(t=>t.id)).size,data.techniques.length);
  assert.ok(data.techniques.some(t=>t.id==='T1059.001'&&t.sub));
  for(const t of data.techniques) {assert.match(t.id,/^T\d{4}(\.\d{3})?$/);assert.ok(t.tactics.length);for(const k of t.tactics)assert.ok(data.tactics.some(x=>x.key===k));}
});

test('positive defenses resolve deficiencies; unreviewed mappings and contradictory scopes still need work',()=>{
 const finding=layer('hunt','finding');finding.entries[0].compensatingControl='control';const layers=[finding,layer('detection','present'),layer('intel','observed')],before=structuredClone(layers);
 const s=summary(layers,'T1059.001'),a=assess(s);assert.equal(s.huntGap,false);assert.equal(a.covered,true);assert.equal(a.attention,true);assert.equal(s.intelPending,true);assert.deepEqual(layers,before);
 finding.entries[0].compensatingControl='unknown';assert.equal(assess(summary(layers,'T1059.001')).findings,true);
 finding.entries[0].compensatingControl='control';layers.push(tagged('intel','none'));assert.equal(summary(layers,'T1059.001').conflict,false);
});

test('unknown coverage is distinct from a confirmed gap',()=>{
  const s=summary([],'T1059.001');assert.equal(s.mapped,false);assert.equal(s.exposed,false);assert.equal(s.detectionGap,false);
  assert.deepEqual(categoryStatus('detection',[]),{label:'No detection mapped',tone:'unknown'});
});
test('relevant intel with an unreviewed control tag stays exposed',()=>{
  assert.equal(summary([layer('intel','relevant'),tagged('hunt','unknown')],'T1059.001').exposed,true);
});
test('either a mapped detection or present control tag addresses the exposure flag',()=>{
  for(const defense of [layer('detection','present'),tagged('hunt','yes')])assert.equal(summary([layer('intel','observed'),defense],'T1059.001').exposed,false);
});
test('hidden layers do not contribute and parents do not imply child coverage',()=>{
  assert.equal(summary([layer('intel','relevant'),layer('detection','present','T1059.001',false)],'T1059.001').exposed,true);
  assert.equal(summary([layer('detection','present','T1059')],'T1059.001').detected,false);
});
test('conflicting same-type evidence is retained; legacy historical intel now migrates to intelligence',()=>{
  assert.equal(summary([tagged('hunt','no'),tagged('intel','yes')],'T1059.001').conflict,false);
  assert.equal(summary([layer('intel','historical')],'T1059.001').exposed,true);
});
test('import rejects invalid statuses and duplicates, reports unknown IDs, regenerates IDs',()=>{
  assert.throws(()=>validateLayers([layer('detection','implemented')],data),/Invalid/);
  const l=layer('intel','relevant');l.entries.push(l.entries[0]);assert.throws(()=>validateLayers([l],data),/Duplicate/);
  const imported=validateLayers([layer('intel','relevant','T9999')],data);assert.equal(imported.unknown,1);assert.equal(imported.layers[0].entries.length,0);
  const first=validateLayers([layer('intel','observed')],data).layers[0];assert.notEqual(first.id,'intel');assert.equal(first.entries[0].status,'intelligence');
});
test('user text is escaped for HTML contexts',()=>{assert.equal(escape('<script>"&\''),'&lt;script&gt;&quot;&amp;&#39;');});
test('card labels spell out missing, pending and conflicting evidence without hiding statuses',()=>{
  assert.deepEqual(categoryStatus('intel',[]),{label:'No mapping',tone:'unknown'});
  assert.deepEqual(categoryStatus('intel',[{type:'intel',status:'relevant'}]),{label:'Intelligence',tone:'context'});
  assert.deepEqual(categoryStatus('detection',[{type:'detection',status:'present'}]),{label:'Detection present',tone:'ready'});
  assert.equal(categoryStatus('hunt',[{type:'hunt',status:'finding'},{type:'hunt',status:'resolved'}]).label,'Deficiency + Resolved');
});
test('legacy findings and control gaps migrate to findings',()=>{
  const imported=validateLayers([layer('hunt','gap'),layer('control','gap')],data).layers;
  assert.equal(imported[0].entries[0].status,'finding');assert.equal(imported[1].type,'hunt');assert.equal(imported[1].entries[0].status,'finding');assert.equal(imported[1].entries[0].compensatingControl,'none');
  assert.equal(summary([layer('hunt','finding')],'T1059.001').huntGap,true);
  assert.equal(summary([tagged('hunt','control')],'T1059.001').huntGap,false);
});
test('drag layer moves preserve assessments and visibility while changing sibling order',()=>{
  const layers=[{...layer('hunt','finding'),id:'a',folder:'First'},{...layer('detection','gap'),id:'b',folder:'Second'},{...layer('intel','relevant'),id:'c',folder:'Second'}];
  const moved=moveLayer(layers,'a','Second','c');
  assert.deepEqual(moved.map(l=>l.id),['b','a','c']);assert.equal(moved[1].folder,'Second');assert.deepEqual(moved[1].entries,layers[0].entries);assert.equal(moved[1].visible,true);
  assert.equal(layers[0].folder,'First');assert.deepEqual(moveLayer(moved,'a','Second','b').map(l=>l.id),['a','b','c']);
});
test('drag folder moves rename the whole subtree, preserve evidence, and reject cycles and duplicates',()=>{
  const folders=['First','First/Child','Second','Third'],layers=[{...layer('hunt','finding'),folder:'First/Child'}];
  const moved=moveFolder(folders,layers,'First','Second');
  assert.deepEqual(moved.folders,['Second','Third','Second/First','Second/First/Child']);assert.equal(moved.layers[0].folder,'Second/First/Child');assert.deepEqual(moved.layers[0].entries,layers[0].entries);
  assert.throws(()=>moveFolder(folders,layers,'First','First/Child'),/itself/);
  assert.throws(()=>moveFolder(['First','Second','Second/First'],layers,'First','Second'),/already exists/);
  assert.deepEqual(moveFolder(folders,layers,'Third','','First').folders,['Third','First','First/Child','Second']);
});
test('layer metadata and nested folders survive import; filters search all metadata without changing visibility',()=>{
  const imported=validateLayers([{...layer('hunt','gap'),folder:'Operations / Purple team',metadata:{owner:'SOC',mappingCompleted:'2026-10-08',tags:['identity','purple'],description:'Baseline exercise'}}],data).layers[0];
  assert.equal(imported.folder,'Operations/Purple team');assert.deepEqual(imported.metadata.tags,['identity','purple']);
  assert.equal(matchesLayer(imported,'2026-10-08 identity','hunt'),true);assert.equal(matchesLayer(imported,'purple baseline'),true);
  assert.equal(matchesLayer(imported,'identity','control'),false);assert.equal(imported.visible,true);
  assert.equal(validateLayers([layer('detection','present')],data).layers[0].folder,'');
});
test('bulk edits preserve unselected evidence and blank shared metadata; exact IDs stay independent',()=>{
  const original={type:'detection',entries:[{techniqueID:'T1059.001',status:'present',notes:'Existing replay evidence',date:'2026-01-01'},{techniqueID:'T1078',status:'present',notes:'Keep this detection'}]};
  const result=bulkEntries(original,['T1059.001'],{status:'present',notes:'',owner:'',source:'',date:''},data,'2026-10-08');
  assert.equal(result[0].notes,'Existing replay evidence');assert.equal('owner' in result[0],false);assert.equal(result[0].date,'2026-01-01');assert.equal(result[0].status,'present');
  assert.deepEqual(result[1],original.entries[1]);assert.equal(original.entries[0].status,'present');
  const added=bulkEntries(original,['T1059','T1059'],{status:'present',notes:'Shared scope'},data,'2026-10-08');
  assert.equal(added.length,3);assert.equal(added[0].status,'present');assert.equal(added[2].techniqueID,'T1059');assert.equal(added[2].date,'2026-10-08');
});
test('bulk edits require evidence for new IDs, validate status and update existing mappings without duplication',()=>{
  const original={type:'hunt',entries:[{techniqueID:'T1059.001',status:'finding',notes:'Old evidence',compensatingControl:'no'}]};
  assert.equal(bulkEntries(original,['T1078'],{status:'resolved',compensatingControl:'detection'},data,'2026-10-08')[1].notes,'');
  assert.throws(()=>bulkEntries(original,['T1078'],{status:'present',notes:'Test'},data,'2026-10-08'),/valid status/);
  assert.throws(()=>bulkEntries(original,['T9999'],{status:'finding',notes:'Test'},data,'2026-10-08'),/Unknown/);
  const updated=bulkEntries(original,['T1059.001','T1078'],{status:'resolved',compensatingControl:'control',notes:'Same baseline',owner:'Engineering'},data,'2026-10-08');
  assert.equal(updated.length,2);assert.ok(updated.every(e=>e.status==='resolved'&&e.notes==='Same baseline'&& !('owner' in e)));
});

test('legacy detection import retains detections, omits gaps and moves references into notes',()=>{
 const result=validateLayers([{name:'Legacy',type:'detection',metadata:{owner:'SOC'},entries:[{techniqueID:'T1059.001',status:'validated',notes:'Replay passed',source:'DET-42',owner:'SOC',date:'2026-01-01'},{techniqueID:'T1078',status:'unvalidated',notes:'Rule deployed'},{techniqueID:'T1003.001',status:'gap',notes:'Missing'}]}],data);
 assert.equal(result.removedDetectionGaps,1);assert.equal(result.layers[0].entries.length,2);assert.ok(result.layers[0].entries.every(e=>e.status==='present'&&!('owner' in e)&&!('source' in e)));assert.equal(result.layers[0].entries[0].notes,'Replay passed\nReference: DET-42');assert.equal(result.layers[0].entries[0].date,'2026-01-01');assert.equal('owner' in result.layers[0].metadata,false);
 assert.equal(summary(result.layers,'T1003.001').mapped,false);
});

test('control tags respect visibility, conflicts and exact IDs',()=>{
 assert.equal(summary([tagged('intel','yes')],'T1059.001').exposed,false);assert.equal(summary([tagged('intel','no')],'T1059.001').exposed,true);
 const conflicting=summary([tagged('intel','yes'),tagged('hunt','no')],'T1059.001');assert.equal(conflicting.conflict,false);assert.equal(conflicting.exposed,false);assert.equal(conflicting.huntGap,true);
 assert.equal(summary([tagged('intel','yes'),tagged('hunt','no','T1059.001',false)],'T1059.001').conflict,false);
 assert.equal(summary([tagged('intel','no'),tagged('hunt','yes','T1059')],'T1059.001').controlled,false);
});
test('legacy control layers migrate without losing evidence or folder scope',()=>{
 const result=validateLayers([{name:'Baseline',type:'control',visible:false,folder:'Ops/Legacy',entries:[{techniqueID:'T1059.001',status:'implemented',notes:'Baseline applied',date:'2026-01-01'},{techniqueID:'T1078',status:'planned',notes:'Rollout pending'},{techniqueID:'T1003.001',status:'gap',notes:'Missing'}]}],data);
 assert.equal(result.migratedControlLayers,1);const l=result.layers[0];assert.equal(l.type,'hunt');assert.equal(l.folder,'Ops/Legacy');assert.equal(l.visible,false);assert.deepEqual(l.entries.map(e=>e.compensatingControl),['control','none','none']);assert.match(l.entries[1].notes,/planned.*\nRollout pending/);assert.equal(l.entries[0].date,'2026-01-01');
});
test('bulk control tags can be kept, set, and cleared while detection records stay tag-free',()=>{
 const l=tagged('hunt','yes');l.entries[0].notes='Scope';
 assert.equal(bulkEntries(l,['T1059.001'],{status:'resolved',compensatingControl:'keep'},data,'2026-10-08')[0].compensatingControl,'control');
 for(const value of ['control','detection','both','none','unknown'])assert.equal(bulkEntries(l,['T1059.001'],{status:'finding',compensatingControl:value},data,'2026-10-08')[0].compensatingControl,value==='unknown'?'none':value);
 const imported=validateLayers([{...layer('detection','present'),entries:[{techniqueID:'T1059.001',status:'present',compensatingControl:'yes'}]}],data).layers[0];assert.equal('compensatingControl' in imported.entries[0],false);
});
test('Deficiencies supports only open or resolved assessments and resolved records leave the open queue',()=>{
 const S=require('../core.js');assert.deepEqual(S.types.hunt.statuses,{finding:'Deficiency',resolved:'Resolved'});
 const l=tagged('hunt','control');assert.equal(summary([l],'T1059.001').huntGap,false);assert.deepEqual(categoryStatus('hunt',[{type:'hunt',status:'resolved'}]),{label:'Resolved',tone:'ready'});
 assert.throws(()=>bulkEntries(l,['T1059.001'],{status:'validated'},data,'2026-10-08'),/valid status/);
 l.entries[0].status='finding';l.entries[0].compensatingControl='unknown';assert.equal(summary([l],'T1059.001').huntGap,true);
});
test('legacy Validated deficiencies become open without losing history, dates, tags, metadata, or repeat-migrating',()=>{
 const original={...layer('hunt','validated'),folder:'SOC',metadata:{tags:['review'],description:'Scope'},entries:[{techniqueID:'T1059.001',status:'validated',notes:'Replay passed',date:'2026-01-01',compensatingControl:'yes'}]};
 const result=validateLayers([original],data),migrated=result.layers[0];assert.equal(result.migratedValidatedDeficiencies,1);assert.equal(migrated.entries[0].status,'resolved');assert.match(migrated.entries[0].notes,/Previous assessment: Validated.*\nReplay passed/);assert.equal(migrated.entries[0].date,'2026-01-01');assert.equal(migrated.entries[0].compensatingControl,'control');assert.equal(migrated.folder,'SOC');assert.deepEqual(migrated.metadata.tags,['review']);assert.equal(original.entries[0].status,'validated');
 const again=validateLayers(result.layers,data);assert.equal(again.migratedValidatedDeficiencies,0);assert.deepEqual(again.layers[0].entries,migrated.entries);
});
test('legacy implemented controls map to resolved deficiencies while planned and absent controls stay open',()=>{
 const result=validateLayers([{name:'Old controls',type:'control',entries:[{techniqueID:'T1059.001',status:'implemented'},{techniqueID:'T1078',status:'planned'},{techniqueID:'T1003.001',status:'gap'}]}],data);assert.deepEqual(result.layers[0].entries.map(e=>e.status),['resolved','finding','finding']);
});

test('deleted tags stay in layer metadata and cannot be resurrected by reload or import',()=>{
 const {activeTags,deleteTag}=require('../core.js');const l={...layer('intel','relevant'),metadata:{tags:['identity','retired'],mappingCompleted:'2026-10-08'}};
 const result=deleteTag(['identity','retired','unused'],[l],'retired');assert.deepEqual(result.tags,['identity','unused']);assert.deepEqual(result.layers[0].metadata.tags,['identity','retired (Tag Deleted)']);assert.deepEqual(l.metadata.tags,['identity','retired']);
 const imported=validateLayers(result.layers,data).layers;assert.equal(imported[0].metadata.mappingCompleted,'2026-10-08');assert.deepEqual(activeTags(result.tags,imported),['identity','unused']);assert.equal(matchesLayer(imported[0],'Tag Deleted'),true);
});

test('tag filters distinguish active names, deleted definitions, and untagged layers',()=>{
 const l={...layer('intel','relevant'),metadata:{tags:['priority','old (Tag Deleted)']}};assert.equal(matchesLayer(l,'','all','priority'),true);assert.equal(matchesLayer(l,'','all','old'),false);assert.equal(matchesLayer(l,'','all','__deleted'),true);assert.equal(matchesLayer(l,'','all','__untagged'),false);assert.equal(matchesLayer(layer('hunt','finding'),'','all','__untagged'),true);assert.equal(matchesLayer(l,'','detection','priority'),false);
});
