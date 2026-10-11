// Run with NODE_PATH pointing to a temporary install of playwright and xlsx.
const { chromium }=require('playwright');
const XLSX=require('xlsx');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-site-isolation-trials']});
 const results=[];
 try{
  for(const viewport of [{width:1280,height:900},{width:390,height:844}]){
   const context=await browser.newContext({viewport});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let response='success',requestedGid=null;
   await context.route('https://docs.google.com/**',async route=>{
    const url=new URL(route.request().url());requestedGid=url.searchParams.get('gid');
    if(response==='network'){await route.abort();return}
    const data=response==='empty'?[]:[['項目','回答'],['生い立ち','京都の商店街で育った'],['趣味','音楽'],['価値観','自由'],['店の歴史','2010年開業'],['スタッフ','写真が得意'],['顧客像','休日に一人で過ごす方'],['店名','<img src=x onerror=alert(1)>']];
    const payload=response==='private'?{status:'error',errors:[{reason:'access_denied'}]}:{status:'ok',table:{cols:[{label:''},{label:''}],rows:data.map(r=>({c:r.map(v=>({v}))}))}};
    await route.fulfill({contentType:'application/javascript',body:'receiveSheet('+JSON.stringify(payload)+');'});
   });
   await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'),'utf8')}));
   // Use the built app, under a nested path like GitHub Pages.
   await page.goto(process.env.THREADS_TEST_URL||'http://127.0.0.1:4173/threads-shift-app/');
   await page.evaluate(()=>{
    document.querySelectorAll('details.card').forEach(e=>e.open=true);
    $('brand').value='既存店舗';$('origin').value='既存の生い立ち';$('values').value='';$('hobby').value='サーフィン';
    wizardDrafts={feeling:'入力途中の感覚'};saveWizard();saveForm();localStorage.setItem('threadHistory',JSON.stringify([{text:'以前の投稿',life:'海',date:'2026/10/01'}]));
   });
   await page.locator('#sourceUrl').fill('https://docs.google.com/spreadsheets/d/testSheet/edit#gid=0');
   await page.locator('#sourceUrl').blur();
   const saved=await page.evaluate(()=>localStorage.getItem('threadForm'));
   await page.locator('#sheetImportButton').click();
   await page.waitForFunction(()=>document.getElementById('importResult').textContent.includes('資料から見つかったプロフィール候補'));
   assert.equal(requestedGid,'0');
   assert.equal(await page.locator('#origin').inputValue(),'既存の生い立ち');
   assert.equal(await page.locator('#values').inputValue(),'');
   assert.equal(await page.evaluate(()=>localStorage.getItem('threadForm')),saved,'import must not save profile');
   assert.equal(await page.locator('#importResult img').count(),0,'sheet HTML must be literal text');
   const origin=page.locator('.importCandidate').filter({has:page.getByText('生い立ち・原体験',{exact:true})});
   assert.match(await origin.textContent(),/既存の生い立ち/);assert.match(await origin.textContent(),/京都の商店街/);
   assert.equal(await origin.locator('input').isChecked(),false);
   await page.getByRole('button',{name:'プロフィールに反映',exact:true}).click();
   assert.equal(await page.locator('#values').inputValue(),'自由');assert.equal(await page.locator('#origin').inputValue(),'既存の生い立ち');assert.equal(await page.locator('#hobby').inputValue(),'サーフィン');
   await origin.locator('input').check();
   // Editing between import and apply must force review instead of overwrite.
   await page.locator('#origin').fill('読込み後の編集');
   await page.getByRole('button',{name:'プロフィールに反映',exact:true}).click();
   assert.match(await page.locator('#importResult').textContent(),/プロフィールが変更/);
   assert.equal(await page.locator('#origin').inputValue(),'読込み後の編集');
   await origin.locator('input').check();await page.getByRole('button',{name:'プロフィールに反映',exact:true}).click();
   assert.equal(await page.locator('#origin').inputValue(),'京都の商店街で育った');
   await page.getByRole('button',{name:'今日の作戦をつくる',exact:true}).click();
   assert.ok((await page.locator('#dailyLead').textContent()).length>10);
   assert.ok((await page.locator('#photoMission').textContent()).length>5);
   await page.evaluate(()=>generate());assert.ok(await page.locator('#posts .post').count()>0);
   assert.match(await page.evaluate(()=>localStorage.getItem('threadHistory')),/以前の投稿/);
   assert.match(await page.evaluate(()=>localStorage.getItem('threadWizard')),/入力途中の感覚/);
   await page.reload();await page.evaluate(()=>document.querySelectorAll('details.card').forEach(e=>e.open=true));
   assert.equal(await page.locator('#origin').inputValue(),'京都の商店街で育った');assert.equal(await page.locator('#brand').inputValue(),'既存店舗');
   for(const mode of ['private','empty','network']){
    response=mode;await page.locator('#sheetImportButton').click();
    await page.waitForFunction(()=>document.getElementById('importResult').getAttribute('aria-busy')==='false');
    const text=await page.locator('#importResult').textContent();assert.match(text,mode==='empty'?/データがありません/:/共有|シートを/);
    assert.equal(await page.locator('#origin').inputValue(),'京都の商店街で育った');
   }
   await page.locator('#sourceUrl').fill('https://evil.test/sheet');await page.locator('#sheetImportButton').click();
   assert.match(await page.locator('#importResult').textContent(),/通常の共有URL/);
   const upload=async(name,buffer)=>{
    await page.locator('#profileFiles').setInputFiles({name,mimeType:'application/octet-stream',buffer});
    await page.waitForFunction(()=>document.getElementById('importResult').getAttribute('aria-busy')==='false');
    assert.match(await page.locator('#importResult').textContent(),/プロフィール候補/);
   };
   await upload('profile.csv',Buffer.from('項目,回答\n趣味,写真\n価値観,挑戦'));
   assert.equal(await page.locator('#hobby').inputValue(),'サーフィン');
   assert.match(await page.locator('#importResult').textContent(),/写真/);
   const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['趣味','価値観'],['料理','誠実']]));
   await upload('profile.xlsx',XLSX.write(book,{type:'buffer',bookType:'xlsx'}));
   assert.match(await page.locator('#importResult').textContent(),/料理/);
   await upload('profile.xls',XLSX.write(book,{type:'buffer',bookType:'biff8'}));
   assert.match(await page.locator('#importResult').textContent(),/料理/);
   await upload('profile.tsv',Buffer.from('項目\t回答\n趣味\t読書'));
   assert.match(await page.locator('#importResult').textContent(),/読書/);
   await upload('profile.txt',Buffer.from('趣味：散歩\n価値観：誠実'));
   assert.match(await page.locator('#importResult').textContent(),/散歩/);
   await upload('profile.md',Buffer.from('趣味：山歩き\n価値観：自由'));
   assert.match(await page.locator('#importResult').textContent(),/山歩き/);
   await upload('profile.json',Buffer.from(JSON.stringify({hobby:'釣り',values:'挑戦'})));
   assert.match(await page.locator('#importResult').textContent(),/釣り/);
   await upload('profile.html',Buffer.from('<p>趣味：散歩</p><img src=x onerror="alert(1)">'));
   assert.equal(await page.locator('#importResult img').count(),0);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile horizontal overflow');
   assert.deepEqual(errors,[],'no uncaught JavaScript errors');
   await page.screenshot({path:'/tmp/kazu-threads-'+viewport.width+'.png',fullPage:true});
   results.push({viewport,passed:true,checks:'Google sandbox callback/gid; preview without save; conflict/apply; race protection; persistence; CSV/TSV/TXT/MD/JSON/HTML/XLSX/XLS; wizard drafts; existing posts/daily/photo/history; Japanese errors; XSS; overflow; JS errors'});
   await context.close();
  }
  console.log(JSON.stringify(results,null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
