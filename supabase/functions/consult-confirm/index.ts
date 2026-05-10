// consult-confirm Edge Function
//
// Validates {booking_id, confirm_token} from the confirmation page,
// then updates the booking row with confirmed_at, the ticked
// transformation_members ids, and the pre_consult_note. Service-role
// client so the page can't bypass RLS.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ConfirmPayload {
  booking_id: string;
  confirm_token: string;
  relate_to_members?: string[];
  pre_consult_note?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405);

  let payload: ConfirmPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "invalid json" }, 400);
  }

  const { booking_id, confirm_token } = payload;
  if (!booking_id || !confirm_token) {
    return jsonResponse({ error: "booking_id and confirm_token required" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  // 1. Validate booking + token.
  const { data: booking, error: lookupErr } = await sb
    .from("bookings")
    .select("id, confirm_token, confirmed_at, first_name, last_name, email, phone, location, slot_id, booking_slots(date, start_time, end_time)")
    .eq("id", booking_id)
    .maybeSingle();

  if (lookupErr) return jsonResponse({ error: "lookup failed" }, 500);
  if (!booking) return jsonResponse({ error: "booking not found" }, 404);
  if (booking.confirm_token !== confirm_token) {
    return jsonResponse({ error: "invalid token" }, 403);
  }

  // 2. Update.
  const ticked = Array.isArray(payload.relate_to_members)
    ? payload.relate_to_members.filter((s) => typeof s === "string").slice(0, 50)
    : [];
  const note = typeof payload.pre_consult_note === "string"
    ? payload.pre_consult_note.slice(0, 4000)
    : null;

  const { error: updErr } = await sb
    .from("bookings")
    .update({
      confirmed_at: new Date().toISOString(),
      relate_to_members: ticked,
      pre_consult_note: note,
    })
    .eq("id", booking_id);

  if (updErr) return jsonResponse({ error: "update failed: " + updErr.message }, 500);

  // 3. Fire team-notify email (fire-and-forget — failure here doesn't
  //    block the prospect's confirmation).
  try {
    const slot = (booking as { booking_slots?: { date?: string; start_time?: string } }).booking_slots || {};
    const leadName = `${booking.first_name || ""} ${booking.last_name || ""}`.trim();
    const dateStr = slot.date || "";
    const timeStr = slot.start_time ? slot.start_time.substring(0, 5) : "";

    const tickedDetails = ticked.length > 0
      ? await (async () => {
          const { data: members } = await sb
            .from("transformation_members")
            .select("name, starting_point, goal")
            .in("id", ticked);
          return members || [];
        })()
      : [];

    const tickedHtml = tickedDetails.length === 0
      ? "<p style=\"margin:8px 0;color:rgba(255,255,255,0.5)\">None ticked.</p>"
      : tickedDetails
          .map((m) =>
            `<li style="margin:6px 0"><strong>${m.name}</strong>` +
            (m.starting_point ? ` — ${m.starting_point}` : "") +
            "</li>"
          )
          .join("");

    const noteHtml = note
      ? `<div style="background:rgba(237,92,37,0.08);border:1px solid rgba(237,92,37,0.2);border-radius:12px;padding:16px;margin:16px 0"><strong>Pre-consult note:</strong><br>${note.replace(/\n/g, "<br>")}</div>`
      : "";

    const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0B0B0B;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;color:#fff">
<div style="max-width:560px;margin:0 auto;padding:40px 24px">
<div style="text-align:center;margin-bottom:24px"><span style="font-size:22px;font-weight:900;letter-spacing:-0.5px">Re<span style="color:#ED5C25">Shape</span></span></div>
<div style="background:#111213;border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:28px">
<h1 style="font-size:20px;font-weight:800;margin:0 0 16px">Consult confirmed: ${leadName}</h1>
<p style="margin:4px 0;color:rgba(255,255,255,0.7)"><strong>When:</strong> ${dateStr} ${timeStr}</p>
<p style="margin:4px 0;color:rgba(255,255,255,0.7)"><strong>Studio:</strong> ${booking.location || ""}</p>
<p style="margin:4px 0;color:rgba(255,255,255,0.7)"><strong>Email:</strong> ${booking.email || ""}</p>
<p style="margin:4px 0;color:rgba(255,255,255,0.7)"><strong>Phone:</strong> ${booking.phone || ""}</p>
<h2 style="font-size:15px;font-weight:700;margin:20px 0 8px">Ticked transformations</h2>
<ul style="margin:0;padding-left:20px;color:rgba(255,255,255,0.7);font-size:14px">${tickedHtml}</ul>
${noteHtml}
</div></div></body></html>`;

    await fetch(`${url}/functions/v1/process-queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        action: "send_message",
        channel: "email",
        to_email: "reshape.nurturing@gmail.com",
        subject: `Consult confirmed: ${leadName} — ${dateStr} ${timeStr}`,
        html_body: html,
        lead_name: "Team Notification",
        sequence: "consult_confirm_team_notify",
      }),
    });
  } catch (e) {
    console.error("team notify failed:", (e as Error).message);
  }

  return jsonResponse({ ok: true });
});
