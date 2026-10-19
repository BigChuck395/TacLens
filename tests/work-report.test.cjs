const {test}=require('node:test'),assert=require('node:assert/strict'),S=require('../core.js'),R=require('../work-report.js'),ELT=require('../elt-report.js');
const data={version:'test',tactics:[{key:'execution',name:'Execution'}],techniques:[{id:'T1',name:'One',tactics:['execution'],sub:false},{id:'T2',name:'Two',tactics:['execution'],sub:false}]};
function fixture(){return {exported:'2026-10-16T12:00:00Z',title:'Report',theme:'light',data,layers:[{id:'a',name:'Assessment <one>',type:'hunt',visible:true,entries:[{techniqueID:'T1',status:'finding',compensatingControl:'none',notes:'Source <script>unsafe</script>',date:'2026-10-01',work:{status:'in_progress',assignee:'Alex',createdOn:'2026-10-01',updatedOn:'2026-10-15',notes:[{date:'2026-10-15',kind:'note',text:'Waiting <img src=x>'}]}}]},{id:'b',name:'Hidden source',type:'hunt',visible:false,entries:[{techniqueID:'T2',status:'resolved',compensatingControl:'both',notes:'Excluded notes',work:{status:'closed',assignee:'Hidden user',createdOn:'2026-10-01',updatedOn:'2026-10-02',closedOn:'2026-10-02',notes:[]}}]}]};}
test('report work snapshot includes selected source mappings only and isolates its notes/history',()=>{
 const payload=fixture(),before=structuredClone(payload),snapshot=R.snapshot(payload);assert.equal(snapshot.layerCount,1);assert.equal(snapshot.items.length,1);assert.equal(snapshot.items[0].coverage.ready,false);assert.equal(snapshot.items[0].defense,'Nothing present');assert.equal(snapshot.items[0].work.assignee,'Alex');assert.deepEqual(payload,before);
 snapshot.items[0].work.notes[0].text='Changed snapshot';assert.equal(payload.layers[0].entries[0].work.notes[0].text,'Waiting <img src=x>');assert.doesNotMatch(JSON.stringify(snapshot),/Hidden source|Hidden user|Excluded notes/);
});
test('read-only work cards escape user text, retain history, and expose filtering without mutation controls',()=>{
 const html=R.render(R.snapshot(fixture()));assert.match(html,/Assessment &lt;one&gt;/);assert.match(html,/Waiting &lt;img src=x&gt;/);assert.match(html,/Source &lt;script&gt;unsafe&lt;\/script&gt;/);assert.match(html,/data-report-work-status="closed"/);assert.match(html,/Work notes and history/);assert.doesNotMatch(html,/<textarea|<form|data-record-defense|data-work-action|data-work-assignee|<script>|<img /);
 assert.match(R.render(R.snapshot(fixture()),{search:'no match'}),/No work items/);
});
test('executive work tracker is optional and its snapshot preserves the same selected scope',()=>{
 const payload=fixture(),without=ELT.build(payload),withWork=ELT.build({...payload,includeWorkTracker:true});
 const read=html=>JSON.parse(html.match(/id="elt-payload">([\s\S]*?)<\/script>/)[1]);assert.equal(read(without).workTracker,undefined);assert.equal(read(withWork).workTracker.items.length,1);assert.doesNotMatch(withWork,/Hidden source|Hidden user|Excluded notes|<script>unsafe|<img src=x>/);assert.match(withWork,/installWorkReport/);assert.doesNotMatch(withWork,/<script src=|<link /);
});
