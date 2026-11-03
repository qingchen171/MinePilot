import { expect, it } from 'vitest';
import { createProductionStage4Session } from '../../src/systems/persistence/production-stage4-runtime';
import { createPresentationRoot } from '../../src/presentation-root';
import { MemoryStorage } from '../helpers/memory-storage';
import { WRITER_LEASE_STORAGE_KEY } from '../../src/systems/persistence/writer-lease';
import { SNAPSHOT_STORAGE_KEYS } from '../../src/systems/persistence/crash-safe-snapshot-store';

const identity={sessionId:'original',leaseToken:'original-token'};
const other={sessionId:'next',leaseToken:'next-token'};
const technical={nextRunId:()=> 'dispose-run',nextGenerationSeed:()=>17,nextDetectionSeed:()=>9};
function fixture(){ const storage=new MemoryStorage();let now=100;const clock={nowMs:()=>now};
  const session=createProductionStage4Session(storage,identity,clock);const root=createPresentationRoot(session,technical);
  expect(root.submit({kind:'start',levelId:'level-001'}).status).toBe('committed');
  return {storage,session,root,clock,expire:()=>{now+=30001}};
}
it('disposal closes old commands and releases only the owner without changing saved authority',()=>{
 const f=fixture();const head=f.storage.read(SNAPSHOT_STORAGE_KEYS.head);
 expect(f.session.dispose().status).toBe('released');
 expect(f.storage.read(SNAPSHOT_STORAGE_KEYS.head)).toEqual(head);
 expect(f.root.submit({kind:'flag',flagged:true,coordinate:{x:8,y:8}})).toMatchObject({status:'rejected',reason:'invalid-request'});
 const next=createPresentationRoot(createProductionStage4Session(f.storage,other,f.clock),technical);
 expect(next.submit({kind:'flag',flagged:true,coordinate:{x:8,y:8}}).status).toBe('committed');
 const lease=f.storage.read(WRITER_LEASE_STORAGE_KEY);f.session.dispose();
 expect(f.storage.read(WRITER_LEASE_STORAGE_KEY)).toEqual(lease);
});
it('a missing unload keeps the foreign lease until real expiry, without stolen authority',()=>{
 const f=fixture();const next=createPresentationRoot(createProductionStage4Session(f.storage,other,f.clock),technical);
 expect(next.submit({kind:'flag',flagged:true,coordinate:{x:8,y:8}})).toMatchObject({status:'rejected',reason:'owned-by-another-session'});
 f.expire();next.reload();expect(next.submit({kind:'flag',flagged:true,coordinate:{x:8,y:8}}).status).toBe('committed');
 const lease=f.storage.read(WRITER_LEASE_STORAGE_KEY);expect(f.session.dispose().status).toBe('not-owner');
 expect(f.storage.read(WRITER_LEASE_STORAGE_KEY)).toEqual(lease);
});
it('failed owner release preserves saved data and lease; fallback remains expiry and explicit action',()=>{
 const f=fixture();const head=f.storage.read(SNAPSHOT_STORAGE_KEYS.head);const lease=f.storage.read(WRITER_LEASE_STORAGE_KEY);
 f.storage.failNext('remove',WRITER_LEASE_STORAGE_KEY);expect(f.session.dispose().status).toBe('storage-failure');
 expect(f.storage.read(SNAPSHOT_STORAGE_KEYS.head)).toEqual(head);expect(f.storage.read(WRITER_LEASE_STORAGE_KEY)).toEqual(lease);
 const next=createPresentationRoot(createProductionStage4Session(f.storage,other,f.clock),technical);
 expect(next.submit({kind:'flag',flagged:true,coordinate:{x:8,y:8}})).toMatchObject({status:'rejected',reason:'owned-by-another-session'});
 f.expire();next.reload();expect(next.submit({kind:'flag',flagged:true,coordinate:{x:8,y:8}}).status).toBe('committed');
});
it('uncertain commit followed by disposal and reopen never replays the former operation',()=>{
 const f=fixture();f.storage.failNext('write',SNAPSHOT_STORAGE_KEYS.head);
 const outcome=f.root.submit({kind:'flag',flagged:true,coordinate:{x:8,y:8}});
 expect(outcome).toMatchObject({status:'rejected',reason:'commit-commit-outcome-uncertain'});
 expect(f.root.retryRetained()).toMatchObject({status:'unavailable'});
 const head=f.storage.read(SNAPSHOT_STORAGE_KEYS.head);f.session.dispose();
 expect(f.storage.read(SNAPSHOT_STORAGE_KEYS.head)).toEqual(head);
 const next=createPresentationRoot(createProductionStage4Session(f.storage,other,f.clock),technical);
 expect(next.retryRetained()).toMatchObject({status:'unavailable'});
 expect(f.storage.read(SNAPSHOT_STORAGE_KEYS.head)).toEqual(head);
});
it('an actual persisted new head followed by reported storage failure reopens once without replay',()=>{
 const f=fixture();const original=f.storage.write.bind(f.storage);let fail=true;
 f.storage.write=(key,value)=>{
   const result=original(key,value);
   if(fail&&key===SNAPSHOT_STORAGE_KEYS.head){fail=false;return {status:'failure',operation:'write',reason:'exception',key,cause:new Error('after-write failure')};}
   return result;
 };
 expect(f.root.submit({kind:'flag',flagged:true,coordinate:{x:8,y:8}})).toMatchObject({status:'rejected',reason:'commit-commit-outcome-uncertain'});
 const head=f.storage.read(SNAPSHOT_STORAGE_KEYS.head);f.session.dispose();
 const next=createPresentationRoot(createProductionStage4Session(f.storage,other,f.clock),technical);
 expect(next.read()).toMatchObject({status:'loaded'});
 const snapshot=next.read();
 if(snapshot.status==='recovery')throw Error('committed authority must recover');
 expect(snapshot.view.attempt?.board.cells[80]).toBe('flagged');
 expect(next.retryRetained()).toMatchObject({status:'unavailable'});
 expect(f.storage.read(SNAPSHOT_STORAGE_KEYS.head)).toEqual(head);
});
