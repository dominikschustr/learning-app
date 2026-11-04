/**
 * Firebase-Projekt für Geräte-Synchronisation und Rangliste (Firestore, kostenloser Spark-Plan).
 * Die Werte sind öffentlich (stehen ohnehin im ausgelieferten JavaScript) – geschützt wird über firestore.rules.
 * Leer = Synchronisation und Rangliste sind ausgeblendet, der Rest der App funktioniert.
 * Einrichtung: siehe README → „Synchronisation und Rangliste einrichten“.
 */
export const FIREBASE = {
  projectId: "lernwerk-92c20",
  apiKey: "AIzaSyDLTfZ6vEGrm0_X7H0mZJ-63uNXXLGYWFc",
};

/**
 * Web Push für die Erinnerung ans Tagesziel. Der öffentliche VAPID-Schlüssel steht hier (nicht geheim),
 * der private liegt nur als GitHub-Secret VAPID_PRIVATE_KEY beim Versand-Workflow (.github/workflows/remind.yml).
 * Leer = Erinnerungen sind ausgeblendet.
 */
export const PUSH = {
  vapidPublicKey: "BAkK5B9g5X_F9B-tpYWx_HJ90wWKvqn2MjR_jXFw_GTXemPlhhb-4l4lfAoAbcTHdk_giy5b98gs1ckZW-1FZMY",
};
