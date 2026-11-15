"""Deploy changed Railway services after CI is green on main.

Railway's own GitHub autodeploy holds commits from authors who are not members
of the Railway workspace in WAITING ("needs approval"), and that check cannot be
turned off. This script makes the deploy independent of the commit author:

for each service whose directory changed since its last successful deployment
  - if Railway's own deployment of this commit starts building, follow it;
  - otherwise (held for approval or never created) trigger
    `railway redeploy --from-source`, which deploys the latest commit of the
    configured branch on behalf of the project token, and follow that one.

Needs RAILWAY_TOKEN (a Railway project token for the production environment).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time

SERVICES = ["backend", "frontend"]  # Railway service name == repo directory
GRACE_SECONDS = 90  # how long Railway's own autodeploy gets to start
DEPLOY_TIMEOUT = 25 * 60  # backend may rebuild the DB on start
POLL = 10

IN_PROGRESS = {"QUEUED", "INITIALIZING", "BUILDING", "DEPLOYING"}
DONE_OK = {"SUCCESS", "SKIPPED"}
DONE_BAD = {"FAILED", "CRASHED", "REMOVED"}


def run(*args: str) -> str:
    return subprocess.run(args, check=True, capture_output=True, text=True).stdout


def deployments(service: str) -> list[dict]:
    """Newest first."""
    return json.loads(run("railway", "deployment", "list", "--service", service, "--json"))


def commit_of(d: dict) -> str:
    return (d.get("meta") or {}).get("commitHash") or ""


def changed_since_last_success(service: str, sha: str) -> bool:
    last = next((commit_of(d) for d in deployments(service) if d["status"] == "SUCCESS"), "")
    if not last:
        return True
    known = subprocess.run(["git", "cat-file", "-e", f"{last}^{{commit}}"], capture_output=True)
    if known.returncode != 0:
        return True
    diff = subprocess.run(["git", "diff", "--quiet", last, sha, "--", f"{service}/"])
    return diff.returncode != 0


def own_deployment_started(service: str, sha: str) -> dict | None:
    """Wait for Railway's autodeploy of `sha` to leave WAITING; None if it does not."""
    deadline = time.monotonic() + GRACE_SECONDS
    while True:
        for d in deployments(service):
            if commit_of(d) == sha and d["status"] != "WAITING":
                if d["status"] in IN_PROGRESS | DONE_OK:
                    return d
        if time.monotonic() >= deadline:
            return None
        time.sleep(POLL)


def trigger(service: str) -> str:
    before = {d["id"] for d in deployments(service)}
    run("railway", "redeploy", "--service", service, "--from-source", "--yes")
    for _ in range(30):
        new = [d for d in deployments(service) if d["id"] not in before]
        if new:
            return new[0]["id"]
        time.sleep(2)
    sys.exit(f"{service}: redeploy was accepted but no new deployment appeared")


def follow(service: str, deployment_id: str) -> bool:
    deadline = time.monotonic() + DEPLOY_TIMEOUT
    last = ""
    while time.monotonic() < deadline:
        d = next((d for d in deployments(service) if d["id"] == deployment_id), None)
        status = d["status"] if d else "MISSING"
        if status != last:
            print(f"{service}: {status}", flush=True)
            last = status
        if status in DONE_OK:
            return True
        if status in DONE_BAD or status == "MISSING":
            return False
        time.sleep(POLL)
    print(f"{service}: timed out after {DEPLOY_TIMEOUT // 60} min", flush=True)
    return False


def main() -> int:
    if not os.environ.get("RAILWAY_TOKEN"):
        sys.exit("RAILWAY_TOKEN secret is not set (Railway project token, production)")
    sha = run("git", "rev-parse", "HEAD").strip()

    targets: dict[str, str] = {}
    for service in SERVICES:
        if not changed_since_last_success(service, sha):
            print(f"{service}: no changes since last successful deploy, skipping")
            continue
        own = own_deployment_started(service, sha)
        if own:
            print(f"{service}: Railway autodeploy {own['id']} is running, following it")
            targets[service] = own["id"]
        else:
            print(f"{service}: autodeploy held or missing, redeploying from source")
            targets[service] = trigger(service)

    failed = [s for s, dep in targets.items() if not follow(s, dep)]
    if failed:
        print(f"Deploy failed: {', '.join(failed)}. Logs: railway logs --service <name>")
        return 1
    print("Deploy finished")
    return 0


if __name__ == "__main__":
    sys.exit(main())
