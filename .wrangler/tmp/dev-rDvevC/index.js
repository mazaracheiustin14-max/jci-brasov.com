var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker/index.js
import { EmailMessage } from "cloudflare:email";
var SITE = "https://jci-brasov.com";
var FROM = "formular@jci-brasov.com";
var FORMSUBMIT = "https://formsubmit.co/ajax/contact@jci-brasov.com";
var worker_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/form") {
      if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
      return handleForm(request, env);
    }
    return env.ASSETS.fetch(request);
  }
};
function safeNext(v, lang) {
  const fallback = lang === "en" ? "/en/multumim.html" : "/multumim.html";
  if (typeof v !== "string") return fallback;
  return /^\/(en\/)?multumim\.html$/.test(v) ? v : fallback;
}
__name(safeNext, "safeNext");
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin).replace(/.{1,76}/g, "$&\r\n").trim();
}
__name(b64, "b64");
async function handleForm(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !/^https:\/\/(www\.)?jci-brasov\.com$/.test(origin)) return new Response("Forbidden", { status: 403 });
  let data;
  try {
    data = await request.formData();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const next = safeNext(data.get("_next"), (data.get("_next") || "").startsWith("/en/") ? "en" : "ro");
  const redirect = /* @__PURE__ */ __name(() => Response.redirect(SITE + next, 303), "redirect");
  if ((data.get("_honey") || "").toString().trim() !== "") return redirect();
  const email = (data.get("email") || "").toString().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return new Response("Adresa de email nu este valid\u0103.", { status: 400 });
  const subject = (data.get("_subject") || "Mesaj nou de pe jci-brasov.com").toString().slice(0, 150);
  const fields = [];
  for (const [k, v] of data.entries()) {
    if (k.startsWith("_") || typeof v !== "string") continue;
    fields.push([k.slice(0, 60), v.slice(0, 4e3)]);
  }
  if (fields.length > 40) return new Response("Bad Request", { status: 400 });
  const body = fields.map(([k, v]) => `${k}: ${v}`).join("\n") + `

--
Trimis de pe ${SITE}${next.includes("/en/") ? "/en/" : "/"}`;
  if (env.MAIL && env.DEST) {
    try {
      const raw = [
        `From: "Formular JCI Brasov" <${FROM}>`,
        `To: <${env.DEST}>`,
        `Reply-To: <${email}>`,
        `Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`,
        `Message-ID: <${crypto.randomUUID()}@jci-brasov.com>`,
        `Date: ${(/* @__PURE__ */ new Date()).toUTCString()}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        "",
        b64(body)
      ].join("\r\n");
      await env.MAIL.send(new EmailMessage(FROM, env.DEST, raw));
      return redirect();
    } catch (e) {
      console.log("email routing failed, falling back:", e && e.message);
    }
  }
  const payload = Object.fromEntries(fields);
  payload._subject = subject;
  payload._replyto = email;
  payload._template = "table";
  payload._captcha = "false";
  try {
    const r = await fetch(FORMSUBMIT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", Origin: SITE, Referer: SITE + "/" },
      body: JSON.stringify(payload)
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && String(j.success) === "true") return redirect();
    console.log("formsubmit:", r.status, JSON.stringify(j));
  } catch (e) {
    console.log("formsubmit error:", e && e.message);
  }
  return new Response(
    "Mesajul nu a putut fi trimis acum. V\u0103 rug\u0103m s\u0103 ne scrie\u021Bi la contact@jci-brasov.com sau s\u0103 ne suna\u021Bi la +40 790 827 426.",
    { status: 502, headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}
__name(handleForm, "handleForm");

// ../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../tmp/wr/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    const body = JSON.stringify(error);
    const headers = {
      "Content-Type": "application/json",
      "MF-Experimental-Error-Stack": "true"
    };
    const encoded = encodeURIComponent(body);
    if (encoded.length <= 8192) {
      headers["MF-Experimental-Error-Stack-Payload"] = encoded;
    }
    return new Response(body, { status: 500, headers });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-Jl8BEH/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../../tmp/wr/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-Jl8BEH/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  scheduledTime;
  cron;
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
