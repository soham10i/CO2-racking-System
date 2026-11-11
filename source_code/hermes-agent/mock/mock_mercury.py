"""Minimal OpenAI-compatible stand-in for the Mercury API, used when no key is set.

Implements GET /v1/models and POST /v1/chat/completions (streaming and non-streaming).
Every reply contains MOCK_MARKER so the smoke test can tell the agent really went through it.
"""
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MARKER = os.environ.get("MOCK_MARKER", "MOCK-MERCURY-OK")
MODEL = os.environ.get("MERCURY_MODEL", "mercury-2")
EXPECTED_KEY = os.environ.get("MOCK_EXPECTED_KEY", "mock-key")


class Handler(BaseHTTPRequestHandler):
    def _json(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self):
        if self.headers.get("Authorization", "") != f"Bearer {EXPECTED_KEY}":
            self._json(401, {"error": {"message": "invalid api key (mock)", "type": "auth"}})
            return False
        return True

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"status": "ok"})
        if self.path.rstrip("/") == "/v1/models":
            if self._authorized():
                self._json(200, {"object": "list", "data": [{"id": MODEL, "object": "model", "owned_by": "mock"}]})
            return
        self._json(404, {"error": {"message": "not found"}})

    def do_POST(self):
        if self.path.rstrip("/") != "/v1/chat/completions":
            return self._json(404, {"error": {"message": "not found"}})
        if not self._authorized():
            return
        req = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        text = f"{MARKER}: hello from the mock Mercury model."
        cid, now = f"chatcmpl-mock-{int(time.time()*1000)}", int(time.time())
        usage = {"prompt_tokens": 10, "completion_tokens": 8, "total_tokens": 18}
        if req.get("stream"):
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.end_headers()
            chunks = [
                {"delta": {"role": "assistant", "content": text}, "finish_reason": None},
                {"delta": {}, "finish_reason": "stop"},
            ]
            for c in chunks:
                evt = {"id": cid, "object": "chat.completion.chunk", "created": now, "model": MODEL,
                       "choices": [{"index": 0, **c}]}
                if c["finish_reason"]:
                    evt["usage"] = usage
                self.wfile.write(f"data: {json.dumps(evt)}\n\n".encode())
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
            return
        self._json(200, {
            "id": cid, "object": "chat.completion", "created": now, "model": MODEL,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
            "usage": usage,
        })

    def log_message(self, fmt, *args):
        print("[mock-mercury]", fmt % args, flush=True)


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", int(os.environ.get("PORT", "8000"))), Handler).serve_forever()
