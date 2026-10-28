import test from 'node:test';
import assert from 'node:assert/strict';
import type { RequestEvent } from '@sveltejs/kit';
import { createHeroEnquiry } from './server/hero-enquiry';
import { validateHeroEnquiry } from './hero-enquiry';

function event(fields:Record<string,string>) {
 const body=new FormData();
 for(const [key,value] of Object.entries(fields))body.set(key,value);
 return {request:new Request('http://localhost/?/heroEnquire',{method:'POST',body}),url:new URL('http://localhost/?/heroEnquire')} as RequestEvent;
}
const valid={full_name:' Test Traveller ',email:' traveller@example.com ',details:'',idempotency_key:'hero-test-123'};
test('invalid hero enquiry never reaches the bookings API',async()=>{
 let calls=0;
 const result=await createHeroEnquiry(async()=>{calls++;})(event({full_name:'x',email:'invalid',details:''}));
 assert.ok('status' in result);assert.equal(result.status,400);assert.equal(calls,0);
 assert.ok(result.data.errors.full_name);assert.ok(result.data.errors.email);
});
test('hero enquiry forwards a trimmed lead and idempotency key without inventing travel details',async()=>{
 let captured:Record<string,unknown>={};
 const result=await createHeroEnquiry(async payload=>{captured=payload;})(event(valid));
 assert.ok('success' in result && result.success);
 assert.equal(captured.full_name,'Test Traveller');assert.equal(captured.email,'traveller@example.com');
 assert.equal(captured.idempotency_key,'hero-test-123');assert.equal(captured.source,'homepage_trip_planner');
 assert.equal(captured.number_of_adults,undefined);assert.equal(captured.travel_date,undefined);
 assert.match(String(captured.message),/not yet specified/);
 assert.equal((captured.lead_context as any).answers.party_size_unconfirmed,true);
});
test('honeypot rejects even otherwise valid submissions',async()=>{
 let called=false;
 const result=await createHeroEnquiry(async()=>{called=true;})(event({...valid,website:'spam.example'}));
 assert.ok('status' in result && result.status===400);assert.equal(called,false);
});
test('API failures retain visitor details and distinguish rate limits',async()=>{
 for(const status of [429,503]){
  const result=await createHeroEnquiry(async()=>{throw {status};})(event({...valid,details:'Five days with my family'}));
  assert.ok('status' in result);assert.equal(result.status,status);
  assert.equal(result.data.values?.details,'Five days with my family');assert.equal(result.data.success,false);
 }
});
test('optional details have a server-side length limit',()=>{
 assert.equal(validateHeroEnquiry({full_name:'Traveller',email:'guest@example.com',details:''}).details,undefined);
 assert.ok(validateHeroEnquiry({full_name:'Traveller',email:'guest@example.com',details:'x'.repeat(2001)}).details);
});
