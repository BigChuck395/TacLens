const test=require('node:test'),assert=require('node:assert/strict');const {families}=require('../matrix.js');
const parent={id:'T1059',name:'Command execution',sub:false},child={id:'T1059.001',name:'PowerShell',sub:true},other={id:'T1059.003',name:'Windows shell',sub:true};
test('matching children branch under a contextual parent without asserting a parent match',()=>{const result=families([child],[parent,child,other]);assert.equal(result.length,1);assert.equal(result[0].parent.id,'T1059');assert.equal(result[0].parentMatched,false);assert.deepEqual(result[0].children,[child]);});
test('a matching parent and multiple children form one sorted family',()=>{const result=families([other,parent,child],[parent,child,other]);assert.equal(result.length,1);assert.equal(result[0].parentMatched,true);assert.deepEqual(result[0].children.map(t=>t.id),['T1059.001','T1059.003']);});
test('executive matrix keeps exact child evidence and flags work while parents remain context',()=>{
 const S=require('../core.js'),M=require('../matrix.js');global.Strata=S;
 const catalog=[{...parent,tactics:['execution']},{...child,tactics:['execution']}],layers=[{id:'h',name:'Test',visible:true,type:'hunt',entries:[{techniqueID:child.id,status:'finding',compensatingControl:'none'}]},{id:'d',name:'SIEM',visible:true,type:'detection',entries:[{techniqueID:child.id,status:'present'}]}];
 const html=M.render({techniques:[catalog[1]],catalog,tactics:[{key:'execution',name:'Execution'}],layers,summarize:S.summary,escape:S.escape,controlStatus:S.controlStatus});
 assert.match(html,/data-tech="T1059" data-state="unmapped"/);assert.match(html,/data-tech="T1059.001" data-state="attention"/);assert.match(html,/1 needs work/);assert.match(html,/data-parent="T1059" hidden/);assert.match(html,/executive-matrix matrix-fit/);assert.doesNotMatch(html,/show-evidence-counts/);
 assert.equal(S.summary(layers,parent.id).mapped,false);assert.equal(M.coverageState(S.summary(layers,child.id)).key,require('../elt-report.js').coverageState(S.summary(layers,child.id)).key);
});
test('matrix previews retain source notes, detection counts and open/resolved assessments with safe text',()=>{
 const S=require('../core.js'),M=require('../matrix.js');global.Strata=S;
 const layers=[{id:'h',name:'Testing',visible:true,type:'hunt',entries:[{techniqueID:child.id,status:'finding',compensatingControl:'none',notes:'Retest pending <script>unsafe()</script>'}]},{id:'d',name:'SIEM',visible:true,type:'detection',entries:[{techniqueID:child.id,status:'present',detections:['Rule one','Rule two']}]}];
 const html=M.preview({technique:child,summary:S.summary(layers,child.id),escape:S.escape,editable:true});assert.match(html,/1 detection layer mapped/);assert.match(html,/1 open · 0 resolved/);assert.match(html,/Retest pending &lt;script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/Click to inspect or edit/);
});
