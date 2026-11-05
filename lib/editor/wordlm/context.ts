/** Train-count posterior within an orthographic family. No probability mass is
 * added to the family and words outside it keep their original LM scores. */
export type SourceContextFeature = readonly [number, number, number, readonly number[]];
export type SourceContextProfile = readonly [string, readonly string[], readonly number[], readonly SourceContextFeature[]];
export interface SourceContextArtifact {
  schemaVersion: number;
  settings: { minimumContextCount: number; maximumProfiles: number; maximumForms: number; contextsPerDirectionPerForm: number };
  profiles: readonly SourceContextProfile[];
}
export interface SourceContextAdjustment { word: string; logAdjustment: number; examples: number; bridge: boolean }
const sumExp = (values: readonly number[]) => { const max=Math.max(...values);return max+Math.log(values.reduce((sum,value)=>sum+Math.exp(value-max),0)); };

export class SpellingContextModel {
  private profiles: Map<string, SourceContextProfile>;
  private cache = new Map<string, { forms: Map<string, number>; features: Map<string, readonly number[]> }>();
  constructor(private readonly artifact: SourceContextArtifact, private readonly idOf: (word: string) => number | undefined,
    private readonly fold: (word: string) => string) {
    if (artifact.schemaVersion!==1 || !Number.isInteger(artifact.settings.minimumContextCount) || artifact.settings.minimumContextCount<3
      || artifact.profiles.length>8000 || artifact.settings.maximumForms>8) throw Error('Invalid spelling context model');
    this.profiles=new Map(artifact.profiles.map(row=>[row[0],row]));
    if(this.profiles.size!==artifact.profiles.length)throw Error('Duplicate spelling context family');
    for(const [key,forms,frequencies,features] of artifact.profiles){
      if(!/^[a-z]{2,32}$/u.test(key)||forms.length<1||forms.length>8||forms.length!==frequencies.length||new Set(forms).size!==forms.length
        ||frequencies.some(n=>!Number.isSafeInteger(n)||n<1)||features.length>forms.length*24)throw Error('Invalid spelling context profile');
      for(const [side,a,b,counts] of features)if(![0,1,2].includes(side)||!Number.isSafeInteger(a)||a<0||!Number.isSafeInteger(b)||b< -1
        ||side!==2&&b!==-1||side===2&&b<0||counts.length!==forms.length||counts.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('Invalid spelling context feature');
    }
  }
  adjustments(key: string, left: readonly string[], right: readonly string[], candidates: readonly {word:string;logScore:number}[]): readonly SourceContextAdjustment[] {
    const profile=this.profiles.get(key);if(!profile)return [];
    const family=candidates.filter(row=>this.fold(row.word)===key&&Number.isFinite(row.logScore));if(family.length<2)return [];
    let cached=this.cache.get(key);
    if(!cached){cached={forms:new Map(profile[1].map((word,i)=>[word,i])),features:new Map(profile[3].map(([side,a,b,counts])=>[`${side}:${a}:${b}`,counts]))};
      if(this.cache.size>=512)this.cache.delete(this.cache.keys().next().value!);this.cache.set(key,cached);}
    const bridgeLeft=left.at(-1),bridgeRight=right[0],a=bridgeLeft===undefined?undefined:this.idOf(bridgeLeft),b=bridgeRight===undefined?undefined:this.idOf(bridgeRight);
    const features:{counts:readonly number[];bridge:boolean}[]=[];
    if(a!==undefined&&b!==undefined){const counts=cached.features.get(`2:${a}:${b}`);if(counts)features.push({counts,bridge:true});}
    if(!features.length)for(const [side,words] of [[0,left.slice(-2)],[1,right.slice(0,2)]] as const){
      for(const word of new Set(words)){const id=this.idOf(word);if(id===undefined)continue;const counts=cached.features.get(`${side}:${id}:-1`);if(counts)features.push({counts,bridge:false});}}
    const logMass=sumExp(family.map(row=>row.logScore));const priors=family.map(row=>Math.exp(row.logScore-logMass));
    let selected:{counts:number[];posterior:number[];bridge:boolean;merit:number}|undefined;
    for(const feature of features){
      const counts=family.map(row=>{const index=cached!.forms.get(row.word);return index===undefined?0:feature.counts[index];});
      const total=counts.reduce((sum,n)=>sum+n,0);if(total<this.artifact.settings.minimumContextCount)continue;
      // One prior observation smooths a new context with the existing WordLM.
      const posterior=counts.map((n,i)=>(n+priors[i])/(total+1));
      const divergence=posterior.reduce((sum,p,i)=>sum+(p>0?p*Math.log(p/Math.max(Number.MIN_VALUE,priors[i])):0),0);
      const merit=divergence*Math.log1p(total);
      if(!selected||merit>selected.merit)selected={counts,posterior,bridge:feature.bridge,merit};
    }
    if(!selected)return [];
    return family.map((row,i)=>({word:row.word,logAdjustment:Math.log(Math.max(Number.MIN_VALUE,selected!.posterior[i]))-Math.log(Math.max(Number.MIN_VALUE,priors[i])),
      examples:selected!.counts[i],bridge:selected!.bridge}));
  }
}
