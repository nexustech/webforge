/** AI apps (`apps/desktop/src/renderer/ai-apps/`, F-AI-1, 4.9): pairing them and seeing them. */
export const aiApps = {
  "aiApps.command": "AI apps…",
  "aiApps.title": "AI apps",
  "aiApps.description":
    "Let AI apps on this computer, such as Claude, work on the site you have open. Each change they make is a step in Undo History, named after the app.",
  "aiApps.enabled": "Let AI apps connect",
  "aiApps.enabledHint":
    "When off, nothing can connect. When on, {appName} listens on this computer only.",
  "aiApps.moved":
    "{appName}'s address for AI apps has changed. Remove your AI apps and add them again.",
  "aiApps.none": "No AI apps yet.",
  "aiApps.list": "Your AI apps",
  "aiApps.status.connected": "Connected",
  "aiApps.status.idle": "Not connected",
  "aiApps.status.waiting": "Waiting for its key",
  "aiApps.remove": "Remove {name}",
  "aiApps.removeTitle": "Remove {name}?",
  "aiApps.removeDescription":
    "{name} can't reach your sites any more. To use it again, add it again with a new key.",
  "aiApps.removeConfirm": "Remove",
  "aiApps.add": "Add AI app",
  "aiApps.add.which": "Which app?",
  "aiApps.add.claude": "Claude Desktop",
  "aiApps.add.claudeHint":
    "{appName} makes an extension for Claude Desktop to install, which checks it's {appName} it talks to.",
  "aiApps.add.other": "Another app",
  "aiApps.add.otherHint":
    "An app that connects to an MCP server at an address, such as Claude Code, Cursor or VS Code.",
  "aiApps.add.name": "Name",
  "aiApps.add.nameHint":
    "What you call it, such as Claude Desktop. Its changes are named after it.",
  "aiApps.add.shared": "The app will read and change the sites you open in {appName}.",
  "aiApps.add.confirm": "Add",
  "aiApps.add.failed.name-empty": "Give the app a name.",
  "aiApps.add.failed.name-taken": "Another AI app has that name. Give this one another.",
  "aiApps.add.failed.off": "Turn on Let AI apps connect first.",
  "aiApps.add.failed.failed":
    "{appName} couldn't keep the app's key safe on this computer, so the app wasn't added.",
  "aiApps.key.title": "{name} is added",
  "aiApps.key.once":
    "Copy its key into {name} now. You won't see it again, and it stops working if {name} doesn't use it within 5 minutes.",
  "aiApps.key.address": "Address",
  "aiApps.key.key": "Key",
  "aiApps.key.copyAddress": "Copy the address",
  "aiApps.key.copyKey": "Copy the key",
  "aiApps.key.copied": "Copied",
  "aiApps.key.cleared": "The key is cleared from the clipboard in a minute, once you've pasted it.",
  "aiApps.key.how":
    "In the app's settings for MCP servers, add one at this address, with the header Authorization: Bearer followed by the key.",
  "aiApps.key.risk":
    "While {appName} is closed, another program on this computer could answer at this address and get the key. Turn this server off in the app while {appName} is closed.",
  "aiApps.key.done": "Done",
  "aiApps.claude.steps": "To connect Claude Desktop",
  "aiApps.claude.step1": "Copy the key.",
  "aiApps.claude.step2": "Choose Install in Claude Desktop. Claude Desktop opens the extension.",
  "aiApps.claude.step3": "In Claude Desktop, paste the key into Key, and install the extension.",
  "aiApps.claude.install": "Install in Claude Desktop",
  "aiApps.claude.opened": "Claude Desktop is opening the extension. Paste the key into Key there.",
  "aiApps.claude.shown":
    "Nothing opened the extension. If Claude Desktop is installed, open the file shown in its folder with it.",
  "aiApps.claude.failed": "{appName} couldn't make the extension. Try again.",
  "aiApps.claude.unknown":
    "{name}'s key wasn't used within 5 minutes, so {name} was removed. Add it again, then install its new extension.",
  "aiApps.extension.description": "Lets Claude work on the site you have open in {appName}.",
  "aiApps.extension.key": "Key",
  "aiApps.extension.keyHint": "The key {appName} showed when you added Claude Desktop in AI apps.",
  "aiApps.bridge.unreachable":
    "{appName} isn't answering. Open {appName}, and in AI apps turn on Let AI apps connect. If AI apps says its address has changed, add Claude Desktop again there, and install its new extension.",
  "aiApps.bridge.notWebforge":
    "{appName} didn't answer as it should, so the key wasn't sent. If Claude Desktop was removed from {appName}'s AI apps, add it again there, and install its new extension. If not, another program may be answering at {appName}'s address: open {appName}, then try again.",
  "aiApps.bridge.keyRefused":
    "{appName} didn't take the key. In {appName}'s AI apps, remove Claude Desktop and add it again, then paste the new key into the extension's settings in Claude Desktop.",
  "aiApps.bridge.failed": "{appName} couldn't answer. Try again.",
  "aiApps.cancel": "Cancel",
  "aiApps.indicator": "Connected AI apps: {names}. Open AI apps.",
  "aiApps.failed": "{appName} couldn't reach AI apps. Try again.",
} as const;
