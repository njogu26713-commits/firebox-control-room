import axios from "axios";
import crypto from "node:crypto";
import { z } from "zod";
import { getConnection, getDb, listActivity, listConnections } from "./db";
import { ENV } from "./_core/env";
import { publicProcedure, router } from "./_core/trpc";

const timeout = 9000;
const connectionInput = z.object({
  appName: z.string().trim().min(2).max(160),
  apiUrl: z.string().url().transform(url => url.replace(/\/$/, "")),
  apiKey: z.string().trim().min(12).max(500),
});
const apiHeaders = (apiKey: string) => ({ Authorization: `Bearer ${apiKey}`, Accept: "application/json" });
const endpoint = (base: string, path: string) => `${base.replace(/\/$/, "")}${path}`;
const secret = () => crypto.createHash("sha256").update(process.env.JWT_SECRET || "firebox-development-secret").digest();
function keyHash(value: string) { return crypto.createHash("sha256").update(value).digest("hex"); }
function keyCipher(value: string) {
  const iv = crypto.randomBytes(12); const cipher = crypto.createCipheriv("aes-256-gcm", secret(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
function keyDecipher(value: string) {
  const [ivText, tagText, encryptedText] = value.split("."); const decipher = crypto.createDecipheriv("aes-256-gcm", secret(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}
function collectionList(payload: any): Array<{ name: string; count: number }> {
  const values = Array.isArray(payload) ? payload : payload?.collections ?? payload?.data ?? [];
  return values.map((item: any) => typeof item === "string" ? { name: item, count: 0 } : { name: item.name ?? item.collection ?? item.id, count: Number(item.count ?? item.recordCount ?? item.records ?? 0) }).filter((item: { name: string; count: number }) => item.name);
}
async function inspectRemote(apiUrl: string, apiKey: string) {
  const info = await axios.get(endpoint(apiUrl, "/api/firebox/database/info"), { headers: apiHeaders(apiKey), timeout });
  const collectionResponse = await axios.get(endpoint(apiUrl, "/api/firebox/database/collections"), { headers: apiHeaders(apiKey), timeout });
  const collections = collectionList(collectionResponse.data);
  return { info: info.data ?? {}, collections, records: collections.reduce((sum, item) => sum + item.count, 0) };
}
async function remoteGet(connection: any, path: string, params?: Record<string, string | number | undefined>) {
  return axios.get(endpoint(connection.apiUrl, path), { headers: apiHeaders(keyDecipher(connection.apiKeyCiphertext)), params, timeout });
}
function errorMessage(error: any, fallback: string) {
  const status = error?.response?.status;
  if (status === 401 || status === 403) return "Invalid Firebox Database API key.";
  if (error?.code === "ECONNABORTED") return "The application API timed out.";
  return error?.response ? "The application API returned an error." : error?.message ?? fallback;
}

export const appRouter = router({
  controlRoom: router({
    connections: publicProcedure.query(() => listConnections()),
    activity: publicProcedure.input(z.object({ limit: z.number().int().min(1).max(100).default(30) }).optional()).query(({ input }) => listActivity(input?.limit ?? 30)),
    aiSupport: publicProcedure.input(z.object({ connectionId: z.string().min(1), question: z.string().trim().min(2).max(2000) })).mutation(async ({ input }) => {
      if (!ENV.groqApiKey) throw new Error("GROQ_API_KEY is not configured on the server.");
      const connection = await getConnection(input.connectionId); if (!connection) throw new Error("Application connection not found.");
      try {
        const inspected = await inspectRemote(connection.apiUrl, keyDecipher(connection.apiKeyCiphertext));
        const lowerQuestion = input.question.toLowerCase();
        const mentioned = inspected.collections.filter(item => lowerQuestion.includes(item.name.toLowerCase())).slice(0, 3);
        const targets = mentioned.length ? mentioned : inspected.collections.slice(0, 3);
        const samples = await Promise.all(targets.map(async item => {
          try {
            const response = await remoteGet(connection, `/api/firebox/database/collections/${encodeURIComponent(item.name)}/records`, { page: 1, pageSize: 5 });
            const data = response.data; return { collection: item.name, reportedCount: item.count, sampleRecords: data.records ?? data.data ?? (Array.isArray(data) ? data : []) };
          } catch { return { collection: item.name, reportedCount: item.count, sampleRecords: [], unavailable: true }; }
        }));
        const context = JSON.stringify({ application: connection.appName, apiVersion: connection.apiVersion, databaseType: connection.databaseType, collectionCount: inspected.collections.length, totalRecords: inspected.records, collections: inspected.collections, samples }, null, 2).slice(0, 50000);
        const response = await axios.post("https://api.groq.com/openai/v1/chat/completions", { model: ENV.groqModel, temperature: 0.2, messages: [
          { role: "system", content: "You are Firebox AI Support. Answer only from the supplied live database context. Be precise, explain when data is unavailable, and never invent fields, counts, or records. You are read-only: never suggest that the Control Room can edit, delete, or mutate data. Mention the relevant collection names when useful. Use concise Markdown." },
          { role: "user", content: `Database context:\n${context}\n\nAdministrator question:\n${input.question}` },
        ] }, { headers: { Authorization: `Bearer ${ENV.groqApiKey}`, "Content-Type": "application/json" }, timeout: 30000 });
        return { answer: response.data?.choices?.[0]?.message?.content ?? "Groq returned no answer.", model: ENV.groqModel, collectionsUsed: targets.map(item => item.name) };
      } catch (error: any) { throw new Error(error?.response?.data?.error?.message ?? error?.message ?? "AI Support could not answer this question."); }
    }),
    connect: publicProcedure.input(connectionInput).mutation(async ({ input }) => {
      try {
        const inspected = await inspectRemote(input.apiUrl, input.apiKey); const db = await getDb();
        if (!db) throw new Error("MONGODB_URI is not configured on the server.");
        const now = new Date();
        const result = await db.collection("application_connections").findOneAndUpdate(
          { apiKeyHash: keyHash(input.apiKey) },
          { $set: { appName: input.appName, apiUrl: input.apiUrl, apiKeyHash: keyHash(input.apiKey), apiKeyCiphertext: keyCipher(input.apiKey), status: "connected", apiVersion: String(inspected.info.apiVersion ?? inspected.info.version ?? "unknown"), databaseType: String(inspected.info.databaseType ?? inspected.info.database ?? "unknown"), collectionCount: inspected.collections.length, recordCount: inspected.records, lastConnectedAt: now, lastSyncAt: now, updatedAt: now }, $setOnInsert: { createdAt: now } },
          { upsert: true, returnDocument: "after" },
        );
        return { success: true, appName: input.appName, collectionCount: inspected.collections.length, recordCount: inspected.records, id: String(result?._id) };
      } catch (error: any) { throw new Error(errorMessage(error, "Unable to connect to the application.")); }
    }),
    refresh: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(async ({ input }) => {
      const connection = await getConnection(input.id); if (!connection) throw new Error("Application connection not found.");
      try { const inspected = await inspectRemote(connection.apiUrl, keyDecipher(connection.apiKeyCiphertext)); const db = await getDb(); if (!db) throw new Error("MONGODB_URI is not configured on the server."); await db.collection("application_connections").updateOne({ _id: connection._id }, { $set: { status: "connected", collectionCount: inspected.collections.length, recordCount: inspected.records, lastConnectedAt: new Date(), lastSyncAt: new Date(), updatedAt: new Date() } }); return { success: true }; } catch (error: any) { throw new Error(errorMessage(error, "Unable to refresh this application.")); }
    }),
    collections: publicProcedure.input(z.object({ connectionId: z.string().min(1) })).query(async ({ input }) => {
      const connection = await getConnection(input.connectionId); if (!connection) throw new Error("Application connection not found.");
      try { const result = await remoteGet(connection, "/api/firebox/database/collections"); return collectionList(result.data); } catch (error: any) { throw new Error(errorMessage(error, "Unable to retrieve collections.")); }
    }),
    records: publicProcedure.input(z.object({ connectionId: z.string().min(1), collection: z.string().min(1).max(160), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(25), search: z.string().max(200).optional(), sort: z.string().max(100).optional() })).query(async ({ input }) => {
      const connection = await getConnection(input.connectionId); if (!connection) throw new Error("Application connection not found.");
      try { const result = await remoteGet(connection, `/api/firebox/database/collections/${encodeURIComponent(input.collection)}/records`, { page: input.page, pageSize: input.pageSize, search: input.search, sort: input.sort }); const data = result.data; return { records: data.records ?? data.data ?? (Array.isArray(data) ? data : []), total: Number(data.total ?? data.count ?? 0), page: input.page, pageSize: input.pageSize }; } catch (error: any) { throw new Error(errorMessage(error, "Unable to retrieve records.")); }
    }),
    record: publicProcedure.input(z.object({ connectionId: z.string().min(1), collection: z.string().min(1), id: z.string().min(1) })).query(async ({ input }) => {
      const connection = await getConnection(input.connectionId); if (!connection) throw new Error("Application connection not found.");
      try { const result = await remoteGet(connection, `/api/firebox/database/collections/${encodeURIComponent(input.collection)}/records/${encodeURIComponent(input.id)}`); return result.data?.record ?? result.data; } catch (error: any) { throw new Error(errorMessage(error, "Unable to retrieve this record.")); }
    }),
  }),
});

export type AppRouter = typeof appRouter;
