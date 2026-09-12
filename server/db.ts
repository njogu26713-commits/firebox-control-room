import { MongoClient, ObjectId, type Db } from "mongodb";
import { ENV } from "./_core/env";

let client: MongoClient | null = null;
let database: Db | null = null;

function mongoUri() {
  return process.env.MONGODB_URI ?? "";
}

export async function getDb(): Promise<Db | null> {
  if (database) return database;
  const uri = mongoUri();
  if (!uri) return null;
  client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  await client.connect();
  database = client.db(process.env.MONGODB_DB || undefined);
  await database.collection("application_connections").createIndex({ updatedAt: -1 });
  await database.collection("activity_log").createIndex({ createdAt: -1 });
  return database;
}

export async function closeDb() {
  await client?.close();
  client = null;
  database = null;
}

export async function upsertUser() {
  // Kept as a no-op compatibility export for unused scaffold files. Authentication is disabled.
}

function publicConnection(document: any) {
  if (!document) return undefined;
  const { apiKeyHash: _hash, apiKeyCiphertext: _ciphertext, ...safe } = document;
  return { ...safe, id: String(document._id) };
}

export async function listConnections() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.collection("application_connections").find({}).sort({ updatedAt: -1 }).toArray();
  return rows.map(publicConnection);
}

export async function getConnection(id: string) {
  const db = await getDb();
  if (!db || !ObjectId.isValid(id)) return undefined;
  return db.collection("application_connections").findOne({ _id: new ObjectId(id) });
}

export async function listActivity(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.collection("activity_log").find({}).sort({ createdAt: -1 }).limit(limit).toArray();
}

export async function ensureIndexes() {
  const db = await getDb();
  if (!db) return;
  await Promise.all([
    db.collection("application_connections").createIndex({ apiKeyHash: 1 }, { unique: true }),
    db.collection("application_connections").createIndex({ updatedAt: -1 }),
    db.collection("activity_log").createIndex({ createdAt: -1 }),
  ]);
}

export { ENV };
