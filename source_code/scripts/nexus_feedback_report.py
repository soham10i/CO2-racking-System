#!/usr/bin/env python3
"""Offline review of Nexus answers: the improvement loop for the prompt and the data context.

  python3 scripts/nexus_feedback_report.py [--days 30] [--out nexus-feedback.md]

Reads the database the api uses (SUPABASE_DB_* or the local postgres from .env) through the postgres:16 image,
so no Python driver is needed. Writes a Markdown report with helpful/unhelpful rates per week and every
unhelpful answer with the question before it and the user's note. User ids and emails are NOT included.
Review it, then change NexusService.SYSTEM_PROMPT or NexusContext and re-check the rate the next week.
"""
import argparse, csv, io, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def env():
    vals = {}
    for line in (ROOT / ".env").read_text().splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.split("=", 1)
            vals[k.strip()] = v.strip()
    return vals


def query(sql, e):
    if e.get("SUPABASE_DB_URL"):
        host_port = e["SUPABASE_DB_URL"].split("//", 1)[1].split("/", 1)[0]
        host, port = host_port.split(":")
        cmd = ["docker", "run", "--rm", "-i", "-e", "PGPASSWORD", "postgres:16-alpine", "psql",
               f"host={host} port={port} dbname=postgres user={e['SUPABASE_DB_USER']} sslmode=require",
               "--csv", "-c", sql]
        pw = e["SUPABASE_DB_PASSWORD"]
    else:
        cmd = ["docker", "compose", "exec", "-T", "-e", "PGPASSWORD", "postgres", "psql", "-U", "co2tracker",
               "-d", "co2tracker", "--csv", "-c", sql]
        pw = e.get("DB_PASSWORD", "")
    out = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, env={**os.environ, "PGPASSWORD": pw})
    if out.returncode:
        sys.exit(out.stderr.strip())
    return list(csv.DictReader(io.StringIO(out.stdout)))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=30)
    ap.add_argument("--out", default="nexus-feedback.md")
    a = ap.parse_args()
    e = env()
    since = f"now() - interval '{int(a.days)} days'"
    weekly = query(f"""
        select to_char(date_trunc('week', created_at), 'YYYY-MM-DD') as week,
               count(*) as answers,
               count(*) filter (where rating = 1) as helpful,
               count(*) filter (where rating = -1) as unhelpful
        from nexus_message where role = 'assistant' and created_at >= {since}
        group by 1 order by 1""", e)
    bad = query(f"""
        select to_char(a.created_at, 'YYYY-MM-DD') as day, a.model,
               (select q.content from nexus_message q where q.conversation_id = a.conversation_id
                  and q.role = 'user' and q.created_at <= a.created_at order by q.created_at desc limit 1) as question,
               a.content as answer, coalesce(a.rating_note, '') as note
        from nexus_message a where a.role = 'assistant' and a.rating = -1 and a.created_at >= {since}
        order by a.created_at desc limit 200""", e)
    lines = [f"# Nexus feedback, last {a.days} days", "", "| Week | Answers | Helpful | Unhelpful | Rated helpful |",
             "|---|---|---|---|---|"]
    for w in weekly:
        rated = int(w["helpful"]) + int(w["unhelpful"])
        share = f"{100 * int(w['helpful']) / rated:.0f} %" if rated else "n/a"
        lines.append(f"| {w['week']} | {w['answers']} | {w['helpful']} | {w['unhelpful']} | {share} |")
    lines += ["", f"## Unhelpful answers ({len(bad)})", ""]
    for b in bad:
        lines += [f"### {b['day']} · {b['model']}", f"**Question:** {b['question']}", "",
                  f"**Answer:** {b['answer'][:1200]}", ""]
        if b["note"]:
            lines += [f"**User's note:** {b['note']}", ""]
    Path(a.out).write_text("\n".join(lines) + "\n")
    print(f"wrote {a.out}: {sum(int(w['answers']) for w in weekly)} answers, {len(bad)} unhelpful")


if __name__ == "__main__":
    main()
