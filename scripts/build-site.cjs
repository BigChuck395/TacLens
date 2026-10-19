// Static output is an explicit allowlist, never a copy of the repository.
const fs=require('node:fs'),path=require('node:path');
const {buildShowcase,showcaseStats}=require('./build-showcase.cjs');
const assets=['index.html','styles.css','core.js','work-ui.js','work-report.js','insights.js','matrix.js','elt-report.js','app.js','data.js','storage.js','favicon.ico','LICENSE-ATTACK.txt'];
const examplePath='examples/operations-showcase-workspace.json';
function buildSite({root=path.resolve(__dirname,'..'),date}={}){
  root=path.resolve(root);
  const output=path.join(root,'_site'),allowed=new Set([...assets,examplePath,'.nojekyll']);
  function check(directory){
    if(fs.lstatSync(directory).isSymbolicLink())throw Error('Static build refuses symbolic links.');
    for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
      const file=path.join(directory,entry.name),relative=path.relative(output,file).split(path.sep).join('/');
      if(entry.isSymbolicLink())throw Error('Static build refuses symbolic links.');
      if(entry.isDirectory()){
        if(relative!=='examples')throw Error('Unexpected folder in _site: '+relative+'. Build in a clean output folder.');
        check(file);
      }else if(!entry.isFile()||!allowed.has(relative))throw Error('Unexpected file in _site: '+relative+'. Build in a clean output folder.');
    }
  }
  if(fs.existsSync(output))check(output);
  for(const asset of assets){const stat=fs.lstatSync(path.join(root,asset));if(!stat.isFile()||stat.isSymbolicLink())throw Error('Expected a regular asset: '+asset);}
  const workspace=buildShowcase(date);
  fs.mkdirSync(path.join(output,'examples'),{recursive:true});
  for(const asset of assets)fs.copyFileSync(path.join(root,asset),path.join(output,asset));
  // Generate from code: a locally edited example or saved workspace is never published.
  fs.writeFileSync(path.join(output,examplePath),JSON.stringify(workspace,null,2)+'\n');
  fs.writeFileSync(path.join(output,'.nojekyll'),'');
  return {files:[...allowed],example:showcaseStats(workspace)};
}
if(require.main===module){const result=buildSite({date:process.argv[2]});console.log('Built _site: '+result.files.length+' allowed files; '+result.example.layers+' generated testing layers.');}
module.exports={assets,examplePath,buildSite};
