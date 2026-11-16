// Ловит код, случайно оказавшийся после // в той же строке (так были «выключены» масштаб вспышек, jsT0 и слежение ракет по высоте).
// Ищем в строчном комментарии фрагмент, похожий на JS-оператор: «; x = …», «; foo(…);», «const …=», «dummy.scale…». Выход 1, если нашлись.
const fs=require('fs'),path=require('path');const dir=path.join(__dirname,'..','src');let bad=0;
const CODE=/(?:^|[\s;}{)])(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=|(?:^|[\s;}])(?:if|for)\s*\(|(?:^|[\s;}])[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)+\s*\([^)]*\)\s*;|(?:^|[;}]\s*)[A-Za-z_$][\w$.\[\]]*\s*(?:\+=|-=|=(?!=))\s*[^;]{1,80};|[A-Za-z_$][\w$]*\.[A-Za-z_$][\w$]*\s*(?:\+=|-=)\s*[\w$.(]/;
if(process.argv[2]==='--self'){const T=['x(); // кораблей const jsT0 = performance.now();','a=1; // взрывы dummy.scale.setScalar(rr);','f(); // Δvp.z+=Math.max(1,2);','b=2; // обычный комментарий: длина 5 км; скорость 3'];for(const l of T)console.log(CODE.test(l.slice(l.indexOf('//')+2))?'ловит':'НЕ ловит',l);process.exit(0)}
for(const f of fs.readdirSync(dir).filter(f=>/\.tsx?$/.test(f))){const L=fs.readFileSync(path.join(dir,f),'utf8').split('\n');
 L.forEach((l,i)=>{let q=null,k=-1;for(let j=0;j<l.length-1;j++){const c=l[j];if(q){if(c==='\\'){j++;continue}if(c===q)q=null;continue}if(c==='"'||c==="'"||c==='`'){q=c;continue}if(c==='/'&&l[j+1]==='/'&&l[j-1]!==':'){k=j;break}if(c==='/'&&l[j+1]==='*'){const e=l.indexOf('*/',j+2);if(e<0)break;j=e+1}}
  if(k<0)return;const cm=l.slice(k+2);if(/https?:|lint-ok/.test(cm))return;const m=cm.match(CODE);if(m){bad++;console.log(`${f}:${i+1}: …${cm.slice(Math.max(0,m.index-20),m.index+60)}`)}})}
console.log(bad?`найдено подозрительных мест: ${bad}`:'код после // не найден');process.exit(bad?1:0);
