#!/usr/bin/env python3
"""Bitbucket Cloud helper for OpFocus DevOps.

Token source, in order of preference:
  1. The prod-org broker — an authenticated call to the BitbucketTokenVendor Apex REST
     endpoint via `sf`, so the OAuth consumer secret never lives on this machine.
  2. Fallback: a local client-credentials mint from ~/.opfocus-devops/bitbucket.json
     (pilot / offline only).

Config (~/.opfocus-devops/bitbucket.json), all optional — defaults shown:
    {
      "workspace": "opfocusdevtem",
      "project": "CO",
      "broker_org": "OpFocus_Prod",   // use "OpFocus_DevOps" while testing
      "key": "...", "secret": "..."    // only needed for the local fallback
    }

Subcommands:
    token                 Print a fresh access token.
    remote SLUG           Print an authenticated https remote URL for git push/clone.
    create-repo SLUG      Create a private repo in the configured project (idempotent).
    repo-exists SLUG      Print "yes"/"no".
    create-pr SLUG SRC DEST [TITLE] [DESC]   Open a PR SRC->DEST. Prints {id, html}.
    merge-pr SLUG PR_ID [STRATEGY]           Merge a PR (default merge_commit). Prints {state}.
    pr-status SLUG PR_ID                      Print {id, state, html} (OPEN/MERGED/DECLINED).
"""
import json, os, sys, base64, subprocess, urllib.request, urllib.parse, urllib.error

CFG_PATH = os.path.expanduser("~/.opfocus-devops/bitbucket.json")
API = "https://api.bitbucket.org/2.0"
DEFAULTS = {"workspace": "opfocusdevtem", "project": "CO", "broker_org": "OpFocus_Prod"}


def load_cfg():
    c = dict(DEFAULTS)
    if os.path.exists(CFG_PATH):
        with open(CFG_PATH) as f:
            c.update(json.load(f))
    return c


def token_from_broker(c):
    """Ask the prod-org broker for a short-lived token. Returns None if unavailable."""
    try:
        out = subprocess.run(
            ["sf", "api", "request", "rest",
             "/services/apexrest/opfocus/bitbucket-token",
             "--target-org", c["broker_org"]],
            capture_output=True, text=True, timeout=30)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout).get("access_token")
    except Exception:
        return None


def token_from_file(c):
    """Fallback: mint a client-credentials token locally (requires key/secret)."""
    if not (c.get("key") and c.get("secret")):
        return None
    auth = base64.b64encode(f"{c['key']}:{c['secret']}".encode()).decode()
    data = urllib.parse.urlencode({"grant_type": "client_credentials"}).encode()
    req = urllib.request.Request(
        "https://bitbucket.org/site/oauth2/access_token",
        data=data, headers={"Authorization": "Basic " + auth})
    return json.load(urllib.request.urlopen(req))["access_token"]


def get_token(c):
    t = token_from_broker(c) or token_from_file(c)
    if not t:
        sys.exit("no token: prod-org broker unreachable and no local key/secret fallback")
    return t


def api(method, url, token, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return (json.loads(raw) if raw else {}), None
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
    elif cmd == "create-pr":
        slug, source, dest = sys.argv[2], sys.argv[3], sys.argv[4]
        title = sys.argv[5] if len(sys.argv) > 5 else f"Promote {source} to {dest}"
        desc = sys.argv[6] if len(sys.argv) > 6 else ""
        body = {"title": title, "description": desc,
                "source": {"branch": {"name": source}},
                "destination": {"branch": {"name": dest}},
                "close_source_branch": True}
        res, err = api("POST", f"{API}/repositories/{ws}/{slug}/pullrequests", token, body)
        if err:
            print(json.dumps({"status": "error", "code": err[0], "detail": err[1]}))
            sys.exit(1)
        print(json.dumps({"status": "created", "id": res["id"],
                          "html": res.get("links", {}).get("html", {}).get("href")}))
    elif cmd == "merge-pr":
        slug, prid = sys.argv[2], sys.argv[3]
        strategy = sys.argv[4] if len(sys.argv) > 4 else "merge_commit"
        body = {"type": "pullrequest", "merge_strategy": strategy, "close_source_branch": True}
        res, err = api("POST", f"{API}/repositories/{ws}/{slug}/pullrequests/{prid}/merge", token, body)
        if err:
            print(json.dumps({"status": "error", "code": err[0], "detail": err[1]}))
            sys.exit(1)
        print(json.dumps({"status": "merged", "id": prid, "state": (res or {}).get("state", "MERGED")}))
    elif cmd == "pr-status":
        slug, prid = sys.argv[2], sys.argv[3]
        res, err = api("GET", f"{API}/repositories/{ws}/{slug}/pullrequests/{prid}", token)
        if err:
            print(json.dumps({"status": "error", "code": err[0], "detail": err[1]}))
            sys.exit(1)
        print(json.dumps({"id": prid, "state": res.get("state"),
                          "html": res.get("links", {}).get("html", {}).get("href")}))
    else:
        sys.exit("usage: bb.py [token | remote SLUG | repo-exists SLUG | create-repo SLUG | "
                 "create-pr SLUG SRC DEST [TITLE] [DESC] | merge-pr SLUG PR_ID [STRATEGY] | "
                 "pr-status SLUG PR_ID]")


if __name__ == "__main__":
    main()
