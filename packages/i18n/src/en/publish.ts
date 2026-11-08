/** Publishing (Phase 4): publish destinations, and connecting to them. */
export const publish = {
  // An FTP, FTPS or SFTP publish destination (4.3, F-PB-1, B5).
  "publish.fileTransfer.title": "Publish to your web host",
  "publish.fileTransfer.description":
    "{appName} uploads your site to the folder your web host serves. Your host's control panel shows these details.",
  "publish.fileTransfer.confirm": "Save",
  "publish.fileTransfer.name": "Name",
  "publish.fileTransfer.name.help":
    "How the list of destinations shows it. Leave it empty to use the host's name.",
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
  "publish.fileTransfer.password.saved":
    "Saved on this computer. Leave it empty to keep it, or type a new one.",
  "publish.fileTransfer.passphrase": "Key passphrase",
  "publish.fileTransfer.folder": "Folder",
  "publish.fileTransfer.folder.help":
    "Where your host serves your site from, such as /public_html.",
  "publish.fileTransfer.url": "Web address",
  "publish.fileTransfer.url.help":
    "Where visitors find your site, such as https://www.example.com.",
  // The site's publish destinations (4.4a): where the Publish button publishes to.
  "publish.destinations.title": "Publish",
  "publish.destinations.description":
    "Where {appName} publishes this site. Each destination's password is kept by this computer, never in your site's file.",
  "publish.destinations.loading": "Reading the destinations…",
  "publish.destinations.empty":
    "No destinations yet. Add your web host: its address, your user name and the folder it serves.",
  "publish.destinations.add": "Add Destination",
  "publish.destinations.close": "Close",
  "publish.destinations.where": "{host} · {folder}",
  "publish.destinations.netlifySite": "Netlify: {url}",
  "publish.destinations.add.fileTransfer": "FTP, FTPS or SFTP…",
  "publish.destinations.add.netlify": "Netlify…",
  "publish.destinations.netlify": "Netlify",
  "publish.destinations.signIn.none":
    "No password saved on this computer. Edit the destination to add one.",
  "publish.destinations.signIn.changed":
    "Its host changed since the password was saved here. Edit the destination to type the password again.",
  "publish.destinations.test": "Test Connection",
  "publish.destinations.test.label": "Test the connection to {name}",
  "publish.destinations.testing": "Testing…",
  "publish.destinations.edit": "Edit",
  "publish.destinations.edit.label": "Edit {name}",
  "publish.destinations.remove": "Remove",
  "publish.destinations.remove.label": "Remove {name}",
  "publish.destinations.removeTitle": "Remove '{name}'?",
  "publish.destinations.removeBody":
    "{appName} stops publishing there, and this computer forgets its password. Nothing on your host changes.",
  "publish.destinations.removeCancel": "Cancel",
  "publish.destinations.removeConfirm": "Remove",
  "publish.destinations.signInNeeded":
    "Type the password again: the host, the user name or the host's key changed since it was saved.",
  "publish.destinations.addressStep": "Changed Site Settings: Web address",
  // Why the destinations couldn't be read or changed.
  "publish.destinations.failed.no-site": "No site is open.",
  "publish.destinations.failed.stale-session":
    "Another site has opened in this window. Open this site again to change its destinations.",
  "publish.destinations.failed.read-only":
    "This site's file can't be changed here, so neither can its destinations.",
  "publish.destinations.failed.no-keychain":
    "This computer can't keep passwords safely, so {appName} can't save one.",
  "publish.destinations.failed.bad-key": "Choose the private key file again.",
  "publish.destinations.failed.full": "A site can have up to {max} destinations.",
  "publish.destinations.failed.unknown": "The destinations couldn't be changed. Try again.",
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
  // A Netlify destination (4.4b): sign in, then choose a site.
  "publish.netlify.title": "Add a Netlify Destination",
  "publish.netlify.editTitle": "Edit Netlify Destination",
  "publish.netlify.description":
    "Sign in to Netlify, then choose the Netlify site to publish to, or a new one. {appName} keeps your sign-in on this computer only.",
  "publish.netlify.confirm": "Save Destination",
  "publish.netlify.name": "Name",
  "publish.netlify.name.help": "How the list shows it. Left empty, it takes the site's name.",
  "publish.netlify.defaultName": "Netlify",
  "publish.netlify.token": "Personal access token",
  "publish.netlify.token.help":
    "Make one on Netlify, in User settings › Applications › Personal access tokens, and paste it here.",
  "publish.netlify.token.saved":
    "This computer has the sign-in saved for this destination. Paste a new token only to change it.",
  "publish.netlify.connect": "Connect",
  "publish.netlify.signIn": "Sign In with Netlify",
  "publish.netlify.connecting": "Connecting to Netlify…",
  "publish.netlify.waitingBrowser":
    "Approve {appName} in the browser page that opened, then come back here.",
  "publish.netlify.connected": "Signed in to Netlify.",
  "publish.netlify.loadingSites": "Getting your Netlify sites…",
  "publish.netlify.site": "Netlify site",
  "publish.netlify.site.help": "One of your Netlify account's sites, or a new one.",
  "publish.netlify.site.choose": "Choose a site…",
  "publish.netlify.site.option": "{name} ({url})",
  "publish.netlify.site.new": "A new site",
  "publish.netlify.newSite": "New site's name",
  "publish.netlify.newSite.help":
    "Part of its address: name.netlify.app. Left empty, Netlify makes one up.",
  "publish.netlify.protected.title": "Visitors have to log in to see this site",
  "publish.netlify.protected.body":
    "Netlify's visitor access is on for it, so visitors get Netlify's log-in page instead of your site. Turn it off in the site's settings on Netlify if your site is for everyone.",
  "publish.netlify.cancelSignIn": "Cancel Sign-In",
  "publish.netlify.failed.not-set-up":
    "This copy of {appName} can't sign in through Netlify's page yet. Paste a personal access token instead.",
  "publish.netlify.failed.unauthorized":
    "Netlify didn't accept the sign-in. Check the token, or make a new one on Netlify.",
  "publish.netlify.failed.timeout": "Netlify didn't answer in time. Try again.",
  "publish.netlify.failed.cancelled": "Signing in was cancelled.",
  "publish.netlify.failed.network":
    "Netlify couldn't be reached. Check your internet connection and try again.",
  "publish.netlify.failed.signed-out": "The sign-in has run out. Sign in to Netlify again.",
  "publish.netlify.failed.failed": "Netlify didn't answer as expected. Try again.",
  "publish.netlify.error.signIn": "Sign in to Netlify, or paste a token and choose Connect.",
  "publish.netlify.error.site": "Choose a Netlify site, or a new one.",
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
  "publish.test.timeout": "The host didn't answer in time. Check its name and port, and try again.",
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
  // Publishing the site to a destination (4.5, F-PB-2): its progress, in a toast with Cancel.
  "publish.run.publish": "Publish",
  "publish.run.publish.label": "Publish to {name}",
  "publish.run.working": "Publishing…",
  "publish.run.cancel": "Cancel",
  "publish.run.cancelling": "Cancelling…",
  "publish.progress.images": "Preparing image {done} of {total}",
  "publish.progress.pages": "Building page {done} of {total}",
  "publish.progress.styles": "Building the styles",
  "publish.progress.fonts": "Adding the fonts",
  "publish.progress.preparing": "Comparing with what's on your host",
  "publish.progress.uploading": "Sending file {done} of {total}",
  "publish.progress.verifying": "Checking your site is live",
  // Republishing a saved version from Version History (4.6b): the destinations, to choose where.
  "publish.republish.title": "Republish “{name}”",
  "publish.republish.description":
    "Choose where to publish this version. The site you're editing stays as it is.",
  "publish.republish.button": "Republish",
  "publish.republish.button.label": "Republish to {name}",
  "publish.republish.mustFix.one":
    "This version has 1 thing to fix before it's published. Restore it, fix it in Site Check, then publish.",
  "publish.republish.mustFix.other":
    "This version has {count} things to fix before it's published. Restore it, fix them in Site Check, then publish.",
  // Your site is live: where, what the live check found, and Open and Copy Link.
  "publish.live.title": "Your site is live",
  "publish.live.at": "Visitors can see it at {url}.",
  "publish.live.noAddress":
    "It's on your host now. Edit the destination to add its web address, so {appName} can check it and link to it.",
  "publish.live.check.different":
    "That address shows another page for now. Your host may take a few minutes, or the address may point somewhere else.",
  "publish.live.check.unreachable":
    "That address couldn't be reached to check it. A new site can take a few minutes to appear.",
  "publish.live.summary": "Sent: {uploaded} · Unchanged: {unchanged} · Removed: {removed}",
  // A republish Netlify answered by putting the version's earlier publish back (#70).
  "publish.live.restored":
    "Netlify put back this version as it was published before, so nothing needed sending.",
  "publish.live.versionNotSaved": "This publish couldn't be kept in Version History.",
  "publish.live.open": "Open Site",
  "publish.live.copy": "Copy Link",
  "publish.live.copied": "Link copied",
  "publish.live.openFailed": "Your site couldn't be opened in your browser.",
  "publish.live.done": "Done",
  // A folder another site was published to with {appName} (A8): replace it only when asked.
  "publish.replace.title": "Replace the site in this folder?",
  "publish.replace.body":
    "The folder on {name} has another site that {appName} published. Publishing this one replaces it.",
  "publish.replace.cancel": "Cancel",
  "publish.replace.confirm": "Replace It",
  // Why a publish didn't happen, and what to do; nothing on the host changed unless it says so.
  "publish.failed.signInNeeded":
    "Type the password again: edit the destination to save it on this computer.",
  "publish.failed.unauthorized":
    "Your host refused the user name or password. Edit the destination to check them.",
  "publish.failed.not-found":
    "Your host has no folder of that name. Edit the destination to check the folder.",
  "publish.failed.rate-limited": "Your host asked to wait. Publish again in a few minutes.",
  "publish.failed.rejected":
    "Your host refused the files. Check the folder, and that your account can change it.",
  "publish.failed.network":
    "Your host couldn't be reached. Check your internet connection and publish again.",
  "publish.failed.timeout":
    "Your host didn't answer in time. Check your internet connection and publish again.",
  "publish.failed.untrusted-host":
    "This computer doesn't trust your host's security certificate, so nothing was sent.",
  "publish.failed.no-encryption":
    "Your host doesn't offer FTPS. Edit the destination to choose SFTP, or plain FTP.",
  "publish.failed.bad-key":
    "The private key couldn't be opened. Edit the destination to choose it again.",
  "publish.failed.other-site": "This folder has another site that {appName} published.",
  "publish.failed.failed": "Publishing didn't finish. Publish again to send the rest.",
  "publish.failed.build-failed": "Your site could not be built. Nothing was sent.",
  "publish.failed.reserved-name":
    "The page “{page}” can't be published: Windows keeps its name, or its folder's, for itself. Rename it in the Pages panel and publish again.",
  "publish.failed.unreadable-image":
    "The image “{image}” can't be published: it's larger than 50 megapixels, or its file is damaged. Replace it in Media and publish again.",
  "publish.failed.no-site": "No site is open.",
  "publish.failed.stale-session":
    "Another site has opened in this window. Open this site again to publish it.",
  "publish.failed.no-destination": "That destination has been removed. Choose another.",
  "publish.failed.no-version":
    "That version is no longer in this site, so it can't be republished.",
  "publish.failed.unreadable-version":
    "{appName} can't read that version, so it can't be republished.",
  "publish.failed.unknown": "Publishing didn't work. Publish again.",
} as const;
