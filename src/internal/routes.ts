import HomePage from './pages/HomePage.vue';
import SearchPage from './pages/SearchPage.vue';
import SettingsPage from './pages/SettingsPage.vue';
import DrivePage from './pages/DrivePage.vue';
import IpfsPage from './pages/IpfsPage.vue';
import SitePage from './pages/SitePage.vue';
import GatewaysPage from './pages/GatewaysPage.vue';
import HelpPage from './pages/HelpPage.vue';
import NetworkPage from './pages/NetworkPage.vue';
import ExplorerPage from './pages/ExplorerPage.vue';
import BlockDetailPage from './pages/BlockDetailPage.vue';
import DaoPage from './pages/DaoPage.vue';
import ReleasePage from './pages/ReleasePage.vue';
import WalletPage from './pages/WalletPage.vue';
import DomainPage from './pages/DomainPage.vue';
import NewTabPage from './pages/NewTabPage.vue';

type InternalRoute = {
  component: any;
  title: string;
};

const INTERNAL_ROUTES: Record<string, InternalRoute> = {
  newtab: { component: HomePage, title: 'Home' },
  home: { component: HomePage, title: 'Home' },
  search: { component: SearchPage, title: 'Search' },
  settings: { component: SettingsPage, title: 'Settings' },
  drive: { component: DrivePage, title: 'Drive' },
  ipfs: { component: IpfsPage, title: 'IPFS' },
  wallet: { component: WalletPage, title: 'Wallet' },
  domain: { component: DomainPage, title: 'Domain' },
  network: { component: NetworkPage, title: 'Network' },
  gateways: { component: GatewaysPage, title: 'Gateways' },
  explorer: { component: ExplorerPage, title: 'Explorer' },
  block: { component: BlockDetailPage, title: 'Block Details' },
  dao: { component: DaoPage, title: 'DAO' },
  release: { component: ReleasePage, title: 'Release' },
  help: { component: HelpPage, title: 'Help' }
};

function isLikelyDomainHost(host: string): boolean {
  const h = String(host || '').trim().toLowerCase();
  if (!h) return false;
  if (INTERNAL_ROUTES[h]) return false;
  if (h === 'ipfs') return false;
  // keep it simple: anything with a dot behaves like a domain
  return h.includes('.');
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

export function resolveInternalComponent(rawUrl: string) {
  const key = parseInternalKey(rawUrl);
  const route = INTERNAL_ROUTES[key];
  if (route) return route.component;
  if (isLikelyDomainHost(key)) return SitePage;
  return INTERNAL_ROUTES.search.component;
}

export function getInternalTitle(rawUrl: string): string {
  const key = parseInternalKey(rawUrl);
  const route = INTERNAL_ROUTES[key];
  if (route) return route.title;
  if (isLikelyDomainHost(key)) return key;
  return INTERNAL_ROUTES.search.title;
}
