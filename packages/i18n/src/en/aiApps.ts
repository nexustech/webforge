/** AI apps (`apps/desktop/src/renderer/ai-apps/`, F-AI-1, 4.9): pairing them and seeing them. */
export const aiApps = {
  "aiApps.command": "AI Apps…",
  "aiApps.title": "AI Apps",
  "aiApps.description":
    "Let AI apps on this computer, such as Claude, work on the site you have open. Each change they make is a step in Undo History, named after the app.",
  "aiApps.enabled": "Let AI apps connect",
  "aiApps.enabledHint":
    "When off, nothing can connect. When on, {appName} listens on this computer only.",
  "aiApps.moved":
    "{appName}'s address for AI apps has changed, as another program was using the old one. To keep your site safe, apps other than Claude Desktop were removed: add them again. Remove Claude Desktop and add it again too, then install its new extension.",
  // At start, until AI apps has been opened (S27, #794).
  "aiApps.movedToast":
    "{appName}'s address for AI apps has changed. Open AI apps to connect your apps again.",
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
  "aiApps.add": "Add AI App",
  "aiApps.add.which": "Which app?",
  "aiApps.client.claude.label": "Claude Desktop",
  "aiApps.client.claude.hint":
    "{appName} makes an extension for Claude Desktop to install, which checks it's {appName} it talks to.",
  // Named plainly, with no logos (5.13, AIA-13).
  "aiApps.client.claudeCode.label": "Claude Code",
  "aiApps.client.claudeCode.hint":
    "{appName} gives you a command that adds it to Claude Code. The key stays out of the command.",
  "aiApps.client.vscode.label": "VS Code (GitHub Copilot)",
  "aiApps.client.vscode.name": "VS Code",
  "aiApps.client.vscode.hint":
    "{appName} opens VS Code to add it, for GitHub Copilot to use. VS Code asks for the key and keeps it safe.",
  "aiApps.client.other.label": "Another app",
  "aiApps.client.other.hint":
    "An app that connects to an MCP server at an address, such as Cursor.",
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
  // While the dialog shows a new app's key (#1245): waiting for it, then connected, or run out.
  "aiApps.shown.waiting": "Waiting for {name} to connect. The key works for {time} more.",
  "aiApps.shown.connected": "{name} is connected.",
  "aiApps.shown.used": "{name} has used its key.",
  "aiApps.shown.expired":
    "{name}'s key wasn't used within 5 minutes, so {name} was removed. Add it again.",
  "aiApps.client.claude.steps": "To connect Claude Desktop",
  "aiApps.client.claude.step1": "Copy the key.",
  "aiApps.client.claude.step2":
    "Choose Install in Claude Desktop. Claude Desktop opens the extension.",
  "aiApps.client.claude.step3":
    "In Claude Desktop, paste the key into Key, and install the extension.",
  "aiApps.client.claude.install": "Install in Claude Desktop",
  "aiApps.client.claude.opened":
    "Claude Desktop is opening the extension. Paste the key into Key there.",
  "aiApps.client.claude.shown":
    "Nothing opened the extension. If Claude Desktop is installed, open the file shown in its folder with it.",
  "aiApps.client.claude.failed": "{appName} couldn't make the extension. Try again.",
  "aiApps.client.claude.unknown":
    "{name}'s key wasn't used within 5 minutes, so {name} was removed. Add it again, then install its new extension.",
  "aiApps.client.claudeCode.steps": "To connect Claude Code",
  // Three steps, each with what it copies (#1245).
  "aiApps.client.claudeCode.step1":
    "Add {appName} to Claude Code: run this command in a terminal. It adds {appName} for all your projects.",
  "aiApps.client.claudeCode.step2":
    "In the same terminal, give it the key: run this command, then copy the key, paste it when the terminal waits for it, and press {key}. The key doesn't show as you paste it.",
  // The key that ends the line, as the computer's keyboard names it (#1268 review).
  "aiApps.client.claudeCode.returnKey": "Return",
  "aiApps.client.claudeCode.enterKey": "Enter",
  "aiApps.client.claudeCode.step3":
    "Start Claude Code in that terminal before the key runs out. In Claude Code, /mcp lists webforge once it's connected.",
  // On Windows, the same steps in PowerShell: its commands are PowerShell's, and cmd.exe splits the
  // add command's header at its spaces (#1367).
  "aiApps.client.claudeCode.step1PowerShell":
    "Add {appName} to Claude Code: run this command in PowerShell. It adds {appName} for all your projects.",
  "aiApps.client.claudeCode.step2PowerShell":
    "In the same PowerShell window, give it the key: run this command, then copy the key, paste it when PowerShell waits for it, and press {key}. The key doesn't show as you paste it.",
  "aiApps.client.claudeCode.step3PowerShell":
    "Start Claude Code in that PowerShell window before the key runs out. In Claude Code, /mcp lists webforge once it's connected.",
  "aiApps.client.claudeCode.keyWhere":
    "Why the key isn't in the commands: Claude Code reads it from {variable} as it connects, so it isn't in your terminal's history or in Claude Code's settings. {variable} lasts as long as that terminal.",
  "aiApps.client.claudeCode.copyCommand": "Copy the add command",
  "aiApps.client.claudeCode.copyKeyCommand": "Copy the key command",
  "aiApps.client.vscode.steps": "To connect VS Code",
  "aiApps.client.vscode.step1": "Copy the key.",
  "aiApps.client.vscode.step2":
    "Choose Install in VS Code. VS Code shows {appName}'s server: install it there.",
  "aiApps.client.vscode.step3":
    "When VS Code starts the server and asks for {appName}'s key, paste the key. VS Code keeps it safe.",
  "aiApps.client.vscode.install": "Install in VS Code",
  "aiApps.client.vscode.opened":
    "VS Code is opening {appName}'s server. Install it there, and paste the key when VS Code asks for it.",
  "aiApps.client.vscode.failed":
    "VS Code didn't open. If it isn't installed, install it, then choose Install in VS Code again.",
  "aiApps.client.vscode.unknown":
    "{name}'s key wasn't used within 5 minutes, so {name} was removed. Add it again.",
  // What VS Code asks for the key with, in its own window.
  "aiApps.client.vscode.prompt": "The key {appName} showed when you added VS Code in AI apps",
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
  // What the tools answer an AI app when the window can't, which the app may show (#1004).
  "aiApps.answer.noSite": "No site is open in {appName}.",
  "aiApps.answer.reloaded":
    "{appName} reloaded the site before it answered: ask again once it has.",
  "aiApps.answer.noAnswer": "{appName} didn't answer in time: try again.",
  // A question still waiting when its site closed or the window went (5.34): no refusal.
  "aiApps.answer.siteClosed":
    "The site closed in {appName} before the person answered, so nothing changed.",
  // Said with each progress report while a request waits, which the app may show (5.34).
  "aiApps.answer.stillWaiting": "Still waiting for {appName}: it may be asking the person.",
  "aiApps.answer.tooMany":
    "{appName} is still answering earlier requests: wait for their answers, then ask again.",
  "aiApps.cancel": "Cancel",
  "aiApps.indicator": "Connected AI apps: {names}. Open AI apps.",
  // Whether an app works without asking on the open site (5.35, UA-2), in AI apps.
  "aiApps.unasked.label": "Work without asking:",
  "aiApps.unasked.for": "Work without asking: {name}",
  "aiApps.unasked.asks": "No, ask first",
  "aiApps.unasked.until": "Yes, until {time}",
  "aiApps.unasked.minutes": "For {count} minutes",
  "aiApps.unasked.hour": "For an hour",
  "aiApps.unasked.hours": "For {count} hours",
  // An app working without asking on the open site (5.35, UA-2), in the title bar.
  "aiApps.indicatorUnasked": "Working without asking: {names}. Open AI apps.",
  "aiApps.failed": "{appName} couldn't reach AI apps. Try again.",
} as const;
