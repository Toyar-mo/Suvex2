"""解绑前记下当前在队列/在跑的题，便于重新绑定后重新排队。"""

from __future__ import annotations

from sqlalchemy import text

from app.core.db import session_scope

with session_scope() as db:
    rows = db.execute(
        text(
            """
            select remote_id, title
            from suvex_challenges
            where status = 'solving'
            order by updated_at
            """
        )
    ).fetchall()

print(f"在队列/在跑：{len(rows)} 道")
for remote_id, title in rows:
    print(f"  {remote_id:>8}  {title}")
