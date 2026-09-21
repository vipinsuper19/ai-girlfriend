const BASE = "http://localhost:3000";
const stamp = Date.now();
const email = `webtest2.${stamp}@example.com`;
const password = "password12";
const displayName = "Followup Tester";
const origin = { origin: "http://localhost:3000" };

const findings = [];
const ok = (area, message) => console.log(`[ok] ${area}: ${message}`);
const issue = (severity, area, message, detail) => {
  findings.push({ severity, area, message });
  console.log(`[${severity}] ${area}: ${message}`);
  if (detail) console.log(`         ${String(detail).slice(0, 400)}`);
};

async function req(url, options = {}, timeoutMs = 20000) {
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
  return setCookie.map((c) => c.split(";")[0]).join("; ");
}

async function main() {
  for (const path of [
    "/reset-password",
    "/chat/history",
    "/account/security",
    "/account/appearance",
    "/account/subscription",
    "/account/privacy",
    "/memory/privacy",
  ]) {
    const { status, response } = await req(`${BASE}${path}`);
    const loc = response.headers.get("location") ?? "";
    if (path === "/reset-password") {
      if (status === 404) {
        issue("major", "auth", "/reset-password 404s while middleware treats it as public");
      } else if (status === 307 && loc.includes("/login")) {
        issue("minor", "auth", `/reset-password redirected to login (${status})`);
      } else ok("auth", `/reset-password ${status}`);
      continue;
    }
    if (status === 307 && loc.includes("/login")) {
      ok("auth", `${path} requires login`);
    } else {
      issue("major", "auth", `${path} returned ${status} loc=${loc}, expected login redirect`);
    }
  }

  const register = await req(`${BASE}/api/bff/auth/register`, {
    method: "POST",
    headers: origin,
    body: JSON.stringify({ email, password, displayName }),
  });
  if (register.status !== 200) {
    issue("blocker", "signup", `register ${register.status}`, register.text);
    print();
    return;
  }
  ok("signup", "register 200");
  let cookies = cookieHeader(register.response.headers.getSetCookie?.() ?? []);

  const login = await req(`${BASE}/api/bff/auth/login`, {
    method: "POST",
    headers: origin,
    body: JSON.stringify({ email, password }),
  });
  if (login.status !== 200) {
    issue("major", "login", `login after register ${login.status}`, login.text);
  } else {
    ok("login", "login after register 200");
    cookies = cookieHeader(login.response.headers.getSetCookie?.() ?? []) || cookies;
  }

  const auth = { cookie: cookies, ...origin };

  const loggedOutOnboarding = await req(`${BASE}/onboarding`);
  if (
    loggedOutOnboarding.status === 307 &&
    (loggedOutOnboarding.response.headers.get("location") ?? "").includes("/login")
  ) {
    ok("onboarding", "logged-out /onboarding redirects to login");
  } else {
    issue(
      "major",
      "onboarding",
      `/onboarding logged-out ${loggedOutOnboarding.status}`,
    );
  }

  const sessionOnly = cookies
    .split("; ")
    .filter((c) => c.startsWith("ag_session="))
    .join("; ");
  const homeSession = await req(`${BASE}/home`, {
    headers: { cookie: sessionOnly },
  });
  const loginSession = await req(`${BASE}/login`, {
    headers: { cookie: sessionOnly },
  });
  const homeLoc = homeSession.response.headers.get("location") ?? "";
  const loginLoc = loginSession.response.headers.get("location") ?? "";
  const homeToRefresh =
    (homeSession.status === 307 || homeSession.status === 308) &&
    homeLoc.includes("/api/bff/auth/refresh");
  const loginToRefresh =
    (loginSession.status === 307 || loginSession.status === 308) &&
    loginLoc.includes("/api/bff/auth/refresh");
  const loop =
    (homeSession.status === 307 || homeSession.status === 308) &&
    homeLoc.includes("/login") &&
    (loginSession.status === 307 || loginSession.status === 308) &&
    loginLoc.includes("/home") &&
    !homeLoc.includes("/api/bff/auth/refresh");
  if (loop) {
    issue(
      "blocker",
      "auth",
      "Expired access token + ag_session causes a /home ↔ /login redirect loop",
      `home→${homeLoc} login→${loginLoc}`,
    );
  } else if (homeToRefresh && loginToRefresh) {
    const refreshPath = homeLoc.startsWith("http")
      ? `${new URL(homeLoc).pathname}${new URL(homeLoc).search}`
      : homeLoc;
    const bounced = await req(`${BASE}${refreshPath}`, {
      headers: { cookie: sessionOnly },
    });
    const bouncedLoc = bounced.response.headers.get("location") ?? "";
    if (
      (bounced.status === 307 || bounced.status === 308) &&
      bouncedLoc.includes("/login")
    ) {
      ok("auth", "session-only request refreshes then lands on login (no loop)");
    } else {
      issue(
        "major",
        "auth",
        `refresh bounce returned ${bounced.status} loc=${bouncedLoc}`,
      );
    }
  } else {
    ok(
      "auth",
      `session-only home=${homeSession.status}/${homeLoc || "n/a"} login=${loginSession.status}/${loginLoc || "n/a"}`,
    );
  }

  const companionRes = await req(`${BASE}/api/bff/avatars`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      name: "Nova",
      gender: "FEMALE",
      systemPrompt: "You are Nova.",
      greeting: "Hey — I'm Nova.",
      appearance: { hairColor: "Black", eyeColor: "Green", skinTone: "Fair" },
      personality: {
        traits: ["Warm"],
        humorLevel: 5,
        flirtLevel: 4,
        empathyLevel: 8,
        romanceLevel: 5,
      },
      voice: { provider: "gemini", voiceId: "Kore", language: "en" },
    }),
  });
  if (![200, 201].includes(companionRes.status)) {
    issue("blocker", "companion", `create ${companionRes.status}`, companionRes.text);
    print();
    return;
  }
  const companion = JSON.parse(companionRes.text).data ?? JSON.parse(companionRes.text);
  ok("companion", `created ${companion.id}`);

  const patchUser = await req(`${BASE}/api/bff/users/me`, {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ displayName: "Renamed Tester" }),
  });
  if (![200, 201].includes(patchUser.status)) {
    issue("major", "account", `PATCH /users/me ${patchUser.status}`, patchUser.text);
  } else ok("account", "display name PATCH 200");

  const patchCompanion = await req(`${BASE}/api/bff/avatars/${companion.id}`, {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ name: "Nova Prime" }),
  });
  if (![200, 201].includes(patchCompanion.status)) {
    issue("major", "companion", `PATCH avatar ${patchCompanion.status}`, patchCompanion.text);
  } else ok("companion", "name PATCH 200");

  const created = await req(`${BASE}/api/bff/conversations`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ companionId: companion.id }),
  });
  const conversation =
    JSON.parse(created.text).data ?? JSON.parse(created.text);
  if (!conversation?.id) {
    issue("major", "chat", "conversation create failed", created.text);
  } else {
    ok("chat", `conversation ${conversation.id} title=${JSON.stringify(conversation.title)}`);
    if (!conversation.title) {
      issue("minor", "chat", "new conversations have no title, UI always shows “Conversation”");
    }
    const stream = await req(
      `${BASE}/api/bff/conversations/${conversation.id}/messages/stream`,
      {
        method: "POST",
        headers: auth,
        body: JSON.stringify({
          content: "My favourite colour is teal and I live in Delhi.",
          type: "TEXT",
        }),
      },
      60000,
    );
    const hasDone = stream.text.includes("event: done");
    const hasError = stream.text.includes("event: error");
    const hasDelta = stream.text.includes("event: delta");
    if (hasError) issue("major", "chat", "stream error event", stream.text.slice(0, 300));
    else if (hasDelta || hasDone) {
      ok("chat", `stream ${stream.status} delta=${hasDelta} done=${hasDone}`);
    } else {
      issue("major", "chat", `stream ${stream.status} empty`, stream.text.slice(0, 200));
    }
  }

  const memories = await req(`${BASE}/api/bff/memories?limit=50`, { headers: auth });
  let memoryList = [];
  try {
    memoryList = JSON.parse(memories.text).data ?? JSON.parse(memories.text) ?? [];
  } catch {
    memoryList = [];
  }
  ok("memory", `list status=${memories.status} count=${Array.isArray(memoryList) ? memoryList.length : "?"}`);
  if (Array.isArray(memoryList) && memoryList.length === 0) {
    issue(
      "minor",
      "memory",
      "no memories after a fact-filled message (extraction may be async or skipped)",
    );
  } else if (Array.isArray(memoryList) && memoryList[0]) {
    const first = memoryList[0];
    const patchMem = await req(`${BASE}/api/bff/memories/${first.id}`, {
      method: "PATCH",
      headers: auth,
      body: JSON.stringify({ content: "Edited memory from test", importance: 6 }),
    });
    if (![200, 201].includes(patchMem.status)) {
      issue("major", "memory", `PATCH memory ${patchMem.status}`, patchMem.text);
    } else ok("memory", "PATCH memory 200");
  }

  const badType = await req(`${BASE}/memory?type=NOPE`, { headers: { cookie: cookies } });
  if (badType.status === 200 && badType.text.includes("Nothing here yet")) {
    issue(
      "minor",
      "memory",
      "invalid ?type=NOPE shows the same empty state as “no memories yet”",
    );
  } else ok("memory", `invalid type page ${badType.status}`);

  for (const path of [
    "/chat/history",
    "/account/security",
    "/account/appearance",
    "/account/subscription",
    "/account/privacy",
    "/memory/privacy",
    `/companion/${companion.id}`,
    `/companion/${companion.id}/edit`,
  ]) {
    const { status, text } = await req(`${BASE}${path}`, { headers: { cookie: cookies } });
    if (status === 200) ok("pages", `${path} 200`);
    else issue("major", "pages", `${path} ${status}`, text.slice(0, 120));
  }

  const historyHtml = await req(`${BASE}/chat/history`, { headers: { cookie: cookies } });
  if (historyHtml.text.includes("Start a new conversation")) {
    ok("chat", "history page has new-conversation control");
  }

  const logout = await req(`${BASE}/api/bff/auth/logout`, {
    method: "POST",
    headers: auth,
  });
  if (![200, 204].includes(logout.status)) {
    issue("major", "auth", `logout ${logout.status}`, logout.text);
  } else ok("auth", `logout ${logout.status}`);

  const afterLogout = await req(`${BASE}/home`, { headers: { cookie: cookies } });
  const afterLoc = afterLogout.response.headers.get("location") ?? "";
  if ((afterLogout.status === 307 || afterLogout.status === 308) && afterLoc.includes("/login")) {
    ok("auth", "after logout, /home redirects to login");
  } else {
    issue(
      "major",
      "auth",
      `after logout /home ${afterLogout.status} loc=${afterLoc} (cookies may still look signed-in)`,
    );
  }

  print();
}

function print() {
  console.log("\n=== FOLLOW-UP SUMMARY ===");
  for (const item of findings) {
    console.log(`- (${item.severity}) [${item.area}] ${item.message}`);
  }
  if (findings.length === 0) console.log("No extra issues.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    setTimeout(() => process.exit(process.exitCode ?? 0), 50);
  });
