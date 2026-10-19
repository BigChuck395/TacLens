const {test}=require('node:test'),assert=require('node:assert/strict');global.Strata=require('../core.js');const {render}=require('../insights.js');
const techniques=[{id:'T1',name:'One'}],layer=(id,type,defense)=>({id,name:id,type,visible:true,entries:[{techniqueID:'T1',status:type==='hunt'?'finding':type==='intel'?'intelligence':'present',compensatingControl:defense,notes:id+' original notes',date:'2026-10-01'}]});
function args(){return {techniques,layers:[layer('Deficiency A','hunt','none'),layer('Intel B','intel','unknown'),layer('Resolved C','hunt','both'),layer('SIEM','detection')],summary:Strata.summary,status:Strata.categoryStatus,escape:Strata.escape,date:'2026-10-16'};}
test('technique analysis gives every assessment its own defense action and shows source evidence once',()=>{
 const html=render({...args(),editable:true});for(const id of ['Deficiency A','Intel B','Resolved C']){assert.match(html,new RegExp('data-defense-layer="'+id+'"'));assert.equal(html.split(id+' original notes').length-1,1);}assert.equal((html.match(/data-record-defense=/g)||[]).length,3);assert.doesNotMatch(html,/source-work-info/);
});
test('layer grouping shows actionable source mappings without turning positive detections into work',()=>{
 const html=render({...args(),editable:true,analysisOptions:{groupBy:'layer'}});assert.match(html,/data-analysis-layer="Deficiency A"/);assert.match(html,/data-analysis-layer="Intel B"/);assert.doesNotMatch(html,/data-analysis-layer="Resolved C"|data-analysis-layer="SIEM"/);assert.equal((html.match(/data-record-defense=/g)||[]).length,2);assert.match(html,/Each row is one source mapping/);
});
test('read-only analysis omits empty tracking containers and preserves actual work information without purple styling',()=>{
 const input=args(),empty=render(input);assert.doesNotMatch(empty,/source-work-info|data-start-work-tech|data-record-defense/);input.layers[0].entries[0].work={status:'in_progress',assignee:'Alex',createdOn:'2026-10-01',updatedOn:'2026-10-15',notes:[{date:'2026-10-15',kind:'note',text:'Waiting for retest'}]};
 const tracked=render(input);assert.match(tracked,/readonly-work-info/);assert.match(tracked,/Alex/);assert.match(tracked,/Waiting for retest/);assert.doesNotMatch(tracked,/source-work-actions|data-start-work-tech|data-record-defense/);
});
