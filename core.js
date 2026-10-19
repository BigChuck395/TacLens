(function(root) {
  'use strict';
  const types = {
    hunt: {name:'Deficiencies', short:'Deficiencies', symbol:'Df', color:'#d87836', statuses:{finding:'Deficiency', resolved:'Resolved'}},
    detection: {name:'Detection coverage', short:'Detection', symbol:'D', color:'#4483c1', statuses:{present:'Detection present'}},
    intel: {name:'Threat intelligence', short:'Intel', symbol:'I', color:'#9270b7', statuses:{intelligence:'Intelligence'}}
  };
  const escape = s => String(s ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const defenseChoices=[['unknown','Not reviewed'],['control','Compensating control present'],['detection','Detection present'],['both','Compensating control and detection present'],['none','Nothing present']];
  function defenseChoicesForType(type){return type==='hunt'?[defenseChoices[4],...defenseChoices.slice(1,4)]:defenseChoices;}
  function defenseValue(value,detected=false){
    if(['control','detection','both','none','unknown'].includes(value))return value;
    if(['yes','architecture'].includes(value))return detected?'both':'control';
    if(value==='no')return detected?'detection':'none';
    return 'unknown';
  }
  function defenseForType(type,value,detected=false){const defense=defenseValue(value,detected);return type==='hunt'&&defense==='unknown'?'none':defense;}
  function deficiencyStatus(type,defense,status){return type==='hunt'?(['control','detection','both'].includes(defenseValue(defense))?'resolved':'finding'):status;}
  function assertDeficiencyResolution(type,status,defense){
    if(type==='hunt'&&status==='resolved'&&!['control','detection','both'].includes(defenseValue(defense)))throw Error('A resolved deficiency needs a recorded detection, compensating control, or both. Nothing present must remain open.');
  }
  function records(layers,id) {const detected=layers.some(d=>d.visible&&d.type==='detection'&&d.entries.some(m=>m.techniqueID===id&&['present','validated','unvalidated'].includes(m.status)));return layers.filter(l=>l.visible).flatMap(l=>l.entries.filter(e=>e.techniqueID===id).map(e=>({...e,status:deficiencyStatus(l.type,defenseForType(l.type,e.compensatingControl,detected),e.status),...(['hunt','intel'].includes(l.type)?{compensatingControl:defenseForType(l.type,e.compensatingControl,detected)}:{}),layer:l.name,layerId:l.id,type:l.type,...(l.type==='intel'?{review:intelReview(l.metadata)}:{})})));}
  function intelReview(metadata,today=new Date().toISOString().slice(0,10)) {
    const m=metadata||{},days=Number(m.reviewDays);
    if(!Number.isInteger(days)||days<1||days>36500)return {due:false,scheduled:false,label:'Indefinite'};
    const date=m.reviewedOn||m.mappingCompleted||'',base=new Date(date+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(base.getTime())||base.toISOString().slice(0,10)!==date)return {due:true,scheduled:true,days,label:'Review date needed'};
    base.setUTCDate(base.getUTCDate()+days);const nextDue=base.toISOString().slice(0,10),due=today>=nextDue;
    return {due,scheduled:true,days,date,nextDue,label:(due?'Review due · ':'Next review · ')+nextDue};
  }
  function detectionNames(value) {
    const values=typeof value==='string'?value.split(/\r?\n/):value===undefined?[]:value;
    if(!Array.isArray(values)||values.some(v=>typeof v!=='string'))throw new Error('Detection names must be text, one per line.');
    const result=[],seen=new Set();for(const item of values){const name=item.trim();if(!name)continue;if(name.length>160)throw new Error('Detection names support up to 160 characters.');if(!seen.has(name.toLowerCase())){seen.add(name.toLowerCase());result.push(name);}}
    if(result.length>100)throw new Error('A technique supports up to 100 named detections per tool layer.');return result;
  }
  function detectionCoverage(entries) {
    const detections=entries.filter(e=>e.type==='detection'&&['present','validated','unvalidated'].includes(e.status));
    const tools=new Map();detections.forEach((e,i)=>{const id=e.layerId||'mapping-'+i;if(!tools.has(id))tools.set(id,e);});
    const namedRuleCount=[...tools.values()].reduce((n,e)=>n+new Set((e.detections||[]).map(name=>name.trim().toLowerCase()).filter(Boolean)).size,0);
    return {count:tools.size,toolCount:tools.size,namedRuleCount};
  }
  function summary(layers,id) {
    const entries = records(layers,id);
    const has = (type,statuses) => entries.some(e => e.type === type && statuses.includes(e.status));
    const relevant = has('intel',['intelligence','relevant','observed','historical']);
    const detected = has('detection',['present','validated','unvalidated'])||entries.some(e=>['hunt','intel'].includes(e.type)&&['detection','both'].includes(e.compensatingControl));
    const tags=entries.filter(e=>['hunt','intel'].includes(e.type)).map(e=>e.compensatingControl);
    const controlled = tags.some(v=>['control','both'].includes(v)),intelAssessments=intelDetectionAssessments(entries);
    return {entries, mapped:entries.length > 0, relevant, detected, controlled,detectionCount:detectionCoverage(entries).count,
      huntGap:has('hunt',['finding','gap']),exposed:intelAssessments.some(x=>x.exposed),intelPending:intelAssessments.some(x=>x.state==='pending'),intelAssessments,
      detectionGap:false,controlGap:false,conflict:false};
  }
  function detectionReviewFingerprint(entries){
    return JSON.stringify(entries.filter(e=>e.type==='detection'&&['present','validated','unvalidated'].includes(e.status)||e.type==='hunt'&&['detection','both'].includes(e.compensatingControl)).map(e=>[e.layerId,e.type,e.date||'',(e.detections||[]).slice().sort()]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
  }
  function intelDetectionAssessments(entries){
    const detected=entries.some(e=>e.type==='detection'&&['present','validated','unvalidated'].includes(e.status)||['detection','both'].includes(e.compensatingControl)),controlled=entries.some(e=>['control','both'].includes(e.compensatingControl)),fingerprint=detectionReviewFingerprint(entries);
    return entries.filter(e=>e.type==='intel').map(e=>{
      const review=e.intelDetectionReview,valid=review&&review.fingerprint===fingerprint,defense=defenseValue(e.compensatingControl);
      const state=review?(valid?review.decision:detected?'pending':'unreviewed'):['detection','both'].includes(defense)?'covered':['none','control'].includes(defense)?'uncovered':detected?'pending':'unreviewed';
      return {layerId:e.layerId,layer:e.layer,entry:e,state,reviewedOn:valid&&review.decision!=='pending'?review.date:'',covered:controlled||state==='covered',exposed:!controlled&&!['covered','pending'].includes(state)};
    });
  }
  function reviewIntelDetection(layers,id,layerId,decision,date,data){
    if(!data.techniques.some(t=>t.id===id))throw Error('Unknown technique.');
    if(!['covered','uncovered','pending'].includes(decision))throw Error('Choose a detection coverage assessment.');
    const parsed=new Date(date+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==date)throw Error('Choose a valid review date.');
    const result=structuredClone(layers),layer=result.find(l=>l.id===layerId&&l.visible&&l.type==='intel'),entry=layer?.entries.find(e=>e.techniqueID===id);
    if(!entry)throw Error('The selected intelligence mapping is no longer available.');
    if(!summary(result,id).detected)throw Error('No detection is recorded for this technique in the selected layers.');
    if(decision==='covered')entry.compensatingControl=['control','both'].includes(defenseValue(entry.compensatingControl))?'both':'detection';
    else if(decision==='uncovered'&&['detection','both'].includes(defenseValue(entry.compensatingControl)))entry.compensatingControl=entry.compensatingControl==='both'?'control':'none';
    entry.intelDetectionReview={decision,date,fingerprint:detectionReviewFingerprint(records(result,id))};
    return result;
  }
  function validateLayers(input,data) {
    if (!Array.isArray(input) || input.length > 100) throw new Error('Expected up to 100 layers.');
    const ids = new Set(data.techniques.map(t => t.id));
    const detectedIDs=new Set(input.filter(l=>l?.type==='detection').flatMap(l=>Array.isArray(l.entries)?l.entries.filter(e=>['present','validated','unvalidated'].includes(e?.status)).map(e=>e.techniqueID):[]));
    let unknown = 0,removedDetectionGaps=0,migratedControlLayers=0,migratedValidatedDeficiencies=0;
    const layers = input.map(l => {
      if (!l || !(types[l.type]||l.type==='control') || typeof l.name !== 'string' || !l.name.trim() || !Array.isArray(l.entries) || l.entries.length > 50000) throw new Error('Every layer needs a name, a supported type, and an entries array.');
      const legacyControl=l.type==='control',type=legacyControl?'hunt':l.type;
      if(legacyControl)migratedControlLayers++;
      const seen = new Set();
      const entries = l.entries.flatMap(e => {
        if(l.type==='detection'&&e?.status==='gap'){removedDetectionGaps++;return [];}
        const validatedDeficiency=l.type==='hunt'&&e?.status==='validated';
        let status=type==='intel'&&['relevant','observed','historical'].includes(e?.status)?'intelligence':legacyControl?e?.status==='implemented'?'resolved':['planned','gap'].includes(e?.status)?'finding':null:l.type==='hunt'&&['gap','validated'].includes(e?.status)?'finding':l.type==='detection'&&['validated','unvalidated','present'].includes(e?.status)?'present':e?.status;
        if (!e || typeof e.techniqueID !== 'string' || !types[type].statuses[status]) throw new Error(`Invalid technique or status in ${l.name}.`);
        if (!ids.has(e.techniqueID)) {unknown++; return [];}
        if (seen.has(e.techniqueID)) throw new Error(`Duplicate ${e.techniqueID} in ${l.name}.`);
        seen.add(e.techniqueID);
        if(validatedDeficiency)migratedValidatedDeficiencies++;
        const defense=defenseForType(type,legacyControl?(e.status==='implemented'?'yes':'no'):e.compensatingControl,detectedIDs.has(e.techniqueID));
        const reopened=type==='hunt'&&status==='resolved'&&!['control','detection','both'].includes(defense),autoResolved=type==='hunt'&&status==='finding'&&['control','detection','both'].includes(defense);status=deficiencyStatus(type,defense,status);
        return [{techniqueID:e.techniqueID,status,notes:autoResolved?('Previous assessment: '+(validatedDeficiency?'Validated':'Deficiency')+'. Resolved automatically because a defense is recorded.\n'+assessmentNotes(e)).trim():reopened?('Previous assessment: Resolved. Reopened because no reviewed defense is recorded.\n'+assessmentNotes(e)).trim():type==='intel'&&['relevant','observed','historical'].includes(e.status)?('Previous intelligence assessment: '+e.status+'.\n'+assessmentNotes(e)).trim():legacyControl?`Migrated control assessment: ${e.status}.\n${assessmentNotes(e)}`:validatedDeficiency?`Previous assessment: Validated. Resolution has not been confirmed.\n${assessmentNotes(e)}`.trim():assessmentNotes(e),date:String(e.date || '').slice(0,30),...(['hunt','intel'].includes(type)&&(e.work||type==='hunt'&&e.deficiencySnooze)?{work:normalizeWork(workInfo({...e,status},new Date().toISOString().slice(0,10)))}:{}),...(type==='hunt'?deficiencyMetadata({...e,...(e.deficiencySnooze?{deficiencySnooze:normalizeSnooze(e.deficiencySnooze)}:{})},{status,date:e.date},validDay(e.date)?e.date:''):{}),...(type==='intel'?{addedOn:validDay(e.addedOn)?e.addedOn:validDay(e.date)?e.date:validDay(l.metadata?.mappingCompleted)?l.metadata.mappingCompleted:''}:{}),...(type==='intel'&&e.intelDetectionReview?{intelDetectionReview:normalizeIntelDetectionReview(e.intelDetectionReview)}:{}),...(['hunt','intel'].includes(type)?{compensatingControl:defense}:e.detections!==undefined?{detections:detectionNames(e.detections)}:{})}];
      });
      return {id:root.crypto.randomUUID(),name:l.name.trim().slice(0,160),type,visible:l.visible !== false,folder:folderPath(l.folder),metadata:layerMetadata(l.metadata),entries};
    });
    return {layers,unknown,removedDetectionGaps,migratedControlLayers,migratedValidatedDeficiencies};
  }
  function normalizeIntelDetectionReview(review){
    if(!review||!['covered','uncovered','pending'].includes(review.decision)||typeof review.fingerprint!=='string'||review.fingerprint.length>2000000||!/^\d{4}-\d{2}-\d{2}$/.test(review.date||''))throw Error('Invalid intelligence detection review.');
    return {decision:review.decision,date:review.date,fingerprint:review.fingerprint};
  }
  function validDay(value){const d=new Date(value+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(value||'')&&Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
  function deficiencyMetadata(old,entry,date){
    const previous=old||{},opened=validDay(previous.openedOn)?previous.openedOn:validDay(previous.date)?previous.date:validDay(entry.date)?entry.date:date;
    const result={resolvedOn:undefined,openedOn:previous.status==='resolved'&&entry.status!=='resolved'?date:opened};
    if(entry.status==='resolved')result.resolvedOn=validDay(previous.resolvedOn)?previous.resolvedOn:validDay(entry.date)?entry.date:date;
    if(previous.deficiencySnooze)result.deficiencySnooze={...previous.deficiencySnooze,...(entry.status==='resolved'&&!previous.deficiencySnooze.cancelledOn?{cancelledOn:date}:{})};
    return result;
  }
  function normalizeSnooze(value){
    if(!value||!validDay(value.until)||!validDay(value.setOn)||typeof value.note!=='string'||!value.note.trim()||value.note.length>2000||value.cancelledOn&&!validDay(value.cancelledOn))throw Error('Invalid deficiency snooze.');
    return {until:value.until,setOn:value.setOn,note:value.note.trim(),...(value.cancelledOn?{cancelledOn:value.cancelledOn}:{})};
  }
  function normalizeWork(value){
    if(!value||!['in_progress','closed','queued'].includes(value.status)||!validDay(value.createdOn)||!validDay(value.updatedOn)||value.status==='closed'&&!validDay(value.closedOn)||typeof value.assignee!=='string'||value.assignee.length>120||!Array.isArray(value.notes)||value.notes.length>500)throw Error('Invalid work item.');
    const notes=value.notes.map(n=>{if(!n||!validDay(n.date)||typeof n.text!=='string'||!n.text.trim()||n.text.length>4000)throw Error('Invalid work note.');return {date:n.date,text:n.text.trim(),kind:['note','started','assigned','closed','queued','migration'].includes(n.kind)?n.kind:'note'};});
    return {status:value.status,assignee:value.assignee.trim(),createdOn:value.createdOn,updatedOn:value.updatedOn,...(value.status==='closed'?{closedOn:value.closedOn}:{}),notes};
  }
  function workInfo(entry,date){
    if(entry.work)return entry.work;
    const old=entry.deficiencySnooze;if(!old)return null;
    const closed=entry.status==='resolved',active=!closed&&!old.cancelledOn&&old.until>date,day=closed&&validDay(entry.resolvedOn)?entry.resolvedOn:old.cancelledOn||old.setOn;
    return {status:closed?'closed':active?'in_progress':'queued',assignee:'',createdOn:old.setOn,updatedOn:day,...(closed?{closedOn:day}:{}),notes:[{date:old.setOn,text:'Previous waiting note (formerly snoozed until '+old.until+'): '+old.note,kind:'migration'}]};
  }
  function normalizeUsers(values){return [...new Set((Array.isArray(values)?values:[]).filter(v=>typeof v==='string').map(v=>v.trim()).filter(v=>v&&v.length<=80&&!v.endsWith(' (User Deleted)')&&!['__create','__unassigned'].includes(v)))].filter((v,i,a)=>a.findIndex(x=>x.toLowerCase()===v.toLowerCase())===i).sort((a,b)=>a.localeCompare(b));}
  function createUser(workspace,name){
    const value=String(name||'').trim(),users=normalizeUsers(workspace.users);
    if(!value||value.length>80||['__create','__unassigned'].includes(value)||value.endsWith(' (User Deleted)')||users.some(u=>u.toLowerCase()===value.toLowerCase()))throw Error('Enter a unique user name of up to 80 characters.');
    return {...structuredClone(workspace),users:normalizeUsers([...users,value])};
  }
  function deleteUser(workspace,name){
    if(!normalizeUsers(workspace.users).includes(name))throw Error('This user is no longer available.');
    const result=structuredClone(workspace);result.users=normalizeUsers(result.users).filter(u=>u!==name);
    result.layers.forEach(l=>l.entries.forEach(e=>{if(e.work?.assignee===name)e.work.assignee=name+' (User Deleted)';}));return result;
  }
  function workCoverage(layers,layerId,id,date){
    const layer=layers.find(l=>l.id===layerId),entry=layer?.entries.find(e=>e.techniqueID===id);if(!entry||!['hunt','intel'].includes(layer.type))return {ready:false,label:'Source mapping unavailable'};
    if(layer.type==='hunt'){const ready=deficiencyStatus('hunt',entry.compensatingControl,entry.status)==='resolved';return {ready,label:ready?'Deficiency resolved':'Deficiency still open'};}
    const s=summary(layers.map(l=>l.id===layerId?{...l,visible:true}:l),id),assessment=s.intelAssessments.find(x=>x.layerId===layerId),due=intelReview(layer.metadata,date).due;
    const ready=!!assessment?.covered&&assessment.state!=='pending'&&!due;
    return {ready,label:due?'Intelligence review due':assessment?.state==='pending'?'Intel detection coverage awaits review':assessment?.covered?'Intelligence coverage confirmed':'Intelligence needs confirmed coverage'};
  }
  function workItems(workspace,data,date){
    const catalog=new Map(data.techniques.map(t=>[t.id,t]));
    return workspace.layers.filter(l=>['hunt','intel'].includes(l.type)).flatMap(layer=>layer.entries.map(entry=>({layer,entry,work:workInfo(entry,date)})).filter(x=>x.work).map(x=>({...x,technique:catalog.get(x.entry.techniqueID)||{id:x.entry.techniqueID,name:x.entry.techniqueID},coverage:workCoverage(workspace.layers,layer.id,x.entry.techniqueID,date)}))).sort((a,b)=>b.work.updatedOn.localeCompare(a.work.updatedOn)||a.technique.id.localeCompare(b.technique.id)||a.layer.name.localeCompare(b.layer.name));
  }
  function updateWork(workspace,id,layerId,patch,date,data){
    if(!data.techniques.some(t=>t.id===id)||!validDay(date))throw Error('Choose a valid technique and date.');
    if(!['start','assign','add_note','close','queue'].includes(patch.action))throw Error('Choose a work action.');
    const result=structuredClone(workspace);result.users=normalizeUsers(result.users);
    const layer=result.layers.find(l=>l.id===layerId&&['hunt','intel'].includes(l.type)),entry=layer?.entries.find(e=>e.techniqueID===id);if(!entry)throw Error('The source mapping is no longer available.');
    const previous=workInfo(entry,date);if(!previous&&patch.action!=='start')throw Error('Start tracking this mapping first.');
    const work=previous?normalizeWork(previous):{status:'in_progress',assignee:'',createdOn:date,updatedOn:date,notes:[]};
    const append=(text,kind)=>{if(work.notes.length>=500)throw Error('This work item has reached its 500-note limit.');work.notes.push({date,text,kind});};
    const note=String(patch.note||'').trim();if(note.length>4000)throw Error('Work notes support up to 4,000 characters.');
    if(patch.action==='start'){if(!previous||previous.status!=='in_progress')append(previous?.status==='closed'?'Reopened work.':'Started work.','started');work.status='in_progress';delete work.closedOn;}
    if(patch.assignee!==undefined){const name=String(patch.assignee||'').trim();if(name&&!result.users.includes(name)&&name!==work.assignee)throw Error('Choose an existing user or create one.');if(name!==work.assignee){work.assignee=name;append(name?'Assigned to '+name+'.':'Assignment cleared.','assigned');}}
    if(patch.action==='add_note'&&!note)throw Error('Enter a work note.');
    if(note)append(note,'note');
    if(patch.action==='close'){const coverage=workCoverage(result.layers,layerId,id,date);if(!coverage.ready)throw Error(coverage.label+'. Record the defense or complete the intelligence review before closing.');work.status='closed';work.closedOn=date;append('Closed work item.','closed');}
    if(patch.action==='queue'){work.status='queued';delete work.closedOn;append('Returned to the work queue.','queued');}
    work.updatedOn=date;entry.work=work;return result;
  }
  function snoozeDeficiency(layers,id,layerId,patch,date,data){
    if(!data.techniques.some(t=>t.id===id)||!validDay(date))throw Error('Choose a valid technique and date.');
    const result=structuredClone(layers),layer=result.find(l=>l.id===layerId&&l.type==='hunt'&&l.visible),entry=layer?.entries.find(e=>e.techniqueID===id);
    if(!entry||deficiencyStatus('hunt',entry.compensatingControl,entry.status)==='resolved')throw Error('Select an unresolved deficiency.');
    Object.assign(entry,deficiencyMetadata(entry,entry,date));
    if(patch.cancel){if(!entry.deficiencySnooze)throw Error('This deficiency is not snoozed.');entry.deficiencySnooze.cancelledOn=date;}
    else{if(!validDay(patch.until)||patch.until<=date)throw Error('Choose a future date to resume this deficiency.');entry.deficiencySnooze=normalizeSnooze({until:patch.until,setOn:date,note:patch.note});}
    return result;
  }
  function analysisFacts(s,date){
    const open=s.entries.filter(e=>e.type==='hunt'&&['finding','gap'].includes(e.status)),intel=s.entries.filter(e=>e.type==='intel');
    const age=value=>validDay(value)?Math.max(0,Math.floor((Date.parse(date+'T00:00:00Z')-Date.parse(value+'T00:00:00Z'))/86400000)):null;
    const dated=open.map(e=>e.openedOn||e.date).filter(validDay).sort(),added=intel.map(e=>e.addedOn||e.date).filter(validDay).sort();
    const progressOpen=open.filter(e=>workInfo(e,date)?.status==='in_progress').length;
    const activeIntel=intel.filter(e=>{const assessment=s.intelAssessments?.find(x=>x.layerId===e.layerId);return assessment?.exposed||assessment?.state==='pending'||e.review?.due;});
    const progressIntel=activeIntel.filter(e=>workInfo(e,date)?.status==='in_progress').length,inProgress=s.entries.filter(e=>workInfo(e,date)?.status==='in_progress').length;
    const total=open.length+activeIntel.length;
    return {intelCount:new Set(intel.map(e=>e.layerId)).size,newestIntel:added.at(-1)||'',intelAge:age(added.at(-1)),oldestOpen:dated[0]||'',openDays:age(dated[0]),detectionCount:s.detectionCount||0,snoozed:progressOpen,progressOpen,progressIntel,intelActive:activeIntel.length,inProgress,openCount:open.length,deferred:total>0&&progressOpen+progressIntel===total};
  }
  function analysisItems(techniques,layers,options={},date=new Date().toISOString().slice(0,10)){
    const q=String(options.search||'').trim().toLowerCase();
    const items=techniques.map(t=>{const s=summary(layers,t.id);return {t,s,facts:analysisFacts(s,date)};}).filter(({t,s,facts:f})=>s.mapped&&(!q||[t.id,t.name,...s.entries.map(e=>e.layer+' '+e.notes+' '+(e.work?.assignee||'')+' '+(e.work?.notes||[]).map(n=>n.text).join(' ')+' '+(e.deficiencySnooze?.note||''))].some(v=>v.toLowerCase().includes(q)))&&(!options.intelDays||f.intelAge!==null&&f.intelAge<=Number(options.intelDays))&&(!options.intelOverlap||f.intelCount>=Number(options.intelOverlap))&&(!options.openDays||f.openDays!==null&&f.openDays>=Number(options.openDays))&&(options.detections===undefined||options.detections===''||options.detections==='0'&&f.detectionCount===0||options.detections==='1'&&f.detectionCount===1||options.detections==='2+'&&f.detectionCount>=2||options.detections==='5+'&&f.detectionCount>=5)&&((options.progress||options.snoozed)!=='hide'||!f.deferred)&&((options.progress||options.snoozed)!=='only'||f.inProgress>0));
    const order=options.sort||'priority';
    return items.sort((a,b)=>{
      const x=a.facts,y=b.facts;if(x.deferred!==y.deferred)return Number(x.deferred)-Number(y.deferred);
      let compared=order==='intelNewest'?y.newestIntel.localeCompare(x.newestIntel):order==='intelOverlap'?y.intelCount-x.intelCount:order==='oldestDeficiency'?(y.openDays??-1)-(x.openDays??-1):order==='fewestDetections'?x.detectionCount-y.detectionCount:0;
      if(compared)return compared;
      if(order==='priority'){
        const active=i=>i.facts.openCount>i.facts.progressOpen||i.facts.intelActive>i.facts.progressIntel;
        compared=Number(active(b))-Number(active(a));if(compared)return compared;
        if(options.lowerDetections!==false&&x.detectionCount!==y.detectionCount)return x.detectionCount-y.detectionCount;
        compared=y.intelCount-x.intelCount||y.newestIntel.localeCompare(x.newestIntel)||(y.openDays??-1)-(x.openDays??-1);if(compared)return compared;
      }
      return a.t.id.localeCompare(b.t.id);
    });
  }
  function recordDefense(layers,id,patch,date,data){
    if(!data.techniques.some(t=>t.id===id)||!validDay(date))throw Error('Choose a valid technique and review date.');
    if(!['unknown','control','detection','both','none'].includes(patch.defense))throw Error('Choose the recorded defense.');
    const result=structuredClone(layers);let layer;
    if(patch.layerId==='__new'){if(result.length>=100)throw Error('A workspace supports up to 100 layers.');layer={id:root.crypto.randomUUID(),name:'Coverage assessments',type:'hunt',visible:true,folder:'',metadata:layerMetadata({}),entries:[]};result.push(layer);}
    else layer=result.find(l=>l.id===patch.layerId&&l.visible&&['hunt','intel'].includes(l.type));
    if(!layer)throw Error('Choose a selected Deficiencies or Intel layer.');
    const defense=defenseForType(layer.type,patch.defense),old=layer.entries.find(e=>e.techniqueID===id),entry={...(old||{}),techniqueID:id,status:deficiencyStatus(layer.type,defense,layer.type==='hunt'?'finding':'intelligence'),compensatingControl:defense,date,notes:[old?.notes||'',String(patch.notes||'').trim()].filter(Boolean).join('\n')};
    if(entry.notes.length>20000)throw Error('Combined notes exceed 20,000 characters.');
    if(layer.type==='hunt')Object.assign(entry,deficiencyMetadata(old,entry,date));
    if(layer.type==='intel')entry.addedOn=old?.addedOn||old?.date||date;
    if(layer.type==='intel'&&old?.compensatingControl!==patch.defense)delete entry.intelDetectionReview;
    if(old)layer.entries[layer.entries.indexOf(old)]=entry;else layer.entries.push(entry);
    if(patch.detection)return quickUpdate(result,id,{detection:patch.detection,name:patch.name,detections:patch.detections,date,changes:[]},data).layers;
    return result;
  }
  function bulkEntries(layer, ids, patch, data, date) {
    const selected = new Set(ids), known = new Set(data.techniques.map(t=>t.id));
    if (!selected.size) throw new Error('Select at least one technique.');
    if (!types[layer.type]?.statuses[patch.status]) throw new Error('Choose a valid status for this layer.');
    for (const id of selected) if (!known.has(id)) throw new Error('Unknown technique: '+id);
    const existing = new Map(layer.entries.map(e=>[e.techniqueID,e]));
    const fields = {notes:20000,date:30};
    const values = Object.fromEntries(Object.entries(fields).map(([k,max])=>[k,String(patch[k]||'').trim().slice(0,max)]));
    const result = layer.entries.map(e=>({...e}));
    const positions = new Map(result.map((e,i)=>[e.techniqueID,i]));
    for (const id of selected) {
      const old = existing.get(id);
      const entry = {techniqueID:id,status:patch.status,...(old?.work?{work:structuredClone(old.work)}:{})};
      if(['hunt','intel'].includes(layer.type))entry.compensatingControl=defenseForType(layer.type,patch.compensatingControl==='keep'||patch.compensatingControl===undefined?old?.compensatingControl:patch.compensatingControl);
      entry.status=deficiencyStatus(layer.type,entry.compensatingControl,entry.status);if(layer.type==='intel'&&old?.intelDetectionReview&&entry.compensatingControl===controlTag(old.compensatingControl))entry.intelDetectionReview=structuredClone(old.intelDetectionReview);
      if(layer.type==='detection'&&(patch.detections!==undefined||old?.detections!==undefined))entry.detections=patch.detections!==undefined?detectionNames(patch.detections):[...old.detections];
      for (const k of Object.keys(fields)) entry[k] = values[k] || old?.[k] || (k==='date'?date:'');
      if(layer.type==='hunt')Object.assign(entry,deficiencyMetadata(old,entry,values.date||date));if(layer.type==='intel')entry.addedOn=old?.addedOn||old?.date||date;
      if (positions.has(id)) result[positions.get(id)] = entry;
      else result.push(entry);
    }
    return result;
  }
  function folderPath(value) {return String(value||'').split('/').map(s=>s.trim().slice(0,80)).filter(Boolean).slice(0,10).join('/');}
  function layerMetadata(value) {
    const m=value&&typeof value==='object'?value:{};
    return {reviewDays:Number.isInteger(Number(m.reviewDays))&&Number(m.reviewDays)>=1&&Number(m.reviewDays)<=36500?Number(m.reviewDays):null,reviewedOn:String(m.reviewedOn||'').slice(0,30),mappingCompleted:String(m.mappingCompleted||'').slice(0,30),tags:(Array.isArray(m.tags)?m.tags:[]).map(t=>String(t).trim().slice(0,100)).filter(Boolean).slice(0,30),description:String(m.description||'').slice(0,2000)};
  }
  function matchesLayer(layer, query, type='all',tag='all') {
    const metadata=layerMetadata(layer.metadata);
    const haystack=[layer.name,types[layer.type].name,layer.folder||'',metadata.mappingCompleted,...metadata.tags,metadata.description].join(' ').toLowerCase();
    const tagged=tag==='all'||tag==='__untagged'&&!metadata.tags.length||tag==='__deleted'&&metadata.tags.some(t=>t.endsWith(' (Tag Deleted)'))||metadata.tags.includes(tag.startsWith('tag:')?tag.slice(4):tag);
    return tagged&&(type==='all'||layer.type===type)&&query.trim().toLowerCase().split(/\s+/).filter(Boolean).every(word=>haystack.includes(word));
  }
  function moveLayer(layers,id,folder,anchorId,after=false) {
    const source=layers.find(l=>l.id===id);if(!source)throw new Error('Layer no longer exists.');
    if(anchorId===id)return layers;
    const result=layers.filter(l=>l.id!==id),moved={...source,folder:folderPath(folder)};
    const at=anchorId?result.findIndex(l=>l.id===anchorId):-1;
    if(anchorId&&at<0)throw new Error('Target layer no longer exists.');
    if(at<0)result.push(moved);else result.splice(at+(after?1:0),0,moved);
    return result;
  }
  function moveFolder(paths,layers,source,parent='',anchor='',after=false) {
    if(!paths.includes(source))throw new Error('Folder no longer exists.');
    if(parent===source||parent.startsWith(source+'/'))throw new Error('A folder cannot move into itself or its subfolders.');
    const next=[parent,source.split('/').at(-1)].filter(Boolean).join('/');
    if(next.split('/').length>10)throw new Error('Folders support up to 10 levels.');
    if(next!==source&&paths.includes(next))throw new Error('A folder with that name already exists there.');
    const subtree=paths.filter(p=>p===source||p.startsWith(source+'/'));
    if(subtree.some(p=>next.split('/').length+p.slice(source.length).split('/').filter(Boolean).length>10))throw new Error('Folders support up to 10 levels.');
    const replace=p=>p===source||p.startsWith(source+'/')?next+p.slice(source.length):p;
    const remaining=paths.filter(p=>!subtree.includes(p));
    if(anchor){const at=remaining.indexOf(anchor);if(at<0)throw new Error('Invalid folder destination.');const anchorTree=remaining.filter(p=>p===anchor||p.startsWith(anchor+'/'));const insert=after?Math.max(...anchorTree.map(p=>remaining.indexOf(p)))+1:at;remaining.splice(insert,0,...subtree.map(replace));}
    else remaining.push(...subtree.map(replace));
    return {folders:remaining,layers:layers.map(l=>l.folder?{...l,folder:replace(l.folder)}:l),source,next};
  }
  function categoryStatus(type,entries) {
    const statuses=[...new Set(entries.filter(e=>e.type===type).map(e=>type==='intel'?'intelligence':type==='hunt'&&e.status==='validated'?'finding':e.status))];
    if(type==='detection')return statuses.some(s=>['present','validated','unvalidated'].includes(s))?{label:'Detection present',tone:'ready'}:{label:'No detection mapped',tone:'unknown'};
    const labels={finding:'Deficiency',validated:'Validated',resolved:'Resolved',implemented:'Implemented',planned:'Planned',gap:'Deficiency',intelligence:'Intelligence',relevant:'Intelligence',observed:'Intelligence',historical:'Intelligence'};
    if(!statuses.length)return {label:'No mapping',tone:'unknown'};
    const tone=statuses.some(s=>s==='gap'||s==='finding')?'issue':statuses.some(s=>s==='resolved'||s==='validated'||s==='implemented')?'ready':statuses.some(s=>s==='planned'||s==='unvalidated')?'pending':'context';
    return {label:statuses.map(s=>labels[s]||s).join(' + '),tone};
  }
  function assessmentNotes(e){const notes=String(e.notes||''),ref=String(e.source||'').trim();return (ref&&!notes.includes(ref)?notes+'\nReference: '+ref:notes).trim().slice(0,20000);}
  function controlTag(value){return defenseValue(value);}
  function activeTags(tags,layers){return [...new Set([...(Array.isArray(tags)?tags:[]),...layers.flatMap(l=>layerMetadata(l.metadata).tags)].filter(t=>typeof t==='string'&&t.trim()&&!t.endsWith(' (Tag Deleted)')).map(t=>t.trim().slice(0,60)))].sort((a,b)=>a.localeCompare(b));}
  function deleteTag(tags,layers,name){return {tags:tags.filter(t=>t!==name),layers:layers.map(l=>({...l,metadata:{...layerMetadata(l.metadata),tags:layerMetadata(l.metadata).tags.map(t=>t===name?t+' (Tag Deleted)':t)}}))};}
  function controlStatus(entries){
    const values=entries.filter(e=>['hunt','intel'].includes(e.type)).map(e=>defenseForType(e.type,e.compensatingControl)),detected=entries.some(e=>e.type==='detection'&&['present','validated','unvalidated'].includes(e.status))||values.some(v=>['detection','both'].includes(v)),controlled=values.some(v=>['control','both'].includes(v));
    if(controlled&&detected)return {label:'Compensating control and detection present',tone:'ready'};
    if(controlled)return {label:'Compensating control present',tone:'ready'};
    if(detected)return {label:'Detection present',tone:'ready'};
    return values.includes('none')?{label:'Nothing present',tone:'absent'}:{label:'Not reviewed',tone:'unreviewed'};
  }
  function cleanupLibrary(folders,layers,{folderPaths=[],layerIds=[],deleteContained=false}={}){
    const selected=new Set(folderPaths),ids=new Set(layerIds),inside=path=>path&&[...selected].some(p=>path===p||path.startsWith(p+'/'));
    const removed=layers.filter(l=>ids.has(l.id)||(deleteContained&&inside(l.folder)));
    return {folders:folders.filter(p=>!inside(p)),layers:layers.filter(l=>!removed.includes(l)).map(l=>inside(l.folder)?{...l,folder:''}:l),deletedLayers:removed.length,deletedMappings:removed.reduce((n,l)=>n+l.entries.length,0),deletedFolders:folders.filter(inside).length};
  }
  function quickUpdate(layers,id,patch,data) {
    if(!data.techniques.some(t=>t.id===id))throw new Error('Unknown technique.');
    const reviewDate=new Date(patch.date+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(patch.date||'')||!Number.isFinite(reviewDate.getTime())||reviewDate.toISOString().slice(0,10)!==patch.date)throw new Error('Choose a valid review date.');
    const result=structuredClone(layers),changed=new Set(),note=String(patch.notes||'').trim();
    function annotate(entry){const notes=[entry.notes||'',note].filter(Boolean).join('\n');if(notes.length>20000)throw new Error('Combined notes exceed 20,000 characters.');entry.notes=notes;entry.date=patch.date;}
    for(const change of patch.changes||[]){const l=result.find(l=>l.id===change.layerId&&l.visible),entry=l?.entries.find(e=>e.techniqueID===id);if(!entry)throw new Error('Selected mapping is no longer available.');
      if(change.status!==undefined&&!types[l.type].statuses[change.status])throw new Error('Invalid assessment.');
      if(change.compensatingControl!==undefined&&(l.type==='detection'||!['control','detection','both','none','unknown','yes','architecture','no'].includes(change.compensatingControl)))throw new Error('Invalid compensating control.');
      if(change.reviewed||change.status!==undefined&&change.status!==entry.status||change.compensatingControl!==undefined&&change.compensatingControl!==controlTag(entry.compensatingControl)){
        const previous={...entry};if(l.type==='intel'&&change.compensatingControl!==undefined&&change.compensatingControl!==controlTag(entry.compensatingControl))delete entry.intelDetectionReview;if(change.status!==undefined)entry.status=change.status;if(['hunt','intel'].includes(l.type))entry.compensatingControl=defenseForType(l.type,change.compensatingControl===undefined?entry.compensatingControl:change.compensatingControl);entry.status=deficiencyStatus(l.type,entry.compensatingControl,entry.status);annotate(entry);if(l.type==='hunt')Object.assign(entry,deficiencyMetadata(previous,entry,patch.date));changed.add(l.id);
      }
    }
    if(patch.detection){let l;if(patch.detection==='__new'){const name=String(patch.name||'').trim();if(!name)throw new Error('Name the new detection layer.');if(result.length>=100)throw new Error('A workspace supports up to 100 layers.');l={id:root.crypto.randomUUID(),name:name.slice(0,160),type:'detection',visible:true,folder:'',metadata:layerMetadata({}),entries:[]};result.push(l);}else l=result.find(l=>l.id===patch.detection&&l.visible&&l.type==='detection');if(!l)throw new Error('Select a visible detection layer.');let entry=l.entries.find(e=>e.techniqueID===id);if(!entry){entry={techniqueID:id,status:'present',notes:''};l.entries.push(entry);}const added=detectionNames(patch.detections);if(added.length)entry.detections=detectionNames([...(entry.detections||[]),...added]);annotate(entry);changed.add(l.id);}
    if(!changed.size)throw new Error('Change an assessment, record a detection, or check a mapping to update its note / review date.');
    return {layers:result,changedCount:changed.size};
  }
  function navigatorSource(input,data) {
    if(input?.domain!=='enterprise-attack'||!Array.isArray(input.techniques))throw Error('Choose an Enterprise ATT&CK Navigator layer.');
    if(input.techniques.length>50000)throw Error('Navigator imports support up to 50,000 source rows.');
    const catalog=new Map(data.techniques.map(t=>[t.id,t])),grouped=new Map(),unknown=new Set();let disabled=0,duplicates=0;
    for(const row of input.techniques){
      if(row?.enabled===false){disabled++;continue;}
      if(!row||typeof row.techniqueID!=='string')throw Error('A Navigator row is missing its technique ID.');
      const t=catalog.get(row.techniqueID);if(!t){unknown.add(row.techniqueID);continue;}
      let item=grouped.get(t.id);if(item)duplicates++;else{item={id:t.id,name:t.name,comments:[],scores:[],colors:[],tactics:[]};grouped.set(t.id,item);}
      const add=(list,value)=>{if(value!==''&&!list.includes(value))list.push(value);};
      if(typeof row.comment==='string')add(item.comments,row.comment.trim());
      if(typeof row.score==='number'&&Number.isFinite(row.score))add(item.scores,String(row.score));
      if(typeof row.color==='string')add(item.colors,row.color.trim().toLowerCase());
      if(typeof row.tactic==='string')add(item.tactics,row.tactic);
    }
    const rows=[...grouped.values()].sort((a,b)=>a.id.localeCompare(b.id));
    return {name:String(input.name||'Imported Navigator layer').slice(0,160),description:typeof input.description==='string'?input.description.slice(0,2000):'',version:input.versions?.attack,rows,disabled,duplicates,unknown:[...unknown]};
  }
  function convertNavigator(source,targets,data) {
    if(!Array.isArray(targets)||!targets.length||targets.length>100)throw Error('Create between 1 and 100 output layers.');
    const known=new Map(source.rows.map(r=>[r.id,r])),names=new Set(),assigned=new Set();
    const date=value=>{const text=String(value||'');if(!text)return '';const d=new Date(text+'T00:00:00Z');if(!/^\d{4}-\d{2}-\d{2}$/.test(text)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==text)throw Error('Choose a valid review date.');return text;};
    const layers=targets.map(target=>{
      const name=String(target.name||'').trim();if(!name||name.length>160)throw Error('Give each output layer a name (up to 160 characters).');
      if(names.has(name.toLowerCase()))throw Error('Give each output layer a different name.');names.add(name.toLowerCase());
      if(!types[target.type])throw Error('Choose a supported output layer type.');
      const ids=[...new Set(target.ids||[])];if(!ids.length)throw Error('Select techniques for “'+name+'”, or remove that output layer.');
      const reviewed=date(target.date),reviewDays=target.reviewDays??null;
      if(target.type==='intel'&&reviewDays!==null&&(!Number.isInteger(reviewDays)||reviewDays<1||reviewDays>36500||!reviewed))throw Error('Scheduled intelligence reviews need a date and an interval from 1 to 36500 days.');
      const entries=ids.map(id=>{
        const row=known.get(id);if(!row)throw Error('Select techniques from this Navigator layer.');assigned.add(id);
        const override=target.overrides?.[id]||{},status=target.type==='detection'?'present':target.type==='intel'?'intelligence':override.status||target.status||'finding';
        if(!types[target.type].statuses[status])throw Error('Choose a valid assessment for “'+name+'”.');
        const control=override.compensatingControl||target.compensatingControl||'unknown';

        if(target.type!=='detection'&&!['unknown','control','detection','both','none','yes','no','architecture'].includes(control))throw Error('Choose a valid compensating-control assessment.');
        const notes=typeof override.notes==='string'&&override.notes.trim()?override.notes.trim():[...(target.keepComments===false?[]:row.comments),String(target.notes||'').trim()].filter(Boolean).join('\n');
        if(notes.length>20000)throw Error('Combined notes exceed 20,000 characters for '+id+'.');
        return {techniqueID:id,status,notes,date:override.date?date(override.date):reviewed,...(target.type!=='detection'?{compensatingControl:defenseForType(target.type,control)}:{})};
      });
      return {name,type:target.type,visible:true,folder:folderPath(target.folder),metadata:layerMetadata({description:target.description||'',...(target.type==='intel'?{mappingCompleted:reviewed,reviewedOn:reviewed,reviewDays}:{})}),entries};
    });
    return {...validateLayers(layers,data),conversion:{assigned:assigned.size,unassigned:source.rows.filter(r=>!assigned.has(r.id)).map(r=>r.id),disabled:source.disabled,duplicates:source.duplicates,unknown:source.unknown}};
  }
  function tacticStatistics(data,layers) {
    const mapped=data.techniques.map(t=>({t,s:summary(layers,t.id)})).filter(x=>x.s.mapped);
    return data.tactics.map(tactic=>{
      const items=mapped.filter(x=>x.t.tactics.includes(tactic.key)),count=fn=>items.filter(({s})=>fn(s)).length;
      return {...tactic,mapped:items.length,open:count(s=>s.huntGap),resolved:count(s=>s.entries.some(x=>x.type==='hunt'&&x.status==='resolved')),detections:count(s=>s.detected),controls:count(s=>s.controlled),intelCovered:count(s=>s.relevant&&!s.exposed&&!s.intelPending),intelPending:count(s=>s.intelPending),intelUncovered:count(s=>s.exposed)};
    });
  }
  function evidenceStatistics(layers){
    const selected=layers.filter(l=>l.visible);
    return Object.keys(types).map(type=>{
      const sources=selected.filter(l=>l.type===type),entries=sources.flatMap(l=>l.entries.map(e=>({...e,compensatingControl:defenseForType(type,e.compensatingControl,selected.some(d=>d.type==='detection'&&d.entries.some(m=>m.techniqueID===e.techniqueID))),status:deficiencyStatus(type,defenseForType(type,e.compensatingControl,selected.some(d=>d.type==='detection'&&d.entries.some(m=>m.techniqueID===e.techniqueID))),e.status)})));
      const controls={control:0,detection:0,both:0,none:0,unknown:0};
      entries.forEach(e=>controls[type==='detection'?'detection':e.compensatingControl]++);
      const defenseAssessments=Object.fromEntries(defenseChoicesForType(type).map(([value])=>[value,{open:0,resolved:0}]));
      if(type==='hunt')entries.forEach(e=>{defenseAssessments[e.compensatingControl][e.status==='resolved'?'resolved':'open']++;});
      const open=entries.filter(e=>['finding','gap'].includes(e.status)).length;
      const resolved=entries.filter(e=>e.status==='resolved').length;
      const assessments=type==='intel'?sources.flatMap(l=>l.entries.map(e=>summary(selected,e.techniqueID).intelAssessments.find(x=>x.layerId===l.id))):[],defended=assessments.filter(x=>x?.covered&&x.state!=='pending').length,pending=assessments.filter(x=>x?.state==='pending').length;
      return {type,layers:sources.length,mappings:entries.length,open,resolved,defended,pending,exposed:type==='intel'?entries.length-defended-pending:0,controls,defenseAssessments};
    });
  }
  function recommendationItems(workspace,data){
    return data.techniques.map(t=>{const s=summary(workspace.layers,t.id);if(!s.mapped||s.huntGap||s.exposed||s.intelPending||s.detected===s.controlled)return null;
      const fingerprint=JSON.stringify(s.entries.map(e=>[e.layerId,e.type,e.status,e.compensatingControl||'',e.date||'']).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
      const review=workspace.recommendationReviews?.[t.id],accepted=review?.fingerprint===fingerprint&&review.decision==='accepted';
      return {technique:t,summary:s,fingerprint,accepted,acceptedOn:accepted?review.acceptedOn:''};
    }).filter(Boolean);
  }
  function reviewRecommendation(workspace,id,action,{layerId='',date=''}={},data){
    const item=recommendationItems(workspace,data).find(r=>r.technique.id===id);if(!item)throw Error('This coverage review is no longer available in the selected layers.');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Choose a valid review date.');
    const result=structuredClone(workspace);result.recommendationReviews={...(result.recommendationReviews||{})};
    if(action==='accept')result.recommendationReviews[id]={fingerprint:item.fingerprint,decision:'accepted',acceptedOn:date};
    else if(action==='reopen')delete result.recommendationReviews[id];
    else if(action==='both'){
      let layer=result.layers.find(l=>l.id===layerId&&l.visible&&l.type!=='detection');
      if(layerId==='__new'){if(result.layers.length>=100)throw Error('A workspace supports up to 100 layers.');layer={id:root.crypto.randomUUID(),name:'Coverage assessments',type:'hunt',visible:true,folder:'',metadata:layerMetadata({}),entries:[]};result.layers.push(layer);}
      if(!layer)throw Error('Choose a Deficiencies or Intel layer for the assessment.');
      let entry=layer.entries.find(e=>e.techniqueID===id);if(!entry){entry={techniqueID:id,status:layer.type==='hunt'?'resolved':'intelligence',notes:''};layer.entries.push(entry);}
      entry.compensatingControl='both';entry.status=deficiencyStatus(layer.type,'both',entry.status);entry.date=date;delete result.recommendationReviews[id];
    }else throw Error('Unknown coverage review action.');
    return result;
  }
  const api = {normalizeWork,workInfo,normalizeUsers,createUser,deleteUser,workCoverage,workItems,updateWork,validDay,deficiencyMetadata,normalizeSnooze,snoozeDeficiency,analysisFacts,analysisItems,recordDefense,detectionReviewFingerprint,intelDetectionAssessments,reviewIntelDetection,normalizeIntelDetectionReview,recommendationItems,reviewRecommendation,deficiencyStatus,assertDeficiencyResolution,types,defenseChoices,defenseChoicesForType,defenseValue,defenseForType,escape,records,summary,validateLayers,bulkEntries,folderPath,layerMetadata,matchesLayer,moveLayer,moveFolder,categoryStatus,assessmentNotes,controlTag,controlStatus,activeTags,deleteTag,cleanupLibrary,quickUpdate,detectionCoverage,detectionNames,intelReview,navigatorSource,convertNavigator,tacticStatistics,evidenceStatistics};
  root.Strata = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
