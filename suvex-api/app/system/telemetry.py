"""系统级实时遥测聚合（事件总线、队列、沙箱容器、模型健康与数据库池）。"""

from __future__ import annotations

import subprocess
import time
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_engine
from app.core.timeutil import now_utc
from app.events.bus import activity_bus
from app.kernel.models import KernelChallenge
from app.providers.models import ProviderAccount
from app.scans.models import Scan

_BOOT_MONOTONIC = time.monotonic()


def _probe_docker_sandboxes() -> dict[str, Any]:
    """轻量探测运行中的安全沙箱容器数（2 秒超时，失败不阻塞接口）。"""
    try:
        proc = subprocess.run(
            ["docker", "ps", "--format", "{{.Names}}\t{{.Image}}\t{{.Status}}"],
            capture_output=True,
            text=True,
            timeout=2.0,
            check=False,
        )
        if proc.returncode != 0:
            return {"dockerAvailable": False, "runningTotal": 0, "sandboxCount": 0, "containers": []}
        rows = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
        containers = []
        sandbox_count = 0
        for row in rows:
            parts = row.split("\t")
            name = parts[0] if len(parts) > 0 else ""
            image = parts[1] if len(parts) > 1 else ""
            status = parts[2] if len(parts) > 2 else ""
            is_sandbox = any(
                tag in name.lower() or tag in image.lower()
                for tag in ("ctf2-", "suvex-sandbox", "strix")
            )
            if is_sandbox:
                sandbox_count += 1
            containers.append({"name": name, "image": image, "status": status, "isSandbox": is_sandbox})
        return {
            "dockerAvailable": True,
            "runningTotal": len(containers),
            "sandboxCount": sandbox_count,
            "containers": containers[:12],
        }
    except Exception:  # noqa: BLE001
        return {"dockerAvailable": False, "runningTotal": 0, "sandboxCount": 0, "containers": []}


def collect_telemetry(db: Session) -> dict[str, Any]:
    """汇总实时平台运行态势。"""
    settings = get_settings()
    since_24h = now_utc() - timedelta(hours=24)

    # Scans
    active_scans = int(
        db.scalar(select(func.count(Scan.id)).where(Scan.status == "running")) or 0
    )
    queued_scans = int(
        db.scalar(select(func.count(Scan.id)).where(Scan.status == "queued")) or 0
    )
    completed_24h = int(
        db.scalar(
            select(func.count(Scan.id)).where(
                Scan.status == "completed", Scan.finished_at >= since_24h
            )
        )
        or 0
    )
    failed_24h = int(
        db.scalar(
            select(func.count(Scan.id)).where(
                Scan.status == "failed", Scan.finished_at >= since_24h
            )
        )
        or 0
    )

    # CTF
    ctf_total = int(db.scalar(select(func.count(KernelChallenge.id))) or 0)
    ctf_solved = int(
        db.scalar(
            select(func.count(KernelChallenge.id)).where(KernelChallenge.status == "solved")
        )
        or 0
    )
    ctf_solving = int(
        db.scalar(
            select(func.count(KernelChallenge.id)).where(KernelChallenge.status == "solving")
        )
        or 0
    )

    # Providers
    providers = list(db.scalars(select(ProviderAccount)).all())
    verified_providers = sum(1 for p in providers if p.verified)
    default_provider = next((p for p in providers if p.is_default), providers[0] if providers else None)

    # DB Pool
    pool_info: dict[str, Any] = {}
    try:
        pool = get_engine().pool
        pool_info = {
            "size": getattr(pool, "size", lambda: 0)(),
            "checkedOut": getattr(pool, "checkedout", lambda: 0)(),
            "overflow": getattr(pool, "overflow", lambda: 0)(),
        }
    except Exception:  # noqa: BLE001
        pool_info = {}

    return {
        "version": settings.app_version,
        "uptimeSeconds": int(time.monotonic() - _BOOT_MONOTONIC),
        "generatedAt": now_utc().isoformat(),
        "eventBus": activity_bus.stats(),
        "scans": {
            "active": active_scans,
            "queued": queued_scans,
            "completed24h": completed_24h,
            "failed24h": failed_24h,
        },
        "ctf": {
            "total": ctf_total,
            "solved": ctf_solved,
            "solving": ctf_solving,
        },
        "providers": {
            "total": len(providers),
            "verified": verified_providers,
            "defaultLabel": default_provider.label if default_provider else None,
            "defaultModel": default_provider.model if default_provider else None,
        },
        "sandboxes": _probe_docker_sandboxes(),
        "dbPool": pool_info,
    }
