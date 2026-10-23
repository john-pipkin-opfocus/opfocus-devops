#!/usr/bin/env python3
"""Serve the change-selector page and capture the user's selection.

GET  /                -> index.html (and any static asset in this dir)
POST /submit          -> writes selection.json next to this script, then responds {ok:true}
"""
import http.server, socketserver, json, os, sys, threading

DIR = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
SELECTION_PATH = os.path.join(DIR, "selection.json")

# clear any stale selection from a previous run
try:
    os.remove(SELECTION_PATH)
except FileNotFoundError:
    pass


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def do_POST(self):
        if self.path.rstrip("/") == "/submit":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length else "{}"
            try:
                payload = json.loads(body)
            except json.JSONDecodeError:
                payload = {"selected": [], "raw": body}
            with open(SELECTION_PATH, "w") as f:
                json.dump(payload, f, indent=2)
            print("SELECTION RECEIVED:", len(payload.get("selected", [])), "components", flush=True)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
            # Stop the server once a selection is in, so the caller is notified the
            # moment the user submits (shutdown must run off the serve_forever thread).
            threading.Thread(target=self.server.shutdown, daemon=True).start()
        else:
            self.send_error(404)

    def log_message(self, *a):
        pass  # keep stdout clean for the SELECTION line


with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
    print(f"change-selector serving on http://127.0.0.1:{PORT}", flush=True)
    httpd.serve_forever()
