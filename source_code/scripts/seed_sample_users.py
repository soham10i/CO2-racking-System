#!/usr/bin/env python3
"""Create sample users through the public API (so every number uses the real emission engine).

  python3 scripts/seed_sample_users.py [--base http://localhost:8081] [--mailhog http://localhost:8025]

Users (all in Germany, verified through MailHog, onboarding done):
  sample.year@co2tracker.test     365 days of generated activity (seasonal heating, holidays, a flight)
  sample.twomonths@co2tracker.test 60 days of generated activity
  sample.tester1/2@co2tracker.test empty accounts for manual entry
Passwords are random and written to .sample-accounts.txt (git-ignored), never printed.
The data is synthetic ("augmented"), deterministic per user (fixed random seed). Re-running skips users that exist.
"""
import argparse, datetime as dt, json, random, re, secrets, sys, time, urllib.error, urllib.parse, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ACCOUNTS = ROOT / ".sample-accounts.txt"


def call(base, path, method="GET", body=None, token=None, expect=(200, 201, 202, 204)):
    req = urllib.request.Request(base + "/api/v1" + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read()
                return json.loads(raw) if raw else None
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2 + attempt * 2)
                continue
            if e.code in expect:
                return None
            raise RuntimeError(f"{method} {path} -> {e.code}: {e.read()[:300]!r}") from None
    raise RuntimeError(f"{method} {path}: still rate limited")


def verification_token(mailhog, email):
    q = urllib.parse.urlencode({"kind": "to", "query": email})
    for _ in range(20):
        with urllib.request.urlopen(f"{mailhog}/api/v2/search?{q}", timeout=10) as r:
            items = json.load(r).get("items", [])
        for it in items:
            body = it["Content"]["Body"].replace("=\r\n", "").replace("=3D", "=")
            m = re.search(r"token=([A-Za-z0-9_\-]+)", body)
            if m:
                return m.group(1)
        time.sleep(1)
    raise RuntimeError("no verification mail for " + email)


def make_user(base, mailhog, email, name):
    password = secrets.token_urlsafe(18)
    call(base, "/auth/register", "POST", {"email": email, "password": password, "displayName": name})
    call(base, "/auth/verify-email", "POST", {"token": verification_token(mailhog, email)})
    token = call(base, "/auth/login", "POST", {"email": email, "password": password})["accessToken"]
    call(base, "/me/profile", "PUT", {"displayName": name, "country": "DE", "timezone": "Europe/Berlin",
                                      "units": "METRIC", "digestOptIn": False, "onboardingCompleted": True}, token)
    return password, token


def generate(days, seed, today):
    """A German commuter: weekday car or train, two to three meals a day, monthly energy, weekly waste."""
    rnd = random.Random(seed)
    out = []
    add = lambda d, c, s, q: out.append({"category": c, "subtype": s, "quantity": round(q, 1), "occurredOn": d.isoformat()})
    start = today - dt.timedelta(days=days - 1)
    holiday = start + dt.timedelta(days=rnd.randint(days // 3, max(days // 3 + 1, days - 20))) if days >= 180 else None
    for i in range(days):
        d = start + dt.timedelta(days=i)
        away = holiday and holiday <= d < holiday + dt.timedelta(days=10)
        winter = d.month in (11, 12, 1, 2, 3)
        if d.weekday() < 5 and not away:  # commute, 18 km each way
            mode = rnd.choices(["CAR_PETROL", "TRAIN_REGIONAL", "BIKE_WALK", "BUS"], [0.5, 0.3, 0.1 if winter else 0.25, 0.1])[0]
            add(d, "TRANSPORT", mode, 36 * rnd.uniform(0.9, 1.1))
        elif rnd.random() < 0.35:  # weekend trip
            add(d, "TRANSPORT", rnd.choice(["CAR_PETROL", "TRAIN_LONG", "TRAM_SUBWAY"]), rnd.uniform(10, 120))
        if not away:
            for _ in range(rnd.choice([2, 2, 3])):
                add(d, "DIET", rnd.choices(["MEAL_VEGETARIAN", "MEAL_POULTRY", "MEAL_PORK", "MEAL_BEEF", "MEAL_FISH", "MEAL_VEGAN", "MEAL_LAMB"],
                                           [0.3, 0.2, 0.15, 0.12, 0.08, 0.12, 0.03])[0], 1)
        if d.weekday() == 6:  # weekly
            add(d, "WASTE", "RECYCLING", rnd.uniform(2, 4))
            add(d, "WASTE", "INCINERATION", rnd.uniform(3, 6))
            add(d, "WASTE", "COMPOST", rnd.uniform(1, 3))
            add(d, "ENERGY", "ELECTRICITY", rnd.uniform(45, 70) * (0.5 if away else 1))
            add(d, "ENERGY", "NATURAL_GAS", rnd.uniform(250, 420) if winter else rnd.uniform(30, 70))
        if rnd.random() < 0.06:
            add(d, "SHOPPING", "OTHER_GOODS", rnd.uniform(15, 120))
        if rnd.random() < 0.01:
            add(d, "SHOPPING", rnd.choice(["TSHIRT", "JEANS"]), 1)
    if holiday:
        add(holiday, "TRANSPORT", "FLIGHT_SHORT", 1150)
        add(holiday + dt.timedelta(days=9), "TRANSPORT", "FLIGHT_SHORT", 1150)
    if days >= 300:
        add(start + dt.timedelta(days=days // 2), "SHOPPING", "SMARTPHONE", 1)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8081")
    ap.add_argument("--mailhog", default="http://localhost:8025")
    a = ap.parse_args()
    today = dt.date.today()
    users = [("sample.year@co2tracker.test", "Yara (1 year)", 365, 2025),
             ("sample.twomonths@co2tracker.test", "Tom (2 months)", 60, 60),
             ("sample.tester1@co2tracker.test", "Tester One", 0, 0),
             ("sample.tester2@co2tracker.test", "Tester Two", 0, 0)]
    existing = ACCOUNTS.read_text() if ACCOUNTS.exists() else ""
    lines = []
    for email, name, days, seed in users:
        if email in existing:
            print(f"skip {email} (already in {ACCOUNTS.name})")
            continue
        password, token = make_user(a.base, a.mailhog, email, name)
        lines.append(f"{email}  {password}  # {name}")
        ACCOUNTS.write_text(existing + "".join(l + "\n" for l in lines))
        acts = generate(days, seed, today) if days else []
        for n, act in enumerate(acts, 1):
            call(a.base, "/activities", "POST", act, token)
            if n % 20 == 0:
                time.sleep(0.8)  # stay under nginx's 30 req/s budget
        print(f"created {email}: {len(acts)} activities over {days} days")
    print(f"passwords: {ACCOUNTS}")


if __name__ == "__main__":
    sys.exit(main())
