import "server-only";
import { Redis } from "@upstash/redis";

/** Upstash Redis (Free-Plan, 500.000 Befehle/Monat); null, wenn die Variablen fehlen. */
const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
export const redis = url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;
