/**
 * Veröffentlicht firestore.rules im Firebase-Projekt (läuft bei jedem Push auf main in .github/workflows/deploy.yml,
 * nachdem die Regeln im Emulator getestet wurden). Nichts zu tun, wenn die veröffentlichten Regeln schon gleich sind.
 *
 * Secret: FIREBASE_SERVICE_ACCOUNT (dasselbe Dienstkonto wie für die Mitteilungen).
 */
import { readFileSync } from "node:fs";
import { accessToken, appConfig, serviceAccount } from "./firebase-admin.mjs";

const API = "https://firebaserules.googleapis.com/v1";

async function call(token, method, path, body) {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, json };
}

async function main() {
  const sa = serviceAccount();
  if (!sa) {
    console.log(
      "::error::Secret FIREBASE_SERVICE_ACCOUNT fehlt – firestore.rules wurden nicht veröffentlicht. " +
        "Einrichtung: README → Mitteilungen.",
    );
    process.exit(1);
  }
  const project = sa.project_id || appConfig().projectId;
  const source = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const token = await accessToken(sa, "https://www.googleapis.com/auth/cloud-platform");
  const releaseName = `projects/${project}/releases/cloud.firestore`;

  // Schon veröffentlicht?
  const current = await call(token, "GET", releaseName);
  if (current.ok) {
    const rs = await call(token, "GET", current.json.rulesetName);
    const live = rs.json?.source?.files?.map((f) => f.content).join("\n");
    if (live === source) {
      console.log("firestore.rules sind bereits veröffentlicht.");
      return;
    }
  } else if (current.status !== 404) {
    throw new Error(`Regeln abfragen fehlgeschlagen (${current.status}): ${JSON.stringify(current.json)}`);
  }

  const created = await call(token, "POST", `projects/${project}/rulesets`, {
    source: { files: [{ name: "firestore.rules", content: source }] },
  });
  if (!created.ok) throw new Error(`Regeln hochladen fehlgeschlagen (${created.status}): ${JSON.stringify(created.json)}`);

  const release = { name: releaseName, rulesetName: created.json.name };
  const res = current.ok
    ? await call(token, "PATCH", releaseName, { release })
    : await call(token, "POST", `projects/${project}/releases`, release);
  if (!res.ok) throw new Error(`Regeln veröffentlichen fehlgeschlagen (${res.status}): ${JSON.stringify(res.json)}`);
  console.log(`firestore.rules veröffentlicht (${created.json.name}).`);
}

main().catch((e) => {
  console.error(`::error::${e.message}`);
  process.exit(1);
});
