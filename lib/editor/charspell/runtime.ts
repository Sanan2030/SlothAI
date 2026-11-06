import info from './model-info.json';
import {charSpellLower,type CharSpellModel,type CharSpellRank} from './core';
export interface CharSpellStats{
  mode:'automatic';loaded:true;sourceCheckpointSHA256:string;parameters:number;
  rankedTokens:number;candidatesScored:number;changedTokens:number;
}
export interface CharSpellInference{
  readonly stats:CharSpellStats;
  rank(input:string,candidates:readonly string[],left:readonly string[],right:readonly string[]):readonly CharSpellRank[];
}
export function createCharSpellInference(model:CharSpellModel):CharSpellInference{
  const stats:CharSpellStats={mode:'automatic',loaded:true,sourceCheckpointSHA256:info.sourceCheckpointSHA256,
    parameters:info.parameters,rankedTokens:0,candidatesScored:0,changedTokens:0};
  return {stats,rank(input,candidates,left,right){
    stats.rankedTokens++;stats.candidatesScored+=candidates.length;
    return model.rank(charSpellLower(input),candidates.map(charSpellLower),charSpellLower(left.slice(-info.config.contextWords).join(' ')),charSpellLower(right.slice(0,info.config.contextWords).join(' ')));
  }};
}
