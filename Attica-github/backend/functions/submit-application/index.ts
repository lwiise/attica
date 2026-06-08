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

const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const form = await req.formData();

    // Anti-spam : si le pot de miel est rempli, on simule un succès.
    if (String(form.get("_gotcha") ?? "").length > 0) return json({ ok: true });

    const type = String(form.get("form_type") ?? "");
    if (type !== "annuelle" && type !== "mensuelle") {
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
    for (const { file } of fileEntries) {
      if (file.size > MAX_FILE_BYTES) return json({ error: `Fichier trop volumineux : ${file.name}` }, 400);
      if (file.type && !ALLOWED_TYPES.includes(file.type)) {
        return json({ error: `Type de fichier non autorisé : ${file.name}` }, 400);
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const id = crypto.randomUUID();
    const stored: Array<Record<string, unknown>> = [];

    for (const { field, file } of fileEntries) {
      const path = `${type}/${id}/${field}/${safeName(file.name)}`;
      const { error: upErr } = await supabase.storage
        .from("applications")
        .upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (upErr) throw upErr;
      stored.push({ field, path, name: file.name, size: file.size, type: file.type });
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
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const notify = Deno.env.get("NOTIFY_EMAIL");
    const from = Deno.env.get("FROM_EMAIL");
    if (resendKey && notify && from) {
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
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to: notify.split(",").map((s) => s.trim()),
            subject,
            html,
          }),
        });
      } catch (_) {
        // l'échec de l'email ne doit jamais bloquer l'enregistrement
      }
    }

    return json({ ok: true, id });
  } catch (err) {
    console.error(err);
    return json({ error: "Erreur serveur" }, 500);
  }
});
