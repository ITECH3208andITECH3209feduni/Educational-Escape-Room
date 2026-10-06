const { MongoClient } = require('mongodb');
let client;
let db;
async function connect(uri) {
  client = new MongoClient(uri);
  await client.connect();
  // Mongoose uses 'test' when no database is named in the URI.
  db = client.db(process.env.MONGO_DB_NAME || undefined);
}
function getDatabase() {
  if (!db) throw new Error('Database is not connected');
  return db;
}
async function health() {
  try { await getDatabase().command({ ping: 1 }); return true; }
  catch { return false; }
}
async function close() {
  if (client) await client.close();
  client = undefined; db = undefined;
}
module.exports = { connect, getDatabase, health, close };
