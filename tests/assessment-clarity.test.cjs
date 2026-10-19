const {test}=require('node:test'),assert=require('node:assert/strict');
global.Strata=require('../core.js');const {render}=require('../insights.js');
test('every open source is visible separately from controls; resolved sources stay out of the open list',()=>{
 const layers=[['Purple <team>','finding','unknown'],['Another team','finding','none'],['Retest','resolved','yes']].map(([name,status,compensatingControl],i)=>({id:String(i),name,type:'hunt',visible:true,entries:[{techniqueID:'T1059.001',status,compensatingControl,notes:'Evidence <text>'}]}));
 layers.push({id:'d',name:'SIEM',type:'detection',visible:true,entries:[{techniqueID:'T1059.001',status:'present'}]});
 const args={techniques:[{id:'T1059.001',name:'PowerShell'}],layers,summary:Strata.summary,status:Strata.categoryStatus,escape:Strata.escape};
 const html=render({...args,editable:true});assert.match(html,/Still open in 2 layers/);assert.equal((html.match(/data-review-deficiency=/g)||[]).length,2);assert.match(html,/Purple &lt;team&gt;/);assert.match(html,/Assessment: Deficiency · unresolved/);assert.match(html,/Record a detection, compensating control, or both/);assert.match(html,/Nothing present/);
 const report=render(args);assert.match(report,/Still open in 2 layers/);assert.doesNotMatch(report,/data-review-deficiency=/);
 layers[0].entries[0].compensatingControl='both';layers[1].entries[0].compensatingControl='both';assert.doesNotMatch(render(args),/Still open in/);assert.match(render(args),/No outstanding work/);
});
