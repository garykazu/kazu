/* Profile imports: keep source data separate from saved profile until explicit review. */
let importBusy=false, importReview=null;
async function excelReader(){
 if(window.XLSX)return window.XLSX;
 if(!window._excelLoading)window._excelLoading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  const timer=setTimeout(()=>reject(new Error('Excel読み込み機能を取得できません。通信を確認するか、CSVで添付してください。')),20000);
  script.onload=()=>{clearTimeout(timer);window.XLSX?resolve(window.XLSX):reject(new Error('Excel読み込み機能が利用できません。CSVで添付してください。'))};
  script.onerror=()=>{clearTimeout(timer);reject(new Error('Excel読み込み機能を取得できません。CSVで添付してください。'))};document.head.appendChild(script);
 });
 try{return await window._excelLoading}catch(e){window._excelLoading=null;throw e}
}
async function readProfileFile(file){
 if(file.size>10*1024*1024)throw new Error('10MB以下のファイルを添付してください。');
 const ext=file.name.split('.').pop().toLowerCase(),buffer=await file.arrayBuffer();
 if(['xlsx','xls'].includes(ext)){const X=await excelReader(),book=X.read(buffer,{type:'array'});return book.SheetNames.map(name=>'【'+name+'】\n'+tableProfileText(X.utils.sheet_to_json(book.Sheets[name],{header:1,defval:'',raw:false}))).join('\n')}
 if(!['csv','tsv','txt','md','json','html','htm'].includes(ext))throw new Error('未対応の形式です。ExcelまたはCSVを添付してください。');
 let text=new TextDecoder('utf-8').decode(buffer);if(text.includes('�'))text=new TextDecoder('shift-jis').decode(buffer);
 if(['csv','tsv'].includes(ext))return tableProfileText(spreadsheetRows(text));
 if(ext==='json'){
  let data;try{data=JSON.parse(text.replace(/^\uFEFF/,''))}catch(e){throw new Error('JSONファイルの形式が正しくありません。')}
  if(Array.isArray(data)&&data.every(Array.isArray))return tableProfileText(data);
  const lines=[];function visit(value,label=''){
   if(value===null||value===undefined)return;
   if(Array.isArray(value)){if(value.every(x=>typeof x!=='object'))lines.push(label+'：'+value.join(' / '));else value.forEach(x=>visit(x,label))}
   else if(typeof value==='object')Object.entries(value).forEach(([key,item])=>visit(item,PROFILE_FIELDS.find(([id])=>id===key)?.[1]||key));
   else lines.push(label+'：'+String(value));
  }visit(data);return lines.join('\n');
 }
 if(['html','htm'].includes(ext)){
  const doc=new DOMParser().parseFromString(text,'text/html');
  doc.querySelectorAll('script,style').forEach(el=>el.remove());
  if(doc.querySelector('table'))return Array.from(doc.querySelectorAll('table'),table=>tableProfileText(Array.from(table.rows,row=>Array.from(row.cells,cell=>cell.textContent)))).join('\n');
  doc.querySelectorAll('br').forEach(el=>el.replaceWith(doc.createTextNode('\n')));
  doc.querySelectorAll('p,div,li,h1,h2,h3').forEach(el=>el.append(doc.createTextNode('\n')));
  return doc.body.textContent;
 }
 return text.replace(/^\uFEFF/,'');
}

const PROFILE_FIELDS = [
 ['brand','店舗・ブランド名',['ブランド名','店舗名','店名']],
 ['category','業種',['業種']],
 ['strength','強み・特徴',['強み','特徴','他店と比べて']],
 ['origin','生い立ち・原体験',['生い立ち','原体験','出身','育ち','幼少','経歴','過去の失敗']],
 ['founding','店を始めた理由',['店を始めた理由','始めた','創業','開業','きっかけ','店名・ブランド名に込めた']],
 ['hobby','趣味',['趣味','好きなこと','仕事以外で']],
 ['holiday','休日',['休日']],
 ['why','趣味の理由',['好きな理由','なぜ好き','なぜ、それが好き','趣味の理由','その趣味の何に']],
 ['moment','夢中になる瞬間',['夢中','好きな瞬間','一番夢中']],
 ['values','価値観',['価値観','大切','信念','こだわり','今後も変えたくない']],
 ['dislike','苦手なこと',['苦手','嫌い','逆に']],
 ['workValue','店づくりの価値観',['店づくり','その価値観は','絶対に妥協']],
 ['localStory','店の歴史・地域',['店の歴史','地域','地元','場所','歴史','この場所を']],
 ['staffStory','スタッフ',['スタッフ','店長','従業員']],
 ['customerVoice','顧客像・お客様の声',['お客様','顧客','来店理由','口コミ']],
 ['wish','届けたい気持ち・未来',['持ち帰って','願い','帰る時','これから店を','5年後','お客様にどんな時間']]
];
function normalizedLabel(value){return String(value??'').normalize('NFKC').replace(/^[\s\d.、)（(①-⑳Qq：:・【】]+/,'').replace(/[\s?？、,。:：]/g,'').toLowerCase()}
function profileField(label){
 const key=normalizedLabel(label);if(!key||key.length>100)return null;
 // Match the existing interview questions first, then the most specific label.
 if(typeof QUESTIONS!=='undefined'){
  const question=QUESTIONS.find(q=>normalizedLabel(q[2])===key);
  if(question)return question[1];
 }
 let best=null,score=0;
 for(const [id,title,aliases] of PROFILE_FIELDS){for(const alias of [title,...aliases]){
  const token=normalizedLabel(alias);if((key===token||key.includes(token))&&token.length>score){best=id;score=token.length}
 }}
 return best;
}
function isProfileHeading(label){
 const key=normalizedLabel(label);
 return PROFILE_FIELDS.some(([,title,aliases])=>[title,...aliases].some(a=>normalizedLabel(a)===key))||
  (typeof QUESTIONS!=='undefined'&&QUESTIONS.some(q=>normalizedLabel(q[2])===key));
}
function spreadsheetRows(text){
 text=String(text).replace(/^\uFEFF/,'');
 const delimiter=text.split(/\r?\n/)[0].includes('\t')?'\t':',';let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
 else if(c===delimiter&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}
 row.push(cell);rows.push(row);return rows.filter(r=>r.some(c=>c.trim()));
}
function tableProfileText(rows){
 const data=rows.map(row=>Array.from(row,c=>String(c??'').replace(/\r\n?/g,'\n').trim())).filter(row=>row.some(Boolean));
 if(!data.length)return '';
 const output=[];let headers=null,section='';
 const isAnswerHeading=c=>/^(回答|答え|内容|記入欄|回答欄|answer)$/i.test(c);
 const isQuestionHeading=c=>/^(質問|項目|項目名|質問項目|question)$/i.test(c);
 for(const row of data){
  const cells=row.filter(Boolean),fields=row.map(profileField);
  // Horizontal profile table, or a vertical interview table with a header row.
  if(fields.filter(Boolean).length>=2&&cells.every(c=>c.length<=100&&!/[：:]/.test(c))&&cells.filter(c=>profileField(c)).every(isProfileHeading)){headers={kind:'profile',labels:row};continue}
  if(row.some(isQuestionHeading)&&row.some(isAnswerHeading)){headers={kind:'interview',question:row.findIndex(isQuestionHeading),answer:row.findIndex(isAnswerHeading)};continue}
  if(cells.length===1&&profileField(cells[0])&&!/[：:]/.test(cells[0])){section=cells[0];headers=null;continue}
  if(headers?.kind==='profile'){
   row.forEach((value,i)=>{if(value&&headers.labels[i])output.push(headers.labels[i]+'：'+value.replace(/\n/g,' / '))});continue;
  }
  if(headers?.kind==='interview'){
   const question=row[headers.question]||section,answer=row[headers.answer];
   if(question&&answer)output.push(question+'：'+answer.replace(/\n/g,' / '));continue;
  }
  // Skip empty leading cells and numbering, retain question/answer association.
  const first=row.findIndex(c=>c&&!/^\d+[.)、]?$/.test(c));
  if(first<0)continue;
  const label=row[first],answer=row.slice(first+1).filter(Boolean).join(' / ');
  if(answer){output.push((section?section+' / '+label:label)+'：'+answer.replace(/\n/g,' / '))}
  else output.push((section&&!/[：:]/.test(label)?section+'：':'')+label.replace(/\n/g,' / '));
 }
 return output.join('\n');
}
function extractProfileCandidates(text){
 const values=new Map();let section=null;
 for(const line of text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean)){
  const parts=line.split(/[：:]/),label=parts.shift(),id=profileField(label.split(' / ')[0])||profileField(label);
  if(parts.length&&id){const value=parts.join('：').trim();if(value){if(!values.has(id))values.set(id,[]);if(!values.get(id).includes(value))values.get(id).push(value)}section=id;}
  else if(id&&!parts.length&&label.length<=80){section=id;}
  else if(section&&!parts.length&&!/^【.*】$/.test(line)){if(!values.has(section))values.set(section,[]);values.get(section).push(line)}
  else section=null;
 }
 return PROFILE_FIELDS.filter(([id])=>values.has(id)).map(([id,label])=>({id,label,value:values.get(id).join('\n')}));
}
function parseSheetUrl(value){
 let url;try{url=new URL(value)}catch(e){throw new Error('Googleスプレッドシートの共有URLを貼ってください。')}
 const match=url.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/(?:edit|view|preview|copy|htmlview))?\/?$/);
 if(url.protocol!=='https:'||url.hostname!=='docs.google.com'||url.port||url.username||url.password||!match||match[1]==='e')throw new Error('Googleスプレッドシートの通常の共有URL（https://docs.google.com/spreadsheets/d/…/edit）を貼ってください。');
 const gid=url.searchParams.get('gid')??new URLSearchParams(url.hash.slice(1)).get('gid');
 if(gid!==null&&!/^\d{1,20}$/.test(gid))throw new Error('タブ番号（gid）が正しくありません。シートのURLをコピーし直してください。');
 return {id:match[1],gid};
}
function showSheetSource(){
 const hint=$('sheetSourceHint');hint.replaceChildren();let sheet,url;
 try{url=new URL(v('sourceUrl'));sheet=parseSheetUrl(v('sourceUrl'))}catch(e){return}
 if(url.searchParams.get('rtpof')==='true'){
  hint.textContent='このURLはGoogle上で開いたExcelの可能性があります。読込みできない場合はExcelファイルを添付してください。';
  const link=document.createElement('a');link.className='chip';link.textContent='Excelファイルをダウンロード';link.href='https://drive.google.com/uc?export=download&id='+encodeURIComponent(sheet.id);link.target='_blank';link.rel='noopener noreferrer';hint.append(link);
 }else hint.textContent='ログインせず閲覧できるシートを読み込みます。'+(sheet.gid!==null?'指定タブ（gid: '+sheet.gid+'）を優先します。':'最初のタブを対象にします。');
}
function googleTableText(payload){
 if(!payload||payload.status==='error'||!Array.isArray(payload.table?.cols)||!Array.isArray(payload.table?.rows))throw new Error('シートを取得できません。共有の「一般的なアクセス」を「リンクを知っている全員・閲覧者」にしてください。組織内限定・ログイン必須の資料はExcel・CSVで添付してください。');
 const {cols,rows}=payload.table;
 if(rows.length>20000||cols.length>200)throw new Error('資料が大きすぎます。必要な範囲をCSVで添付してください。');
 const labels=cols.map(c=>String(c.label??'')),data=rows.map(row=>cols.map((col,i)=>{const cell=row.c?.[i];return cell?String(cell.f??cell.v??''):''}));
 if(labels.some(Boolean))data.unshift(labels);
 const text=tableProfileText(data);
 if(!text.trim())throw new Error('このタブには読み込めるデータがありません。内容のあるタブのURLを貼ってください。');
 if(text.length>2000000)throw new Error('資料が大きすぎます。必要な範囲をCSVで添付してください。');
 return text;
}
function readGoogleSheet(value){
 const sheet=parseSheetUrl(value);
 // Google Visualization JSONP avoids the CSV export endpoint's CORS restrictions.
 // Execute Google's response in an opaque sandbox, never in the app's origin.
 return new Promise((resolve,reject)=>{
  const frame=document.createElement('iframe');frame.hidden=true;frame.setAttribute('sandbox','allow-scripts');frame.referrerPolicy='no-referrer';frame.title='スプレッドシート読込み';
  const token='sheet_'+crypto.getRandomValues(new Uint32Array(4)).join('_');
  const target=new URL('https://docs.google.com/spreadsheets/d/'+sheet.id+'/gviz/tq');
  target.searchParams.set('tqx','out:json;responseHandler:receiveSheet');target.searchParams.set('headers','0');
  if(sheet.gid!==null)target.searchParams.set('gid',sheet.gid);
  const access='シートを読み込めません。共有設定を「リンクを知っている全員・閲覧者」にし、URLと通信を確認してください。組織の制限やGoogle側の配信制限で取得できない場合は、Excel・CSVをダウンロードして添付してください。';
  let settled=false;const timer=setTimeout(()=>done(new Error(access)),20000);
  function done(error,text){if(settled)return;settled=true;clearTimeout(timer);window.removeEventListener('message',receive);frame.remove();error?reject(error):resolve(text)}
  function receive(event){if(event.source!==frame.contentWindow||event.origin!=='null'||event.data?.token!==token)return;try{if(event.data.error)throw new Error(access);done(null,googleTableText(event.data.payload))}catch(e){done(e)}}
  window.addEventListener('message',receive);
  // Only constant code and a URL built from validated ID/gid enter the sandbox.
  // The sandbox has no access to localStorage, profile fields, or parent DOM.
  frame.srcdoc='<!doctype html><meta charset="utf-8"><script>const token='+JSON.stringify(token)+';function receiveSheet(payload){parent.postMessage({token,payload},"*")}const s=document.createElement("script");s.src='+JSON.stringify(target.href)+';s.referrerPolicy="no-referrer";s.onerror=()=>parent.postMessage({token,error:true},"*");document.head.appendChild(s);<\/script>';
  document.body.appendChild(frame);
 });
}
function renderImportReview(message=''){
 const review=importReview;if(!review)return;
 const result=$('importResult');result.replaceChildren();
 const box=document.createElement('div');box.className='result';result.append(box);
 function text(tag,value,parent=box){const el=document.createElement(tag);el.textContent=value;parent.append(el);return el}
 text('b',review.names.length?'読み込み完了：'+review.names.join('、'):'読み込めませんでした');
 if(message)text('p',message);
 if(review.text){
  text('h3','資料から見つかったプロフィール候補');text('p','読込みだけでは保存済みプロフィールを変更しません。採用する項目を選び、最後に「プロフィールに反映」を押してください。');
  for(const candidate of review.candidates){
   const item=document.createElement('div');item.className='importCandidate';box.append(item);
   text('b',candidate.label,item);const compare=document.createElement('div');compare.className='importCompare';item.append(compare);
   text('p','既存値：\n'+(v(candidate.id)||'（空欄）'),compare);text('p','候補値：\n'+candidate.value,compare);
   const choice=document.createElement('label');choice.className='importChoice';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.checked=candidate.selected;checkbox.addEventListener('change',()=>candidate.selected=checkbox.checked);choice.append(checkbox,document.createTextNode(v(candidate.id)?'既存値をこの候補で置き換える（確認済み）':'この候補を採用する'));item.append(choice);
  }
  if(review.candidates.length){const actions=document.createElement('div');actions.className='importActions';box.append(actions);const apply=text('button','プロフィールに反映',actions);apply.type='button';apply.className='btn primary';apply.addEventListener('click',applyImportedCandidates)}
  else text('p','分類できる項目がありませんでした。下の資料を確認し、必要な項目に手入力してください。項目名と回答を分けた表にすると分類しやすくなります。');
  const details=document.createElement('details');box.append(details);text('summary','読み込んだ資料を確認',details);text('pre',review.text,details);
 }
 for(const error of review.errors)text('p',error);
}
function applyImportedCandidates(){
 if(!importReview)return;const chosen=importReview.candidates.filter(c=>c.selected);
 if(!chosen.length){renderImportReview('反映する候補を選んでください。入力済み項目は初期状態では選択されていません。');return}
 // Recheck at apply time: editing a profile after import must require a new review.
 if(chosen.some(c=>v(c.id)!==c.existing)){
  for(const c of importReview.candidates){c.existing=v(c.id);c.selected=false}
  renderImportReview('読込み後にプロフィールが変更されました。最新の既存値を確認して、もう一度候補を選んでください。');return;
 }
 for(const c of chosen)$(c.id).value=c.value;
 saveForm();refreshQuestions();diagnose();renderBridge();renderWizard();
 importReview.candidates=importReview.candidates.filter(c=>!c.selected);
 renderImportReview(chosen.length+'項目をプロフィールに反映しました。選択しなかった項目は変更していません。');
}
async function importProfile(mode='auto'){
 if(importBusy)return;
 const files=mode==='url'?[]:Array.from($('profileFiles').files),url=mode==='files'?'':v('sourceUrl');
 if(!files.length&&!url){$('importResult').textContent='Googleスプレッドシートの共有URLか、Excel・CSVファイルを入れてください。';return}
 importBusy=true;importReview=null;$('importResult').textContent='資料を読み込んでいます…';$('importResult').setAttribute('aria-busy','true');$('sheetImportButton').disabled=true;
 try{
  const texts=[],errors=[],names=[];
  for(const file of files){try{const text=await readProfileFile(file);if(!text.trim())throw new Error('データがありません。');texts.push(text);names.push(file.name)}catch(e){errors.push(file.name+'：'+e.message)}}
  if(url){try{texts.push(await readGoogleSheet(url));names.push('Googleスプレッドシート')}catch(e){errors.push(e.message)}}
  const text=texts.join('\n');
  importReview={text,names,errors,candidates:extractProfileCandidates(text).map(c=>({...c,existing:v(c.id),selected:!v(c.id)}))};renderImportReview();
 }catch(e){$('importResult').textContent='読み込めませんでした：'+e.message}
 finally{importBusy=false;$('sheetImportButton').disabled=false;$('importResult').setAttribute('aria-busy','false')}
}
