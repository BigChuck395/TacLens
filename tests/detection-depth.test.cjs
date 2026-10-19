const {test}=require('node:test'),assert=require('node:assert/strict');
const {detectionCoverage,summary,detectionNames,validateLayers,bulkEntries,quickUpdate,controlStatus}=require('../core.js');
const {assess}=require('../insights.js');
const detection=id=>({layerId:id,type:'detection',status:'present',detections:['Rule '+id]});
test('counts distinct positive detection layers, independently of rule names or tactic repetitions',()=>{
 const entries=[detection('a'),{...detection('b'),detections:['One','Two','Three']},detection('a')];
 assert.equal(detectionCoverage(entries).count,2);assert.equal(detectionCoverage(entries).toolCount,2);
 assert.equal(detectionCoverage([{...detection('a'),detections:undefined}]).count,1);
 assert.equal(detectionCoverage([]).count,0);assert.equal(detectionCoverage(entries,100).count,2);
 assert.equal('threshold' in detectionCoverage(entries),false);
});
test('counts follow selected layers and exact technique IDs',()=>{
 const layers=[{id:'a',type:'detection',name:'A',visible:true,entries:[{techniqueID:'T1000',status:'present'}]},{id:'b',type:'detection',name:'B',visible:false,entries:[{techniqueID:'T1000',status:'present',detections:['a','b']}]},{id:'c',type:'detection',name:'C',visible:true,entries:[{techniqueID:'T1000.001',status:'present'}]}];
 assert.equal(summary(layers,'T1000').detectionCount,1);layers[1].visible=true;
 assert.equal(summary(layers,'T1000').detectionCount,2);assert.equal(summary(layers,'T1000.001').detectionCount,1);
});
test('rule details remain optional reference data and survive import and edits',()=>{
 const data={techniques:[{id:'T1000'}]},input={name:'EDR',type:'detection',visible:true,entries:[{techniqueID:'T1000',status:'present',detections:['Rule 1','rule 1','Rule 2'],notes:'Servers'}]};
 const layers=validateLayers([input],data).layers;assert.deepEqual(layers[0].entries[0].detections,['Rule 1','Rule 2']);
 assert.deepEqual(bulkEntries(layers[0],['T1000'],{status:'present'},data,'2026-10-09')[0].detections,['Rule 1','Rule 2']);
 const updated=quickUpdate(layers,'T1000',{detection:layers[0].id,detections:'Rule 2\nRule 3',date:'2026-10-09'},data).layers;
 assert.deepEqual(updated[0].entries[0].detections,['Rule 1','Rule 2','Rule 3']);assert.equal(summary(updated,'T1000').detectionCount,1);
 assert.deepEqual(detectionNames(' A\na\nB'),['A','B']);assert.throws(()=>detectionNames([{}]));
});
test('detected Intel has no count-based review and open deficiencies require explicit resolution',()=>{
 for(const detections of [undefined,['One'],['One','Two','Three']]){
  const layers=[{id:'i',type:'intel',name:'Intel',visible:true,entries:[{techniqueID:'T1000',status:'relevant',compensatingControl:'no'}]},{id:'d',type:'detection',name:'SIEM',visible:true,entries:[{techniqueID:'T1000',status:'present',detections}]}];
  assert.equal(assess(summary(layers,'T1000')).attention,false);
  layers.push({id:'f',type:'hunt',name:'Exercise',visible:true,entries:[{techniqueID:'T1000',status:'finding',compensatingControl:'no'}]});
  assert.equal(assess(summary(layers,'T1000')).attention,false);
  layers[2].entries[0].status='resolved';assert.equal(assess(summary(layers,'T1000')).attention,false);
 }
});
test('non-detection controls provide coverage without fabricating detection mappings',()=>{
 const data={techniques:[{id:'T1000'}]},layers=validateLayers([{name:'Intel',type:'intel',visible:true,entries:[{techniqueID:'T1000',status:'relevant',compensatingControl:'architecture'}]}],data).layers;
 const s=summary(layers,'T1000');assert.equal(s.controlled,true);assert.equal(s.detected,false);assert.equal(s.exposed,false);assert.equal(s.detectionCount,0);assert.equal(assess(s).attention,false);
 assert.equal(controlStatus(s.entries).tone,'ready');assert.match(controlStatus(s.entries).label,/Compensating control present/);
 const changed=quickUpdate(layers,'T1000',{changes:[{layerId:layers[0].id,compensatingControl:'architecture',reviewed:true}],date:'2026-10-09'},data).layers;
 assert.equal(changed[0].entries[0].compensatingControl,'control');
 assert.equal(bulkEntries(layers[0],['T1000'],{status:'intelligence',compensatingControl:'architecture'},data,'2026-10-09')[0].compensatingControl,'control');
 layers.push({id:'f',name:'Exercise',type:'hunt',visible:true,entries:[{techniqueID:'T1000',status:'resolved',compensatingControl:'no'}]});
 assert.equal(summary(layers,'T1000').conflict,false);assert.equal(summary(layers,'T1000').huntGap,true);assert.equal(assess(summary(layers,'T1000')).attention,true);
});
