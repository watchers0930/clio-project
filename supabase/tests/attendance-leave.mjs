// Run with PGLITE_MODULE_PATH pointing to an installed @electric-sql/pglite entry.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.PGLITE_MODULE_PATH || '@electric-sql/pglite');
const db = new PGlite();
const user = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const boss = '00000000-0000-4000-8000-000000000003';
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table users(id uuid primary key,role text default 'user',hire_date date,is_active boolean default true,signature_path text,rank_level int);
create table templates(id uuid primary key,name text);
create table documents(id uuid primary key default gen_random_uuid(),created_by uuid references users(id),template_id uuid references templates(id),title text,content text,status text);
create table audit_logs(id uuid primary key default gen_random_uuid(),user_id uuid,action text,target_type text,target_id uuid,details jsonb);
`);
await db.exec(await readFile(new URL('../migrations/040_approval_workflow.sql',import.meta.url),'utf8'));
for (const file of ['045_attendance_leave','046_leave_policy','047_leave_workflow','048_leave_approval_commands','049_attendance_heartbeat_version']) {
  await db.exec(await readFile(new URL(`../migrations/${file}.sql`,import.meta.url),'utf8'));
}
await db.query('insert into users(id,hire_date,rank_level) values($1,\'2020-01-01\',5),($2,\'2020-01-01\',5),($3,\'2020-01-01\',2)',[user,other,boss]);
await db.exec('insert into leave_calendar_years select y,true from generate_series(1900,2199) y');
const scalar = async(sql,args=[]) => (await db.query(sql,args)).rows[0].result;
const call = async(name,args) => scalar(`select to_jsonb(${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as result`,args);
let checks=0;
async function rejects(run,code) { await assert.rejects(run,e=>e.code===code); checks++; }
for (const [hire,asof,expected] of [
  ['2025-01-15','2025-02-14',0],['2025-01-15','2025-02-15',1],
  ['2025-01-15','2026-01-14',11],['2025-01-15','2026-01-15',15],
  ['2024-02-29','2025-02-28',15],['2000-01-01','2021-01-01',25],
  ['1990-01-01','1992-01-01',15],['1990-01-01','1993-01-01',16],
  ['1990-01-01','1994-01-01',16],['1990-01-01','1995-01-01',17],
  ['1990-01-01','2020-01-01',25],
]) {
  await db.query('update users set hire_date=$2 where id=$1',[other,hire]);
  assert.equal((await call('leave_balance',[other,asof])).totalGranted,expected);checks++;
}
assert.equal(await scalar("select leave_anniversary('2025-01-31',1)::text as result"),'2025-02-28');checks++;
// Policy edge cases execute the sole SQL implementation; isolate fixture history.
await db.exec('begin');
await db.exec("insert into leave_calendar values('2026-10-13','공휴일'),('2026-10-14','회사휴무')");
assert.deepEqual((await db.query("select day::text from leave_workdays('2026-10-12','2026-10-18')")).rows.map(r=>r.day), ['2026-10-12','2026-10-15','2026-10-16']); checks++;
await db.query("update users set hire_date='2020-01-15' where id=$1",[other]);
await db.query(`insert into leave_requests(user_id,leave_type,start_date,end_date,requested_days,deduct_days,status,policy_version,idempotency_key)
 values($1,'annual','2026-01-14','2026-01-16',3,3,'approved','anniversary-v1','cross-anniversary')`,[other]);
const split=await call('leave_balance',[other,'2026-01-15']);
assert.equal(split.totalGranted,17); assert.equal(split.totalDeducted,2); assert.equal(split.remainingDays,15); checks++;
await db.query('delete from leave_requests where user_id=$1',[other]);
await db.query("update users set hire_date='2025-01-15' where id=$1",[other]);
await db.query(`insert into leave_requests(user_id,leave_type,start_date,end_date,requested_days,deduct_days,status,policy_version,idempotency_key)
 values($1,'annual','2025-03-03','2025-03-03',1,1,'pending','anniversary-v1','no-advance')`,[other]);
const shortage=await call('leave_balance',[other,'2025-01-16']);
assert.equal(shortage.totalGranted,0); assert.equal(shortage.requestableDays,-1); checks++;
await db.query("update users set hire_date='2027-01-01' where id=$1",[other]);
assert.equal((await call('leave_balance',[other,'2026-01-01'])).reason,'future_hire_date'); checks++;
await db.exec('rollback');
const today=await scalar("select (now() at time zone 'Asia/Seoul')::date::text as result");
let hb=await call('attendance_heartbeat',[user]);
assert.equal(hb.heartbeat_count,1); assert.equal(hb.version,0); checks++;
const modalVersion=hb.version;
hb=await call('attendance_heartbeat',[user]);
assert.equal(hb.heartbeat_count,2); assert.equal(hb.version,modalVersion); checks++;
const date=hb.work_date;
const timestamp=`${date}T09:00:00+09:00`;
const corrected=await call('attendance_correct',[user,date,JSON.stringify({mode:'correct',checkInAt:timestamp,reason:'출근 보정',version:hb.version})]);
assert.equal(corrected.heartbeat_count,2); assert.ok(corrected.manual_check_in_at); checks++;
await rejects(()=>call('attendance_correct',[user,date,JSON.stringify({mode:'restore',reason:'복원',version:hb.version})]),'P0001');
await db.exec("create function reject_audit() returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end; $$; create trigger fail_audit before insert on audit_logs for each row execute function reject_audit()");
await rejects(()=>call('attendance_correct',[user,date,JSON.stringify({mode:'restore',reason:'복원',version:corrected.version})]),'P0001');
assert.equal(await scalar('select version as result from attendance_records where user_id=$1',[user]),corrected.version);checks++;
await db.exec('drop trigger fail_audit on audit_logs');
const restored=await call('attendance_correct',[user,date,JSON.stringify({mode:'restore',reason:'복원',version:corrected.version})]);
assert.equal(restored.manual_check_in_at,null);checks++;
const afterRestore=await call('attendance_heartbeat',[user]);
assert.equal(afterRestore.version,restored.version);checks++;
for(let i=0;i<27;i++) await call('attendance_heartbeat',[user]);
await rejects(()=>call('attendance_heartbeat',[user]),'54000');
let balance=await call('leave_balance',[user,today]);
assert.equal(balance.computable,true);assert.ok(balance.totalGranted>=15);checks++;
await db.query('update users set hire_date=null where id=$1',[other]);
assert.equal((await call('leave_balance',[other,today])).reason,'no_hire_date');checks++;
// Pick two upcoming workdays that do not cross the grant's expiration.
const days=(await db.query("select day::text from leave_workdays($1::date,($1::date+20)) limit 2",[today])).rows.map(r=>r.day);
const docInputs={leave_start_date:days[0],leave_end_date:days[0],leave_type:'half_day',half_day_slot:'am'};
const doc=await scalar('insert into documents(created_by,title,content) values($1,\'휴가원\',$2) returning id as result',[user,`<!--DOCUMENT_INPUTS:${JSON.stringify(docInputs)}-->`]);
const body={leaveType:'half_day',startDate:days[0],endDate:days[0],halfDaySlot:'am',idempotencyKey:'first',documentId:doc};
const leave=await call('leave_write',[user,null,JSON.stringify(body)]);
assert.equal(Number(leave.deduct_days),0.5);checks++;
assert.equal((await call('leave_write',[user,null,JSON.stringify(body)])).id,leave.id);checks++;
await rejects(()=>call('leave_write',[other,leave.id,JSON.stringify({action:'update',reason:'tamper'})]),'P0002');
const line=[{step_order:1,approver_id:user,rank_title:'담당'},{step_order:2,approver_id:boss,rank_title:'대표'}];
const submitted=await call('leave_submit',[user,doc,JSON.stringify(line)]);
balance=await call('leave_balance',[user,today]);
assert.equal(balance.reservedDays,0.5);assert.equal(balance.totalDeducted,0);checks++;
await rejects(()=>call('leave_write',[user,leave.id,JSON.stringify({action:'update',reason:'locked'})]),'P0001');
await rejects(()=>call('leave_write',[user,null,JSON.stringify({...body,documentId:undefined,idempotencyKey:'overlap'})]),'P0001');
const pm=await call('leave_write',[user,null,JSON.stringify({...body,documentId:undefined,idempotencyKey:'pm',halfDaySlot:'pm'})]);
assert.equal(pm.half_day_slot,'pm');checks++;
await rejects(()=>call('leave_decide',[other,submitted.requestId,'approve','']),'42501');
await call('leave_decide',[boss,submitted.requestId,'delegate','']);
balance=await call('leave_balance',[user,today]);
assert.equal(balance.totalDeducted,0.5);assert.equal(balance.reservedDays,0);checks++;
assert.equal(await scalar('select status as result from leave_requests where id=$1',[leave.id]),'approved');checks++;
await rejects(()=>call('leave_decide',[boss,submitted.requestId,'approve','']),'P0001');
await rejects(()=>db.query('delete from documents where id=$1',[doc]),'23001');
await rejects(()=>db.query('delete from approval_requests where id=$1',[submitted.requestId]),'23001');
await rejects(()=>db.query('update documents set content=\'tampered\' where id=$1',[doc]),'P0001');
// Reject, resubmit and preserve every approval reference.
const reInputs={leave_start_date:days[1],leave_end_date:days[1],leave_type:'annual'};
const reDoc=await scalar('insert into documents(created_by,title,content) values($1,\'휴가원\',$2) returning id as result',[user,`<!--DOCUMENT_INPUTS:${JSON.stringify(reInputs)}-->`]);
const reLeave=await call('leave_write',[user,null,JSON.stringify({leaveType:'annual',startDate:days[1],endDate:days[1],idempotencyKey:'resubmit',documentId:reDoc})]);
// Mutated draft document cannot be submitted against stale structured leave.
await db.query('update documents set content=$2 where id=$1',[reDoc,`<!--DOCUMENT_INPUTS:${JSON.stringify({...reInputs,leave_start_date:days[0]})}-->`]);
await rejects(()=>call('leave_submit',[user,reDoc,JSON.stringify(line)]),'P0001');
assert.equal(await scalar('select status as result from leave_requests where id=$1',[reLeave.id]),'draft');checks++;
await db.query('update documents set content=$2 where id=$1',[reDoc,`<!--DOCUMENT_INPUTS:${JSON.stringify(reInputs)}-->`]);
const firstSubmit=await call('leave_submit',[user,reDoc,JSON.stringify(line)]);
await call('leave_decide',[boss,firstSubmit.requestId,'reject','']);
const secondSubmit=await call('leave_submit',[user,reDoc,JSON.stringify(line)]);
assert.notEqual(firstSubmit.requestId,secondSubmit.requestId);checks++;
assert.equal(await scalar('select count(*)::int as result from leave_approval_history where leave_id=$1',[reLeave.id]),2);checks++;
await rejects(()=>db.query('delete from approval_requests where id=$1',[firstSubmit.requestId]),'23001');
// Final approval must revalidate balance; step and leave changes roll back on failure.
await db.query('update users set hire_date=$2 where id=$1',[user,today]);
await rejects(()=>call('leave_decide',[boss,secondSubmit.requestId,'approve','']),'P0001');
assert.equal(await scalar('select status as result from approval_steps where request_id=$1 and step_order=2',[secondSubmit.requestId]),'waiting');checks++;
assert.equal(await scalar('select status as result from leave_requests where id=$1',[reLeave.id]),'pending');checks++;
await db.query("update users set hire_date='2020-01-01' where id=$1",[user]);
// RLS: even with table grants, authenticated cannot bypass API writes.
await db.exec('grant usage on schema public to authenticated; grant select on users to authenticated; grant select,insert,update,delete on attendance_records,leave_requests to authenticated; set role authenticated');
await rejects(()=>db.query('insert into attendance_records(user_id,work_date) values($1,$2)',[other,today]),'42501');
await rejects(()=>call('attendance_heartbeat',[user]),'42501');
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);
assert.equal(await scalar('select count(*)::int as result from attendance_records'),0);checks++;
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
assert.equal(await scalar('select count(*)::int as result from attendance_records'),1);checks++;
await db.exec('reset role');
await db.query('update leave_calendar_years set verified=false where year=extract(year from $1::date)',[today]);
await rejects(()=>call('leave_balance',[user,today]),'55000');
console.log(`PASS: ${checks} database contract, transaction, security and policy checks`);
await db.close();
