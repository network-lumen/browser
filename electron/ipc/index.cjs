const { registerChainIpc } = require('./chain.cjs');
const { registerNetworkIpc } = require('./network.cjs');
const { registerIpfsIpc } = require('./ipfs.cjs');
const { registerIpfsPubsubIpc } = require('./ipfs_pubsub.cjs');
const { registerReleaseIpc } = require('./release.cjs');
const { registerProfilesIpc } = require('./profiles.cjs');
const { registerWalletIpc } = require('./wallet.cjs');
const { registerGatewayIpc } = require('./gateway.cjs');
const { registerGatewayServerIpc } = require('./gateway_server.cjs');
const { registerHandlers: registerAddressBookIpc } = require('./addressbook.cjs');
const { registerSecurityIpc } = require('./security.cjs');
const { registerHlsIpc } = require('./hls.cjs');
const { registerFindIpc } = require('./find.cjs');
const { registerDriveBackupIpc } = require('./drive_backup.cjs');
const { registerTroubleshootingIpc } = require('./troubleshooting.cjs');
const { registerExtensionsIpc } = require('./extensions.cjs');
const { registerHttpIpc } = require('./http.cjs');
const { registerDevtoolsIpc } = require('./devtools.cjs');
const { registerDialogIpc } = require('./dialogs.cjs');
const { registerSettingsIpc } = require('./settings.cjs');
const { registerAppIpc } = require('./app.cjs');
const { registerSiteIpc } = require('../sites/actions.cjs');

/**
 * Every IPC channel the app answers, registered in one call.
 *
 * `main.cjs` used to carry the import and the call for each of these, twenty
 * lines of each, plus a dozen handlers written inline between them - so the
 * file that starts the app was also where you found out that the clipboard has
 * a channel. Adding a module meant editing two lists in two places and hoping
 * nobody added a third.
 *
 * Registration happens at module load, not on `app.whenReady()`: a renderer can
 * call a channel as soon as it exists, and a handler registered later answers
 * "No handler registered" to whatever asked first.
 */
function registerAllIpc() {
  registerAppIpc();
  registerChainIpc();
  registerSiteIpc();
  registerProfilesIpc();
  registerHttpIpc();
  registerNetworkIpc();
  registerIpfsIpc();
  registerIpfsPubsubIpc();
  registerReleaseIpc();
  registerWalletIpc();
  registerGatewayIpc();
  registerGatewayServerIpc();
  registerAddressBookIpc();
  registerSecurityIpc();
  registerHlsIpc();
  registerFindIpc();
  registerDriveBackupIpc();
  registerTroubleshootingIpc();
  registerExtensionsIpc();
  registerDevtoolsIpc();
  registerDialogIpc();
  registerSettingsIpc();
}

module.exports = {
  registerAllIpc,
};
