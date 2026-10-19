const test=require('node:test'),assert=require('node:assert/strict'),{build,coverageState,coverageLegend,rollupTechniques,techniqueDisposition}=require('../elt-report.js');
test('ELT legend includes only present categories, with intelligence reviews separate from deficiencies',()=>{
 const open={open:true,state:{key:'attention'}},pending={state:{key:'intel-pending'}},covered={state:{key:'covered'}};
 assert.deepEqual(coverageLegend([open,covered]),[['attention','Open deficiency'],['covered','Defense recorded']]);
 assert.deepEqual(coverageLegend([pending,covered]),[['intel-pending','Detection review needed'],['covered','Defense recorded']]);
 assert.deepEqual(coverageLegend([covered]),[['covered','Defense recorded']]);
});
test('ELT colors separate open deficiencies, uncovered intelligence and pending detection reviews',()=>{
 assert.equal(coverageState({mapped:true,huntGap:true,detected:true,relevant:true}).key,'attention');
 assert.equal(coverageState({mapped:true,conflict:false,controlled:true}).key,'covered');assert.equal(coverageState({mapped:true,detected:true,intelPending:true}).key,'intel-pending');
 assert.equal(coverageState({mapped:true,relevant:true,exposed:true}).key,'exposed');
 assert.equal(coverageState({mapped:true,detected:true}).key,'covered');
 assert.equal(coverageState({mapped:true,controlled:true}).key,'covered');
 assert.equal(coverageState({mapped:true}).key,'unreviewed');
 assert.equal(coverageState({mapped:false}).key,'unmapped');
});
test('ELT export preserves exact scopes, selected sources and escaped text in a standalone snapshot',()=>{
 const data={version:'test',license:'MITRE license',tactics:[{key:'execution',name:'Execution'}],techniques:[{id:'T1059',name:'Parent',sub:false,tactics:['execution']},{id:'T1059.001',name:'PowerShell',sub:true,tactics:['execution']}]};
 const layers=[{id:'d',name:'SIEM',type:'detection',visible:true,entries:[{techniqueID:'T1059.001',status:'present',notes:'</script><script>alert(1)</script>'}]},{id:'h',name:'Excluded',type:'hunt',visible:false,entries:[{techniqueID:'T1059.001',status:'finding',compensatingControl:'none'}]}];
 const html=build({title:'<img onerror=alert(1)>',context:'Scope',exported:'2026-10-16',theme:'light',data,layers});
 const snapshot=JSON.parse(html.match(/id="elt-payload">([\s\S]*?)<\/script>/)[1]);
 assert.deepEqual(snapshot.layers,['SIEM']);assert.equal(snapshot.techniques[0].state.key,'unmapped');assert.equal(snapshot.techniques[1].state.key,'covered');assert.equal(snapshot.techniques[1].detectionCount,1);assert.equal(snapshot.pending,1);assert.equal(snapshot.accepted,0);
 assert.equal(snapshot.techniques[1].entries[0].notes,layers[0].entries[0].notes);
 assert.equal(snapshot.families.length,1);assert.equal(snapshot.families[0].id,'T1059');assert.equal(snapshot.families[0].state.key,'covered');assert.equal(snapshot.families[0].parentMapped,false);assert.equal(snapshot.families[0].subtechniqueCount,1);
 assert.equal(snapshot.techniques[1].disposition.label,'Detection present');assert.equal(snapshot.techniques[0].disposition.label,'No mapping');
 assert.doesNotMatch(html,/<img onerror|<script>alert/);assert.doesNotMatch(html,/<script src=|<link /);
});

test('sub-technique dispositions distinguish defenses, unresolved findings, pending intel and unmapped scopes',()=>{
 for(const [detected,controlled,label] of [[true,false,'Detection present'],[false,true,'Compensating control present'],[true,true,'Detection and control present']]){
  const disposition=techniqueDisposition({state:{key:'covered'},detected,controlled,resolved:true,open:false});assert.equal(disposition.label,label);assert.equal(disposition.detail,'Resolved deficiency');
 }
 const finding=techniqueDisposition({state:{key:'attention'},detected:true,controlled:false,open:true,resolved:true});assert.equal(finding.label,'Open deficiency');assert.equal(finding.detail,'Detection present');
 assert.equal(techniqueDisposition({state:{key:'intel-pending'},detected:true}).label,'Detection review needed');assert.equal(techniqueDisposition({state:{key:'unmapped'}}).label,'No mapping');
});

test('parent rollups prioritize every mapped child and ignore unmapped siblings',()=>{
 const technique=(id,key,tactics=['execution'])=>({id,name:id,sub:id.includes('.'),tactics,mapped:key!=='unmapped',intel:['exposed','intel-pending'].includes(key),state:{key}});
 for(const [keys,expected] of [
  [['covered','attention','exposed'],'attention'],
  [['covered','exposed','intel-pending'],'exposed'],
  [['covered','intel-pending','unreviewed'],'intel-pending'],
  [['covered','unreviewed','unmapped'],'unreviewed'],
  [['unmapped','covered','unmapped'],'covered'],
  [['unmapped','unmapped','unmapped'],'unmapped']
 ]){
  const input=keys.map((key,i)=>technique(i?'T1.00'+i:'T1',key)),before=structuredClone(input),[family]=rollupTechniques(input);
  assert.equal(family.state.key,expected);assert.deepEqual(input,before);assert.equal(family.mappedCount,keys.filter(k=>k!=='unmapped').length);assert.equal(Object.values(family.counts).reduce((a,b)=>a+b,0),family.mappedCount);
 }
 const [family]=rollupTechniques([technique('T1','unmapped',['execution']),technique('T1.001','covered',['execution','defense-evasion'])]);
 assert.deepEqual(family.tactics,['execution','defense-evasion']);assert.deepEqual(family.memberIds,['T1','T1.001']);assert.equal(family.intel,false);
});

test('defense does not transfer between parent and children, and multiple layers do not inflate rollups',()=>{
 const data={version:'test',tactics:[{key:'execution',name:'Execution'}],techniques:['T1','T1.001','T1.002'].map(id=>({id,name:id,sub:id.includes('.'),tactics:['execution']}))};
 const layers=[
  {id:'a',type:'hunt',name:'Parent defense',visible:true,entries:[{techniqueID:'T1',status:'resolved',compensatingControl:'both'}]},
  {id:'b',type:'intel',name:'Child intelligence',visible:true,entries:[{techniqueID:'T1.001',status:'intelligence',compensatingControl:'none'}]},
  {id:'d1',type:'detection',name:'SIEM',visible:true,entries:[{techniqueID:'T1.002',status:'present'}]},
  {id:'d2',type:'detection',name:'EDR',visible:true,entries:[{techniqueID:'T1.002',status:'present'}]},
  {id:'hidden',type:'hunt',name:'Excluded deficiency',visible:false,entries:[{techniqueID:'T1.002',status:'finding',compensatingControl:'none'}]}
 ];
 const before=structuredClone(layers),html=build({title:'Rollups',exported:'2026-10-19',theme:'light',data,layers}),snapshot=JSON.parse(html.match(/id="elt-payload">([\s\S]*?)<\/script>/)[1]),[family]=snapshot.families;
 assert.equal(family.state.key,'exposed');assert.equal(family.counts.covered,2);assert.equal(family.counts.exposed,1);assert.equal(family.counts.attention,0);assert.equal(family.mappedCount,3);assert.equal(family.parentMapped,true);assert.equal(family.subtechniqueCount,2);
 assert.equal(snapshot.techniques.find(t=>t.id==='T1.002').detectionCount,2);assert.deepEqual(layers,before);assert.doesNotMatch(html,/Excluded deficiency/);
});
