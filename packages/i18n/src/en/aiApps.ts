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
  "aiApps.key.how":
    "In the app's settings for MCP servers, add one at this address, with the header Authorization: Bearer followed by the key.",
  "aiApps.key.done": "Done",
  "aiApps.cancel": "Cancel",
  "aiApps.indicator": "Connected AI apps: {names}. Open AI apps.",
  "aiApps.failed": "{appName} couldn't reach AI apps. Try again.",
} as const;
