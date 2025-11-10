// _worker.js - Cloudflare Worker amb Rate Limiting + CSP + Seguretat
// Combina: Rate limiting per IP + Nonces dinàmics + Sanitització de scripts

const TRUSTED_INLINE_ATTRIBUTE = "data-csp-nonce";

const SCRIPT_SRC_ALLOWLIST = [
  /^\.?\/(assets|dist)\//,
  /^https:\/\/cdn\.jsdelivr\.net\//,
  /^https:\/\/cdnjs\.cloudflare\.com\//,
  /^https:\/\/static\.cloudflareinsights\.com\//,
  /^https:\/\/www\.googletagmanager\.com\//,
];

const STYLE_HREF_ALLOWLIST = [
  /^\.?\/(assets|dist|css)\//,
  /^https:\/\/fonts\.googleapis\.com\//,
];

// ──────────────────────────────────────────────────────────
// ✨ Rate Limiting - Configuració
// ──────────────────────────────────────────────────────────
const RATE_LIMITS = {
  "/api/pdf": { max: 5, window: 60 }, // 5 PDFs per minut
  "/api/ocr": { max: 10, window: 60 }, // 10 OCRs per minut
  "/api/backup": { max: 3, window: 300 }, // 3 backups per 5 minuts
  default: { max: 100, window: 60 }, // 100 requests generals per minut
};

/**
 * Comprova rate limit per IP utilitzant Cache API
 */
async function checkRateLimit(request, path) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  // Determinar límit segons path
  let limit = RATE_LIMITS.default;
  for (const [pattern, config] of Object.entries(RATE_LIMITS)) {
    if (pattern !== "default" && path.startsWith(pattern)) {
      limit = config;
      break;
    }
  }

  const cacheKey = `rate-limit:${ip}:${path}`;
  const cache = caches.default;

  try {
    const cached = await cache.match(cacheKey);

    if (cached) {
      const data = await cached.json();
      const count = data.count || 0;
      const resetAt = data.resetAt || Date.now();

      // Si encara estem dins la finestra de temps
      if (Date.now() < resetAt) {
        if (count >= limit.max) {
          const secondsLeft = Math.ceil((resetAt - Date.now()) / 1000);
          return {
            allowed: false,
            remaining: 0,
            resetIn: secondsLeft,
            limit: limit.max,
          };
        }

        // Incrementar comptador
        const response = new Response(
          JSON.stringify({
            count: count + 1,
            resetAt: resetAt,
          }),
          {
            headers: {
              "Cache-Control": `max-age=${limit.window}`,
            },
          }
        );
        await cache.put(cacheKey, response);

        return {
          allowed: true,
          remaining: limit.max - count - 1,
          resetIn: Math.ceil((resetAt - Date.now()) / 1000),
          limit: limit.max,
        };
      }
    }

    // Primer request o finestra expirada
    const resetAt = Date.now() + limit.window * 1000;
    const response = new Response(
      JSON.stringify({
        count: 1,
        resetAt: resetAt,
      }),
      {
        headers: {
          "Cache-Control": `max-age=${limit.window}`,
        },
      }
    );
    await cache.put(cacheKey, response);

    return {
      allowed: true,
      remaining: limit.max - 1,
      resetIn: limit.window,
      limit: limit.max,
    };
  } catch (error) {
    console.error("[Worker] Error checking rate limit:", error);
    // Fail open: permetre el request en cas d'error
    return {
      allowed: true,
      remaining: limit.max,
      resetIn: limit.window,
      limit: limit.max,
    };
  }
}

// ──────────────────────────────────────────────────────────
// Handler Principal del Worker
// ──────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. Comprovar rate limit
    const rateLimitResult = await checkRateLimit(request, path);

    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: `Has superat el límit de ${rateLimitResult.limit} requests. Torna-ho a intentar en ${rateLimitResult.resetIn}s.`,
          retryAfter: rateLimitResult.resetIn,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": rateLimitResult.resetIn.toString(),
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimitResult.resetIn.toString(),
          },
        }
      );
    }

    // 2. Fetch del recurs original
    const originRes = await fetch(request);
    const h = new Headers(originRes.headers);
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const ctype = (h.get("content-type") || "").toLowerCase();
    const isHtml = ctype.includes("text/html");

    // 3. Aplicar headers de seguretat
    applySecurityHeaders(h, nonce, isHtml);

    // 4. Afegir headers de rate limit
    h.set("X-RateLimit-Limit", rateLimitResult.limit.toString());
    h.set("X-RateLimit-Remaining", rateLimitResult.remaining.toString());
    h.set("X-RateLimit-Reset", rateLimitResult.resetIn.toString());

    // 5. Si no és HTML, retornar directament
    if (!isHtml) {
      return new Response(originRes.body, {
        status: originRes.status,
        statusText: originRes.statusText,
        headers: h,
      });
    }

    // 6. Si és HTML, aplicar HTMLRewriter per sanititzar + injectar nonces
    const rewriter = new HTMLRewriter()
      .on("body", {
        element(el) {
          el.setAttribute("data-csp-nonce", nonce);
        },
      })
      .on("script", {
        element(el) {
          const src = el.getAttribute("src");
          const hasTrustedAttr =
            el.getAttribute(TRUSTED_INLINE_ATTRIBUTE) !== null;

          // Scripts amb src
          if (src) {
            // Comprovar si està a l'allowlist
            if (!SCRIPT_SRC_ALLOWLIST.some((re) => re.test(src))) {
              el.remove();
              return;
            }
            // Si té l'atribut de confiança, afegir nonce i eliminar l'atribut temporal
            if (hasTrustedAttr) {
              el.setAttribute("nonce", nonce);
              el.removeAttribute(TRUSTED_INLINE_ATTRIBUTE);
            }
            return;
          }

          // Scripts inline (sense src)
          if (hasTrustedAttr) {
            el.setAttribute("nonce", nonce);
            el.removeAttribute(TRUSTED_INLINE_ATTRIBUTE);
            return;
          }

          // Scripts inline sense atribut de confiança: eliminar
          el.remove();
        },
      })
      .on("link[rel='stylesheet']", {
        element(el) {
          const href = el.getAttribute("href");
          const hasTrustedAttr =
            el.getAttribute(TRUSTED_INLINE_ATTRIBUTE) !== null;

          if (href && hasTrustedAttr) {
            el.setAttribute("nonce", nonce);
            el.removeAttribute(TRUSTED_INLINE_ATTRIBUTE);
          } else if (
            href &&
            !STYLE_HREF_ALLOWLIST.some((re) => re.test(href))
          ) {
            el.remove();
          }
        },
      })
      .on("style", {
        element(el) {
          const hasTrustedAttr =
            el.getAttribute(TRUSTED_INLINE_ATTRIBUTE) !== null;

          if (hasTrustedAttr) {
            el.setAttribute("nonce", nonce);
            el.removeAttribute(TRUSTED_INLINE_ATTRIBUTE);
            return;
          }
          el.remove();
        },
      });

    const rewritten = rewriter.transform(originRes);
    return new Response(rewritten.body, {
      status: originRes.status,
      statusText: originRes.statusText,
      headers: h,
    });
  },
};

// ──────────────────────────────────────────────────────────
// Headers de Seguretat
// ──────────────────────────────────────────────────────────
function applySecurityHeaders(headers, nonce, isHtml) {
  if (isHtml) {
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests",
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' data: blob: https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://fonts.googleapis.com https://fonts.gstatic.com https://static.cloudflareinsights.com https://www.google-analytics.com https://region1.google-analytics.com",
      "worker-src 'self' blob:",
      "img-src 'self' data: blob: https://www.google-analytics.com https://region1.google-analytics.com",
    ].join("; ");

    headers.set("Content-Security-Policy", csp);
    headers.delete("Content-Security-Policy-Report-Only");
  } else {
    headers.delete("Content-Security-Policy");
    headers.delete("Content-Security-Policy-Report-Only");
  }

  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  headers.set("X-Frame-Options", "DENY");
  headers.set("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
}
