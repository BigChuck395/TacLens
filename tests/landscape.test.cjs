const {test}=require('node:test'),assert=require('node:assert/strict'),{tacticStatistics}=require('../core.js');
test('landscape counts exact techniques, distinct from layer counts, with independent assessments and defenses',()=>{
 const data={tactics:[{key:'a',name:'A'},{key:'b',name:'B'},{key:'c',name:'Empty'}],techniques:[{id:'T1',tactics:['a','b']},{id:'T2',tactics:['a']},{id:'T3',tactics:['a']},{id:'T4',tactics:['b']}]};
 const layer=(type,entries,visible=true)=>({id:crypto.randomUUID(),name:type,type,visible,entries:entries.map(([techniqueID,status,compensatingControl])=>({techniqueID,status,compensatingControl}))});
 const layers=[layer('hunt',[['T1','finding','yes']]),layer('hunt',[['T1','resolved','yes']]),layer('detection',[['T1','present']]),layer('detection',[['T1','present']]),layer('intel',[['T1','intelligence','yes'],['T2','intelligence','architecture'],['T3','intelligence','no']]),layer('detection',[['T3','present']],false)];
 const [a,b,c]=tacticStatistics(data,layers);assert.deepEqual({...a,key:undefined,name:undefined},{key:undefined,name:undefined,mapped:3,open:0,resolved:1,detections:1,controls:2,intelCovered:2,intelPending:0,intelUncovered:1});assert.equal(b.mapped,1);assert.equal(c.mapped,0);
 layers.push(layer('detection',[['T3','present']]));const updated=tacticStatistics(data,layers)[0];assert.equal(updated.intelUncovered,0);assert.equal(updated.intelCovered,3);assert.equal(updated.controls,2);
});
