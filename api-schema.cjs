'use strict';
const string=(maxLength=160)=>({type:'string',maxLength}),date={type:'string',format:'date'},identity={type:'string',format:'uuid'};
const object=(properties,required=[])=>({type:'object',additionalProperties:false,properties,required});
const array=(items,maxItems=100)=>({type:'array',items,maxItems});
const defense={type:'string',enum:['none','control','detection','both','unknown']};
const outcome={type:'string',enum:['assess','accepted','dismissed','not_related']};
const metadata=object({description:string(2000),tags:array(string(60),30),mappingCompleted:date,reviewedOn:date,reviewDays:{type:['integer','null'],minimum:1,maximum:36500}});
const mapping={name:string(),notes:string(20000),date,detections:array(string(300),500),compensatingControl:defense,logging:{type:'string',enum:['present','absent','unknown']},outcome,riskAcceptance:object({date,notes:string(4000)},['date']),decisionNotes:string(4000)};
module.exports={
 ReportOptions:object({format:{type:'string',enum:['standard','elt']},title:string(),context:string(20000),includeAnalysis:{type:'boolean'},includeWorkTracker:{type:'boolean'},theme:{type:'string',enum:['dark','light']},scope:{type:'string',enum:['selected','all']},layerIds:array(identity,100)}),
 NewWorkspace:object({id:identity,name:string(),terminology:object({opportunity:object({singular:string(60),plural:string(60)})})},['name']),
 WorkspaceImport:object({workspace:{type:'object',description:'An exported strata-workspace version 1 backup. Gets a new workspace ID; old layer type aliases migrate.'},name:string()},['workspace']),
 WorkspacePatch:object({name:string(),terminology:object({opportunity:object({singular:string(60),plural:string(60)})}),matrixColors:{type:'object',additionalProperties:{type:'string',pattern:'^#[a-fA-F0-9]{6}$'}}}),
 NewLayer:object({id:identity,name:string(),type:{type:'string',enum:['opportunity','detection','intel','hunt','deficiency','deficiencies','opportunities']},visible:{type:'boolean'},folder:string(2000),metadata},['name','type']),
 LayerPatch:object({name:string(),visible:{type:'boolean'},folder:string(2000),metadata,archived:{type:'boolean'}}),
 LayerImport:object({layers:array({type:'object'},100)},['layers']),LayerOrder:object({ids:array(identity,100)},['ids']),
 NewMapping:object({id:identity,techniqueID:{type:'string',example:'T1059.001'},...mapping},['techniqueID']),MappingPatch:object(mapping),
 BulkMappings:object({mappings:array({$ref:'#/components/schemas/NewMapping'},1000)},['mappings']),
 Defense:object({defense,logging:mapping.logging,notes:string(20000),date,outcome,riskAcceptance:mapping.riskAcceptance,decisionNotes:string(4000)},['defense']),
 Decision:object({decision:{type:'string',enum:['accepted','dismissed','not_related','reopen']},date,notes:string(4000)},['decision']),
 IntelReview:object({decision:{type:'string',enum:['covered','uncovered','pending']},date},['decision']),
 WorkAction:object({action:{type:'string',enum:['start','assign','add_note','close','queue']},date,assignee:string(120),note:string(4000)},['action']),
 Recommendation:object({action:{type:'string',enum:['accept','reopen']},date},['action']),NamedItem:object({name:string(80)},['name']),NewFolder:object({path:string(2000)},['path'])
};
