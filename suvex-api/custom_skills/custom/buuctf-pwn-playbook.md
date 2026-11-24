---
name: buuctf-pwn-playbook
category: custom
description: >-
  BUUCTF/CTF2 Pwn 实战速查：平台连接铁律、8 类高频坑、SROP/栈迁移模板、26 题速查表与放弃记录
---

# BUUCTF / CTF2 Pwn 实战速查

来源：DASCTF CTF2 练习场（practice_ground `b9bbb32f-f186-458f-b90b-12440c0f6aea`）
已打通 26 题，**全部 attempt 1**。

## 平台连接铁律

- 靶机地址字段是 **`access_url`**（不是 `access_host`/`access_port`，那两个永远是 None）。
- 全部是 **TLS 回话**：`ssl.wrap_socket(raw, server_hostname=host)`，`nc_ssl: true`。
- 启动工具名：`ctf2_start_challenge_environment`（`ctf2_start_practice_*` 系列全是错的）。
- 查环境：`ctf2_get_environment`；删环境：`ctf2_user_delete_practice_id_challenges_challengeid_environment`。
- 附件 URL 从 **`ctf2_get_practice_challenge` 的 `challenge.files[].download_url`** 取；
  `ctf2_get_attachment_url` 参数名对不上会返回 INVALID_REQUEST。
- 环境活 1 小时；**一次连接内完成全部阶段**，别跨连接（alarm/超时是隐形杀手）。
- **换题第一步：先比 MD5**。同一练习场里有大量"换 flag 不换二进制"的重复题
  （如 `ciscn_2019_s_4` 与 `ciscn_2019_es_2` 的 MD5 都是 `0e66450060f89bf7f0f0076da1984405`）。
  先 `md5sum` 新题和已解过的文件，命中就 `sed 's|old|new|'` 复用脚本，一次交互拿 flag。

## 高频坑（踩过的）

### 1. alarm() 是隐形的 60 秒死线
`ciscn_2019_c_1` 的 `init` 有 `alarm(0x3c)` + `signal(SIGALRM, handler)`，handler 直接 `_exit(1)`。
脚本里每轮 `sleep(0.5~1.0)` 叠加很快超时，表现是 **"dumped core" / 突然 EOF / recvuntil EOFError**
——极像栈对齐崩溃，实际是超时被杀。
判据：崩溃总发生在"第 N 次交互之后"，且 N 随 sleep 增大而变小 → 查有没有 alarm。
对策：一轮内跑完所有阶段，sleep 压到 0.1~0.2，用 `recvuntil(标记)` 而非固定 `grab()`。

### 2. 全局变量做循环起点的"加密"函数（c_1 / en_2 共用骨架）
`encrypt()`：循环 **从全局 `x`（0x6020ac）开始**到 `strlen(buf)` 结束，`x` **进程内不重置**。
第二轮 `x` = 上一轮 strlen。`strlen` 遇 `\x00` 停，第一个 `\x00` 之后的字节永不被异或。
**推论**：让 payload 第一个 `\x00` 位置 == 当前 `x` → 循环一次不执行 = **平文发送**。
buf 偏移 0x50+8=88，`RET`(0x4006b9) 高字节在索引 91，构造使首 null 落 91，第二轮完全免预变换。

**xor key 每道题不同，必须逐题核对**：
- `ciscn_2019_c_1`：`a-z ^0xd`、`A-Z ^0xe`、`0-9 ^0xf`
- `ciscn_2019_en_2`：`a-z ^0xe`、`A-Z ^0xd`、`0-9 ^0xc`  ← 分类与 key 整体对调！
（只看回显 `A`→`O` 是 c_1、`A`→`B` 是 en_2，可快速判别）

### 3. 单次 read 长度上限会截断长链
`bjdctf_2020_babyrop`：`read(0, buf, 0x64)`=100 字节。两阶段链 112 字节时末尾"返回 vuln"被截掉
→ 泄漏能打出来但程序立刻崩，第二轮 payload 没人接收。误诊过"栈对齐"和"libc 版本不对"。
对策：每轮只放 4 个 qword，拆三轮短链（leak puts → leak read → system）。

### 4. strlen 是 IFUNC，不能用来指纹 libc
泄漏 `strlen@got` 拿到的是 `__strlen_avx2` 实现变体，与符号偏移差很远，libc.rip 0 命中。
用 **`puts` + `__libc_start_main` + `gets`** 这类非 IFUNC 符号交叉验证。

### 5. libc.rip 的 addresses 查询要求给 filter
`{"addresses":{...}}` 单独发会 400 "must provide at least one filter"。
用 `{"symbols":{"puts":"9c0","__libc_start_main":"ab0"}}`（末三位）更稳，多符号交叉验证。

### 6. 32 位 shellcode + jmp esp：push 会覆盖自己
`ciscn_2019_s_9`：`fgets(buf, 0x32)` 只 49 字节，buf 32 + saved ebp 4 + `jmp esp` 4 = 剩 9 字节。
方案：28B shellcode 放 buf 开头，retaddr = `jmp esp`(0x8048554)，`esp` 处放 `jmp short` 跳回 buf。
**坑**：`jmp esp` 后 `esp = buf+0x28`，shellcode 里的 `push eax/push "//sh"/push "/bin"`
向下压栈正好覆盖 `buf+0x18` 之后的 `mov ecx,esp / mov al,0xb / int 0x80` → SIGSEGV。
**修法**：shellcode 开头先 `sub esp, 0x28`（83ec28），让 push 落到 buf 下方空闲栈。
诊断手段：`gdb -ex "b *0x8048550" -ex "run < in.bin" -ex si -ex si -ex "x/48xb $eip"`，
一眼能看到 buf 里被 push 写坏的字节。

### 7. 手滑把方法覆盖成 None
`s.settimeout = 8 if False else None` 之后 `s.settimeout(8)` 直接
`TypeError: 'NoneType' object is not callable`。socket 包装别赋值覆盖方法。

### 8. 沙箱缺 32 位运行库会让本地复现失败
`FileNotFoundError: './xxx'` 而文件明明存在 → 是 `/lib/ld-linux.so.2` 缺失。
装：`dpkg --add-architecture i386 && apt-get update && apt-get install -y libc6:i386`。
本地能跑之后再调 payload，比盲打远程省几个回合。

## SROP 标准模板（ciscn_2019_s_3）

程序自带 `read(0, rsp-0x10, 0x400)` + `write` 回显，`gadgets` 里有 `mov rax,0xf; ret`。
两帧、**不依赖栈地址**：

```python
f1 = SigreturnFrame(); f1.rax=0; f1.rdi=0; f1.rsi=BSS; f1.rdx=0x400
f1.rip=SYSCALL; f1.rsp=BSS
stage1 = b'A'*0x10 + p64(MOV_RAX_15) + p64(SYSCALL) + bytes(f1)   # PAD=0x10 不是 0x18!
f2 = SigreturnFrame(); f2.rax=59; f2.rdi=SH; f2.rsi=0; f2.rdx=0
f2.rip=SYSCALL; f2.rsp=SH+0x100
stage2 = p64(MOV_RAX_15)+p64(SYSCALL)+bytes(f2)
stage2 = stage2.ljust(0x200,b'\x00') + b'/bin/sh\x00'
```
**返回地址在 buf+0x10**（探测时 `b'A'*0x10+p64(VULN)` 能重新进 vuln 即为证）。

## 题目速查表

| 题名 | 架构 | 偏移 | 手法 | 备注 |
|---|---|---|---|---|
| test_your_nc | - | - | 直连即 shell | flag 在 /flag |
| rip | x64 | 23 | ret2text → 0x401186 | 自带 system("/bin/sh")；先补 1 ret 对齐 |
| warmup_csaw_2016 | x64 | 72 | ret2text → 0x40060d | system("cat flag.txt") |
| get_started_3dsctf_2016 | x86 | - | ROP 传参 | 需构造 a1/a2 |
| ciscn_2019_n_1 | x64 | 40+ | float 变量覆盖 | 0x41348000 = 11.28125 |
| not_the_same_3dsctf_2016 | x86 | - | ROP 写 flag 到 bss 再读 | 无 system 回显 |
| jarvisoj_level0 | x64 | 136 | ret2text → 0x400596 | |
| NewStarCTF ret2text | x64 | 40 | ret2text → 0x4011fb | execve("/bin/sh") |
| jarvisoj_level2_x64 | x64 | 136 | ret2libc | 自带 system@plt+/bin/sh(0x600a90)；pop rdi;ret=0x4006b3 |
| bjdctf_2020_babystack | x64 | 24 | ret2text | 先 scanf 长度再 read 可控 |
| wustctf2020_getshell | x86 | 28 | ret2text → shell() | read 只 32 字节 |
| [第五空间2019]PWN5 | x86 | - | 格式化字符串 | buf 当 fmt；AAAA 在第 10 参数；`%10$n` 写 4 到 0x804c044 |
| repeater | x64 | 0x28 | canary 泄漏 + ret2libc | 覆盖 canary 首字节为非零让 puts 溢出；输 0 继续/非零退出 |
| [Harekaze]baby_rop | x64 | 24 | ret2text | 自带 system+/bin/sh(0x601048)；**flag 在 /home/babyrop/flag** |
| bjdctf_2020_babyrop | x64 | 40 | ret2libc（三轮短链） | read 只 100 字节 |
| ciscn_2019_n_8 | x86 PIE | 52 | 变量覆盖 | `buf+0x34==0x11 && buf+0x38==0` |
| ciscn_2019_c_1 | x64 | 88 | ret2libc + 加密 | libc6_2.27-3ubuntu1 |
| ciscn_2019_en_2 | x64 | 88 | 同 c_1 | **xor key 对调**（a-z^0xe/A-Z^0xd/0-9^0xc） |
| ciscn_2019_es_2 | x86 | 0x28 | 栈迁移 | printf 泄漏 ebp → buf=ebp-0x38；`leave;ret`(0x80485fd) |
| ciscn_2019_s_4 | x86 | 同 es_2 | 同 es_2 | **MD5 与 es_2 完全一致**，换 flag 不换二进制 |
| ciscn_2019_s_3 | x64 | 0x10 | SROP | 见上文模板；BSS=0x601100 |
| ciscn_2019_s_9 | x86 | 0x24 | jmp esp + shellcode | fgets 只 49B；**shellcode 开头 sub esp,0x28** |

## 放弃记录（别重复踩）

- **tiny_backdoor_v1_hackover_2016**：无 banner 无附件，任何输入（含空行）立刻 core dump,
  34B x64 shellcode >= 换行能压掉 core 但无回显。纯盲打无 oracle，6 轮停手。
- **bubble_ekoparty_2016**：PIE+canary+stripped，全局 `arr@0x202040`/`count@0x202440`，
  count=256 时第 257 个输入覆盖 count 自身。但打印/排序都从 arr[0] 向高地址走，
  `.got@0x201f80` 在低地址方向、需负索引精确构造排序递归，投入产出比差，6 轮停手。
- **HeartAttack_hitcon_2016**：多进程 socket 服务 + SysV shm，漏洞在共享内存越界，
  分析成本高，2 轮停手。

## libc 指纹流程（attach 里没 libc 时）

1. `pop rdi; puts@got; puts@plt` × N 个非 IFUNC 符号。
2. 解析：`\n` + 6 字节 + `\x7f` 的模式匹配（地址里可能含 `\n`，别按行 split）。
3. libc.rip：`{"symbols":{"puts":"9c0","__libc_start_main":"ab0"}}` 末三位交叉验证。
4. 拿到 base 后用**第二个符号 assert 校验**，不匹配就是 libc 猜错了。
