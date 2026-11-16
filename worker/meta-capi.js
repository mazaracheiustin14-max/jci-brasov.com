// Meta Conversions API (server): trimite CompleteRegistration pentru înscrierile noi de pe formularul public.
// Același event_id ("reg-" + token) ca în pixelul din browser, deci Meta deduplică și păstrează un singur eveniment.
// Activ doar dacă secretul META_CAPI_TOKEN e setat. Nu aruncă niciodată erori.

const PIXEL_ID = "1646950960458698";
const GRAPH = "https://graph.facebook.com/v21.0/" + PIXEL_ID + "/events";

async function sha256(v) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Telefon românesc în format internațional, doar cifre: 07xxxxxxxx -> 407xxxxxxxx, +40... -> 40..., 0040... -> 40...
export function normPhone(raw) {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0")) d = "40" + d.slice(1);
  return d;
}

function cookie(header, name) {
  const m = (header || "").match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

export async function sendRegistration(env, request, f, token, siteUrl) {
  try {
    if (!env.META_CAPI_TOKEN || !token) return;
    const h = (k) => request.headers.get(k) || "";
    const hash = async (v) => (v ? [await sha256(v)] : undefined);
    const parts = String(f.nume || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    const country = ((request.cf && request.cf.country) || "").toLowerCase();
    const ck = h("Cookie");
    const ud = {
      em: await hash(String(f.email || "").trim().toLowerCase()),
      ph: await hash(normPhone(f.telefon)),
      fn: await hash(parts[0]),
      ln: await hash(parts.slice(1).join(" ")),
      country: await hash(country),
      client_ip_address: h("CF-Connecting-IP") || undefined,
      client_user_agent: h("User-Agent") || undefined,
      fbp: cookie(ck, "_fbp") || undefined,
      fbc: cookie(ck, "_fbc") || undefined,
    };
    for (const k of Object.keys(ud)) if (ud[k] === undefined) delete ud[k];
    const body = {
      data: [{
        event_name: "CompleteRegistration",
        event_time: Math.floor(Date.now() / 1000),
        event_id: "reg-" + token,
        action_source: "website",
        event_source_url: h("Referer") || siteUrl + "/eveniment",
        user_data: ud,
        custom_data: { content_name: "Inscriere eveniment" },
      }],
    };
    if (env.META_TEST_CODE) body.test_event_code = env.META_TEST_CODE;
    const r = await fetch(GRAPH + "?access_token=" + encodeURIComponent(env.META_CAPI_TOKEN), {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (!r.ok) console.log("meta capi:", r.status, (await r.text()).slice(0, 300));
  } catch (e) { console.log("meta capi:", e && e.message); }
}
