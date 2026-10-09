# Device logs

What the app writes about itself, where, and how an identifier is kept out of it. The code is
`packages/logging`; each app opens its directory at its entry (`apps/desktop/src/main/logs.ts`,
`apps/mobile/src/logs.ts`) and hands the logger to `startLogger` in `@session/app`.

Logs are plain text in app-private storage. Nothing sensitive is meant to be in them, and that is
enforced by the types below and a sweep over every line, not by encryption.

## The line

Every line starts with a **fixed-width, 77-column prefix**, so the eye can skip straight to column 78:

```
2026-10-08T03:20:09.123Z     +12.345 INFO  [network]        [#41c2e0]        path built hops=3 ms=812
2026-10-08T03:20:09.140Z     +12.362 DEBUG [store]                           conversations applied count=14
2026-10-08T03:20:11.002Z     +14.224 WARN  [session-router] [#41c2e0]        hop slow hop=2 ms=1840
└──────── 24 ───────────┘ └─ 11 ──┘ └ 5 ┘ └───── 16 ─────┘ └───── 16 ─────┘ message, key=value
```

| column        | width             | content                                                                                                                                                                                                                                                        |
| ------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UTC timestamp | 24                | millisecond, with `Z`                                                                                                                                                                                                                                          |
| uptime        | 11, right-aligned | `+seconds.mmm` since process start; monotonic, so intervals survive a clock step. Aligned on the decimal point. Past 11.5 days it grows by a column rather than wrapping                                                                                       |
| level         | 5                 | `TRACE DEBUG INFO  WARN  ERROR CRIT` — a word, never collapsed                                                                                                                                                                                                 |
| category      | 16                | `[network]` padded after the bracket. The longest known category (`session-router`) fills it exactly; a longer one is kept whole and pushes the line, never truncated                                                                                          |
| op            | 16                | the operation one line belongs to, or blank: the app's own `[#41c2e0]` for a send / download / poll / sync, or libsession's request tag `[CoS-0-GZHC]`, which it puts on every line of a request under both transports and the app moves here from the message |
| message       | rest              | the event, then `key=value` pairs: **values, not conclusions** (`present=false destroyed=true`, not "group is gone"). Newlines escaped as `\n`                                                                                                                 |

Two sigils, so a value says what kind of thing it is: **`#` is an operation** (random, minted when the
operation starts), **`~` is a pseudonym** of a real identifier (keyed hash, same input → same
pseudonym for as long as the logs are kept). Op plumbing lands with the instrumentation PR; the
column exists from day one.

## Identifiers: redaction is a property of the type

The logger's structured API takes values of a closed set of types. Free text is allowed only as the
message, and it passes a backstop sweep. **The raw form of an identifier is unreachable from a log
call**: the types have no raw accessor a log call accepts, and a lint rule refuses `log(...)`
arguments built from `.raw`/`.hex`/template strings of one.

| kind                         | renders as                                                                 | examples                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **never logged**             | no overload accepts it                                                     | message bodies and drafts, attachment filenames, display names, recovery phrases, seeds, private/config keys, whole UI state, raw URLs                                                                          |
| **user-visible identifiers** | prefix + 4 + 4, ASCII: `05ab12...cd90`                                     | account IDs, group IDs: the reporter can match either end against what the app shows                                                                                                                            |
| **internal identifiers**     | pseudonym `~3fa9c1`                                                        | service-node keys, swarm message hashes, request ids, server file IDs, container/install UUIDs. Support needs equality across lines, never the value. Keyed with a random per-install salt kept beside the logs |
| **network addresses**        | family + class + port: `v4 public:22021`, `v6-mapped private:443`          | never the octets; the device's own address is never logged                                                                                                                                                      |
| **URLs**                     | scheme, host, path shape — see below                                       |                                                                                                                                                                                                                 |
| **paths**                    | the semantic name: `config-dump(user_groups)`, `db`, `attachment(~5d0e11)` | never a container UUID or a filename                                                                                                                                                                            |
| **free**                     | as is                                                                      | counts, sizes, durations, states, namespaces, levels, error codes, config type names, seqnos, UTC offset, locale                                                                                                |

Address classes: `loopback`, `private` (RFC 1918, ULA, link-local), `cgnat` (100.64/10), `public`,
`unspecified`. Families: `v4`, `v6`, `v6-mapped` (an IPv4 address carried in IPv6).

URLs keep their shape and lose what identifies:

- **scheme** as is;
- **host** in clear only if it is Session's own public infrastructure (seed nodes, the file server,
  the push server, the Session Network API) — a fixed allowlist in `packages/logging`. Any other host
  is a pseudonym: a community server says which communities someone is in;
- **path**: on an allowlisted host, segments that look like ids (≥ 16 characters of hex or base64, or
  ≥ 6 digits) become pseudonyms; on any other host, every segment does except a fixed vocabulary
  (`room`, `file`, `files`, `messages`, `since`, `capabilities`, `batch`, `sequence`, `pin`, `reactions`);
- **query**: dropped, replaced by its parameter count (`?<2>`); a community link's `public_key=` lives
  there;
- **fragment**: dropped.

One ellipsis form everywhere, ASCII `...` (legacy iOS writes `...`, Android `…`; not `..`, which
legacy iOS rewrites to `.`).

**Backstop sweep** over every rendered line, before it is written; each match replaced by its
redacted form and counted (the counts go in the export header): URLs; UUIDs; hex runs of **32 or
more** (a 66-hex prefixed key becomes its user-visible form, anything else a pseudonym); base64 runs
of 40+ with mixed case; **lowercase base32 runs of 50+, keeping a `.sesh`/`.snode` suffix** (Session
Router and service-node addresses — a real testnet run showed the client's own router address
reaching the file before this rule); IPv4/IPv6 literals; runs of 13+ words of 3–12 letters (Latin
and Cyrillic; a phrase in another script is a known gap). libsession's lines are free text from C++,
so they are swept like any other line.

## Following things through a log

**One request, end to end** — grep the op id:

```
2026-10-09T07:12:30.101Z   +4211.870 INFO  [network]        [#41c2e0]        request start method=store dest=snode~3fa9c1 addr=v4 public:22021 ns=0 bytes=1840
2026-10-09T07:12:30.313Z   +4212.082 WARN  [network]        [#41c2e0]        request failed dest=snode~3fa9c1 addr=v4 public:22021 errno=ECONNREFUSED ms=212 attempt=1
2026-10-09T07:12:30.315Z   +4212.084 INFO  [network]        [#41c2e0]        retry dest=snode~8b20de addr=v4 public:22021 attempt=2
2026-10-09T07:12:30.902Z   +4212.671 INFO  [network]        [#41c2e0]        request ok dest=snode~8b20de status=200 ms=587 bytes=212
```

`grep '#41c2e0'` gives the whole story; `grep 'snode~3fa9c1'` gives every operation that ever touched
that node, across ops and across the files of one install (same salt).

**A path that goes bad on a private network** — the class is what support needs, never the octets:

```
... WARN  [quic]           [#9a0e51]        connect failed dest=snode~c41b07 addr=v6-mapped private:22021 errno=EHOSTUNREACH ms=3004
```

**A file download** — the server is Session's own, so its host stays; the file id is a pseudonym, which
the attachment's own lines carry too:

```
... INFO  [attach]         [#d2b6f4]        download start url=https://filev2.getsession.org/file/~5d0e11 msg=~77a0c3 bytes=245812
... INFO  [attach]         [#d2b6f4]        download ok ms=1204 path=attachment(~5d0e11)
```

**A community poll** — the server is not Session's, so its host is a pseudonym, room names too; the
query is only counted:

```
... INFO  [community]      [#0c11e8]        poll url=https://~a91f0c/room/~e02d4b/messages/since/~41f0aa?<1> status=200 msgs=3 ms=388
```

`grep '~a91f0c'` follows one community server across every room and every poll without saying which it
is.

**An account, as the reporter sees it** — user-visible ids keep both ends, so a screenshot of the app
can be matched to the line:

```
... INFO  [send]           [#5e70b2]        send start to=05ab12...cd90 kind=text attempt=1
```

## Files

- `logs/` under app-private storage (desktop `userData/logs`; mobile documents/`logs`).
- **Names, no spaces:** `session-<UTC basic>-<n>.log`, e.g. `session-20261008T032009Z-0.log`.
- **A new file at every launch**, so "the previous run" is a file and a crash's run is never mixed
  into the next one.
- **Rotate by size, never age:** a file closes at 2 MiB; the store keeps the newest files up to
  ~20 MiB and deletes the oldest whole file. Nothing is truncated mid-file.
- Writes buffered, flushed at least every 2 s and on background / window close. Unmissable markers
  flush at once.
- **The log never depends on the database or its key.** If the directory can't be written the logger
  falls back to console and says why in the next file that can be.

## The startup block (top of every launch)

Written **without** the line prefix, after an empty line, one item per line:

```
2026-10-09T07:40:58.002Z      +3.811 INFO  [lifecycle]                       >>> background

── Session 1.0.0 (123) launched 2026-10-09 07:41:02Z
  Version        1.0.0 (123)
  Commit         833d55d5
  libsession     76d93c51
  Variant        testflight
  Install        testflight
  Device         iPhone17,1
  OS             iOS 26.1
  Time           en-AU · UTC+10:00
  Network        mainnet
  Transport      Session Router (default)
  Flags          none overridden
  Log level      info,network=debug
  Previous run   session-20261009T011544Z-0.log, ended cleanly
2026-10-09T07:41:02.130Z      +0.412 INFO  [lifecycle]                       >>> launch
```

- **The empty line** sets one launch apart from the last when scrolling, without a rule that would
  compete with the export's header. `grep -n '^── Session'` lists every launch in a file or an
  export, and splitting on it cuts a log into runs.
- **The libsession commit** is stamped at build time from the submodule, like the app's: libsession
  is the client, so a report has to say which one.
- **Time** is the locale and the UTC offset together; no time-zone name, no region.
- **Network and transport** are read where the bridge is opened, not from what the renderer was
  built with, so a dev run says what it is actually attached to. Seed node and file server follow
  when they were set.
- **Platform rows:** Linux adds Distro, Display (Wayland or X11), Desktop and Packaging (AppImage,
  Flatpak, Snap), and gives the kernel as its OS version. macOS and Windows give their version.
- **Desktop's main process writes the block**, so it opens the file and is there even when the
  renderer never loads. The renderer marks its own launch (`>>> launch process=renderer`).
- **"Previous run … ended cleanly"** comes from the markers: a previous file whose last marker is
  not a background or a quit says that run died, which is the first thing support asks.

## Unmissable markers

Never sampled, rate-limited or level-filtered, flushed at once: `launch`, `foreground`,
`background`, `quit` (where the platform says), `start ok|failed reason=…`,
`account loaded|none|created`, `memory warning` (phones), `renderer gone` and
`child process gone` with Chromium's reason (desktop), and `export`. Their absence is then
evidence.
