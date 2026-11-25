"""目标靶机环境故障早停检测器（止损熔断）。

## 解决的真实线上问题（Wallbreaker_Easy 实测）

当远端 CTF 靶机容器开启了 `NoNewPrivs: 1`（例如 K8s Pod 配置了
`allowPrivilegeEscalation: false`），Linux 内核会强制屏蔽所有 SUID/SGID 与
文件 Capabilities 提权。此时即使智能体已经 100% 完成了漏洞利用并拿到
`www-data` RCE，执行题目自带的 `/readflag` 仍会被内核拦截，报：

    /bin/cat: /flag: Permission denied

若没有早停判据，智能体会继续在靶机上排查 15+ 分钟、消耗上百轮工具调用与大量
Token 才因超时失败。本模块用纯函数 + 轻量状态机做**两阶段零误报止损**：

1. **阶段一（提示与宽限窗口）**：同时观测到 `NoNewPrivs: 1` 与
   `/readflag` 报 `Permission denied`（或 `/flag` 仅 `root` 可读 `600/400`）时，
   只注入**一次**明确提醒，引导智能体有限排查非 SUID 旁路（环境变量、配置、
   数据库、php-fpm 等），并给予 `grace_turns`（默认 8 轮）宽限窗口。
2. **阶段二（自动止损中止）**：宽限窗口耗尽仍未产出候选 Flag，或在已知
   `NoNewPrivs: 1` 下连续多个回合重复撞上 `/readflag` 权限拒绝时，直接返回
   明确的环境异常诊断并终止本题，避免继续空烧预算。
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

#: 检测到环境故障后，给智能体排查非 SUID 旁路的宽限回合数。
DEFAULT_GRACE_TURNS = 8
#: 已知 NoNewPrivs=1 时，若在多少个不同回合内都撞上 /readflag Permission denied，直接止损。
DEFAULT_MAX_DENIED_TURNS = 3

_RE_NO_NEW_PRIVS = re.compile(r"\bNoNewPrivs\s*:\s*1\b", re.IGNORECASE)
_RE_READFLAG_REF = re.compile(r"/readflag\b", re.IGNORECASE)
_RE_FLAG_DENIED = re.compile(
    r"(?:/flag\b[^\n]{0,80}(?:Permission denied|Operation not permitted|EACCES))"
    r"|(?:(?:Permission denied|Operation not permitted)[^\n]{0,80}/flag\b)",
    re.IGNORECASE,
)
_RE_GENERIC_DENIED = re.compile(r"\bPermission denied\b", re.IGNORECASE)
_RE_ROOT_ONLY_FLAG = re.compile(
    r"-(?:r--|rw-|r-x|rwx)------\s+\d+\s+root\s+root\s+\d+[^\n]*/flag\b",
    re.IGNORECASE,
)


@dataclass(frozen=True, slots=True)
class EnvFaultDecision:
    """本轮观测后的环境故障判定。"""

    #: `"none"` = 正常继续；`"warn"` = 首次发出环境异常提醒；`"abort"` = 触发止损中止。
    action: str = "none"
    #: 故障类型标识（供事件遥测与统计使用）。
    fault_kind: str = ""
    #: 给用户 / 任务记录的明确原因说明。
    reason: str = ""
    #: 注入给模型的纠偏提示（仅 action == "warn" 时非空）。
    nudge: str = ""


@dataclass
class EnvFaultTracker:
    """单次解题循环内的目标环境故障跟踪器（纯内存、无 IO）。"""

    grace_turns: int = DEFAULT_GRACE_TURNS
    max_denied_turns: int = DEFAULT_MAX_DENIED_TURNS

    saw_no_new_privs: bool = False
    flag_root_only: bool = False
    readflag_denied_turns: set[int] = field(default_factory=set)
    warned_at_turn: int | None = None
    aborted: bool = False

    def observe(self, *, turn: int, command: str, output: str) -> None:
        """消化单次工具执行的命令与输出，累计硬证据。"""
        cmd = command or ""
        out = output or ""
        if not cmd and not out:
            return

        if _RE_NO_NEW_PRIVS.search(out):
            self.saw_no_new_privs = True

        if _RE_ROOT_ONLY_FLAG.search(out):
            self.flag_root_only = True

        invoked_readflag = bool(_RE_READFLAG_REF.search(cmd))
        flag_denied = bool(_RE_FLAG_DENIED.search(out))
        if flag_denied or (invoked_readflag and _RE_GENERIC_DENIED.search(out)):
            self.readflag_denied_turns.add(turn)

    def evaluate(self, *, turn: int, has_candidates: bool = False) -> EnvFaultDecision:
        """在每轮工具执行完毕后评估是否应发出提醒或触发早停止损。"""
        if self.aborted or has_candidates:
            return EnvFaultDecision()

        suid_blocked = self.saw_no_new_privs and (
            len(self.readflag_denied_turns) >= 1 or self.flag_root_only
        )
        if not suid_blocked:
            return EnvFaultDecision()

        if self.warned_at_turn is None:
            self.warned_at_turn = turn
            return EnvFaultDecision(
                action="warn",
                fault_kind="target_no_new_privs_suid_blocked",
                reason="检测到目标容器启用了 NoNewPrivs=1 且 /readflag SUID 提权被拒",
                nudge=(
                    "（系统环境异常提醒：已从目标输出中确证容器开启了 `NoNewPrivs: 1`，"
                    "Linux 内核会屏蔽所有 SUID/SGID/filecap 提权，导致 `/readflag` 无法读取 `root` 权限的 `/flag`。"
                    "请不要再反复重试 `/readflag` 或 SUID 提权，仅用有限几轮核查是否存在非 SUID 旁路"
                    "（如环境变量、可读配置文件/数据库/源码中的备用 Flag、已运行的 root 服务漏洞）；"
                    f"若 {self.grace_turns} 轮内仍无有效旁路，系统将自动判定为靶机环境配置故障并止损中止。）"
                ),
            )

        elapsed_after_warn = turn - self.warned_at_turn
        if (
            elapsed_after_warn >= self.grace_turns
            or len(self.readflag_denied_turns) >= self.max_denied_turns
        ):
            self.aborted = True
            reason = (
                "靶机环境异常（自动止损）：目标容器启用了 NoNewPrivs=1 导致 `/readflag` 的 SUID 提权被内核拦截"
                "（`/flag` 仅 root 可读，报 Permission denied），经旁路核查未发现其他可读途径。"
                "该问题属于远端靶机容器/Pod 权限配置故障（allowPrivilegeEscalation=false），"
                "已提前终止以避免继续消耗 Token，建议反馈平台或更换其他题目。"
            )
            return EnvFaultDecision(
                action="abort",
                fault_kind="target_no_new_privs_suid_blocked",
                reason=reason,
            )

        return EnvFaultDecision()


__all__ = [
    "DEFAULT_GRACE_TURNS",
    "DEFAULT_MAX_DENIED_TURNS",
    "EnvFaultDecision",
    "EnvFaultTracker",
]
