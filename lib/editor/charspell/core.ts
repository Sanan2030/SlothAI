import info from './model-info.json';
type TensorName = keyof typeof info.tensors;
export const charSpellLower = (value: string): string => value.normalize('NFC').replace(/I/g,'ı').replace(/İ/g,'i').toLowerCase();
export interface CharSpellRank { word: string; logit: number }
/** Original character CNN checkpoint; padding, masking and feature order match PyTorch. */
export class CharSpellModel {
  private readonly tensors = new Map<TensorName, Float32Array>();
  private readonly characters = new Map(Array.from(info.characters,(c,i)=>[c,i+2]));
  private readonly embeddings = new Map<string,Float32Array>();
  private readonly rankings = new Map<string,readonly CharSpellRank[]>();
  constructor(values: Float32Array) {
    if(values.length!==info.parameters || values.some(v=>!Number.isFinite(v)))throw Error('CharSpell çəkiləri uyğun deyil.');
    let end=0;
    for(const name of Object.keys(info.tensors) as TensorName[]){
      const t=info.tensors[name],n=t.shape.reduce((a,b)=>a*b,1);
      if(t.offset!==end)throw Error('CharSpell tensor sərhədi uyğun deyil.');
      this.tensors.set(name,values.slice(end,end+n));end+=n;
    }
    if(end!==values.length)throw Error('CharSpell tensor ölçüsü uyğun deyil.');
  }
  private tensor(name: TensorName): Float32Array {return this.tensors.get(name)!;}
  private linear(input:ArrayLike<number>,weights:Float32Array,bias:Float32Array):Float32Array{
    const output=new Float32Array(bias.length);
    for(let r=0;r<output.length;r++){
      let sum=bias[r];for(let c=0;c<input.length;c++)sum+=weights[r*input.length+c]*input[c];output[r]=sum;
    }return output;
  }
  private encode(word:string):Float32Array{
    const {maxWordChars:width,charEmbedding:embedding,charChannels:channels}=info.config;
    const clipped=Array.from(word).slice(0,width).join('');const cached=this.embeddings.get(clipped);if(cached)return cached;
    const ids=Array.from(clipped,c=>this.characters.get(c)??1),table=this.tensor('encoder.embedding.weight');
    const pooled=new Float32Array(channels*2);
    for(const [head,kernel] of [3,5].entries()){
      const weights=this.tensor(kernel===3?'encoder.conv3.weight':'encoder.conv5.weight');
      const bias=this.tensor(kernel===3?'encoder.conv3.bias':'encoder.conv5.bias'),pad=(kernel-1)/2;
      for(let channel=0;channel<channels;channel++){
        let maximum=0;
        for(let at=0;at<ids.length;at++){
          let sum=bias[channel];
          for(let feature=0;feature<embedding;feature++){
            const offset=(channel*embedding+feature)*kernel;
            for(let k=0;k<kernel;k++){
              const position=at+k-pad;
              if(position>=0&&position<ids.length)sum+=weights[offset+k]*table[ids[position]*embedding+feature];
            }
          }maximum=Math.max(maximum,sum);
        }pooled[head*channels+channel]=maximum;
      }
    }
    const encoded=this.linear(pooled,this.tensor('encoder.project.weight'),this.tensor('encoder.project.bias')).map(Math.tanh);
    if(this.embeddings.size>=4096)this.embeddings.delete(this.embeddings.keys().next().value!);
    this.embeddings.set(clipped,encoded);return encoded;
  }
  rank(input:string,candidates:readonly string[],left:string,right:string):readonly CharSpellRank[]{
    if(!candidates.length || candidates.length>32)throw Error('CharSpell namizəd sayı uyğun deyil.');
    const key=[input,left,right,...candidates].join('\0');const cached=this.rankings.get(key);if(cached)return cached;
    const width=info.config.wordEmbedding;
    const source=this.encode(input),before=this.encode(Array.from(left).slice(-info.config.maxWordChars).join('')),after=this.encode(right);
    const rows=candidates.map(word=>{
      const candidate=this.encode(word),features=new Float32Array(width*5);
      features.set(candidate);features.set(source,width);features.set(before,width*2);features.set(after,width*3);
      for(let i=0;i<width;i++)features[width*4+i]=Math.abs(candidate[i]-source[i]);
      const hidden=this.linear(features,this.tensor('score.0.weight'),this.tensor('score.0.bias')).map(Math.tanh);
      return {word,logit:this.linear(hidden,this.tensor('score.2.weight'),this.tensor('score.2.bias'))[0]};
    }).sort((a,b)=>b.logit-a.logit||a.word.localeCompare(b.word,'az'));
    if(this.rankings.size>=2048)this.rankings.delete(this.rankings.keys().next().value!);
    this.rankings.set(key,rows);return rows;
  }
}
