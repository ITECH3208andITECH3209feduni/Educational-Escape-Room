// Test-only substitute. This does not prove compatibility with a live server.
const { BSON, ObjectId } = require('mongodb');
const clone = value => BSON.deserialize(BSON.serialize({ value })).value;
const key = value => value instanceof ObjectId ? value.toHexString() : value instanceof Date ? value.getTime() : value;
function equal(a,b) {
  if (a == null || b == null) return a == null && b == null;
  if ((a instanceof Date) !== (b instanceof Date)) return false;
  if ((a instanceof ObjectId) !== (b instanceof ObjectId)) return false;
  return key(a) === key(b);
}
function matches(row,filter) {
  return Object.entries(filter).every(([field,value]) => {
    if (field === '$and') return value.every(v=>matches(row,v));
    if (field === '$or') return value.some(v=>matches(row,v));
    if (field === '$nor') return !value.some(v=>matches(row,v));
    const actual=row[field];
    if (value && typeof value==='object' && !(value instanceof ObjectId) && !(value instanceof Date)) {
      return Object.entries(value).every(([op,v])=>{
        if(op==='$exists') return Object.hasOwn(row,field)===v;
        if(op==='$in')return v.some(x=>equal(actual,x));
        if(op==='$nin')return !v.some(x=>equal(actual,x));
        if(op==='$eq')return equal(actual,v);
        if(op==='$ne')return !equal(actual,v);
        if((actual instanceof Date)!==(v instanceof Date)) return false;
        const a=key(actual),b=key(v);
        return op==='$gt'?a>b:op==='$gte'?a>=b:op==='$lt'?a<b:op==='$lte'?a<=b:false;
      });
    }
    return equal(actual,value);
  });
}
function project(row,projection={}) {
  const positive=Object.keys(projection).filter(k=>projection[k]===1);
  if(positive.length) return clone(Object.fromEntries(Object.entries(row).filter(([k])=>k==='_id'||positive.includes(k))));
  return clone(Object.fromEntries(Object.entries(row).filter(([k])=>projection[k]!==0)));
}
module.exports = function memoryDatabase() {
 const collections=new Map();
 return {
  command: async()=>({ok:1}), dropDatabase:async()=>collections.clear(),
  collection(name) {
   if(collections.has(name))return collections.get(name);
   const rows=[];const unique=new Set();
   function check(row,ignore) { for(const k of unique) if(rows.some(r=>r!==ignore&&equal(r[k],row[k]))) {const e=new Error('duplicate key');e.code=11000;throw e;} }
   const api={
    createIndex:async(fields,opts={})=>{if(opts.unique)for(const k of Object.keys(fields))unique.add(k);return 'test_index';},
    insertOne:async row=>{check(row);rows.push(clone(row));return {insertedId:row._id};},
    find(filter={},opts={}) {
      const found=rows.filter(r=>matches(r,filter));
      if(opts.sort)found.sort((a,b)=>{for(const [k,d]of Object.entries(opts.sort)){if(key(a[k])<key(b[k]))return -d;if(key(a[k])>key(b[k]))return d;}return 0;});
      return {toArray:async()=>found.map(r=>project(r,opts.projection))};
    },
    async findOne(filter={},opts={}) { return (await api.find(filter,opts).toArray())[0]||null; },
    countDocuments:async filter=>rows.filter(r=>matches(r,filter)).length,
    findOneAndDelete:async filter=>{const i=rows.findIndex(r=>matches(r,filter));return i<0?null:rows.splice(i,1)[0];},
    updateOne:async(filter,update)=>{
      const row=rows.find(r=>matches(r,filter));if(!row)return {matchedCount:0};
      const next={...row,...clone(update.$set||{})};
      for(const [k,v]of Object.entries(update.$inc||{})) next[k]=(next[k]||0)+v;
      for(const k of Object.keys(update.$unset||{}))delete next[k];check(next,row);
      for(const k of Object.keys(row))delete row[k];Object.assign(row,next);return {matchedCount:1};
    }
   };collections.set(name,api);return api;
  }
 };
};
