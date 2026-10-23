#!/usr/bin/env python3
"""Detect out-of-band drift in a target org before a promote, and (for code)
attempt a clean 3-way merge.

For each promoted component it compares three versions:
  base   = the component on the target BRANCH   (git show <branch-ref>:<path>)
  ours   = the version being promoted           (the working-tree file)
  theirs = the component in the target ORG       (retrieved from the org)

Status per component:
  clean           theirs == base  -> no drift, safe to deploy
  new             component not in the target org yet
  unrelated_drift org changed (theirs != base) but ours == base -> you won't
                  clobber it; alert + offer to capture into VCS
  mergeable       code drift overlaps ours, 3-way merge is clean -> merged text
                  provided; deploy the merge and capture the org change back
  conflict        code drift overlaps ours and the merge conflicts -> manual
  manual_xml      XML metadata drifted and overlaps ours -> manual (never auto-merge)

Usage:
  detect_drift.py --target-org <alias> --branch-ref <ref> \
      --metadata "ApexClass:Foo CustomField:Account.Bar" -- <path> [<path> ...]

Run from the client repo. Writes merged text for 'mergeable' components to
<path>.merged next to each, and prints a JSON summary to stdout.
"""
import argparse, json, os, subprocess, sys, tempfile

CODE_EXT = (".cls", ".trigger", ".js", ".html", ".cmp", ".page", ".component")


def sh(cmd, **kw):
    return subprocess.run(cmd, capture_output=True, text=True, **kw)


def git_show(ref, path):
    r = sh(["git", "show", f"{ref}:{path}"])
    return r.stdout if r.returncode == 0 else None  # None => not on the branch


def retrieve_org(target_org, metadata):
    """Retrieve the given metadata from the org into a temp project; return its dir."""
    d = tempfile.mkdtemp(prefix="drift_target_")
    os.makedirs(os.path.join(d, "force-app", "main", "default"))  # retrieve needs the pkg dir to exist
    with open(os.path.join(d, "sfdx-project.json"), "w") as f:
        f.write('{"packageDirectories":[{"path":"force-app","default":true}],"sourceApiVersion":"62.0"}')
    args = ["sf", "project", "retrieve", "start", "--target-org", target_org, "--json"]
    for m in metadata:
        args += ["--metadata", m]
    sh(args, cwd=d)  # missing components simply aren't written
    return d


def merge3(ours, base, theirs):
    """git merge-file 3-way. Returns (clean: bool, text: str)."""
    with tempfile.TemporaryDirectory() as t:
        po, pb, pt = (os.path.join(t, n) for n in ("ours", "base", "theirs"))
        for p, c in ((po, ours), (pb, base), (pt, theirs)):
            open(p, "w").write(c)
        # merge-file edits the 'ours' file in place; -p prints to stdout instead
        r = sh(["git", "merge-file", "-p", po, pb, pt])
        return r.returncode == 0, r.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-org", required=True)
    ap.add_argument("--branch-ref", required=True)
    ap.add_argument("--metadata", default="")
    ap.add_argument("paths", nargs="+")
    a = ap.parse_args()

    metadata = a.metadata.split() if a.metadata else []
    org_dir = retrieve_org(a.target_org, metadata)

    results = []
    for path in a.paths:
        base = git_show(a.branch_ref, path)
        ours = open(path).read() if os.path.exists(path) else None
        org_path = os.path.join(org_dir, path)
        theirs = open(org_path).read() if os.path.exists(org_path) else None

        if theirs is None:
            status = "new"
        elif base is not None and theirs == base:
            status = "clean"
        elif ours is not None and base is not None and ours == base:
            status = "unrelated_drift"      # org changed it; we are not
        else:
            # drift overlaps what we're promoting
            if path.endswith(CODE_EXT) and None not in (ours, base, theirs):
                clean, merged = merge3(ours, base, theirs)
                if clean:
                    open(path + ".merged", "w").write(merged)
                    status = "mergeable"
                else:
                    status = "conflict"
            else:
                status = "manual_xml"
        results.append({"path": path, "status": status})

    print(json.dumps({"target_org": a.target_org, "components": results}, indent=2))


if __name__ == "__main__":
    main()
