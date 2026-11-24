"""系统级可观测遥测 HTTP 路由。"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth.deps import Identity, require_read
from app.core.db import get_db
from app.system.telemetry import collect_telemetry

router = APIRouter(prefix="/system", tags=["系统遥测"])

ReadDep = Annotated[Identity, Depends(require_read)]
DbDep = Annotated[Session, Depends(get_db)]


@router.get("/telemetry", summary="实时系统可观测遥测快照")
def get_system_telemetry(_identity: ReadDep, db: DbDep) -> dict:
    return collect_telemetry(db)
