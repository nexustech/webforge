# 0021. AI apps reach Webforge over loopback HTTP, and Claude Desktop through a bundled extension

- Status: Proposed
- Date: 2026-11-01
- Related: 4.9 (#171), spec/04 Q9, [spec/01 §9](../../spec/01-architecture.md#9-security--privacy) (AI apps), [security review](../reviews/2026-10-30-security-review.md) (S18–S21 and the 4.9 requirements), F-AI-1, GA5, [ADR 0015](0015-preview-server.md) (the other loopback listener)

## Context
4.9 lets AI apps on this computer use the 4.8 commands through the Model Context Protocol (MCP). Q9 asks how they reach the server in main:
- **Loopback Streamable HTTP with a per-app token.** This was the plan's provisional answer, if the main AI desktop apps can connect to it.
- **A small bundled stdio bridge.** Electron's `RunAsNode` fuse is off (spec/01 §3), so the Webforge binary can't be that bridge.

What the AI apps can connect to, as of 1 Nov 2026:
- **Claude Desktop and ChatGPT's custom connectors (remote MCP) connect from the vendor's cloud,** not from this computer. A server on `127.0.0.1` is out of their reach, and opening Webforge to the internet is out of the question.
- **Claude Desktop starts local servers itself, over stdio.** They are added in its config file or as a *desktop extension*:
  - an `.mcpb` file holding a manifest and the server's code;
  - a `node` server runs on the Node.js that Claude Desktop ships, so the person needn't install it;
  - a setting the manifest marks `sensitive` is masked when entered and stored securely by Claude Desktop, and reaches the server in an environment variable.
- **ChatGPT's desktop app can't start a local server,** except through Codex, which is a developer tool. Its custom connectors are remote only.
- **Developer tools on this computer** (Claude Code, Cursor, VS Code) connect to a Streamable HTTP URL on `127.0.0.1`, with an `Authorization: Bearer` header from their config.

So no single transport reaches both kinds of app. Loopback HTTP reaches only the developer tools, and stdio reaches Claude Desktop only through a bridge that Claude Desktop runs.

**The threat that comes with a remembered port: squatting.** Loopback is shared by every process on the computer, including those in another person's session on it. While Webforge isn't listening, any of them can bind the port. A client that connects then talks to the squatter, which can do two things:
- **take the key**, sent in `Authorization` with the client's first request;
- **answer as Webforge**, with tool descriptions of its own that carry instructions into the person's AI app, whose other tools may reach their files or accounts.

The server's checks (decision 1) protect Webforge from its callers. Nothing in them protects the callers from a server that isn't Webforge.

## Decision
1. **One server: MCP over Streamable HTTP, in main, on loopback.** It uses the official TypeScript SDK (MIT), with its logging off. Each MCP session is one connection: an app's `initialize` starts it.
   - **It binds the literal `127.0.0.1`,** never `localhost` or `0.0.0.0`, whenever *AI apps* is on in Preferences and Webforge is running, so its port is never left free for the length of a session. While no site is open, every tool answers "no site open" and nothing else. With the preference off, nothing listens.
   - **The port is drawn at random from the ephemeral range** the first time *AI apps* is turned on, and remembered. The apps' configs hold the address, so a new port each start would cut every app off. Only when that port is taken is a new one drawn: Preferences → *AI apps* then says each app has to be added again.
   - **Every request is checked before the SDK sees it:**
     - one with an `Origin` header is refused, since a browser page is never a client;
     - `Host` must be exactly `127.0.0.1:<port>`;
     - the key travels only in `Authorization: Bearer`, never in the URL;
     - the body is capped.
2. **Each paired app has its own key, which is the pairing.** Standard MCP clients can only send a header from their config. They can't exchange a short code for a token. So what the person pastes into the app is the app's key itself:
   - **The key** is 256 random bits, shown once by *Add AI app* with a copy button and never shown again.
   - **Webforge keeps only its SHA-256,** in the OS keychain through 4.4a's credential store, and compares hashes in constant time.
   - **A key not used within 5 minutes is revoked,** so a key left on the clipboard or a screen doesn't stay valid. Its first use completes the pairing, and the dialog shows *Connected*.
   - **The app's name comes from the pairing dialog,** where the person picks or types it, cleaned. Never from the app's own `clientInfo`.
   - **Removing an app deletes its hash,** and its sessions end.
   - **Failed attempts back off,** doubling after the third in a minute. A 256-bit key can't be guessed, but the back-off stops a local process from hammering the server.
3. **Claude Desktop connects through a Webforge desktop extension.** It is a small relay, `webforge-bridge`, bundled with esbuild into one file in the app's resources.
   - It takes MCP over stdio from Claude Desktop and sends each message on to the server, with the key in the header. Nothing else: it holds no state and logs nothing.
   - **It checks that it is talking to Webforge before it sends the key.** Each pairing has a second random value, the *server proof*, which Webforge keeps in the keychain beside the key's hash:
     - the bridge opens each connection with a fresh nonce, sent in a request that carries no key;
     - the server answers with HMAC-SHA256 of the nonce under the proof;
     - the bridge compares that in constant time. If it doesn't match, it sends nothing more and tells Claude that Webforge isn't answering at its address.

     So a squatter gets neither the key nor a chance to describe tools. The proof is no use to a caller of the server, which still needs the key.
   - *Add AI app* → *Claude Desktop* writes an `.mcpb` for that pairing. It holds the bridge and a manifest with the address, the app's name and the server proof. The proof isn't the key: it lets the bridge recognise the server, and grants nothing on it. The file sits in the person's own profile, with the rest of Claude's extensions, out of another account's reach. Webforge then opens the file, and Claude Desktop shows its install dialog.
   - The key is the extension's one `sensitive` setting. The person pastes it there, and Claude Desktop stores it securely. The key is never written into the file, which would leave it in plain text in Downloads and in Claude's extensions folder.
   - It runs on Claude Desktop's own Node.js, so `RunAsNode` stays off and Webforge ships no Node binary.
4. **The developer tools connect directly.** *Add AI app* → *Another app* shows the URL and the header, ready to paste into Claude Code, Cursor or VS Code.
   - **They can't check the server,** so the risk remains, and the dialog and the help page name it: a developer tool sends its key to whatever answers at that address. While Webforge isn't running, another program on the computer could be answering.
   - The help page tells the person to turn that tool's Webforge server off while Webforge is closed. A tool that can run a stdio command can use the bridge instead, which does check.
5. **ChatGPT isn't supported at first.** Its desktop app can't reach a server on this computer, short of a tunnel to OpenAI, which would send the site's content through OpenAI's servers, or Codex. The help page says so. When ChatGPT can start local servers, the bridge in 3 should serve it too.
6. **Each request goes through what the security review asks for:**
   - **Checks:** main validates every request against the `ai` contract (S21);
   - **Limits:**
     - one command in flight per app;
     - a rate limit per app;
     - a back-off after the person declines a D7 question, so an app can't wear them down;
   - **A safety version:** an automatic version "Before ‹app›'s changes" at each session's first change (S20);
   - **Untrusted text:** tool descriptions say that site text is untrusted data, and values travel in labelled fields, never in descriptions;
   - **Confirmations:** sensitive fields (S18) and *Add page* wait for D7 confirmation;
   - **Open Preview** takes no URL, path or host, and never starts the phone preview;
   - **Run Site Check** results and every error use ids and titles only;
   - **No content in logs:** a tool call is logged with its name and the app's id, never its content. A test plants a marker string in a call, and finds it in no log or crash report.

## Consequences
- **What a person can connect:** Claude Desktop, in two steps (open the file, paste the key), and developer tools, by pasting the URL and the header. ChatGPT waits for OpenAI. The help page covers the first two.
- **Two pieces to build in 4.9:** the server in main, and the bridge with the `.mcpb` it goes in. The bridge needs tests of its own, with a stdio client through the bridge to a test server:
  - it sends the header, and a wrong key is refused;
  - against a server that doesn't know the proof, it sends no key and no message after the challenge.

  The `.mcpb` also needs to pass the MCPB CLI's validation.
- **Not reachable from another computer:** it binds `127.0.0.1` only. A test connects through the machine's other addresses and is refused.
- **The remembered port** is a second loopback port beside the preview server's (ADR 0015). The preview server keeps drawing a new one each time.
- **Changes to #171's acceptance criteria,** to agree before 4.9 starts:
  - "Binds the literal `127.0.0.1` on an ephemeral port" becomes "on a port from the ephemeral range, drawn once and remembered, listening whenever *AI apps* is on and Webforge runs (answering 'no site open' while none is), and the bridge checks the server's proof before it sends the key".
  - "Pairing codes are single-use, expire after about 5 minutes and lock after a few failures" becomes "A key is shown once, is revoked unless used within 5 minutes, and failed attempts back off".
  - "Help page: how to connect Claude and ChatGPT desktop apps" becomes "Claude Desktop and developer tools; ChatGPT once it can reach local servers".
  - New: "Claude Desktop connects through a Webforge `.mcpb` desktop extension; the key is its sensitive setting, never in the file".
- **Not chosen:**
  - **A stdio bridge for every app,** started by the app: it needs a Node.js on the computer, or a Node binary shipped and signed with Webforge, since our own binary can't run scripts. Its path would also change with each install or update.
  - **A new port each start:** every app's config would go stale at each restart.
  - **A tunnel or a public endpoint for ChatGPT:** the site's content would go through someone else's servers, against spec/01 §9 ("Webforge itself sends nothing").
- **Revisit** when Claude Desktop or ChatGPT can connect to a loopback HTTP server themselves, or when MCP standardises local pairing.
