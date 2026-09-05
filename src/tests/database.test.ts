import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { ElicitRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { prepareDatabaseQuery, prepareDatabaseChange, databaseQueryResult, QUERY_FORBIDDEN, QUERY_CALLS } from '../query-database.js';
import { createStarlimsMcpServer } from '../server.js';
import { StarlimsHttpAdapter } from '../adapters/starlims-http-adapter.js';
import { loadStarlimsMcpConfig } from '../config.js';

const change = {sql:'UPDATE ORDTASK SET STATUS = ? WHERE ORDNO = ? AND TESTCODE = ?',parameters:['Done','O1','T1'],reason:'Approved correction',maxAffectedRows:1};
test('restricted query validation rejects side effects and injection before dispatch',()=>{
 for(const sql of ['SELECT ORDNO FROM ORDERS WHERE ORDNO = ?', 'SELECT COUNT(*) AS N FROM ORDERS WHERE ORDNO = ?', 'SELECT COALESCE(ORDNO, ?) AS N FROM ORDERS']) assert.equal(prepareDatabaseQuery({sql,parameters:['O1']}).maxRows,100);
 for(const sql of ['DELETE FROM ORDERS','SELECT * INTO BACKUP FROM ORDERS','SELECT 1; DELETE FROM ORDERS','SELECT dbo.fn(?)','SELECT * FROM OPENQUERY(x,?)','SELECT NEXT VALUE FOR SEQ','SELECT * FROM a.b.c','SELECT 1 --comment','SELECT /*hint*/ 1',"SELECT 'value'",'SELECT * FROM ORDERS WITH (UPDLOCK)','WITH x AS (SELECT 1 AS N) SELECT * FROM x']) assert.throws(()=>prepareDatabaseQuery({sql,parameters:[]}));
 assert.throws(()=>prepareDatabaseQuery({sql:'SELECT ? AS N',parameters:[]}));
 assert.throws(()=>prepareDatabaseQuery({sql:'SELECT 1 AS N',connection:'SettingsDB'}));
 assert.throws(()=>prepareDatabaseQuery({sql:'SELECT 1 AS N',timeoutSeconds:31}));
 assert.throws(()=>databaseQueryResult({success:false,message:'Endpoint disabled'}),/disabled/);
});
test('changes require parameterized simple DML and bounded limits',()=>{
 assert.equal(prepareDatabaseChange(change).parameters.length,3);
 assert.ok(prepareDatabaseChange({...change,sql:'DELETE FROM dbo.T WHERE ID = ?',parameters:[1]}));
 assert.ok(prepareDatabaseChange({...change,sql:'INSERT INTO dbo.T (ID, NAME) VALUES (?, ?)',parameters:[1,'hello']}));
 for(const sql of ['UPDATE T SET X = ?','DELETE FROM T','TRUNCATE TABLE T','UPDATE T SET X = 1 WHERE ID = ?','UPDATE T SET X = ? WHERE ID = ? OR 1=1','INSERT INTO T SELECT * FROM X','DELETE FROM T WHERE ID = ?; DELETE FROM X']) assert.throws(()=>prepareDatabaseChange({...change,sql}));
 assert.throws(()=>prepareDatabaseChange({...change,maxAffectedRows:101}));
 assert.throws(()=>prepareDatabaseChange({...change,approved:true}));
});
test('server validation lists and transaction ordering remain aligned',()=>{
 const ssl=readFileSync(new URL('../../scm/server/Server Scripts/SCM_API/McpDatabaseAccess.srvscr',import.meta.url),'utf8');
 assert.ok(ssl.includes(QUERY_FORBIDDEN.join('|'))); assert.ok(ssl.includes(QUERY_CALLS.join('|')));
 assert.ok(ssl.indexOf('expected>limit')<ssl.indexOf('valid := RunSQL'));
 assert.ok(ssl.indexOf('affected>limit')<ssl.indexOf('EndLimsTransaction("Database",.T.)'));
 assert.match(ssl,/BeginLimsTransaction\("Database","Serializable"\)/);
 assert.match(ssl,/SetSqlTimeout\(timeout,"Database"\)/);
 assert.match(ssl,/SetSqlTimeout\(timeoutBefore,"Database"\)/);
 assert.match(ssl,/GetDBMSProviderName\("Database"\)/);
 assert.doesNotMatch(ssl,/ConnectionString|:Password|GetConnectionStrings|SaveCode|save_item/);
});
test('standalone MCP demands a fresh human confirmation for every write', async t=>{
 let calls=0, confirmations=0;
 let approved=false;
 const server=createStarlimsMcpServer({version:'test',adapter:{id:'test',capabilities:['database.change'],invoke:async()=>{calls++;return {affectedRows:1};}}});
 const client=new Client({name:'test',version:'1'},{capabilities:{elicitation:{form:{}}}});
 client.setRequestHandler(ElicitRequestSchema,async request=>{confirmations++;assert.match(request.params.message,/Maximum affected rows: 1/);assert.match(request.params.message,/O1/);return {action:approved?'accept':'decline',content:{approve:approved}};});
 const [a,b]=InMemoryTransport.createLinkedPair();
 await server.connect(a);await client.connect(b);
 t.after(()=>client.close());t.after(()=>server.close());
 assert.equal((await client.callTool({name:'execute_database_change',arguments:change})).isError,true);assert.equal(calls,0);
 approved=true;
 assert.notEqual((await client.callTool({name:'execute_database_change',arguments:change})).isError,true);
 assert.notEqual((await client.callTool({name:'execute_database_change',arguments:change})).isError,true);
 assert.equal(calls,2);assert.equal(confirmations,3);
});
test('clients without elicitation cannot invoke writes',async t=>{
 let calls=0;
 const server=createStarlimsMcpServer({version:'test',adapter:{id:'test',capabilities:['database.change'],invoke:async()=>{calls++;return {};}}});
 const client=new Client({name:'test',version:'1'});const [a,b]=InMemoryTransport.createLinkedPair();
 await server.connect(a);await client.connect(b);t.after(()=>client.close());t.after(()=>server.close());
 assert.equal((await client.callTool({name:'execute_database_change',arguments:change})).isError,true);assert.equal(calls,0);
});
test('HTTP adapter uses dedicated endpoint, rejects write in read-only policy', async()=>{
 const requests:{url:string,body:unknown}[]=[];
 const config=await loadStarlimsMcpConfig([], { STARLIMS_BASE_URL:'http://example.test/lims', STARLIMS_USER:'test', STARLIMS_PASSWORD:'secret' });
 const adapter=new StarlimsHttpAdapter(config,{debug(){},info(){},error(){}}, (async(url,options)=>{
  requests.push({url:String(url),body:options?.body});
  return new Response(JSON.stringify(String(url).includes('GetSessions')?{success:true,data:{user:'test'}}:{success:true,data:{rows:[],rowCount:0}}),{status:200});
 }) as typeof fetch);
 await adapter.invoke('query_database',{sql:'SELECT ORDNO FROM ORDERS WHERE ORDNO = ?',parameters:['O1']});
 assert.ok(requests.at(-1)!.url.includes('McpQueryDatabase'));
 await assert.rejects(()=>adapter.invoke('execute_database_change',change),/read-only/);
 assert.ok(requests.every(r=>!r.url.includes('SaveCode')&&!r.url.includes('RunScript')));
});
