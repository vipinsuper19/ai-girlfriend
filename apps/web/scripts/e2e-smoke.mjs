const BASE = "http://localhost:3000";
const API = "http://localhost:3001/api/v1";
const stamp = Date.now();
const email = `webtest.${stamp}@example.com`;
const password = "password12";
const displayName = "Web Tester";

const findings = [];

function issue(severity, area, message, detail) {
  findings.push({ severity, area, message, detail });
  console.log(`[${severity}] ${area}: ${message}`);
  if (detail) console.log(`         ${detail}`);
}

function ok(area, message) {
  console.log(`[ok] ${area}: ${message}`);
}

async function req(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
      ...options,
      headers: {
        ...(options.body && typeof options.body === "string"
          ? { "content-type": "application/json" }
          : {}),
        ...(options.headers ?? {}),
      },
    });
    const text = await response.text();
    return { response, text, status: response.status };
  } finally {
    clearTimeout(timer);
  }
}

function cookieHeader(setCookie) {
  return setCookie
    .map((c) => c.split(";")[0])
    .join("; ");
}

function parseCookies(setCookie) {
  const jar = {};
  for (const raw of setCookie) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    jar[pair.slice(0, eq)] = pair.slice(eq + 1);
  }
  return jar;
}

async function main() {
  // --- Public pages ---
  for (const path of ["/", "/login", "/signup"]) {
    try {
      const { status, text } = await req(`${BASE}${path}`);
      if (status !== 200) issue("major", "public", `${path} returned ${status}`);
      else ok("public", `${path} 200`);
      if (path === "/" && !text.includes("Someone who remembers")) {
        issue("major", "landing", "Headline missing from HTML");
      }
      if (path === "/signup" && !text.includes("Create your account")) {
        issue("major", "signup", "Signup heading missing");
      }
    } catch (error) {
      issue("blocker", "public", `${path} failed to load`, String(error));
    }
  }

  try {
    const { status, response } = await req(`${BASE}/home`);
    const loc = response.headers.get("location") ?? "";
    if (status === 307 || status === 308) {
      if (loc.includes("/login")) ok("auth", "/home redirects to login when logged out");
      else issue("major", "auth", `/home redirected to ${loc}, expected /login`);
    } else {
      issue("major", "auth", `/home returned ${status} without login redirect`);
    }
  } catch (error) {
    issue("blocker", "auth", "/home request hung or failed", String(error));
  }

  try {
    const { status } = await req(`${BASE}/forgot-password`);
    if (status === 404) {
      issue(
        "major",
        "auth",
        "/forgot-password 404s even though middleware allows it",
      );
    } else ok("auth", `/forgot-password ${status}`);
  } catch (error) {
    issue("major", "auth", "/forgot-password failed", String(error));
  }

  try {
    const { text } = await req(`${BASE}/`);
    if (text.includes('href="/login"') && text.includes("Terms")) {
      issue("minor", "landing", "Terms/Privacy footer links go to /login");
    }
  } catch {}

  // --- Direct API health ---
  try {
    const { status, text } = await req(`${API}/auth/login`, {
      method: "POST",
      body: JSON.stringify({ email: "nope@example.com", password: "wrongpass" }),
    });
    if (status === 401) ok("api", "login rejects bad credentials");
    else issue("major", "api", `bad login returned ${status}`, text.slice(0, 200));
  } catch (error) {
    issue("blocker", "api", "API login unreachable", String(error));
  }

  // --- Register via BFF ---
  let cookies = "";
  try {
    const { status, text, response } = await req(`${BASE}/api/bff/auth/register`, {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password, displayName }),
    });
    const setCookie = response.headers.getSetCookie?.() ?? [];
    if (status !== 200) {
      issue("blocker", "signup", `BFF register returned ${status}`, text.slice(0, 400));
    } else {
      ok("signup", "BFF register 200");
      const jar = parseCookies(setCookie);
      if (!jar.ag_at) issue("blocker", "signup", "register did not set ag_at cookie");
      if (!jar.ag_rt && !setCookie.some((c) => c.startsWith("ag_rt="))) {
        issue(
          "major",
          "signup",
          "ag_rt may be missing from document cookie jar (path-scoped is OK)",
        );
      }
      if (!jar.ag_session) issue("major", "signup", "register did not set ag_session");
      cookies = cookieHeader(setCookie);
    }
  } catch (error) {
    issue("blocker", "signup", "BFF register failed", String(error));
  }

  // duplicate email
  try {
    const { status } = await req(`${BASE}/api/bff/auth/register`, {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password, displayName }),
    });
    if (status === 409) ok("signup", "duplicate email returns 409");
    else issue("major", "signup", `duplicate register returned ${status}, expected 409`);
  } catch (error) {
    issue("major", "signup", "duplicate register failed", String(error));
  }

  // bad login
  try {
    const { status, text } = await req(`${BASE}/api/bff/auth/login`, {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
      body: JSON.stringify({ email, password: "wrong-password" }),
    });
    if (status === 401) ok("login", "wrong password 401");
    else issue("major", "login", `wrong password returned ${status}`, text.slice(0, 200));
  } catch (error) {
    issue("major", "login", "wrong password request failed", String(error));
  }

  if (!cookies) {
    console.log("\nNo session; skipping authenticated flows.");
    printSummary();
    return;
  }

  const authHeaders = { cookie: cookies };

  // --- Authenticated pages ---
  try {
    const { status, response, text } = await req(`${BASE}/home`, {
      headers: authHeaders,
    });
    const loc = response.headers.get("location") ?? "";
    if (status === 200 && text.includes("She's not here yet")) {
      ok("home", "no companion shows home empty state");
    } else if ((status === 307 || status === 308) && loc.includes("/onboarding")) {
      issue(
        "blocker",
        "onboarding",
        "Skip is a loop: /home redirects back to onboarding without a companion",
      );
    } else {
      issue("major", "home", `/home with no companion returned ${status} ${loc}`);
    }
  } catch (error) {
    issue("blocker", "home", "authenticated /home failed", String(error));
  }

  try {
    const { status, text } = await req(`${BASE}/onboarding`, { headers: authHeaders });
    if (status === 200 && text.includes("Meet someone new")) ok("onboarding", "intro loads");
    else issue("major", "onboarding", `intro ${status}`, text.slice(0, 120));
  } catch (error) {
    issue("major", "onboarding", "intro failed", String(error));
  }

  for (const path of [
    "/onboarding/appearance",
    "/onboarding/personality",
    "/onboarding/voice",
    "/onboarding/finalize",
  ]) {
    try {
      const { status } = await req(`${BASE}${path}`, { headers: authHeaders });
      if (status === 200) ok("onboarding", `${path} 200`);
      else issue("major", "onboarding", `${path} returned ${status}`);
    } catch (error) {
      issue("major", "onboarding", `${path} failed`, String(error));
    }
  }

  // skip loop: visiting /home after skip
  try {
    const { status, response } = await req(`${BASE}/home`, { headers: authHeaders });
    const loc = response.headers.get("location") ?? "";
    if (loc.includes("/onboarding")) {
      issue(
        "blocker",
        "onboarding",
        "Skip is a loop: /home always redirects back to onboarding without a companion",
      );
    } else if (status === 200) {
      ok("onboarding", "skip lands on home without a redirect loop");
    }
  } catch {}

  // --- Create companion via BFF ---
  let companionId;
  try {
    const { status, text } = await req(`${BASE}/api/bff/avatars`, {
      method: "POST",
      headers: { ...authHeaders, origin: "http://localhost:3000" },
      body: JSON.stringify({
        name: "Aria",
        gender: "FEMALE",
        systemPrompt: "You are Aria.",
        greeting: "Hey — I'm Aria.",
        appearance: {
          hairColor: "Brown",
          eyeColor: "Brown",
          skinTone: "Medium",
          metadata: { style: "warm" },
        },
        personality: {
          traits: ["Warm", "Playful"],
          humorLevel: 5,
          flirtLevel: 5,
          empathyLevel: 7,
          romanceLevel: 5,
          metadata: { relationshipType: "girlfriend" },
        },
        voice: { provider: "gemini", voiceId: "Aoede", language: "en" },
      }),
    });
    if (status !== 200 && status !== 201) {
      issue("blocker", "onboarding", `POST /avatars ${status}`, text.slice(0, 500));
    } else {
      const parsed = JSON.parse(text);
      const data = parsed.data ?? parsed;
      companionId = data.id;
      ok("onboarding", `companion created id=${companionId}`);
    }
  } catch (error) {
    issue("blocker", "onboarding", "create companion failed", String(error));
  }

  if (companionId) {
    try {
      const { status, text } = await req(`${BASE}/home`, { headers: authHeaders });
      if (status === 200 && text.includes("Aria")) ok("home", "home renders companion");
      else if (status === 200) ok("home", "home 200 after companion");
      else issue("major", "home", `home after create ${status}`, text.slice(0, 150));
    } catch (error) {
      issue("major", "home", "home after create failed", String(error));
    }

    try {
      const { status, response, text } = await req(`${BASE}/chat`, {
        headers: authHeaders,
      });
      const loc = response.headers.get("location") ?? "";
      if (status === 307 && /\/chat\/\d+/.test(loc)) {
        ok("chat", ` /chat redirects to ${loc}`);
        const thread = await req(`${BASE}${loc}`, { headers: authHeaders });
        if (thread.status === 200) ok("chat", "conversation page 200");
        else issue("major", "chat", `thread ${thread.status}`);
      } else if (status === 200) {
        ok("chat", "chat page 200");
      } else {
        issue("major", "chat", `/chat ${status} loc=${loc}`, text.slice(0, 200));
      }
    } catch (error) {
      issue("major", "chat", "/chat failed", String(error));
    }

    // stream a message
    try {
      const list = await req(`${BASE}/api/bff/conversations`, {
        headers: { ...authHeaders, origin: "http://localhost:3000" },
      });
      const parsed = JSON.parse(list.text);
      const conversations = parsed.data ?? parsed;
      const id = conversations[0]?.id;
      if (!id) {
        issue("major", "chat", "no conversation after /chat");
      } else {
        const stream = await req(
          `${BASE}/api/bff/conversations/${id}/messages/stream`,
          {
            method: "POST",
            headers: { ...authHeaders, origin: "http://localhost:3000" },
            body: JSON.stringify({ content: "Hello Aria, this is a test.", type: "TEXT" }),
          },
          45000,
        );
        if (stream.status !== 200) {
          issue(
            "major",
            "chat",
            `SSE stream ${stream.status}`,
            stream.text.slice(0, 400),
          );
        } else if (!stream.text.includes("event:")) {
          issue("major", "chat", "stream 200 but no SSE events", stream.text.slice(0, 200));
        } else if (stream.text.includes("event: error")) {
          issue("major", "chat", "stream emitted error event", stream.text.slice(0, 400));
        } else {
          ok("chat", "SSE stream returned events");
        }
      }
    } catch (error) {
      issue("major", "chat", "SSE send failed", String(error));
    }

    try {
      const { status, text } = await req(`${BASE}/memory`, { headers: authHeaders });
      if (status === 200) ok("memory", "memory list 200");
      else issue("major", "memory", `memory ${status}`, text.slice(0, 150));
    } catch (error) {
      issue("major", "memory", "memory page failed", String(error));
    }

    try {
      const { status } = await req(`${BASE}/companion/${companionId}`, {
        headers: authHeaders,
      });
      if (status === 200) ok("companion", "profile 200");
      else issue("major", "companion", `profile ${status}`);
    } catch (error) {
      issue("major", "companion", "profile failed", String(error));
    }

    try {
      const { status } = await req(`${BASE}/account`, { headers: authHeaders });
      if (status === 200) ok("account", "account 200");
      else issue("major", "account", `account ${status}`);
    } catch (error) {
      issue("major", "account", "account failed", String(error));
    }
  }

  // CSRF origin check
  try {
    const { status } = await req(`${BASE}/api/bff/auth/login`, {
      method: "POST",
      headers: { origin: "http://evil.example" },
      body: JSON.stringify({ email, password }),
    });
    if (status === 403) ok("security", "cross-origin login blocked");
    else issue("minor", "security", `cross-origin login returned ${status}`);
  } catch {}

  printSummary();
}

function printSummary() {
  console.log("\n=== SUMMARY ===");
  const order = { blocker: 0, major: 1, minor: 2 };
  findings.sort((a, b) => order[a.severity] - order[b.severity]);
  if (findings.length === 0) {
    console.log("No issues recorded.");
    return;
  }
  for (const item of findings) {
    console.log(`- (${item.severity}) [${item.area}] ${item.message}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
