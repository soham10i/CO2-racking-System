"""End-to-end smoke test: client -> Hermes API server -> Mercury (real or mock).

Usage: python tests/smoke_test.py [--url http://localhost:8642] [--expect-mock]
Reads API_SERVER_KEY from the environment. Stdlib only. Never prints keys.
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request


def call(url, key=None, body=None, timeout=120):
    req = urllib.request.Request(url, data=json.dumps(body).encode() if body else None,
                                 method="POST" if body else "GET")
    req.add_header("Content-Type", "application/json")
    if key:
        req.add_header("Authorization", f"Bearer {key}")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.status, json.loads(r.read() or b"{}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--url", default=os.environ.get("AGENT_URL", "http://localhost:8642"))
    p.add_argument("--expect-mock", action="store_true")
    p.add_argument("--wait", type=int, default=120, help="seconds to wait for /health")
    a = p.parse_args()
    key = os.environ.get("API_SERVER_KEY")
    if not key:
        sys.exit("FAIL: API_SERVER_KEY not set")

    deadline = time.time() + a.wait
    while True:
        try:
            status, body = call(f"{a.url}/health", timeout=5)
            if status == 200:
                print(f"ok   /health -> {body}")
                break
        except (urllib.error.URLError, ConnectionError, OSError):
            pass
        if time.time() > deadline:
            sys.exit(f"FAIL: agent not healthy at {a.url} after {a.wait}s")
        time.sleep(2)

    try:
        call(f"{a.url}/v1/chat/completions", key="wrong-key-xxxx",
             body={"model": "hermes-agent", "messages": [{"role": "user", "content": "hi"}]})
        sys.exit("FAIL: request with a wrong key was accepted")
    except urllib.error.HTTPError as e:
        print(f"ok   wrong bearer key rejected ({e.code})")

    status, body = call(f"{a.url}/v1/chat/completions", key=key, body={
        "model": "hermes-agent",
        "messages": [{"role": "user", "content": "Reply with one short friendly sentence."}],
    })
    content = (body.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    if status != 200 or not content.strip():
        sys.exit(f"FAIL: empty/bad completion: status={status} body={json.dumps(body)[:500]}")
    print(f"ok   /v1/chat/completions -> {content[:200]!r}")
    if a.expect_mock and "MOCK-MERCURY-OK" not in content:
        sys.exit("FAIL: reply did not come from the mock Mercury server")
    print("PASS")


if __name__ == "__main__":
    main()
