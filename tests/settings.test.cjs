const test=require('node:test'),assert=require('node:assert/strict'),S=require('../core.js');
const folders=['Operations','Operations/SOC','Operations/SOC/Sub','Operations2'];
const layers=[{id:'a',folder:'Operations/SOC/Sub',entries:[{notes:'keep evidence'}]},{id:'b',folder:'Operations',entries:[{},{}]},{id:'c',folder:'Operations2',entries:[{}]}];
test('bulk folder cleanup includes descendants, preserves neighboring folders and moves retained evidence to Unfiled',()=>{
 const result=S.cleanupLibrary(folders,layers,{folderPaths:['Operations','Operations/SOC']});
 assert.equal(result.deletedFolders,3);assert.equal(result.deletedLayers,0);assert.deepEqual(result.folders,['Operations2']);assert.equal(result.layers[0].folder,'');assert.deepEqual(result.layers[0].entries,layers[0].entries);assert.equal(result.layers[2].folder,'Operations2');assert.equal(layers[0].folder,'Operations/SOC/Sub');
});
test('bulk destructive cleanup deduplicates layers selected directly and through folders and counts exact mappings',()=>{
 const result=S.cleanupLibrary(folders,layers,{folderPaths:['Operations','Operations/SOC'],layerIds:['a'],deleteContained:true});
 assert.equal(result.deletedLayers,2);assert.equal(result.deletedMappings,3);assert.deepEqual(result.layers,[layers[2]]);
});
