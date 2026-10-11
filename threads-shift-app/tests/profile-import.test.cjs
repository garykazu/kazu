const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = vm.createContext({URL, URLSearchParams, console});
vm.runInContext('const QUESTIONS = [["人物", "origin", "どこで育ち、どんな家庭・環境でしたか？"]];', context);
vm.runInContext(fs.readFileSync(path.join(__dirname,'../profile-import.js'),'utf8'), context);
const run = code => vm.runInContext(code, context);
test('strict Google URL parsing, hash/query gid including zero',()=>{
 assert.equal(run('parseSheetUrl("https://docs.google.com/spreadsheets/d/abc_DEF-123/edit#gid=0").gid'),'0');
 assert.equal(run('parseSheetUrl("https://docs.google.com/spreadsheets/d/abc/edit?gid=42#gid=0").gid'),'42');
 for(const url of ['javascript:alert(1)','https://docs.google.com.evil.test/spreadsheets/d/abc/edit','http://docs.google.com/spreadsheets/d/abc/edit','https://evil@docs.google.com/spreadsheets/d/abc/edit','https://docs.google.com/spreadsheets/d/e/abc/pubhtml','https://docs.google.com/spreadsheets/d/abc/edit#gid=<script>','https://docs.google.com:444/spreadsheets/d/abc/edit','https://docs.google.com/spreadsheets/d/abc/../../evil']){
  assert.throws(()=>context.parseSheetUrl(url));
 }
});
test('CSV quoting, BOM, multiline and TSV',()=>{
 const rows=context.spreadsheetRows('\uFEFF項目,回答\r\n趣味,"海,写真"\r\n価値観,"自由\n挑戦"');
 assert.equal(rows[1][1],'海,写真');assert.equal(rows[2][1],'自由\n挑戦');
 assert.equal(context.spreadsheetRows('項目\t回答\n趣味\t音楽')[1][1],'音楽');
});
test('horizontal table keeps answer columns linked to headings',()=>{
 const text=context.tableProfileText([['趣味','価値観','地域'],['写真','自由','京都'],['音楽','','神戸']]);
 const candidates=context.extractProfileCandidates(text);
 assert.equal(candidates.find(c=>c.id==='hobby').value,'写真\n音楽');
 assert.equal(candidates.find(c=>c.id==='values').value,'自由');
 assert.equal(candidates.find(c=>c.id==='localStory').value,'京都\n神戸');
});
test('vertical interview, empty cells, section heading and existing question mapping',()=>{
 const text=context.tableProfileText([['項目','回答'],['趣味','海'],['価値観','自由'],['どこで育ち、どんな家庭・環境でしたか？','京都の商店街']]);
 const candidates=context.extractProfileCandidates(text);
 assert.equal(candidates.find(c=>c.id==='origin').value,'京都の商店街');
 const section=context.tableProfileText([['スタッフ'],['','得意分野','写真'],['','趣味','音楽']]);
 assert.match(section,/スタッフ/);
 const blanks=context.tableProfileText([['','','趣味','','写真'],['','','','']]);
 assert.equal(blanks,'趣味：写真');
});
test('do not classify answer keywords into unrelated fields',()=>{
 const candidates=context.extractProfileCandidates('趣味：地域でスタッフと写真を撮る');
 assert.equal(candidates.length,1);assert.equal(candidates[0].id,'hobby');
});
test('empty Google table and failed/private Google response are errors',()=>{
 assert.throws(()=>context.googleTableText({status:'ok',table:{cols:[{label:''}],rows:[]}}),/データがありません/);
 assert.throws(()=>context.googleTableText({status:'error',errors:[{reason:'access_denied'}]}),/共有/);
 assert.equal(context.googleTableText({status:'ok',table:{cols:[{},{}],rows:[{c:[{v:'趣味'},{v:'写真'}]}]}}),'趣味：写真');
});
