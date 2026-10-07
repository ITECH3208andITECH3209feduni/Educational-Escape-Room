const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
test('production dependency tree excludes mongoose and sift', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(__dirname,'../package-lock.json')));
  for (const [key,entry] of Object.entries(lock.packages)) {
    assert(!/(^|\/)node_modules\/(mongoose|sift)$/.test(key),key);
    assert(!entry.dependencies?.sift && !entry.dependencies?.mongoose,key);
  }
});
test('native driver API regression suite', {}, async t => {
  const database = require('../db/database');
  process.env.MONGO_DB_NAME = `fedescape_test_${Date.now()}_${process.pid}`;
  process.env.NODE_ENV = 'test';
  process.env.EMAIL_HOST = 'localhost';
  process.env.EMAIL_PORT = '25';
  process.env.EMAIL_FROM = 'test@example.invalid';
  process.env.CLIENT_URL = 'http://localhost:5500';
  const mails = [];
  const nodemailer = require('nodemailer');
  const originalTransport = nodemailer.createTransport;
  nodemailer.createTransport = () => ({ sendMail: async mail => { mails.push(mail); return { accepted: [mail.to] }; } });
  if (!process.env.TEST_MONGO_URI) {
    const db = require('./memory-database')();
    database.getDatabase = () => db;
    database.connect = async () => {};
    database.close = async () => {};
    database.health = async () => true;
    t.diagnostic('Using a test-only in-memory substitute, not a real MongoDB server.');
  } else {
    await database.connect(process.env.TEST_MONGO_URI);
  }
  const User = require('../models/User');
  const Room = require('../models/Room');
  const Attempt = require('../models/Attempt');
  for (const Model of [User,Room,Attempt]) await Model.ensureIndexes();
  const server = require('../server').listen(0,'127.0.0.1');
  await new Promise(resolve => server.once('listening',resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await database.getDatabase().dropDatabase();
    await database.close();
    nodemailer.createTransport = originalTransport;
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  async function request(method,url,body,session,status=200) {
    session = session || {};
    if (!['GET','HEAD'].includes(method) && !session.csrf) {
      const bootstrap = await fetch(base+'/auth/csrf');
      session.cookie = bootstrap.headers.get('set-cookie').split(';')[0];
      session.csrf = (await bootstrap.json()).csrfToken;
    }
    const response = await fetch(base+url,{method,headers:{'Content-Type':'application/json',
      ...(session.cookie ? {Cookie:session.cookie} : {}), ...(session.csrf ? {'X-CSRF-Token':session.csrf} : {})},
      body:body === undefined ? undefined : JSON.stringify(body)});
    const data = await response.json();
    assert.equal(response.status,status,`${method} ${url}: ${JSON.stringify(data)}`);
    if (response.headers.get('set-cookie')) session.cookie=response.headers.get('set-cookie').split(';')[0];
    if (data.csrfToken) session.csrf=data.csrfToken;
    data.session = session; // Test cookie jar only, never returned by production API.
    return data;
  }
  async function register(email,role) {
    await request('POST','/auth/register',{name:'Test Person',email,password:'Test-pass-123',role},null,201);
    await request('POST','/auth/login',{email,password:'Test-pass-123'},null,403);
    const token = mails.at(-1).text.match(/token=([a-f\d]+)/)[1];
    await request('GET',`/auth/verify-email/${token}`);
    await request('GET',`/auth/verify-email/${token}`,undefined,null,400);
    return request('POST','/auth/login',{email,password:'Test-pass-123'});
  }
  let student,otherStudent,educator,otherEducator,room,attempt;
  await t.test('registration, verification and login for both roles',async () => {
    student = await register('student@example.invalid','student');
    otherStudent = await register('otherstudent@example.invalid','student');
    educator = await register('educator@example.invalid','educator');
    otherEducator = await register('othereducator@example.invalid','educator');
    await request('POST','/auth/register',{name:'Duplicate',email:'student@example.invalid',password:'Test-pass-123'},null,409);
    await request('POST','/auth/register',{name:'Bad role',email:'admin@example.invalid',password:'Test-pass-123',role:'admin'},null,400);
    await request('GET','/auth/me',undefined,null,401);
  });
  await t.test('profile saves preserve hidden password and verification fields',async () => {
    const before = await User.collection().findOne({email:'student@example.invalid'});
    const res = await request('PATCH','/auth/profile',{name:'Updated Student',preferences:{theme:'dark'}},student.session);
    assert.equal(res.user.preferences.theme,'dark');
    for(const key of User.hidden) assert(!Object.hasOwn(res.user,key));
    const after = await User.collection().findOne({_id:before._id});
    assert.equal(before.password,after.password);
    assert.equal(after.emailVerified,true);
    await request('POST','/auth/login',{email:'student@example.invalid',password:'Test-pass-123'});
    await request('PATCH','/auth/change-password',{currentPassword:'Test-pass-123',newPassword:'Changed-pass-123'},student.session);
    student = await request('POST','/auth/login',{email:'student@example.invalid',password:'Changed-pass-123'});
  });
  await t.test('room validation, question IDs, publish and educator isolation',async () => {
    const res=await request('POST','/rooms',{name:'Migration room',description:'Test',time:20,questions:[{questionText:'One?',correctAnswer:'yes',points:10},{questionText:'Two?',questionType:'true-false',correctAnswer:'true',points:20}]},educator.session,201);
    room=res.room;
    assert.match(room.questions[0]._id,/^[a-f\d]{24}$/);
    assert.equal(room.questions[0].hint,'');
    await request('GET',`/rooms/${room._id}`,undefined,otherEducator.session,403);
    await request('PATCH',`/rooms/${room._id}`,{name:'Forbidden'},otherEducator.session,403);
    await request('PATCH',`/rooms/${room._id}`,{time:0},educator.session,400);
    await request('PATCH',`/rooms/${room._id}/publish`,{},educator.session);
    const list=await request('GET','/rooms');
    assert.equal(list.rooms[0].educator.name,'Test Person');
    assert(!Object.hasOwn(list.rooms[0].questions[0],'correctAnswer'));
    const mine=await request('GET','/rooms/educator/my-rooms',undefined,otherEducator.session);
    assert.equal(mine.count,0);
  });
  await t.test('attempt resume, answer scoring, duplicate protection and completion',async () => {
    attempt=(await request('POST',`/attempts/start/${room._id}`,{},student.session,201)).attempt;
    const resumed=(await request('POST',`/attempts/start/${room._id}`,{},student.session)).attempt;
    assert.equal(resumed._id,attempt._id);
    await request('GET',`/attempts/${attempt._id}`,undefined,otherStudent.session,403);
    const answer={questionId:room.questions[0]._id,answer:' YES ',hintUsed:true};
    const result=await request('PATCH',`/attempts/${attempt._id}/answer`,answer,student.session);
    assert.equal(result.result.score,10);assert.equal(result.result.progressPercentage,50);
    await request('PATCH',`/attempts/${attempt._id}/answer`,answer,student.session,409);
    await request('PATCH',`/attempts/${attempt._id}/answer`,{questionId:room.questions[1]._id,answer:'true'},student.session);
    await request('PATCH',`/attempts/${attempt._id}/complete`,{},student.session);
    const stored=await Attempt.findById(attempt._id);
    assert.equal(stored.score,30);assert.equal(stored.scorePercentage,100);assert.equal(stored.progressPercentage,100);
    assert.equal(stored.hintsUsed,1);assert.equal(stored.leaderboardEligible,true);assert(stored.completedAt instanceof Date);
  });
  await t.test('results, reference joins, leaderboard and room access checks',async () => {
    const results=await request('GET','/attempts/my-results',undefined,student.session);
    assert.equal(results.results[0].room.name,'Migration room');
    const other=await request('GET','/attempts/my-results',undefined,otherStudent.session);assert.equal(other.count,0);
    await request('GET',`/attempts/room/${room._id}/results`,undefined,educator.session);
    await request('GET',`/attempts/room/${room._id}/results`,undefined,otherEducator.session,403);
    const board=await request('GET',`/attempts/room/${room._id}/leaderboard`,undefined,student.session);
    assert(board.success);
    await request('PATCH',`/rooms/${room._id}/archive`,{},educator.session);
    await request('POST',`/attempts/start/${room._id}`,{},student.session,404);
    await request('DELETE',`/rooms/${room._id}`,undefined,educator.session);
    assert(await Attempt.findById(attempt._id));
  });
  await t.test('date casting for expiring tokens and validation are retained',async () => {
    const crypto=require('node:crypto');
    const token='test-reset-token';
    const user=await User.findById(student.user.id);
    user.passwordResetToken=crypto.createHash('sha256').update(token).digest('hex');
    user.passwordResetExpires=Date.now()+60000;await user.save();
    await request('POST',`/auth/reset-password/${token}`,{password:'Reset-pass-123'});
    await request('POST','/auth/login',{email:'student@example.invalid',password:'Reset-pass-123'});
    await assert.rejects(User.create({name:'Bad',email:'invalid',password:'hash123'}),/email/);
    await assert.rejects(Room.create({name:'Bad',description:'Bad',educator:educator.user.id,time:5,availableFrom:'2026-10-06',availableUntil:'2026-10-05'}),/end date/);
    assert.throws(() => User.findOne({email:{$ne:{}}}),/string/);
  });
  await t.test('existing BSON records and optimistic updates work',async () => {
    const a=await User.findById(student.user.id),b=await User.findById(student.user.id);
    a.name='First update';await a.save();b.name='Stale update';await assert.rejects(b.save(),/changed/);
    const { ObjectId } = require('mongodb');
    const id = new ObjectId();
    await User.collection().insertOne({_id:id,name:'Legacy User',email:'legacy@example.invalid',password:'preserved-hash',emailVerified:true,role:'student'});
    const legacy=await User.findById(String(id));
    assert.equal(legacy.accountStatus,'active');assert.equal(legacy.preferences.theme,'light');
    legacy.name='Legacy Updated';await legacy.save();
    assert.equal((await User.collection().findOne({_id:id})).password,'preserved-hash');
    await assert.rejects(User.create({name:'Duplicate',email:'legacy@example.invalid',password:'hash123'}), /duplicate key/);
    const health=await request('GET','/health');assert.equal(health.database,'connected');
  });
});
