#!/usr/bin/env python3
"""Bitbucket Cloud helper for OpFocus DevOps.

Reads credentials from ~/.opfocus-devops/bitbucket.json:
    { "workspace": "...", "project": "...", "key": "...", "secret": "..." }

Mints a short-lived client-credentials token on each call (never stored), and
exposes the few Bitbucket operations the skills need.

Subcommands:
    token                 Print a fresh access token.
    remote SLUG           Print an authenticated https remote URL for git push/clone.
    create-repo SLUG      Create a private repo in the configured project (idempotent).
    repo-exists SLUG      Print "yes"/"no".
"""
import json, os, sys, base64, urllib.request, urllib.parse, urllib.error

CFG_PATH = os.path.expanduser("~/.opfocus-devops/bitbucket.json")
API = "https://api.bitbucket.org/2.0"


def load_cfg():
    if not os.path.exists(CFG_PATH):
        sys.exit(f"missing credentials file: {CFG_PATH}")
    with open(CFG_PATH) as f:
        return json.load(f)


def get_token(c):
    auth = base64.b64encode(f"{c['key']}:{c['secret']}".encode()).decode()
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req = urllib.request.Request(
        "https://bitbucket.org/site/oauth2/access_token",
        data=data, headers={"Authorization": "Basic " + auth})
    return json.load(urllib.request.urlopen(req))["access_token"]


def api(method, url, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r), None
    except urllib.error.HTTPError as e:
        return None, (e.code, e.read().decode()[:400])


def main():
    c = load_cfg()
    ws = c["workspace"]
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    token = get_token(c)

    if cmd == "token":
        print(token)
    elif cmd == "remote":
        print(f"https://x-token-auth:{token}@bitbucket.org/{ws}/{sys.argv[2]}.git")
    elif cmd == "repo-exists":
        res, _ = api("GET", f"{API}/repositories/{ws}/{sys.argv[2]}", token)
        print("yes" if res else "no")
    elif cmd == "create-repo":
        slug = sys.argv[2]
        existing, _ = api("GET", f"{API}/repositories/{ws}/{slug}", token)
        if existing:
            print(json.dumps({"status": "exists", "slug": slug,
                              "html": existing.get("links", {}).get("html", {}).get("href")}))
            return
        body = {"scm": "git", "is_private": True,
                "project": {"key": c["project"]}, "fork_policy": "no_public_forks"}
        res, err = api("POST", f"{API}/repositories/{ws}/{slug}", token, body)
        if err:
            print(json.dumps({"status": "error", "code": err[0], "detail": err[1]}))
            sys.exit(1)
        print(json.dumps({"status": "created", "slug": slug,
                          "html": res.get("links", {}).get("html", {}).get("href")}))
    else:
        sys.exit("usage: bb.py [token | remote SLUG | repo-exists SLUG | create-repo SLUG]")


if __name__ == "__main__":
    main()
