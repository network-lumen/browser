import { t } from '../stores/i18nStore';
import { markForTranslation } from './services/i18n';
import HomePage from './pages/HomePage.vue';
import SearchPage from './pages/SearchPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import DrivePage from './pages/DrivePage.vue';
import IpfsPage from './pages/IpfsPage.vue';
import SitePage from './pages/SitePage.vue';
import WebPage from './pages/WebPage.vue';
import GatewaysPage from './pages/GatewaysPage.vue';
import MyGatewaysPage from './pages/MyGatewaysPage.vue';
import HelpPage from './pages/HelpPage.vue';
import NetworkPage from './pages/NetworkPage.vue';
import BlockDetailPage from './pages/BlockDetailPage.vue';
import ReleasePage from './pages/ReleasePage.vue';
import WalletPage from './pages/WalletPage.vue';
import DomainPage from './pages/DomainPage.vue';
import NewTabPage from './pages/NewTabPage.vue';
import HistoryPage from './pages/HistoryPage.vue';
import TransactionDetailPage from './pages/TransactionDetailPage.vue';
import AddressDetailPage from './pages/AddressDetailPage.vue';
import ExtensionsPage from './pages/ExtensionsPage.vue';
import ExtensionPage from './pages/ExtensionPage.vue';
import { getFileUrlTitle, isBrowserUrl, isFileUrl, parseExtensionTabUrl } from './navigationUrl';
import { truncateMiddle } from './services/format';
import type { InternalRoute } from '../types/routes';

/**
 * The name of every internal page, in one place.
 *
 * `markForTranslation` and not `t()`: this table is built once, when the module
 * is first imported, and `t()` here would freeze whichever language happened to
 * be loaded at that moment - which is English, because the module is pulled in
 * long before a profile's locale is read. Every tab title, every card on the
 * home page and every history entry then stays English for the life of the
 * session. The words are translated at `t(route.title)`, where they are drawn.
 */
const INTERNAL_ROUTES: Record<string, InternalRoute> = {
  newtab: { component: NewTabPage, title: markForTranslation('New tab') },
  history: { component: HistoryPage, title: markForTranslation('History') },
  home: { component: HomePage, title: markForTranslation('Home') },
  search: { component: SearchPage, title: markForTranslation('Search') },
  settings: { component: SettingsPage, title: markForTranslation('Settings') },
  drive: { component: DrivePage, title: markForTranslation('Drive') },
  ipfs: { component: IpfsPage, title: 'IPFS' },
  ipns: { component: IpfsPage, title: 'IPNS' },
  wallet: { component: WalletPage, title: markForTranslation('Wallet') },
  domain: { component: DomainPage, title: markForTranslation('Domain') },
  domains: { component: DomainPage, title: markForTranslation('Domains') },
  extensions: { component: ExtensionsPage, title: markForTranslation('Extensions') },
  extension: { component: ExtensionPage, title: markForTranslation('Extension') },
  network: { component: NetworkPage, title: markForTranslation('Network') },
  gateways: { component: GatewaysPage, title: markForTranslation('Gateways') },
  'my-gateways': { component: MyGatewaysPage, title: markForTranslation('My Gateways') },
  block: { component: BlockDetailPage, title: markForTranslation('Block details') },
  transaction: { component: TransactionDetailPage, title: markForTranslation('Transaction details') },
  tx: { component: TransactionDetailPage, title: markForTranslation('Transaction details') },
  address: { component: AddressDetailPage, title: markForTranslation('Address details') },
  release: { component: ReleasePage, title: markForTranslation('Release') },
  help: { component: HelpPage, title: markForTranslation('Help') }
};

/** The name of an internal page, translated, for anything drawing a route list. */
export function internalRouteTitle(key: string): string {
  const route = INTERNAL_ROUTES[key];
  return route ? t(route.title) : key.charAt(0).toUpperCase() + key.slice(1);
}

function isLikelyDomainHost(host: string): boolean {
  const h = String(host || '').trim().toLowerCase();
  if (!h) return false;
  if (INTERNAL_ROUTES[h]) return false;
  if (h === 'ipfs' || h === 'ipns') return false;
  // keep it simple: anything with a dot behaves like a domain
  return h.includes('.');
}

function shortenHash(hash: string): string {
  return truncateMiddle(hash, { start: 6, end: 6 });
}

function parseInternalKey(rawUrl: string): string {
  const s = String(rawUrl || '').trim();
  if (!s) return 'home';

  // Strip scheme if present
  const withoutScheme = /^lumen:\/\//i.test(s) ? s.slice('lumen://'.length) : s;
  // host is first segment before path/query/fragment
  const host = (withoutScheme.split(/[\/?#]/, 1)[0] || '').toLowerCase();
  return host || 'home';
}

export const INTERNAL_ROUTE_KEYS = Object.keys(INTERNAL_ROUTES);

export const ALL_COMPONENTS = [
  HomePage,
  SearchPage,
  SettingsPage,
  DrivePage,
  WebPage,
  GatewaysPage,
  MyGatewaysPage,
  HelpPage,
  NetworkPage,
  BlockDetailPage,
  TransactionDetailPage,
  AddressDetailPage,
  ReleasePage,
  WalletPage,
  DomainPage,
  ExtensionsPage,
  ExtensionPage,
  NewTabPage,
  HistoryPage
];

export function resolveInternalComponent(rawUrl: string) {
  const asString = String(rawUrl || '').trim();
  if (isBrowserUrl(asString)) return WebPage;
  const key = parseInternalKey(rawUrl);
  const route = INTERNAL_ROUTES[key];
  if (route) return route.component;
  if (isLikelyDomainHost(key)) return SitePage;
  return INTERNAL_ROUTES.search.component;
}

export function getInternalTitle(rawUrl: string): string {
  const asString = String(rawUrl || '').trim();
  if (isBrowserUrl(asString)) {
    if (isFileUrl(asString)) return getFileUrlTitle(asString);
    try {
      const u = new URL(asString);
      return (u.hostname || asString).trim();
    } catch {
      return asString || t('New tab');
    }
  }
  const key = parseInternalKey(rawUrl);
  if (key === 'extension') {
    const routeInfo = parseExtensionTabUrl(rawUrl);
    if (routeInfo?.name) return routeInfo.name;
  }
  // Block/tx/address detail views are usually reached as embedded sub-views of
  // NetworkPage (lumen://network/block/<h>, /tx/<hash>, /address/<addr> -
  // host is "network", not "block"/"tx"/"address"), so these must match on
  // the URL's PATH rather than on `key` (the host).
  const blockMatch = asString.match(/\/block\/(\d+)/i);
  if (blockMatch) return t('Block {height}', { height: blockMatch[1] });
  const txMatch = asString.match(/\/(?:transaction|tx)\/([A-F0-9]+)/i);
  if (txMatch) return t('Tx {hash}', { hash: shortenHash(txMatch[1]) });
  const addressMatch = asString.match(/\/address\/([a-z0-9]+)/i);
  if (addressMatch) return t('Address {address}', { address: shortenHash(addressMatch[1]) });
  const route = INTERNAL_ROUTES[key];
  if (route) return t(route.title);
  if (isLikelyDomainHost(key)) return key;
  return t(INTERNAL_ROUTES.search.title);
}
