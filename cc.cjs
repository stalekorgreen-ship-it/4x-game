const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const jobs=JSON.parse(process.argv[2]);
for(const j of jobs){const p=await b.newPage({viewport:{width:1600,height:1000}});const errs=[];p.on('pageerror',e=>errs.push(e.stack.split('\n').slice(0,3).join('|')));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('TUNNEL'))errs.push(m.text().slice(0,200))});
 await p.goto('http://127.0.0.1:5173/concept3.html?'+j.q);try{await p.waitForFunction('window.done',null,{timeout:90000})}catch(e){console.log('timeout',j.f,errs.join('\n'));await p.close();continue}
 await p.screenshot({path:'/tmp/claude-0/-home-claude/9b2e0eda-c967-53d2-8f82-d549ec912f29/scratchpad/shots/'+j.f+'.png'});console.log(j.f,errs.join('|').slice(0,200));await p.close()}
await b.close()})();
