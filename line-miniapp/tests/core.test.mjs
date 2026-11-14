
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {PAPERS, parseArxiv, topicFromChat, findPapers} from '../lib/rizz/papers.ts';
import {craftedReplies, validateSuggestions, respectsBoundary} from '../lib/rizz/generate.ts';
import {verifySignature, lineUser} from '../lib/rizz/server.ts';
import {POST as webhook} from '../app/api/line/webhook/route.ts';
import {POST as generate} from '../app/api/generate/route.ts';
import {shouldInitializeLine} from '../lib/rizz/liff.ts';
import {GET as getContext, DELETE as deleteContext} from '../app/api/context/route.ts';
const env = globalThis.__rizzEnv;
const db = new DatabaseSync(':memory:');
db.exec(readFileSync('drizzle/0000_greedy_unus.sql','utf8'));
const wrap = (sql, values=[]) => ({bind(...params){return wrap(sql,params)},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}}},async first(){return db.prepare(sql).get(...values)??null},async all(){return {results:db.prepare(sql).all(...values)}}});
env.DB={prepare:sql=>wrap(sql)};
env.LINE_CHANNEL_SECRET='test-secret';env.LINE_CHANNEL_ACCESS_TOKEN='test-token';env.LIFF_ID='123-abc';env.LIFF_CHANNEL_ID='123';
const sent=[];
globalThis.fetch=async (url,init)=>{
  if(String(url).includes('oauth2/v2.1/verify')) {const token=new URLSearchParams(init.body).get('id_token');return Response.json(token==='bad-audience'?{sub:'U1',aud:'wrong',exp:9999999999}:{sub:token==='user2'?'U2':'U1',aud:'123',exp:9999999999});}
  if(String(url).includes('/bot/message/reply')){sent.push(JSON.parse(init.body));return Response.json({});}
  throw Error('Unexpected external request: '+url);
};
const sign = async body => {const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('test-secret'),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Buffer.from(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('base64');};
const event=(id,user='U1',text='coffee?')=>({type:'message',timestamp:Date.now(),replyToken:'reply-'+id,source:{type:'user',userId:user},message:{id,type:'text',text}});
const sendWebhook=async events=>{const body=JSON.stringify({events});return webhook(new Request('https://example.com/api/line/webhook',{method:'POST',body,headers:{'x-line-signature':await sign(body)}}));};
const authRequest=(token='user1',method='GET')=>new Request('https://example.com/api/context',{method,headers:{authorization:'Bearer '+token}});
const chat=[{id:'1',role:'them',text:'coffee after this transformer lecture?'}];
const gen=async body=>{const r=await generate(new Request('https://example.com/api/generate',{method:'POST',body:JSON.stringify(body)}));return [r,await r.json()];};

test('real LIFF redirect URLs start initialization before the query is unwrapped',()=>{
  assert.equal(shouldInitializeLine('?liff.state=%3Fimport%3D1'),true);
  assert.equal(shouldInitializeLine('?import=1'),true);
  assert.equal(shouldInitializeLine(''),false);
  assert.equal(shouldInitializeLine('?import=0'),false);
});

test('crafted replies cite real, matching paper IDs across topics and variations',()=>{for(const topic of ['attention','diffusion','learning','scaling','alignment'])for(const vibe of ['lowkey','playful','bold'])for(const nerd of [1,2,3])for(const variation of [0,1]){const lines=craftedReplies(chat,vibe,nerd,topic,variation);assert.equal(lines.length,3);for(const line of lines){assert.ok(PAPERS.some(p=>p.id===line.paperId));assert.ok(line.explanation.length>40);assert.doesNotMatch(line.text,/\bRAG\b/i);}}assert.equal(PAPERS.find(p=>p.title.startsWith('Model-Agnostic')).id,'1703.03400');});
test('invented model citations and malformed candidate sets are rejected',()=>{const good={suggestions:craftedReplies(chat,'lowkey',2,'attention')};assert.ok(validateSuggestions(good,PAPERS));assert.equal(validateSuggestions({suggestions:good.suggestions.map(x=>({...x,paperId:'9999.99999'}))},PAPERS),null);assert.equal(validateSuggestions({suggestions:[]},PAPERS),null);});
test('arXiv parser extracts IDs, canonical links and XML entities',()=>{const p=parseArxiv('<feed><entry><id>http://arxiv.org/abs/1706.03762v7</id><title>Attention &amp; Sequences</title><published>2017-06-12</published><summary>A real abstract.</summary><author><name>A. Author</name></author></entry></feed>','attention');assert.equal(p[0].id,'1706.03762');assert.equal(p[0].title,'Attention & Sequences');assert.equal(p[0].year,2017);assert.deepEqual(parseArxiv('<feed><entry><id>https://evil.test/1</id></entry></feed>','attention'),[]);});
test('raw webhook signature verification rejects tampering',async()=>{const body='{"events":[]}';const signature=await sign(body);assert.equal(await verifySignature(body,signature,'test-secret'),true);assert.equal(await verifySignature(body+' ',signature,'test-secret'),false);assert.equal(await verifySignature(body,'not-base64','test-secret'),false);});
test('generation validates length, speaker labels and topic',async()=>{const input={messages:chat,vibe:'lowkey',nerd:2,topic:'auto',variation:0};const [ok,result]=await gen(input);assert.equal(ok.status,200);assert.equal(result.mode,'crafted');assert.equal(result.suggestions.length,3);assert.ok(result.suggestions.every(s=>result.papers.some(p=>p.id===s.paperId)));assert.equal((await gen({...input,messages:[]}))[0].status,400);assert.equal((await gen({...input,messages:[{id:'1',role:'you',text:'hello'}]}))[0].status,400);assert.equal((await gen({...input,topic:'rag'}))[0].status,400);});
test('explicit rejection produces a boundary response rather than flirting',async()=>{const [response,value]=await gen({messages:[{id:'1',role:'them',text:'please stop texting me'}],vibe:'bold',nerd:3,topic:'auto'});assert.equal(response.status,200);assert.equal(value.boundary,true);assert.deepEqual(value.suggestions,[]);});
test('forged public identity headers cannot authorize paid model calls',async()=>{
  const previousFetch=globalThis.fetch;
  const previousKey=env.OPENAI_API_KEY;
  env.OPENAI_API_KEY='not-a-real-key';
  let outbound=0;
  globalThis.fetch=async()=>{outbound++;throw new Error('No provider call should occur');};
  try {
    const response=await generate(new Request('https://example.com/api/generate',{
      method:'POST',headers:{'oai-authenticated-user-id':'forged'},
      body:JSON.stringify({messages:chat,vibe:'lowkey',nerd:2,topic:'auto'}),
    }));
    assert.equal(response.status,200);
    assert.equal((await response.json()).mode,'crafted');
    assert.equal(outbound,0);
  } finally {globalThis.fetch=previousFetch;env.OPENAI_API_KEY=previousKey;}
});
test('unauthenticated context cannot be read, and wrong token audience is rejected',async()=>{assert.equal((await getContext(new Request('https://example.com/api/context'))).status,401);await assert.rejects(()=>lineUser(authRequest('bad-audience')),e=>e.status===401);});
test('valid LINE events are deduplicated and group messages are ignored',async()=>{assert.equal((await sendWebhook([event('m1'),event('m2'),event('other','U2'),{...event('group'),source:{type:'group',userId:'U1',groupId:'G1'}}])).status,200);assert.equal((await sendWebhook([event('m1')])).status,200);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shared_messages').get().n,3);assert.equal(sent.length,2);assert.ok(sent[0].messages[1].template.actions[0].uri.includes('import=1'));});
test('tampered webhook does not mutate message storage',async()=>{const before=db.prepare('SELECT COUNT(*) AS n FROM shared_messages').get().n;const response=await webhook(new Request('https://example.com/api/line/webhook',{method:'POST',body:JSON.stringify({events:[event('tampered')]}),headers:{'x-line-signature':'invalid'}}));assert.equal(response.status,401);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shared_messages').get().n,before);});
test('context is isolated by verified identity, not client user ID',async()=>{const req=new Request('https://example.com/api/context?userId=U2',{headers:{authorization:'Bearer user1'}});const response=await getContext(req);const value=await response.json();assert.equal(response.status,200);assert.deepEqual(new Set(value.messages.map(m=>m.id)),new Set(['m1','m2']));});
test('unsending and clearing delete only the owning user context',async()=>{await sendWebhook([{type:'unsend',source:{type:'user',userId:'U1'},unsend:{messageId:'m1'}}]);assert.equal(db.prepare('SELECT id FROM shared_messages WHERE id=?').get('m1'),undefined);assert.equal((await deleteContext(authRequest('user1','DELETE'))).status,200);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shared_messages WHERE user_id=?').get('U1').n,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shared_messages WHERE user_id=?').get('U2').n,1);});
test('expired context is unavailable and physically pruned on access',async()=>{db.prepare('UPDATE shared_messages SET expires_at=0').run();const response=await getContext(authRequest('user2'));assert.deepEqual((await response.json()).messages,[]);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM shared_messages').get().n,0);});


test('Tavily discovers IDs but arXiv supplies citation metadata', async () => {
  const previous = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (String(url).includes('api.tavily.com')) {
      const input = JSON.parse(init.body);
      assert.deepEqual(input.include_domains, ['arxiv.org']);
      assert.doesNotMatch(input.query, /coffee/);
      return Response.json({results: [{url: 'https://arxiv.org/abs/1706.03762v7', title: 'untrusted search snippet'}]});
    }
    const query = new URL(url);
    assert.equal(query.searchParams.get('id_list'), '1706.03762');
    return new Response('<feed><entry><id>http://arxiv.org/abs/1706.03762v7</id><title>Attention Is All You Need</title><published>2017-06-12</published><summary>Attention mechanisms.</summary></entry></feed>');
  };
  try {
    const result = await findPapers('attention', 'test-key');
    assert.equal(result.source, 'tavily');
    assert.equal(result.papers[0].title, 'Attention Is All You Need');
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = previous; }
});

test('Tavily failures fall back to arXiv title queries', async () => {
  const previous = globalThis.fetch;
  let fallbackQuery = '';
  globalThis.fetch = async (url) => {
    if (String(url).includes('api.tavily.com')) return new Response('unavailable', {status: 503});
    fallbackQuery = new URL(url).searchParams.get('search_query');
    return new Response('<feed><entry><id>http://arxiv.org/abs/2006.11239v2</id><title>Denoising Diffusion Probabilistic Models</title><published>2020-06-19</published><summary>Reverse diffusion.</summary></entry></feed>');
  };
  try {
    const result = await findPapers('diffusion', 'test-key');
    assert.equal(result.source, 'arxiv');
    assert.match(fallbackQuery, /Denoising Diffusion/);
    assert.equal(result.papers[0].id, '2006.11239');
  } finally { globalThis.fetch = previous; }
});
