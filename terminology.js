(function installTerminology(root){
  'use strict';
  const defaults={opportunity:{singular:'Finding',plural:'Findings'}};
  let current=structuredClone(defaults);
  function normalize(value,{strict=false}={}){
    const input=value?.opportunity||{},result={};
    for(const key of ['singular','plural']){
      const raw=input[key],label=typeof raw==='string'?raw.trim().normalize('NFC'):'';
      if(raw===undefined){result[key]=defaults.opportunity[key];continue;}
      if(!label||label.length>60||/[\u0000-\u001f\u007f]/.test(label)){
        if(strict)throw Error('Enter a '+key+' label of 1–60 characters on one line.');
        result[key]=defaults.opportunity[key];
      }else result[key]=label;
    }
    return {opportunity:result};
  }
  function configure(value){current=normalize(value);return get();}
  function get(){return structuredClone(current);}
  function text(value,settings=current){
    const labels=normalize(settings).opportunity;
    const lower=label=>label.replace(/\p{L}+/gu,word=>word.length>1&&word===word.toUpperCase()?word:word.toLowerCase());
    return String(value??'').replace(/\b(an|An) (opportunities|opportunity)\b/g,(_,article,word)=>(/^[aeiou]/i.test(/ies$/.test(word)?labels.plural:labels.singular)?article:article==='An'?'A':'a')+' '+word).replace(/\b(opportunities|opportunity)\b/gi,word=>{const label=/ies$/i.test(word)?labels.plural:labels.singular;return word===word.toLowerCase()?lower(label):label;});
  }
  function escape(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
  function html(value){return escape(text(value));}
  function symbol(settings=current){const letters=Array.from(normalize(settings).opportunity.singular).filter(char=>/[\p{L}\p{N}]/u.test(char));const first=(letters[0]||'F').toUpperCase();return ['D','I'].includes(first)&&letters[1]?first+letters[1].toLowerCase():first;}
  const api={normalize,configure,get,text,html,symbol,runtime:installTerminology.toString()};root.TacLensTerms=api;if(typeof module!=='undefined')module.exports=api;
})(globalThis);
