const stub = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.assign(globalThis, { document: stub(), window: stub(), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {}, ResizeObserver: function () { return stub(); }, performance: {now:()=>Date.now()} });
const Bt = await import('/home/claude/4x-game/src/05-battle.ts');const Dm=await import('/home/claude/4x-game/src/16-demo.ts');
const D=await import('/home/claude/4x-game/src/01-data.ts');const bd=await import('/home/claude/4x-game/src/16b-botdesign.ts');
const mk=(mnt)=>{const parts={};parts[D.mkKey('chem',{pw:'100'})||'chem']=0;const e=Object.keys(D.COMP).includes('ion')?'ion':'chem';parts[e]=20;parts.tank=2;parts.cabin=3;parts.life=2;parts[D.mkKey('rail',{cal:'10',bar:'1',ld:'m',cap:'10',saf:'0',mnt})]=6;parts.ammo=1;parts[D.mkKey('reactor',{p:'100'})]=1;parts.armor=3;for(const b of ['radar','fcs','irs','ems'])parts[D.mkKey(b,{})]=1;parts[D.mkKey('radar',{pw:'l',res:'f'})]=1;const sp=bd.previewSpec(parts);return sp};
for(const mnt of ['t','a']){
 const a=mk(mnt);if(!a){console.log('spec null');continue}
 const B=Bt.Battles.main;B.beginBg({title:'x',fleets:[[],[]],late:[{t:0,side:0,spec:a,edge:40,ang:0},{t:0,side:1,spec:{...mk('t'),name:'foe'},edge:40,ang:Math.PI}],demo:true,maxT:14400,names:['a','b'],onEnd(){}});
 B.tickN(1);const S=B.ships().find(s=>s.side===0);console.log('ships',B.ships().length);let fired=0,off=[];let last=0;
 for(let k=0;k<4000;k++){B.tickN(2);const n=B.stat().shots[0];if(n>last&&S.tg&&S.tg.alive){let r=Math.atan2(S.tg.y-S.y,S.tg.x-S.x)-S.hd;r=Math.abs(Math.atan2(Math.sin(r),Math.cos(r)));off.push(r)}last=n}
 off.sort((x,y)=>x-y);const big=off.filter(x=>x>.25).length;console.log('big',big,'of',off.length);console.log(mnt,'ton',Math.round(a.tons),'rails',a.rails,'ax',a.railCfg&&a.railCfg[0]&&a.railCfg[0].ax,'shots',last,'max off deg',off.length?(off[off.length-1]*57.3).toFixed(1):'-','median',off.length?(off[off.length>>1]*57.3).toFixed(1):'-');
}
{const B=Bt.Battles.main;for(const s of B.ships())console.log(s.side,s.T.n,'alive',s.alive,'x',s.x|0,'y',s.y|0,'tg',!!s.tg,'mag',s.mag,'en',s.enR,'rng',s.maxR, 'fuel',s.fuel|0, 'tur',s.tur.length, 'st',s.st, 't',B.time()|0, JSON.stringify(B.stat().shots))}
{const B=Bt.Battles.main;for(const s of B.ships())console.log(s.side,'seen',JSON.stringify(s.seen),'lock',JSON.stringify(s.lock),'F',s.F&&s.F.stance,'cls',s.cls,'scs',JSON.stringify(s.sc||s.scList||null), 'ch', s.ch, 'blk', s.blk, 'stc',s.st)}
