"""靶机环境故障早停检测器单测（防 Wallbreaker_Easy 类 NoNewPrivs=1 死循环空耗）。"""

from app.kernel.env_fault import EnvFaultTracker


def test_no_false_positive_without_no_new_privs() -> None:
    """普通权限不足（没有 NoNewPrivs=1）绝不误触发早停。"""
    tracker = EnvFaultTracker(grace_turns=4, max_denied_turns=2)
    for turn in range(1, 10):
        tracker.observe(
            turn=turn,
            command="/readflag",
            output="/bin/cat: /flag: Permission denied",
        )
        decision = tracker.evaluate(turn=turn, has_candidates=False)
        assert decision.action == "none"


def test_no_false_positive_when_only_no_new_privs_seen() -> None:
    """仅有 NoNewPrivs=1 但未出现 /readflag 失败或 root-only /flag，不误触发。"""
    tracker = EnvFaultTracker(grace_turns=3)
    for turn in range(1, 8):
        tracker.observe(
            turn=turn,
            command="cat /proc/self/status",
            output="CapEff:\t0000000000000000\nNoNewPrivs:\t1\n",
        )
        decision = tracker.evaluate(turn=turn, has_candidates=False)
        assert decision.action == "none"


def test_two_stage_warn_then_abort_after_grace_window() -> None:
    """同时观测到 NoNewPrivs=1 与 /readflag 权限被拒：先警告一次，给足宽限轮次后再早停。"""
    tracker = EnvFaultTracker(grace_turns=4, max_denied_turns=3)

    tracker.observe(
        turn=5,
        command="cat /proc/self/status && /readflag",
        output="NoNewPrivs:\t1\n/bin/cat: /flag: Permission denied\n",
    )
    d1 = tracker.evaluate(turn=5, has_candidates=False)
    assert d1.action == "warn"
    assert d1.fault_kind == "target_no_new_privs_suid_blocked"
    assert "NoNewPrivs" in d1.nudge

    # 宽限期内（第 6、7、8 轮）继续允许探索旁路，不再重复警告也不提前中止
    for t in (6, 7, 8):
        tracker.observe(turn=t, command="env", output="PATH=/usr/bin")
        assert tracker.evaluate(turn=t, has_candidates=False).action == "none"

    # 第 9 轮（5 + 4）宽限耗尽且仍无候选 Flag → 触发止损中止
    tracker.observe(turn=9, command="ls -la /flag", output="-rw------- 1 root root 43 /flag")
    d_abort = tracker.evaluate(turn=9, has_candidates=False)
    assert d_abort.action == "abort"
    assert "NoNewPrivs=1" in d_abort.reason
    assert "自动止损" in d_abort.reason


def test_fast_abort_on_repeated_readflag_denied() -> None:
    """已知 NoNewPrivs=1 且在 3 个不同回合都撞上 /readflag 权限被拒时，不等满宽限直接止损。"""
    tracker = EnvFaultTracker(grace_turns=8, max_denied_turns=3)

    tracker.observe(turn=1, command="cat /proc/self/status", output="NoNewPrivs:\t1")
    tracker.observe(turn=2, command="/readflag", output="/bin/cat: /flag: Permission denied")
    assert tracker.evaluate(turn=2).action == "warn"

    tracker.observe(turn=3, command="LD_PRELOAD=/tmp/a.so /readflag", output="/bin/cat: /flag: Permission denied")
    assert tracker.evaluate(turn=3).action == "none"

    tracker.observe(turn=4, command="/readflag", output="/bin/cat: /flag: Permission denied")
    d = tracker.evaluate(turn=4)
    assert d.action == "abort"


def test_never_aborts_if_candidate_flag_found() -> None:
    """如果已经通过其他旁路拿到候选 Flag，绝不触发环境故障中止。"""
    tracker = EnvFaultTracker(grace_turns=2, max_denied_turns=2)
    tracker.observe(
        turn=1,
        command="cat /proc/self/status && ls -la /flag",
        output="NoNewPrivs:\t1\n-rw------- 1 root root 43 Nov 25 06:45 /flag\n",
    )
    assert tracker.evaluate(turn=1, has_candidates=True).action == "none"
