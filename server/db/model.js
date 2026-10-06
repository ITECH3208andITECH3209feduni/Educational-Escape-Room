// FEDEscape's small persistence layer over the official MongoDB driver.
// Supports only the operations used by this application; not a general ODM.
const { ObjectId } = require('mongodb');
const { isDeepStrictEqual } = require('node:util');
const { getDatabase } = require('./database');
const models = new Map();
const state = new WeakMap();
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function copy(value) {
  if (value instanceof ObjectId) return new ObjectId(value.toHexString());
  if (value instanceof Date) return new Date(value);
  if (Array.isArray(value)) return value.map(copy);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,copy(v)]));
  return value;
}
function defineSchema(fields, options = {}) {
  return { fields, options, indexes: [], hooks: {}, methods: {},
    index(keys, options = {}) { this.indexes.push({ keys, options }); },
    pre(event, fn) { this.hooks[event] = fn; }
  };
}
function fail(path, message) {
  const error = new Error(`${path}: ${message}`);
  error.name = 'ValidationError'; throw error;
}
function cast(value, spec, path, validate = true) {
  if (value === undefined || value === null) {
    if (validate && spec.required) fail(path, Array.isArray(spec.required) ? spec.required[1] : 'is required');
    return value;
  }
  const type = spec.type;
  if (Array.isArray(type)) {
    if (!Array.isArray(value)) fail(path, 'must be an array');
    const item = type[0];
    return value.map((v,i) => item.fields ? normalize(v, item, `${path}.${i}`, false) : cast(v, { type: item }, `${path}.${i}`, validate));
  }
  if (type === ObjectId) {
    if (value instanceof ObjectId) return value;
    if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail(path, 'must be a valid ObjectId');
    return new ObjectId(value);
  }
  if (type === String) {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') fail(path, 'must be a string');
    value = String(value);
    if (spec.trim) value = value.trim();
    if (spec.lowercase) value = value.toLowerCase();
    if (validate && spec.required && !value) fail(path, 'is required');
    if (validate && spec.minlength !== undefined && value.length < spec.minlength) fail(path, `minimum length is ${spec.minlength}`);
    if (validate && spec.maxlength !== undefined && value.length > spec.maxlength) fail(path, `maximum length is ${spec.maxlength}`);
    if (validate && spec.match && !spec.match[0].test(value)) fail(path, spec.match[1]);
  } else if (type === Number) {
    if (!['number', 'string'].includes(typeof value) || value === '') fail(path, 'must be a number');
    value = Number(value);
    if (!Number.isFinite(value)) fail(path, 'must be a finite number');
    if (validate && spec.min !== undefined && value < spec.min) fail(path, `minimum is ${spec.min}`);
    if (validate && spec.max !== undefined && value > spec.max) fail(path, `maximum is ${spec.max}`);
  } else if (type === Boolean) {
    if ([true, 1, 'true', '1', 'yes'].includes(value)) value = true;
    else if ([false, 0, 'false', '0', 'no'].includes(value)) value = false;
    else fail(path, 'must be a boolean');
  } else if (type === Date) {
    value = new Date(value);
    if (!Number.isFinite(value.getTime())) fail(path, 'must be a valid date');
  }
  if (validate && spec.enum && !spec.enum.includes(value)) fail(path, `must be one of ${spec.enum.join(', ')}`);
  return value;
}
function normalize(input, schema, prefix = '', partial = false) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(prefix, 'must be an object');
  const output = {};
  if (schema.options._id !== false) output._id = input._id ? cast(input._id, { type: ObjectId }, '_id') : new ObjectId();
  for (const [key, raw] of Object.entries(schema.fields)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (partial && !own(input,key)) continue;
    const spec = typeof raw === 'function' ? { type: raw } : raw;
    if (!own(spec,'type')) {
      output[key] = normalize(input[key] ?? {}, { fields: spec, options: { _id: false } }, path, false);
      continue;
    }
    let value = input[key];
    if (value === undefined && own(spec,'default')) value = typeof spec.default === 'function' ? spec.default() : copy(spec.default);
    value = cast(value, spec, path);
    if (value !== undefined) output[key] = value;
  }
  for (const key of ['createdAt','updatedAt','__v']) if (own(input,key)) output[key] = copy(input[key]);
  return output;
}
function castFilter(filter, schema) {
  const result = {};
  for (const [key,value] of Object.entries(filter)) {
    if (['$and','$or','$nor'].includes(key)) { result[key] = value.map(v => castFilter(v,schema)); continue; }
    const spec = key === '_id' ? { type: ObjectId } : schema.fields[key];
    if (!spec || !spec.type) throw new Error(`Unsupported filter field: ${key}`);
    if (value && typeof value === 'object' && !(value instanceof ObjectId) && !(value instanceof Date)) {
      const operators = {};
      for (const [op,v] of Object.entries(value)) {
        if (!['$eq','$ne','$gt','$gte','$lt','$lte','$in','$nin','$exists'].includes(op)) throw new Error(`Unsupported query operator: ${op}`);
        operators[op] = op === '$exists' ? Boolean(v) : Array.isArray(v) ? v.map(x => cast(x,spec,key,false)) : cast(v,spec,key,false);
      }
      result[key] = operators;
    } else result[key] = cast(value,spec,key,false);
  }
  return result;
}
function createModel(name, schema) {
  const collectionName = { User: 'users', Room: 'rooms', Attempt: 'attempts' }[name];
  const collection = () => getDatabase().collection(collectionName);
  const hidden = Object.keys(schema.fields).filter(k => schema.fields[k].select === false);
  function hydrate(data, isNew = false) {
    if (!data) return null;
    const values = copy(data);
    // Preserve defaults on legacy records without loading hidden credentials.
    function defaults(target, fields) {
      for (const [key, spec] of Object.entries(fields)) {
        if (spec.select === false) continue;
        if (!own(spec, 'type')) {
          if (target[key] === undefined) target[key] = {};
          if (target[key] && typeof target[key] === 'object') defaults(target[key], spec);
        } else if (target[key] === undefined && own(spec, 'default')) {
          target[key] = cast(typeof spec.default === 'function' ? spec.default() : copy(spec.default), spec, key, false);
        }
      }
    }
    if (!isNew) defaults(values, schema.fields);
    const doc = Object.assign(Object.create(Document.prototype), values);
    state.set(doc, { original: copy(data), isNew, populated: false });
    return doc;
  }
  class Document {
    toObject() { return copy(this); }
    toJSON() {
      const obj = this.toObject();
      for (const key of hidden) delete obj[key];
      return obj;
    }
    async save() {
      const meta = state.get(this);
      if (meta.populated) throw new Error('Save an unpopulated document to preserve reference IDs');
      const data = normalize(this,schema,'',!meta.isNew);
      if (schema.hooks.validate) schema.hooks.validate.call(data);
      if (schema.hooks.save) schema.hooks.save.call(data);
      // Validate computed values as well as user-supplied values.
      const checked = normalize(data,schema,'',!meta.isNew);
      const now = new Date();
      if (schema.options.timestamps) {
        if (meta.isNew) checked.createdAt = now;
        checked.updatedAt = now;
      }
      if (meta.isNew) {
        checked.__v = 0;
        await collection().insertOne(copy(checked));
      } else {
        const changes = {};
        const removed = {};
        for (const [k,v] of Object.entries(checked)) if (!['_id','__v'].includes(k) && !isDeepStrictEqual(v,meta.original[k])) changes[k] = v;
        for (const k of Object.keys(meta.original)) if (own(schema.fields,k) && !own(checked,k)) removed[k] = '';
        const version = meta.original.__v;
        const filter = { _id: this._id, __v: version === undefined ? { $exists: false } : version };
        const update = { $set: changes, $inc: { __v: 1 } };
        if (Object.keys(removed).length) update.$unset = removed;
        const result = await collection().updateOne(filter, update);
        if (!result.matchedCount) {
          const error = new Error('Record changed in another request. Reload and try again.');
          error.status = 409; throw error;
        }
        checked.__v = (version || 0) + 1;
      }
      for (const key of Object.keys(this)) delete this[key];
      Object.assign(this, checked);
      meta.original = copy(checked); meta.isNew = false;
      return this;
    }
  }
  class Query {
    constructor(filter, single) { this.filter = castFilter(filter,schema); this.single = single; this.joins = []; this.extra = new Set(); }
    sort(value) { this.order = value; return this; }
    select(value) {
      for (const field of value.split(/\s+/).filter(Boolean)) {
        if (!field.startsWith('+') || !hidden.includes(field.slice(1))) throw new Error('Only explicit hidden-field selection is supported');
        this.extra.add(field.slice(1));
      }
      return this;
    }
    populate(field, fields) { this.joins.push({field,fields}); return this; }
    then(resolve,reject) { return this.exec().then(resolve,reject); }
    async exec() {
      const projection = Object.fromEntries(hidden.filter(k => !this.extra.has(k)).map(k => [k,0]));
      const options = { projection };
      if (this.order) options.sort = this.order;
      const rows = this.single ? [await collection().findOne(this.filter,options)].filter(Boolean) : await collection().find(this.filter,options).toArray();
      const docs = rows.map(row => hydrate(row));
      for (const {field,fields} of this.joins) {
        const ref = models.get(schema.fields[field]?.ref);
        if (!ref) throw new Error(`Unknown reference: ${field}`);
        const ids = [...new Map(docs.filter(d => d[field]).map(d => [String(d[field]),d[field]])).values()];
        const projection = Object.fromEntries(fields.split(/\s+/).filter(Boolean).map(k => [k,1]));
        // Never populate credentials, regardless of requested fields.
        for (const key of ref.hidden) delete projection[key];
        if (!Object.keys(projection).length) projection._id = 1;
        const related = ids.length ? await ref.collection().find({ _id: { $in: ids } },{ projection }).toArray() : [];
        const map = new Map(related.map(row => [String(row._id),row]));
        for (const doc of docs) { doc[field] = copy(map.get(String(doc[field])) || null); state.get(doc).populated = true; }
      }
      return this.single ? docs[0] || null : docs;
    }
  }
  const Model = {
    collection, hidden,
    find: (filter = {}) => new Query(filter,false),
    findOne: (filter = {}) => new Query(filter,true),
    findById: id => new Query({ _id: id },true),
    countDocuments: filter => collection().countDocuments(castFilter(filter,schema)),
    findByIdAndDelete: id => collection().findOneAndDelete(castFilter({ _id: id },schema)),
    async create(input) { const doc = hydrate(normalize(input,schema),true); return doc.save(); },
    async ensureIndexes() {
      for (const [key,spec] of Object.entries(schema.fields)) if (spec.unique || spec.index) await collection().createIndex({ [key]: 1 },spec.unique ? { unique: true } : {});
      for (const index of schema.indexes) await collection().createIndex(index.keys,index.options);
    }
  };
  models.set(name,Model);
  return Model;
}
module.exports = { defineSchema, createModel, ObjectId };
