// Generates an importable example only. Installing it is a separate, explicit action.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{randomUUID}=require('node:crypto');
const S=require('../core.js');
const context={};vm.runInNewContext(fs.readFileSync(require.resolve('../data.js'),'utf8'),context);const data=context.ATTACK_DATA;
function buildShowcase(anchor=new Date().toISOString().slice(0,10)){
 if(!S.validDay(anchor))throw Error('Choose a valid showcase date.');
 const day=offset=>new Date(Date.parse(anchor+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
 const byId=new Map(data.techniques.map(t=>[t.id,t]));
 const featured={
  'T1059.001':{scenario:0,tools:3}, // Fully defended; no unresolved work.
  'T1059':{scenario:0,tools:2},
  'T1059.003':{scenario:1,tools:0}, // Uncovered intel with recent overlapping sources.
  'T1003.001':{scenario:2,tools:2}, // Detection-only, reviewed and accepted.
  'T1567.002':{scenario:3,tools:0}, // Architecture-only, accepted coverage.
  'T1078':{scenario:4,tools:1}, // Intel awaiting confirmation against a mapped detection.
  'T1082':{scenario:5,tools:3}, // Good coverage; intelligence maintenance is overdue.
  'T1486':{scenario:6,tools:0}, // Two open sources, only one being worked.
  'T1566.001':{scenario:2,tools:5},
  'T1105':{scenario:7,tools:2}, // Three sources with different intel review decisions.
  'T1041':{scenario:6,tools:0}, // All unresolved sources tracked; lower in Needs work.
  'T1021.001':{scenario:0,tools:2}, // Work ready to close after defense was recorded.
  'T1071.001':{scenario:4,tools:2}, // Unassigned intelligence investigation.
  'T1547.001':{scenario:6,tools:0}, // Work returned to queue with notes intact.
  'T1005':{scenario:6,tools:0}, // Work assigned to a deleted user.
  'T1110.003':{scenario:8,tools:2}, // Upcoming intelligence review.
  'T1027':{scenario:0,tools:2}, // Closed deficiency and intelligence work history.
  'T1059.004':{scenario:4,tools:2} // Changed tool evidence makes an earlier review pending.
 };
 const ids=new Set(Object.keys(featured));
 for(const tactic of data.tactics)for(const sub of [false,true])data.techniques.filter(t=>t.tactics.includes(tactic.key)&&!!t.sub===sub).slice(0,sub?8:12).forEach(t=>ids.add(t.id));
 for(const parent of ['T1059','T1003','T1021','T1566','T1071','T1110'])data.techniques.filter(t=>t.id.startsWith(parent+'.')).forEach(t=>ids.add(t.id));
 const techniques=[...ids].filter(id=>byId.has(id)).sort();
 const make=(name,type,folder,tags,description,extra={})=>({id:randomUUID(),name,type,visible:true,folder,metadata:S.layerMetadata({tags:['showcase',...tags],description,...extra}),entries:[]});
 const detectionNames=['SIEM · Windows analytics','SIEM · Identity analytics','SIEM · Cloud audit analytics','SIEM · Network analytics','EDR · Employee workstations','EDR · Engineering workstations','EDR · Windows production servers','EDR · Windows application servers','EDR · Linux production servers','EDR · Linux build servers','Cloud · Workload protection','Cloud · Identity protection','Network · East-west monitoring','Network · Internet gateway','Email · Attachment analysis','Identity · Privileged access monitoring'];
 const detectionFolders=['SIEM','SIEM','SIEM','SIEM','EDR/Workstations','EDR/Workstations','EDR/Servers','EDR/Servers','EDR/Servers','EDR/Servers','Cloud','Cloud','Network','Network','Email','Identity'];
 const detection=detectionNames.map((name,i)=>make(name,'detection','Detection tools/'+detectionFolders[i],['detection',i<4?'siem':i<10?'edr':'telemetry'],'Tool-specific positive mappings. Multiple rule names in this layer still count as one detection layer for each exact technique.'));
 const deficiencies=[
  ['Purple · Endpoint validation','Assessments/Purple team/Endpoints','purple-team'],
  ['Purple · Identity validation','Assessments/Purple team/Identity','purple-team'],
  ['Purple · Cloud validation','Assessments/Purple team/Cloud','purple-team'],
  ['Purple · Network validation','Assessments/Purple team/Network','purple-team'],
  ['Red · Workstation assessment','Assessments/Red team/Workstations','red-team'],
  ['Red · Server assessment','Assessments/Red team/Servers','red-team'],
  ['Retest · Detection remediation','Assessments/Retests/Detections','retest'],
  ['Retest · Architecture protections','Assessments/Retests/Architecture','retest']
 ].map(([name,folder,tag])=>make(name,'hunt',folder,[tag,'testing'],'Tested behavior and remediation evidence. Nothing present stays open; a recorded detection, compensating control, or both resolves this specific assessment.'));
 const intel=[
  make('Intel · Current campaign overview','intel','Intelligence/Campaigns/Current',['intelligence','campaign','recent'],'Recent source mappings for comparing overlap and confirmed protection.',{mappingCompleted:day(-3),reviewDays:null}),
  make('Intel · Endpoint tradecraft','intel','Intelligence/Reports/Endpoint',['intelligence','endpoint'],'Endpoint behavior reviewed against the selected tool evidence.',{mappingCompleted:day(-16),reviewDays:null}),
  make('Intel · Identity threats','intel','Intelligence/Reports/Identity',['intelligence','identity'],'Separate intelligence source for reviewing the same exact techniques independently.',{mappingCompleted:day(-9),reviewDays:null}),
  make('Intel · Review overdue','intel','Intelligence/Review queue/Overdue',['intelligence','review-due'],'Coverage remains recorded while the source intelligence needs its scheduled review.',{mappingCompleted:day(-50),reviewedOn:day(-40),reviewDays:30}),
  make('Intel · Detection review required','intel','Intelligence/Campaigns/Current',['intelligence','detection-review','recent'],'Detections are mapped. Confirm whether those detections cover each reported behavior.',{mappingCompleted:day(-1),reviewDays:null}),
  make('Intel · Archived network report','intel','Intelligence/Archive/Network',['intelligence','archived'],'Not selected in Analysis. Scheduled reviews and tracked work remain available across the workspace.',{mappingCompleted:day(-95),reviewedOn:day(-65),reviewDays:60}),
  make('Intel · Upcoming source review','intel','Intelligence/Review queue/Upcoming',['intelligence','scheduled'],'An upcoming source review with confirmed coverage; the due date does not remove protection.',{mappingCompleted:day(-8),reviewedOn:day(-2),reviewDays:30}),
  make('Intel · Architecture-protected behaviors','intel','Intelligence/Reports/Architecture',['intelligence','architecture'],'Architectural restrictions confirmed for the reported behavior; no detection is implied by a control-only assessment.',{mappingCompleted:day(-25),reviewDays:null})
 ];
 intel[5].visible=false;
 const add=(layer,id,defense,notes,age=0,openedAge=age)=>{
  if(layer.entries.some(e=>e.techniqueID===id))throw Error('Duplicate showcase mapping '+layer.name+' '+id);
  const entry={techniqueID:id,status:layer.type==='detection'?'present':layer.type==='intel'?'intelligence':S.deficiencyStatus('hunt',defense),date:day(-age),notes};
  if(layer.type!=='detection')entry.compensatingControl=defense;
  if(layer.type==='hunt'){entry.openedOn=day(-openedAge);if(entry.status==='resolved')entry.resolvedOn=entry.date;}
  if(layer.type==='intel')entry.addedOn=day(-age);
  layer.entries.push(entry);return entry;
 };
 for(const [index,id] of techniques.entries()){
  const scenario=featured[id]?.scenario??index%10,toolCount=featured[id]?.tools??([0,2,4,5,7,8].includes(scenario)?1+index%6:0),name=byId.get(id).name;
  for(let k=0;k<toolCount;k++){
   const tool=(index*3+k*5)%detection.length,entry=add(detection[tool],id,null,index%13===0?'':'Behavior analytics for '+name+'. This mapping is positive evidence from this tool; review intelligence sources separately for their reported behavior.',2+index%30);
   entry.detections=index%6===0?[]:['RULE-'+(tool+1)+'-'+id+' behavior match',...(index%3===0?['RULE-'+(tool+1)+'-'+id+' alternate signal']:[])];
  }
  if(scenario===0){
   add(deficiencies[6],id,'both','Retest passed after a detection was created and an independent compensating control was confirmed.',2,60+index%100);
   add(intel[0],id,'both','Reported behavior matches the tested detections. The compensating control also addresses this exact technique.',id==='T1027'?25:index%4);
  }else if(scenario===1){
   add(intel[0],id,'none','Recent source reports '+name+'. No detection or compensating control is recorded for this behavior.',index%3);
   add(intel[2],id,'none','An independent source maps the same behavior. No confirmed defense is recorded.',3+index%9);
   if(index%2===0)add(intel[1],id,'none','Additional source overlap increases the relevance of reviewing this technique.',7);
  }else if(scenario===2){
   add(deficiencies[6],id,'detection','Resolved following detection implementation. Retest reproduced the behavior and the detection fired. No independent compensating control is recorded.',4,75+index%50);
   add(intel[1],id,'detection','The selected detections cover the behavior described by this source. Review or accept detection-only coverage in Coverage review.',4);
  }else if(scenario===3){
   add(deficiencies[7],id,'control','Retest confirmed an architectural restriction blocks the behavior. No detection is recorded for this exact technique.',6,100+index%40);
   add(intel[7],id,'control','An access restriction or isolation boundary addresses this behavior. Coverage is supplied by architecture.',10+index%12);
  }else if(scenario===4){
   add(intel[4],id,'unknown','Source added recently. A detection tool maps this technique; confirm whether its logic and asset scope cover this particular behavior.',featured[id]?7:index%3);
   if(index%2===0&&!featured[id])add(intel[2],id,'unknown','A second source needs its own detection coverage decision. Reviewing another source does not review this mapping.',5);
  }else if(scenario===5){
   add(deficiencies[6],id,'both','Detection and compensating control verified. This deficiency is resolved.',5,90);
   add(intel[3],id,'both','Both defenses are confirmed. The source intelligence review is overdue; completing it does not change recorded coverage.',45);
  }else if(scenario===6){
   add(deficiencies[Math.floor(index/10)%6],id,'none','Test reproduced '+name+' in the assessed scope. No defense is recorded for this test case. Record a detection or compensating control after remediation.',8+index%35,30+index%180);
   add(intel[0],id,'none','Relevant behavior also appears in this source. No confirmed defense is recorded for this technique.',featured[id]?25:index%7);
  }else if(scenario===7){
   add(intel[0],id,'detection','Reviewed source: existing detections cover the specific behavior described here.',3);
   add(intel[2],id,'none','Reviewed source: the current detection logic does not cover this reported variation. Tool mappings remain positive evidence.',6);
   add(intel[4],id,'unknown','Separate source awaiting a coverage decision against the mapped detections.',1);
  }else if(scenario===8){
   add(intel[6],id,'both','Both defenses confirmed. The scheduled source review is upcoming.',8);
  }else{
   add(deficiencies[7],id,'control',index%4===1?'':'The compensating control blocks the tested path. A detection tool mapping is not implied.',14,120);
   add(intel[7],id,'control','The reported behavior is addressed by a confirmed architecture control.',20);
  }
 }
 const assessmentOnly=techniques.find((id,index)=>!featured[id]&&index%10===2);
 if(!assessmentOnly)throw Error('Assessment-only example missing.');
 detection.forEach(l=>l.entries=l.entries.filter(e=>e.techniqueID!==assessmentOnly));
 add(deficiencies.find(l=>l.name.startsWith('Red')&&!l.entries.some(e=>e.techniqueID==='T1486')),'T1486','none','A second test scope also needs remediation. This source has not been assigned; tracking the other assessment does not close it.',12,160);
 add(intel[7],'T1566.001','control','Mail isolation supplies independent protection. A detection coverage decision is recorded separately below.',7);
 for(const id of ['T1059.003','T1041','T1005'])add(intel[5],id,'none','Archived source retained for its original scope. This layer is not selected in Analysis.',95);
 deficiencies[5].metadata.tags.push('Legacy exercise (Tag Deleted)');intel[5].metadata.tags.push('Legacy campaign (Tag Deleted)');
 const layers=[...detection,...deficiencies,...intel],checked=S.validateLayers(layers,data);if(checked.unknown)throw Error('Showcase contains unknown ATT&CK IDs.');
 checked.layers.forEach((l,i)=>layers[i]={...l,id:layers[i].id});
 const folderRoots=layers.map(l=>l.folder),folders=[...new Set(folderRoots.flatMap(p=>p.split('/').map((_,i)=>p.split('/').slice(0,i+1).join('/'))))];
 let workspace={schema:'strata-workspace',version:1,name:'TacLens · Operations showcase',demo:true,generatedOn:anchor,attackVersion:data.version,folders,tags:S.activeTags([],layers),users:['Alex Morgan','Jordan Lee','Sam Rivera','Taylor Chen','Casey Patel'],collapsedFolders:['Detection tools/EDR','Intelligence/Archive'],layers};
 const source=(id,type)=>workspace.layers.find(l=>l.visible&&l.type===type&&l.entries.some(e=>e.techniqueID===id));
 const start=(id,type,assignee,note,offset=-10)=>{const l=source(id,type);workspace=S.updateWork(workspace,id,l.id,{action:'start',assignee,note},day(offset),data);return l.id;};
 const note=(id,layerId,text,offset=-1)=>{workspace=S.updateWork(workspace,id,layerId,{action:'add_note',note:text},day(offset),data);};
 const exfil=start('T1041','hunt','Alex Morgan','Engineering is implementing an egress restriction. Retest is scheduled before recording defense.',-14);
 note('T1041',exfil,'Change is approved; waiting for deployment to the assessed hosts.');
 start('T1041','intel','Alex Morgan','Tracking this intelligence source alongside the egress remediation.',-12);
 start('T1486','hunt','Jordan Lee','Endpoint team is testing a ransomware protection change. Another open assessment is still unassigned.',-8);
 start('T1071.001','intel','','Needs an analyst to replay the reported C2 behavior against the existing rules.',-3);
 const ready=start('T1021.001','hunt','Sam Rivera','Detection and architectural protection verified. Review evidence and close this work item.',-7);
 note('T1021.001',ready,'Retest complete. The source deficiency is resolved; the work item is ready to close.',-1);
 const queued=start('T1547.001','hunt','Taylor Chen','Waiting for the application team to confirm startup configuration.',-20);
 workspace=S.updateWork(workspace,'T1547.001',queued,{action:'queue',note:'Returned to the queue because the original remediation approach is unavailable.'},day(-2),data);
 workspace=S.createUser(workspace,'Former analyst');start('T1005','hunt','Former analyst','Evidence collection is underway. Reassign this work after the analyst leaves.',-6);workspace=S.deleteUser(workspace,'Former analyst');
 start('T1005','intel','Taylor Chen','Confirming whether the same collection behavior is relevant to the current environment.',-4);
 for(const type of ['hunt','intel']){
  const closed=start('T1027',type,'Jordan Lee','Tested the obfuscated payload path and recorded the protection evidence.',-21);
  workspace=S.updateWork(workspace,'T1027',closed,{action:'close',note:'Defense verified and source review complete. Retaining the work history.'},day(-2),data);
 }
 const review=(id,layer,decision,offset=-1)=>{workspace.layers=S.reviewIntelDetection(workspace.layers,id,layer.id,decision,day(offset),data);};
 review('T1003.001',intel[1],'covered');review('T1105',intel[0],'covered');review('T1105',intel[2],'uncovered');review('T1566.001',intel[7],'uncovered');
 review('T1059.004',intel[4],'covered',-5);
 const changed=workspace.layers.find(l=>l.type==='detection'&&l.entries.some(e=>e.techniqueID==='T1059.004')).entries.find(e=>e.techniqueID==='T1059.004');
 changed.detections=[...(changed.detections||[]),'RULE-new Linux shell signal'];changed.date=day(-1);
 const shellIntel=workspace.layers.find(l=>l.id===intel[4].id).entries.find(e=>e.techniqueID==='T1059.004');shellIntel.notes='A previous review confirmed this behavior, but the selected detection evidence has since changed. Review the mapping again before relying on the earlier decision.';
 for(const id of ['T1567.002','T1003.001'])workspace=S.reviewRecommendation(workspace,id,'accept',{date:day(-1)},data);
 const golden=S.summary(workspace.layers,'T1059.001');if(golden.huntGap||golden.exposed||golden.intelPending||!golden.detected||!golden.controlled)throw Error('Fully defended PowerShell example is invalid.');
 if(S.summary(workspace.layers,'T1567.002').detected||!S.summary(workspace.layers,'T1567.002').controlled)throw Error('Architecture-only example is invalid.');
 return workspace;
}
function showcaseStats(workspace){const states=data.techniques.map(t=>S.summary(workspace.layers,t.id)),work=S.workItems(workspace,data,workspace.generatedOn),reviews=S.recommendationItems(workspace,data);return {layers:workspace.layers.length,selectedLayers:workspace.layers.filter(l=>l.visible).length,mappings:workspace.layers.reduce((n,l)=>n+l.entries.length,0),techniques:states.filter(s=>s.mapped).length,tactics:S.tacticStatistics(data,workspace.layers).filter(t=>t.mapped).length,openDeficiencies:states.reduce((n,s)=>n+s.entries.filter(e=>e.type==='hunt'&&e.status==='finding').length,0),intelDetectionReviews:states.reduce((n,s)=>n+s.intelAssessments.filter(a=>a.state==='pending').length,0),coverageReviews:reviews.filter(r=>!r.accepted).length,acceptedCoverage:reviews.filter(r=>r.accepted).length,trackedWork:work.length};}
if(require.main===module){const workspace=buildShowcase(process.argv[2]);fs.writeFileSync(path.join(__dirname,'../examples/operations-showcase-workspace.json'),JSON.stringify(workspace,null,2)+'\n');console.log(JSON.stringify(showcaseStats(workspace)));}
module.exports={buildShowcase,showcaseStats};
