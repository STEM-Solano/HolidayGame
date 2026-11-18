import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import worker from './worker/index.js';

const sqlite = new DatabaseSync(':memory:');
sqlite.exec(readFileSync(new URL('./drizzle/0000_rooms.sql',import.meta.url),'utf8'));
const DB = {prepare(sql){
  const stmt = sqlite.prepare(sql);
  return {bind(...args){return {
    first:()=>stmt.get(...args),
    run:()=>({meta:{changes:stmt.run(...args).changes}})
  };}};
}};
const option = name => process.argv.includes(name) ? process.argv[process.argv.indexOf(name)+1] : undefined;
const port = Number(option('--port') || process.env.PORT || 3000);
createServer(async (incoming,outgoing)=>{
  try {
    const headers=new Headers(incoming.headers);
    const chunks=[];
    for await(const chunk of incoming) chunks.push(chunk);
    const request=new Request('http://localhost'+incoming.url,{
      method:incoming.method, headers,
      body:chunks.length?Buffer.concat(chunks):undefined
    });
    const response=await worker.fetch(request,{DB});
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end('Game server request failed.');
  }
}).listen(port,option('--host') || '0.0.0.0',()=>console.log('Crowd Score listening on port '+port));
