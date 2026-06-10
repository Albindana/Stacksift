#!/usr/bin/env python3
"""Bootstrap Uptime Kuma (DO-7 / M4.6): notification channels + monitors + a
public status page — reproducibly, from code, against a fresh or existing volume.

Uptime Kuma 1.x has no first-class IaC; config lives in its SQLite volume. This
script codifies that config via the community `uptime-kuma-api` client so the
M4.6 setup (status page + multi-channel notifications) can be recreated after a
`docker compose down -v`. It is idempotent: notifications/monitors/status page
are matched by name/slug and skipped if they already exist.

Usage:
    python3 -m venv .venv && .venv/bin/pip install uptime-kuma-api
    docker compose up -d uptime-kuma mailpit
    UPTIME_KUMA_PASSWORD=<admin-pw> .venv/bin/python scripts/bootstrap-uptime-kuma.py

Env:
    UPTIME_KUMA_URL        default http://localhost:3002   (host → container :3001)
    UPTIME_KUMA_USERNAME   default admin   (created on a fresh instance)
    UPTIME_KUMA_PASSWORD   required        (sets the admin password on first run)
    SLACK_WEBHOOK_URL      optional        (Slack channel configured only if set)
    SLACK_CHANNEL          default #stacksift-uptime
    SMTP_HOST/SMTP_PORT    default mailpit / 1025   (Mailpit; swap for prod SMTP)
    MAIL_FROM/MAIL_TO      default uptime@stacksift.local / sre@stacksift.local
    STATUS_PAGE_SLUG       default status
"""
import os
import sys

try:
    from uptime_kuma_api import UptimeKumaApi, MonitorType, NotificationType
except ImportError:
    sys.exit("uptime-kuma-api not installed. Run: pip install uptime-kuma-api")

def env(*names, default=""):
    """First non-empty env var among `names`. Lets the script read the deploy
    secrets.env directly, whose SMTP keys use .NET-config style (Smtp__Host,
    Smtp__Password, …) — not SMTP_*. SMTP_* are accepted as overrides."""
    for n in names:
        v = os.environ.get(n)
        if v not in (None, ""):
            return v
    return default


URL = os.environ.get("UPTIME_KUMA_URL", "http://localhost:3002")
USERNAME = os.environ.get("UPTIME_KUMA_USERNAME", "admin")
PASSWORD = os.environ.get("UPTIME_KUMA_PASSWORD")
SLACK_WEBHOOK_URL = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
SLACK_CHANNEL = os.environ.get("SLACK_CHANNEL", "#stacksift-uptime")
# SMTP reads the deploy secrets.env keys (Smtp__*) directly; SMTP_* override.
SMTP_HOST = env("SMTP_HOST", "Smtp__Host", default="mailpit")
SMTP_PORT = int(env("SMTP_PORT", "Smtp__Port", default="1025"))
SMTP_USERNAME = env("SMTP_USERNAME", "Smtp__Username")        # Resend: "resend"
SMTP_PASSWORD = env("SMTP_PASSWORD", "Smtp__Password")        # Resend: the API key
SMTP_SECURE = env("SMTP_SECURE", "Smtp__UseSsl").lower() in ("1", "true", "yes")  # TLS-on-connect (port 465)
MAIL_FROM = env("MAIL_FROM", "Smtp__FromAddress", default="uptime@stacksift.local")  # a Resend-verified sender
MAIL_TO = env("MAIL_TO", default="sre@stacksift.local")      # who gets uptime alerts
STATUS_PAGE_SLUG = os.environ.get("STATUS_PAGE_SLUG", "status")
# Set STACKSIFT_DOMAIN (e.g. dmdailydeals.com) to monitor the PUBLIC https URLs
# (deployed env); unset → compose-internal hostnames (local demo).
DOMAIN = os.environ.get("STACKSIFT_DOMAIN", "").strip()

if DOMAIN:
    # Deployed: monitor the public https URLs (tests the full DNS→ingress→app path).
    MONITORS = [
        {"name": "app",       "url": f"https://app.{DOMAIN}/api/health",   "interval": 60},
        {"name": "api ready", "url": f"https://api.{DOMAIN}/health/ready", "interval": 30},
        {"name": "api live",  "url": f"https://api.{DOMAIN}/health/live",  "interval": 30},
        {"name": "auth",      "url": f"https://auth.{DOMAIN}/realms/stacksift/.well-known/openid-configuration", "interval": 60},
        {"name": "grafana",   "url": f"https://grafana.{DOMAIN}/api/health", "interval": 60},
        {"name": "marketing", "url": f"https://www.{DOMAIN}/api/health",   "interval": 60},
    ]
else:
    # Local demo: compose-internal hostnames (Kuma evaluates from inside stacksift-net).
    MONITORS = [
        {"name": "app",          "url": "http://frontend:3000/api/health", "interval": 60},
        {"name": "api ready",    "url": "http://api:5190/health/ready",    "interval": 30},
        {"name": "api live",     "url": "http://api:5190/health/live",     "interval": 30},
        {"name": "auth",         "url": "http://keycloak:8080/realms/stacksift/.well-known/openid-configuration", "interval": 60},
        {"name": "grafana",      "url": "http://grafana:3000/api/health",  "interval": 60},
        {"name": "rabbitmq mgmt","url": "http://rabbitmq:15672",           "interval": 60},
    ]


def main() -> int:
    if not PASSWORD:
        sys.exit("UPTIME_KUMA_PASSWORD is required.")

    api = UptimeKumaApi(URL)
    try:
        if api.need_setup():
            print(f"Fresh instance — creating admin '{USERNAME}'.")
            api.setup(USERNAME, PASSWORD)
        api.login(USERNAME, PASSWORD)

        # ── Notifications (multi-channel = >=2) ──────────────────────────────
        existing_notifs = {n["name"]: n["id"] for n in api.get_notifications()}
        notif_ids = []

        email_name = "Email (SMTP)"
        if email_name in existing_notifs:
            notif_ids.append(existing_notifs[email_name])
            print(f"= {email_name} (exists)")
        else:
            api.add_notification(
                name=email_name, type=NotificationType.SMTP,
                isDefault=True, applyExisting=False,
                smtpHost=SMTP_HOST, smtpPort=SMTP_PORT,
                smtpSecure=(True if SMTP_SECURE else ""),       # True = TLS-on-connect (Resend :465)
                smtpIgnoreTLSError=not SMTP_SECURE,             # Mailpit has no TLS; Resend does
                smtpUsername=SMTP_USERNAME, smtpPassword=SMTP_PASSWORD,
                smtpFrom=MAIL_FROM, smtpTo=MAIL_TO,
            )
            notif_ids.append({n["name"]: n["id"] for n in api.get_notifications()}[email_name])
            print(f"+ {email_name} -> {SMTP_HOST}:{SMTP_PORT}")

        slack_name = "Slack (#stacksift-uptime)"
        if not SLACK_WEBHOOK_URL:
            print("! SLACK_WEBHOOK_URL unset — skipping Slack (email-only this run).")
        elif slack_name in existing_notifs:
            notif_ids.append(existing_notifs[slack_name])
            print(f"= {slack_name} (exists)")
        else:
            api.add_notification(
                name=slack_name, type=NotificationType.SLACK,
                isDefault=True, applyExisting=False,
                slackwebhookURL=SLACK_WEBHOOK_URL, slackchannel=SLACK_CHANNEL,
                slackusername="Uptime Kuma",
            )
            notif_ids.append({n["name"]: n["id"] for n in api.get_notifications()}[slack_name])
            print(f"+ {slack_name}")

        notif_map = {nid: True for nid in notif_ids}

        # ── Monitors (both channels attached) ────────────────────────────────
        existing_mons = {m["name"]: m["id"] for m in api.get_monitors()}
        monitor_ids = []
        for m in MONITORS:
            if m["name"] in existing_mons:
                monitor_ids.append(existing_mons[m["name"]])
                print(f"= monitor '{m['name']}' (exists)")
                continue
            r = api.add_monitor(
                type=MonitorType.HTTP, name=m["name"], url=m["url"],
                interval=m["interval"], maxretries=0, retryInterval=30,
                notificationIDList=notif_map,
            )
            monitor_ids.append(r["monitorID"])
            print(f"+ monitor '{m['name']}' -> {m['url']}")

        # ── Public status page ───────────────────────────────────────────────
        slugs = {p["slug"] for p in api.get_status_pages()}
        if STATUS_PAGE_SLUG not in slugs:
            api.add_status_page(STATUS_PAGE_SLUG, "StackSift Status")
            print(f"+ status page /{STATUS_PAGE_SLUG}")
        api.save_status_page(
            STATUS_PAGE_SLUG, title="StackSift Status",
            description="Live status of StackSift services.",
            publicGroupList=[{
                "name": "Services",
                "monitorList": [{"id": mid} for mid in monitor_ids],
            }],
        )
        print(f"= status page published: {URL}/status/{STATUS_PAGE_SLUG}")

        print(f"\nDone. {len(notif_ids)} channel(s), {len(monitor_ids)} monitor(s).")
        return 0
    finally:
        api.disconnect()


if __name__ == "__main__":
    raise SystemExit(main())
