// Сводка тактических показателей по прогонам duel-test (по сторонам): потери, точность, смены целей (и возвраты к прежней), отходы/возвращения, ПВО.
// node tools/tactics-sum.cjs файл... → таблица; --json → машиночитаемо
const fs=require('fs');const files=process.argv.slice(2).filter(f=>!f.startsWith('--'));const J=process.argv.includes('--json');const out={};
for(const f of files){const L=fs.readFileSync(f,'utf8').split('\n').filter(l=>l.startsWith('{')&&l.includes('"ships"')).map(l=>JSON.parse(l));const A={runs:L.length,seeds:L.map(o=>o.seed),side:[0,1].map(()=>({lost:0,ships:0,mods:0,mods0:0,hits:0,shots:0,sw:0,swBack:0,ret:0,back:0,home:0,pvoKill:0,wins:0}))};
 for(const o of L){const al=[0,0];for(const s of o.ships){const sd=+s.n.slice(-1);const S=A.side[sd];if(!S)continue;S.ships++;if(!s.alive)S.lost++;else al[sd]++;const [a,b]=(s.mod||'0/0').split('/').map(Number);S.mods+=s.alive?a:0;S.mods0+=b}
  if(al[0]>al[1])A.side[0].wins++;else if(al[1]>al[0])A.side[1].wins++;
  for(const sd of [0,1]){const S=A.side[sd];S.hits+=(o.hits||[])[sd]||0;S.shots+=(o.shots||[])[sd]||0;const sw=o.fc&&o.fc.sw;if(sw&&sw.ns)S.sw+=sw.ns[sd]||0;
   for(const [k,v] of Object.entries(o.rs||{})){if(+k[0]!==sd)continue;if(/(ok|prep)→retreat$/.test(k))S.ret+=v;if(/→return$/.test(k))S.back+=v;if(/→home$/.test(k))S.home+=v}
   for(const [k,v] of Object.entries((o.pvo&&o.pvo.kill)||{}))if(+k[0]===sd)S.pvoKill+=v}
  if(o.fc&&o.fc.sw)A.swBackTotal=(A.swBackTotal||0)+(o.fc.sw.back||0)}
 for(const S of A.side){S.acc=S.shots?+(S.hits/S.shots).toFixed(3):0;S.modsLeft=S.mods0?+(S.mods/S.mods0).toFixed(3):0}out[f.split('/').pop().replace('.txt','')]=A}
if(J)console.log(JSON.stringify(out,null,1));else for(const [k,A] of Object.entries(out)){console.log(`== ${k} (${A.runs} боёв, seed ${A.seeds.join(',')}) · возвратов к прежней цели всего ${A.swBackTotal||0}`);for(const [i,S] of A.side.entries())console.log(`  сторона ${i}: побед ${S.wins} · потеряно ${S.lost}/${S.ships} · модулей цело ${(S.modsLeft*100).toFixed(0)}% · попаданий ${S.hits}/${S.shots} (${(S.acc*100).toFixed(1)}%) · смен целей ${S.sw} · отходов ${S.ret}, возвращений ${S.back}, на базу ${S.home} · ракет сбито ПВО ${S.pvoKill}`)}
