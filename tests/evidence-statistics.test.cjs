const {test}=require('node:test'),assert=require('node:assert/strict'),{evidenceStatistics}=require('../core.js');
test('inventory uses mapping counts consistently and each breakdown reconciles to its row total',()=>{
 const layer=(type,entries,visible=true)=>({id:crypto.randomUUID(),type,visible,entries:entries.map(([techniqueID,status,compensatingControl])=>({techniqueID,status,compensatingControl}))});
 const layers=[layer('hunt',[['T1','finding','yes'],['T2','finding','unknown']]),layer('hunt',[['T1','resolved','architecture']]),layer('detection',[['T1','present']]),layer('detection',[['T1','present']]),layer('intel',[['T1','intelligence','yes'],['T2','intelligence','no']]),layer('intel',[['T1','intelligence','unknown']]),layer('hunt',[['T1','finding','no']],false)];
 const [h,d,i]=evidenceStatistics(layers);assert.equal(h.mappings,3);assert.equal(h.open,1);assert.equal(h.resolved,2);assert.equal(h.open+h.resolved,h.mappings);assert.equal(d.mappings,2);assert.equal(d.layers,2);assert.equal(i.mappings,3);assert.equal(i.defended,1);assert.equal(i.pending,1);assert.equal(i.exposed,1);assert.equal(i.defended+i.pending+i.exposed,i.mappings);
 for(const r of [h,i])assert.equal(Object.values(r.controls).reduce((a,b)=>a+b,0),r.mappings);
 layers.forEach(l=>l.visible=false);for(const r of evidenceStatistics(layers))assert.equal(r.mappings,0);
});
