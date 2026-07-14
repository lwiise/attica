// ============================================================
//  Edge Function : submit-application
//  Reçoit un formulaire Attica (champs + documents), stocke les
//  fichiers dans le bucket privé "applications", enregistre la
//  demande en base, puis envoie une notification email (optionnelle).
//
//  Déploiement (au choix) :
//   A) Dashboard Supabase → Edge Functions → Deploy a new function
//      → nom "submit-application" → coller ce fichier.
//   B) CLI : supabase functions deploy submit-application --no-verify-jwt
//
//  Secrets à définir (Project Settings → Edge Functions → Secrets,
//  ou `supabase secrets set ...`). SUPABASE_URL et
//  SUPABASE_SERVICE_ROLE_KEY sont injectés automatiquement.
//   - RESEND_API_KEY   (optionnel, pour l'email)
//   - NOTIFY_EMAIL     (destinataire(s), séparés par des virgules)
//   - FROM_EMAIL       (expéditeur vérifié chez Resend)
// ============================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Noms de champs de fichiers attendus (tout autre nom -> dossier "misc").
const ALLOWED_FIELDS = new Set([
  "piece_identite", "justificatifs_financiers", "justificatifs", "extrait_poursuites", "assurance_copie",
]);
// Signatures binaires (magic bytes) des types réellement acceptés.
const MAGIC: Array<{ type: string; bytes: number[] }> = [
  { type: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { type: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },           // JPEG
  { type: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },      // PNG
];
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 Mo par fichier
const MAX_FILES = 25;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-120) || "fichier";
}

// Échappe les valeurs fournies par le visiteur avant insertion dans l'email HTML.
function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

// Détermine le vrai type d'un fichier d'après ses premiers octets (magic bytes),
// sans faire confiance au type MIME déclaré par le client. null si non reconnu.
async function sniffType(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  for (const m of MAGIC) {
    if (m.bytes.every((b, i) => head[i] === b)) return m.type;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const form = await req.formData();

    // Anti-spam : si le pot de miel est rempli, on simule un succès.
    if (String(form.get("_gotcha") ?? "").length > 0) return json({ ok: true });

    const type = String(form.get("form_type") ?? "");
    if (type !== "annuelle" && type !== "mensuelle" && type !== "parking") {
      return json({ error: "Type de formulaire invalide" }, 400);
    }

    const fields: Record<string, string> = {};
    const fileEntries: Array<{ field: string; file: File }> = [];

    for (const [key, value] of form.entries()) {
      if (key === "_gotcha" || key === "form_type") continue;
      if (value instanceof File) {
        if (value.size === 0) continue;
        fileEntries.push({ field: key, file: value });
      } else {
        fields[key] = fields[key] ? `${fields[key]}, ${value}` : String(value);
      }
    }

    if (!fields["email"]) return json({ error: "Email requis" }, 400);
    if (fileEntries.length > MAX_FILES) return json({ error: "Trop de fichiers" }, 400);

    // Validation stricte AVANT tout upload : taille + type RÉEL (magic bytes).
    // Rejette tout fichier vide, trop volumineux ou non reconnu (PDF/JPEG/PNG).
    const prepared: Array<{ field: string; file: File; contentType: string }> = [];
    for (const { field, file } of fileEntries) {
      if (file.size > MAX_FILE_BYTES) return json({ error: `Fichier trop volumineux : ${file.name}` }, 400);
      const sniffed = await sniffType(file);
      if (!sniffed) return json({ error: `Type de fichier non autorisé : ${file.name}` }, 400);
      // Le nom de champ vient du client -> on le restreint à une liste connue.
      const safeField = ALLOWED_FIELDS.has(field) ? field : "misc";
      prepared.push({ field: safeField, file, contentType: sniffed });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const id = crypto.randomUUID();
    const stored: Array<Record<string, unknown>> = [];

    for (const { field, file, contentType } of prepared) {
      const path = `${type}/${id}/${field}/${safeName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("applications")
        .upload(path, file, { contentType, upsert: false });
      if (upErr) throw upErr;
      stored.push({ field, path, name: file.name, size: file.size, type: contentType });
    }

    const applicantName = [fields["prenom"], fields["nom"]].filter(Boolean).join(" ").trim();

    const { error: insErr } = await supabase.from("applications").insert({
      id,
      type,
      status: "new",
      applicant_name: applicantName || null,
      applicant_email: fields["email"] || null,
      applicant_phone: fields["tel_portable"] || fields["telephone"] || null,
      data: fields,
      files: stored,
    });
    if (insErr) throw insErr;

    // Notification email (optionnelle) -------------------------------
    // Un échec d'envoi ne bloque jamais l'enregistrement, mais il ne doit
    // plus être silencieux : le résultat est journalisé (logs de la
    // fonction) ET enregistré sur la demande (notify_status/notify_error),
    // visible dans le tableau de bord.
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const notify = Deno.env.get("NOTIFY_EMAIL");
    const from = Deno.env.get("FROM_EMAIL");
    let notifyStatus = "skipped";
    let notifyError: string | null = null;
    if (!resendKey || !notify || !from) {
      notifyError = "Secrets manquants : " +
        [!resendKey && "RESEND_API_KEY", !notify && "NOTIFY_EMAIL", !from && "FROM_EMAIL"]
          .filter(Boolean).join(", ");
      console.warn(`[notify] email non envoyé — ${notifyError}`);
    } else {
      const safeWho = applicantName || fields["email"] || "";
      const rows = Object.entries(fields)
        .map(([k, v]) =>
          `<tr><td style="padding:3px 12px;color:#888;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:3px 12px">${escapeHtml(v)}</td></tr>`
        )
        .join("");
      const html = `<h2 style="font-family:Georgia,serif;color:#A8843A">Nouvelle demande de location — ${escapeHtml(type)}</h2>
        <p><strong>${escapeHtml(safeWho)}</strong> — ${stored.length} document(s) joint(s).</p>
        <p>Ouvrez le tableau de bord pour consulter le dossier et télécharger les pièces.</p>
        <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:13px">${rows}</table>`;
      // Sujet : pas de HTML, mais on retire les sauts de ligne (anti-injection d'en-tête).
      const subject = `Nouvelle demande ${type} — ${safeWho}`.replace(/[\r\n]+/g, " ").slice(0, 200);
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: notify.split(",").map((s) => s.trim()),
            subject,
            html,
          }),
        });
        if (res.ok) {
          notifyStatus = "sent";
        } else {
          // fetch ne lève PAS d'exception sur un statut HTTP d'erreur :
          // clé révoquée (401), domaine non vérifié (403), quota atteint
          // (429)… arrivent ici, avec le message exact renvoyé par Resend.
          notifyStatus = "error";
          const body = (await res.text()).slice(0, 500);
          notifyError = `Resend ${res.status} : ${body}`;
          console.error(`[notify] échec d'envoi — ${notifyError}`);
        }
      } catch (e) {
        notifyStatus = "error";
        notifyError = `Réseau : ${e instanceof Error ? e.message : String(e)}`;
        console.error(`[notify] échec d'envoi — ${notifyError}`);
      }
    }
    const { error: nErr } = await supabase.from("applications")
      .update({ notify_status: notifyStatus, notify_error: notifyError })
      .eq("id", id);
    if (nErr) console.error("[notify] statut non enregistré (colonnes manquantes ? relancez schema.sql) :", nErr.message ?? nErr);

    return json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return json({ error: "Erreur serveur" }, 500);
  }
});
