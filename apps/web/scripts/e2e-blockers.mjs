const BASE = "http://localhost:3000";
const stamp = Date.now();
const email = `blocker.${stamp}@example.com`;
const password = "password12";
const origin = { origin: "http://localhost:3000" };

async function req(url, options = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(20000),
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  return {
    response,
    text,
    status: response.status,
    loc: response.headers.get("location") ?? "",
  };
}

function cookieHeader(response) {
  return (response.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .join("; ");
}

function pick(jar, names) {
  return jar
    .split("; ")
    .filter((c) => names.some((name) => c.startsWith(`${name}=`)))
    .join("; ");
}

function locPath(loc) {
  if (!loc) return "";
  if (loc.startsWith("http")) {
    const url = new URL(loc);
    return `${url.pathname}${url.search}`;
  }
  return loc;
}

const failures = [];
function check(name, ok, detail) {
  if (ok) console.log(`[ok] ${name}`);
  else {
    failures.push(name);
    console.log(`[fail] ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const reg = await req(`${BASE}/api/bff/auth/register`, {
  method: "POST",
  headers: origin,
  body: JSON.stringify({ email, password, displayName: "Blocker" }),
});
if (reg.status !== 200) {
  console.error("register failed", reg.status, reg.text.slice(0, 200));
  process.exit(1);
}
const jar = cookieHeader(reg.response);
const auth = { cookie: jar };

const home = await req(`${BASE}/home`, { headers: auth });
check(
  "skip home empty state",
  home.status === 200 && home.text.includes("She's not here yet"),
  `${home.status} ${home.loc}`,
);

const chat = await req(`${BASE}/chat`, { headers: auth });
check(
  "skip chat empty state",
  chat.status === 200 && chat.text.includes("No one to talk to yet"),
  `${chat.status} ${chat.loc}`,
);

const sessionOnly = pick(jar, ["ag_session"]);
const sessionAndRt = pick(jar, ["ag_session", "ag_rt"]);

const homeSess = await req(`${BASE}/home`, { headers: { cookie: sessionOnly } });
const loginSess = await req(`${BASE}/login`, {
  headers: { cookie: sessionOnly },
});
check(
  "session-only home bounces to refresh",
  [307, 308].includes(homeSess.status) &&
    locPath(homeSess.loc).includes("/api/bff/auth/refresh"),
  `${homeSess.status} ${homeSess.loc}`,
);
check(
  "session-only login bounces to refresh (not /home)",
  [307, 308].includes(loginSess.status) &&
    locPath(loginSess.loc).includes("/api/bff/auth/refresh") &&
    !locPath(loginSess.loc).includes("/home"),
  `${loginSess.status} ${loginSess.loc}`,
);

const bounced = await req(`${BASE}${locPath(homeSess.loc)}`, {
  headers: { cookie: sessionOnly },
});
check(
  "refresh without rt goes to login",
  [307, 308].includes(bounced.status) && locPath(bounced.loc).includes("/login"),
  `${bounced.status} ${bounced.loc}`,
);
check(
  "no home↔login loop",
  !(
    locPath(homeSess.loc).includes("/login") &&
    locPath(loginSess.loc).includes("/home")
  ),
);

const homeRt = await req(`${BASE}/home`, { headers: { cookie: sessionAndRt } });
check(
  "expired access with rt bounces to refresh",
  [307, 308].includes(homeRt.status) &&
    locPath(homeRt.loc).includes("/api/bff/auth/refresh"),
  `${homeRt.status} ${homeRt.loc}`,
);
const refreshed = await req(`${BASE}${locPath(homeRt.loc)}`, {
  headers: { cookie: sessionAndRt },
});
const setCookies = refreshed.response.headers.getSetCookie?.() ?? [];
check(
  "refresh with rt restores access and returns to home",
  [307, 308].includes(refreshed.status) &&
    locPath(refreshed.loc).includes("/home") &&
    setCookies.some((c) => c.startsWith("ag_at=") && !c.includes("Max-Age=0")),
  `${refreshed.status} ${refreshed.loc}`,
);

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log("\nblockers fixed");
process.exit(0);
