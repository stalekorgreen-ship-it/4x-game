// Собирает корабли редактора (tools/ship-editor) в public/data/ships.json для игры.
// Запуск: NODE_PATH=... node tools/export-ships.cjs
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.launch();const pg=await b.newPage();pg.on('pageerror',e=>console.error(e.message));
await pg.goto('file://'+path.join(__dirname,'ship-editor','index.html'));await pg.waitForTimeout(300);
const roles=['Крестокрыл','Шахтёр','Тягач','Ракетоносец','Фрегат','Разведчик','Колонист','Линкор','Авианосец'];const out=[];
for(const r of roles){const j=await pg.evaluate(r=>{if(r==='Крестокрыл')loadP(r);else autoShip(r);return gameJSON(r);},r);out.push(j);console.log(r,j.L,'м',j.M,'т',Math.round(j.pos.length/1024),'КБ');}
out.sort((a,b)=>a.M-b.M);fs.writeFileSync(path.join(__dirname,'..','public','data','ships.json'),JSON.stringify({_readme:'Корабли из редактора корпусов (tools/export-ships.cjs). Игра берёт ближайший по массе.',list:out}));await b.close();})();
