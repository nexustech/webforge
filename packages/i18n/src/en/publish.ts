/** Publishing (Phase 4): publish destinations, and connecting to them. */
export const publish = {
  // An FTP, FTPS or SFTP publish destination (4.3, F-PB-1, B5).
  "publish.fileTransfer.title": "Publish to your web host",
  "publish.fileTransfer.description":
    "{appName} uploads your site to the folder your web host serves. Your host's control panel shows these details.",
  "publish.fileTransfer.confirm": "Save",
  "publish.fileTransfer.preset": "Control panel",
  "publish.fileTransfer.preset.help": "Fills in the usual settings for it.",
  "publish.fileTransfer.preset.cpanel": "cPanel",
  "publish.fileTransfer.preset.plesk": "Plesk",
  "publish.fileTransfer.preset.other": "Another, or I don't know",
  "publish.fileTransfer.protocol": "Connection",
  "publish.fileTransfer.protocol.ftps": "FTPS (encrypted)",
  "publish.fileTransfer.protocol.sftp": "SFTP (encrypted)",
  "publish.fileTransfer.protocol.ftp": "FTP (not encrypted)",
  "publish.fileTransfer.host": "Host",
  "publish.fileTransfer.host.placeholder": "ftp.example.com",
  "publish.fileTransfer.port": "Port",
  "publish.fileTransfer.port.help": "Leave empty for the usual one: {port}.",
  "publish.fileTransfer.user": "User name",
  "publish.fileTransfer.signIn": "Sign in with",
  "publish.fileTransfer.signIn.password": "A password",
  "publish.fileTransfer.signIn.key": "A private key file",
  "publish.fileTransfer.password": "Password",
  "publish.fileTransfer.password.help": "Kept safely by your computer, never in your site's file.",
  "publish.fileTransfer.passphrase": "Key passphrase",
  "publish.fileTransfer.folder": "Folder",
  "publish.fileTransfer.folder.help":
    "Where your host serves your site from, such as /public_html.",
  "publish.fileTransfer.url": "Web address",
  "publish.fileTransfer.url.help":
    "Where visitors find your site, such as https://www.example.com.",
  // Problems the form words itself.
  "publish.fileTransfer.error.host": "Use the host's name, such as ftp.example.com.",
  "publish.fileTransfer.error.folder": "Use a folder, such as /public_html.",
  "publish.fileTransfer.error.password": "Type the password.",
  "publish.fileTransfer.error.key": "Choose your private key file.",
  "publish.fileTransfer.error.passphrase": "This key needs its passphrase.",
  "publish.fileTransfer.error.plainFtp": "Read the warning about plain FTP first.",
  "publish.fileTransfer.error.hostKey": "Test the connection to check this host first.",
  // The private key file (SFTP).
  "publish.keyFile.chooseTitle": "Choose your private key file",
  "publish.keyFile.choose": "Choose Key File…",
  "publish.keyFile.chosen": "Using {name}",
  "publish.keyFile.none": "No key file chosen.",
  "publish.keyFile.saved": "Using your saved key.",
  "publish.keyFile.unreadable": "That file couldn't be read.",
  "publish.keyFile.tooLarge": "That file is too large to be a private key.",
  "publish.keyFile.unsupported":
    "That key is saved in a format {appName} can't read. Save it again in the OpenSSH format, which most hosts' control panels offer.",
  "publish.keyFile.notAKey":
    "That file isn't a private key. Choose the private one, not the file ending in .pub.",
  // Plain FTP's warning, once per destination (B5).
  "publish.plainFtp.title": "Plain FTP isn't encrypted",
  "publish.plainFtp.body":
    "Your password and your site's files travel unprotected, so someone on the same network could read them. Use FTPS or SFTP if your host offers either.",
  "publish.plainFtp.accept": "Use Plain FTP Anyway",
  // Test connection.
  "publish.test.button": "Test Connection",
  "publish.test.testing": "Connecting…",
  "publish.test.ok": "Connected. {appName} can publish your site here.",
  "publish.test.unauthorized": "The host refused the user name or password.",
  "publish.test.not-found": "Signed in, but there's no folder of that name. Check the folder.",
  "publish.test.rate-limited": "The host asked to wait. Try again in a few minutes.",
  "publish.test.rejected": "The host refused the request. Check the folder and your permissions.",
  "publish.test.network":
    "The host couldn't be reached. Check its name, the port and your internet connection.",
  "publish.test.untrusted-host":
    "This computer doesn't trust the host's security certificate, so nothing was sent.",
  "publish.test.no-encryption":
    "This host doesn't offer FTPS. Choose SFTP if your host offers it, or plain FTP.",
  "publish.test.bad-key": "The private key couldn't be opened. Check its passphrase.",
  "publish.test.other-site": "This folder has another site published there with {appName}.",
  "publish.test.cancelled": "The test was cancelled.",
  "publish.test.failed": "The connection didn't work.",
  // An SFTP host's key, trusted the first time (ADR 0006 §7).
  "publish.hostKey.title": "Is this your host?",
  "publish.hostKey.body":
    "Your host's key is {hostKey}. If it matches the one your host shows, trust it: {appName} will then refuse any other.",
  "publish.hostKey.changedTitle": "The host's key has changed",
  "publish.hostKey.changedBody":
    "The host now shows {hostKey}. Trust it only if your host says it changed its key; otherwise someone may be in the way.",
  "publish.hostKey.trust": "Trust This Host",
  "publish.hostKey.unreadable": "The host's key couldn't be read.",
} as const;
