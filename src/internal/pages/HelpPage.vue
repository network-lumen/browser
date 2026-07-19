<template>
  <div class="help-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Help" :icon="HelpCircle" activeKey="help">
      <nav class="lsb-nav flex flex-column gap-75">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase">Resources</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left"
            :class="{ active: currentView === 'discover' }"
            @click="setView('discover')"
          >
            <Sparkles :size="18" />
            <span>Discover Lumen</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left"
            :class="{ active: currentView === 'domains' }"
            @click="setView('domains')"
          >
            <Link2 :size="18" />
            <span>Domains & Drive</span>
          </button>
        </div>

        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label fs-11px txt-weight-light color-text-tertiary text-uppercase">Support</span>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left"
            :class="{ active: currentView === 'publish' }"
            @click="setView('publish')"
          >
            <Rocket :size="18" />
            <span>Publish my site</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left"
            :class="{ active: currentView === 'contact' }"
            @click="setView('contact')"
          >
            <MessageCircle :size="18" />
            <span>Support</span>
          </button>
          <button
            type="button"
            class="lsb-item border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-62 border-radius-sm w-full fs-13px fw-500 text-left"
            :class="{ active: currentView === 'docs' }"
            @click="setView('docs')"
          >
            <BookOpen :size="18"/>
            <span>Documentation</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>
      </header>

      <!-- Discover View -->
      <div v-if="currentView === 'discover'" class="content-area">
        <div class="discover flex flex-column gap-125">
          <!-- Hero Section -->
          <section class="hero-section">
            <div class="hero-content">
              <h2 class="hero-title">Welcome to <span class="gradient-text">Lumen</span></h2>
              <p class="hero-subtitle">The decentralized web browser for the next generation of internet</p>
            </div>
            <div class="hero-features">
              <div class="feature-point">
                <div class="point-icon">🌐</div>
                <div class="point-text">
                  <strong>Decentralized Storage</strong>
                  <span>Store and share content without central servers</span>
                </div>
              </div>
              <div class="feature-point">
                <div class="point-icon">🔐</div>
                <div class="point-text">
                  <strong>Blockchain Domains</strong>
                  <span>Own your identity with .lmn domains</span>
                </div>
              </div>
              <div class="feature-point">
                <div class="point-icon">⚡</div>
                <div class="point-text">
                  <strong>Secure by Design</strong>
                  <span>Encrypted connections and local-first data</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Quick Actions -->
          <section class="quick-actions flex flex-column gap-100">
            <h3 class="section-title">Get Started</h3>
            <div class="actions-grid">
              <button class="action-card" type="button" @click="goto('lumen://drive')">
                <div class="action-icon drive">
                  <FolderOpen :size="24" />
                </div>
                <div class="action-info">
                  <span class="action-title">Drive</span>
                  <span class="action-desc">Upload and manage your files</span>
                </div>
                <ArrowRight :size="16" class="action-arrow" />
              </button>
              <button class="action-card" type="button" @click="goto('lumen://domain')">
                <div class="action-icon domain">
                  <Link2 :size="24" />
                </div>
                <div class="action-info">
                  <span class="action-title">Domains</span>
                  <span class="action-desc">Register your .lmn domain</span>
                </div>
                <ArrowRight :size="16" class="action-arrow" />
              </button>
              <button class="action-card" type="button" @click="goto('lumen://wallet')">
                <div class="action-icon wallet badge-success color-success">
                  <Wallet :size="24" />
                </div>
                <div class="action-info">
                  <span class="action-title">Wallet</span>
                  <span class="action-desc">Manage your LMN tokens</span>
                </div>
                <ArrowRight :size="16" class="action-arrow" />
              </button>
              <button class="action-card" type="button" @click="goto('lumen://search')">
                <div class="action-icon search badge-warning color-warning">
                  <Search :size="24" />
                </div>
                <div class="action-info">
                  <span class="action-title">Search</span>
                  <span class="action-desc">Discover decentralized content</span>
                </div>
                <ArrowRight :size="16" class="action-arrow" />
              </button>
            </div>
          </section>

          <!-- How it Works -->
          <section class="how-it-works flex flex-column gap-100">
            <h3 class="section-title">How Lumen Works</h3>
            <div class="steps-grid">
              <div class="step-card">
                <div class="step-number">1</div>
                <div class="step-content">
                  <h4>Blockchain Names</h4>
                  <p>Domain names are stored on the blockchain - no central authority can take them away.</p>
                </div>
              </div>
              <div class="step-card">
                <div class="step-number">2</div>
                <div class="step-content">
                  <h4>Distributed Storage</h4>
                  <p>Content is stored across multiple nodes, ensuring availability even if some go offline.</p>
                </div>
              </div>
              <div class="step-card">
                <div class="step-number">3</div>
                <div class="step-content">
                  <h4>Verified Access</h4>
                  <p>Every piece of content is cryptographically verified for authenticity.</p>
                </div>
              </div>
            </div>
          </section>

          <!-- Features Grid -->
          <section class="features-section flex flex-column gap-100">
            <h3 class="section-title">Key Features</h3>
            <div class="features-grid">
              <div class="feature-card">
                <div class="feature-icon">
                  <Globe :size="24" />
                </div>
                <div class="feature-content">
                  <h4>Human-Readable Links</h4>
                  <p>Type <code>demo.lmn</code> instead of long cryptographic hashes.</p>
                </div>
              </div>
              <div class="feature-card">
                <div class="feature-icon">
                  <Database :size="24" />
                </div>
                <div class="feature-content">
                  <h4>Content Everywhere</h4>
                  <p>Your website exists in many places, so it stays available.</p>
                </div>
              </div>
              <div class="feature-card">
                <div class="feature-icon">
                  <Server :size="24" />
                </div>
                <div class="feature-content">
                  <h4>Pro Cloud Service</h4>
                  <p>Optional premium service for faster loading and reliability.</p>
                </div>
              </div>
              <div class="feature-card">
                <div class="feature-icon">
                  <Wallet :size="24" />
                </div>
                <div class="feature-content">
                  <h4>Your Identity</h4>
                  <p>Your wallet proves what you own and enables transactions.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      <!-- Domains & Drive View -->
      <div v-else-if="currentView === 'domains'" class="content-area">
        <div class="discover flex flex-column gap-125">
          <!-- Hero -->
          <section class="hero-section small">
            <div class="hero-content">
              <h2 class="hero-title">Publish Your <span class="gradient-text">Website</span></h2>
              <p class="hero-subtitle">Create a domain and link it to your Drive content in 4 easy steps</p>
            </div>
          </section>

          <!-- Steps -->
          <div class="tutorial-steps flex flex-column gap-100">
            <div class="tutorial-step">
              <div class="step-header">
                <div class="step-number">1</div>
                <h4>Upload to Drive</h4>
              </div>
              <p>Go to Drive, upload a file or folder, then click <strong>Share</strong> to get a Lumen link.</p>
              <button class="step-action" type="button" @click="goto('lumen://drive')">
                <FolderOpen :size="18" />
                <span>Open Drive</span>
              </button>
            </div>

            <div class="tutorial-step">
              <div class="step-header">
                <div class="step-number">2</div>
                <h4>Buy Your Domain</h4>
              </div>
              <p>Go to Domains, click <strong>Buy domain</strong>, choose a name like <code>yourname.lmn</code>.</p>
              <button class="step-action" type="button" @click="goto('lumen://domain')">
                <Link2 :size="18" />
                <span>Open Domains</span>
              </button>
            </div>

            <div class="tutorial-step">
              <div class="step-header">
                <div class="step-number">3</div>
                <h4>Link Domain to Content</h4>
              </div>
              <p>In Domain settings, add a record with <code>Key: cid</code> and <code>Value: your-content-hash</code>.</p>
            </div>

            <div class="tutorial-step">
              <div class="step-header">
                <div class="step-number">4</div>
                <h4>Visit Your Site</h4>
              </div>
              <p>Type <code>lumen://yourname.lmn</code> in the address bar to access your decentralized website!</p>
              <button class="step-action" type="button" @click="goto('lumen://newtab')">
                <Globe :size="18" />
                <span>Open New Tab</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Publish My Site View -->
      <div v-else-if="currentView === 'publish'" class="content-area">
        <div class="discover flex flex-column gap-125">
          <!-- Hero -->
          <section class="hero-section small">
            <div class="hero-content">
              <h2 class="hero-title">Create Your <span class="gradient-text">First Website</span></h2>
              <p class="hero-subtitle">Publish a site on the decentralized web in four simple steps — no server required.</p>
            </div>
          </section>

          <!-- Steps -->
          <div class="tutorial-steps flex flex-column gap-100">
            <div class="tutorial-step">
              <div class="step-header">
                <div class="step-number">1</div>
                <h4>Build Your Website</h4>
              </div>
              <p>Create it like you normally would — plain HTML/CSS/JS, or the export of any static site builder. All you need is a folder with an <code>index.html</code> at its root.</p>
            </div>

            <div class="tutorial-step">
              <div class="step-header">
                <div class="step-number">2</div>
                <h4>Upload It to Drive</h4>
              </div>
              <p>Open Drive, upload that folder, then copy its Lumen link — that's your content's address.</p>
              <button class="step-action" type="button" @click="goto('lumen://drive')">
                <FolderOpen :size="18" />
                <span>Open Drive</span>
              </button>
            </div>

            <div class="tutorial-step">
              <div class="step-header">
                <div class="step-number">3</div>
                <h4>Get a Domain</h4>
              </div>
              <p>Open Domains and register a name for your site, like <code>yourname.lmn</code>, if you don't have one yet.</p>
              <button class="step-action" type="button" @click="goto('lumen://domain')">
                <Link2 :size="18" />
                <span>Open Domains</span>
              </button>
            </div>

            <div class="tutorial-step">
              <div class="step-header">
                <div class="step-number">4</div>
                <h4>Link Your Domain to Your Content</h4>
              </div>
              <p>Edit your domain, then add a new record: set <strong>Key</strong> to <code>cid</code> and <strong>Value</strong> to the link you copied in step 2. Save.</p>
            </div>
          </div>

          <div class="discover-note">
            <strong>That's it — you're live.</strong> Visit <code>lumen://yourname.lmn</code> to see your site.
            If it still shows as unavailable, double-check that <code>index.html</code> sits at the root of the
            uploaded folder, and give it a minute to propagate.
          </div>
        </div>
      </div>

      <!-- Contact View -->
      <div v-else-if="currentView === 'contact'" class="content-area">
        <div class="discover flex flex-column gap-125">
          <!-- Hero -->
          <section class="hero-section small">
            <div class="hero-content">
              <h2 class="hero-title">Get <span class="gradient-text">Help</span></h2>
              <p class="hero-subtitle">Connect with our community and get support</p>
            </div>
          </section>

          <!-- Contact Cards -->
          <div class="contact-grid">
            <button class="contact-card" type="button" @click="openInNewTabSafe('https://discord.gg/DwK6V9shKc')">
              <div class="contact-icon discord">
                <MessageCircle :size="28" />
              </div>
              <div class="contact-info">
                <h4>Discord Community</h4>
                <p>Join our active community, ask questions, and get help from other users.</p>
              </div>
              <ArrowRight :size="18" class="contact-arrow" />
            </button>

            <button class="contact-card" type="button" @click="openInNewTabSafe('https://github.com/network-lumen/')">
              <div class="contact-icon github">
                <Github :size="28" />
              </div>
              <div class="contact-info">
                <h4>GitHub</h4>
                <p>Report bugs, contribute to the codebase, or explore our open-source projects.</p>
              </div>
              <ArrowRight :size="18" class="contact-arrow" />
            </button>

            <button class="contact-card" type="button" @click="openInNewTabSafe('lumen://lumen.lmn')">
              <div class="contact-icon website">
                <Globe :size="28" />
              </div>
              <div class="contact-info">
                <h4>Official Website</h4>
                <p>Visit our website for documentation, news, and updates.</p>
              </div>
              <ArrowRight :size="18" class="contact-arrow" />
            </button>
          </div>
        </div>
      </div>
      
      <!-- Docs View -->
      <div v-else-if="currentView === 'docs'" class="content-area docs-content-area">
        <div class="discover docs-discover flex flex-column gap-125">
          <iframe
            class="lumen-doc-frame"
            :src="lumenDocFrameSrc"
            title="window.lumen API Reference"
            loading="lazy"
          ></iframe>

          <!-- Documentation Grid -->
          <div class="docs-grid" v-if="false" aria-hidden="true">
            <!-- What is Lumen Browser -->
            <div class="discover-card">
              <div class="discover-ico">
                <BookOpen :size="20" />
              </div>
              <div>
                <h4>What is Lumen Browser?</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                  nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                  nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                  nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
              </div>
            </div>

            <!-- Secure your Wallet -->
            <div class="discover-card">
              <div class="discover-ico">
                <Wallet :size="20" />
              </div>
              <div>
                <h4>Secure your Wallet</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in
                  reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                  Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
              </div>
            </div>

            <!-- Upload -->
            <div class="discover-card">
              <div class="discover-ico">
                <FolderOpen :size="20" />
              </div>
              <div>
                <h4>Upload</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vel sem nec arcu
                  tincidunt tristique. Mauris posuere, nisl non hendrerit varius, risus neque blandit
                  massa, vitae fermentum velit quam a odio.
                </p>
              </div>
            </div>

            <!-- Cloud -->
            <div class="discover-card">
              <div class="discover-ico">
                <Database :size="20" />
              </div>
              <div>
                <h4>Cloud</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed viverra, arcu in tincidunt
                  gravida, metus ante accumsan justo, sit amet consequat libero dolor sed ligula.
                  Praesent faucibus, elit vitae fermentum viverra, odio tellus laoreet purus.
                </p>
              </div>
            </div>

            <!-- How to Manage Domain -->
            <div class="discover-card">
              <div class="discover-ico">
                <Link2 :size="20" />
              </div>
              <div>
                <h4>How to Manage Domain</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Neque porro quisquam est,
                  qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit. Quis autem vel eum iure
                  reprehenderit qui in ea voluptate velit esse.
                </p>
              </div>
            </div>

            <!-- Domain Setting -->
            <div class="discover-card">
              <div class="discover-ico">
                <Globe :size="20" />
              </div>
              <div>
                <h4>Domain Setting</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras id tortor vitae justo
                  vulputate aliquet. Nulla facilisi. Vestibulum ante ipsum primis in faucibus orci luctus
                  et ultrices posuere cubilia curae.
                </p>
              </div>
            </div>

            <!-- How to Linked Domain -->
            <div class="discover-card">
              <div class="discover-ico">
                <Link2 :size="20" />
              </div>
              <div>
                <h4>How to Linked Domain</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minima veniam,
                  quis nostrum exercitationem ullam corporis suscipit laboriosam. Nisi ut aliquid ex ea commodi
                  consequatur.
                </p>
              </div>
            </div>

            <!-- Publish Website with .lmn -->
            <div class="discover-card">
              <div class="discover-ico">
                <Server :size="20" />
              </div>
              <div>
                <h4>Publish Website with .lmn</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus ultricies, est vitae
                  fermentum malesuada, elit sapien ullamcorper justo, at ultricies mi tortor vitae ex.
                  Integer vitae lectus sed magna ultricies cursus.
                </p>
              </div>
            </div>

            <!-- Theme -->
            <div class="discover-card">
              <div class="discover-ico">
                <Sparkles :size="20" />
              </div>
              <div>
                <h4>Theme</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed consequat elit nec neque
                  gravida, a vestibulum est feugiat. Maecenas tincidunt nisl in enim tincidunt, sit amet
                  convallis libero viverra.
                </p>
              </div>
            </div>

            <!-- Font Size -->
            <div class="discover-card">
              <div class="discover-ico">
                <Sparkles :size="20" />
              </div>
              <div>
                <h4>Font Size</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean sit amet lectus et
                  metus dapibus fermentum. Integer dictum mi at orci pellentesque, eget consequat nibh
                  auctor.
                </p>
              </div>
            </div>

            <!-- Brightness -->
            <div class="discover-card">
              <div class="discover-ico">
                <Sparkles :size="20" />
              </div>
              <div>
                <h4>Brightness</h4>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce lacinia volutpat eros,
                  ac laoreet purus euismod vitae. Etiam in sem nec turpis iaculis pellentesque.
                  Quisque feugiat tellus at malesuada suscipit.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>  
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, ref, watch } from 'vue';
import type { ComputedRef } from 'vue';
import { 
  HelpCircle,
  Sparkles,
  MessageCircle,
  Github,
  Globe,
  Database,
  Server,
  Wallet,
  ArrowRight,
  Search,
  FolderOpen,
  Link2,
  BookOpen,
  Rocket
} from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';

type HelpView = 'discover' | 'domains' | 'publish' | 'contact' | 'docs';

// Single source of truth for the window.lumen reference: this embeds the
// actual generated docs/window-lumen.html (mirrored into public/docs/ by
// `npm run doc:window.lumen`) in an <iframe>, instead of re-deriving a
// second Vue-native render of the same data — one renderer, not two.
function resolveLumenDocFrameSrc(): string {
  try {
    const baseEl = document.querySelector<HTMLBaseElement>('base[href]');
    if (baseEl?.href) {
      return new URL('./docs/window-lumen.html', baseEl.href).href;
    }
  } catch {
    // ignore
  }
  try {
    return new URL('./docs/window-lumen.html', window.location.href).href;
  } catch {
    return './docs/window-lumen.html';
  }
}

const lumenDocFrameSrc = computed(() => resolveLumenDocFrameSrc());

const currentTabUrl = inject<ComputedRef<string>>(
  'currentTabUrl',
  computed(() => 'lumen://help'),
);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>(
  'navigate',
  null,
);
const openInNewTab = inject<((url: string) => void) | null>('openInNewTab', null);

const currentView = ref<HelpView>('discover');

function normalizeViewFromUrl(rawUrl: string): HelpView {
  const s = String(rawUrl || '').trim();
  if (!s) return 'discover';

  // Avoid URL() edge cases with custom schemes by doing minimal parsing ourselves.
  if (!/^lumen:\/\//i.test(s)) return 'discover';
  const withoutScheme = s.slice('lumen://'.length);
  const beforeQuery = withoutScheme.split(/[?#]/, 1)[0] || '';
  const segs = beforeQuery.split('/').filter(Boolean);
  const host = String(segs[0] || '').toLowerCase();
  if (host !== 'help') return 'discover';

  const firstPath = String(segs[1] || '').toLowerCase();
  if (firstPath === 'discover') return 'discover';
  if (firstPath === 'domains' || firstPath === 'domain') return 'domains';
  if (firstPath === 'publish' || firstPath === 'create_my_first_website' || firstPath === 'create-my-first-website') return 'publish';
  if (firstPath === 'contact') return 'contact';
  // Backward-compat: old tabs now redirect to Discover.
  if (firstPath === 'docs') return 'docs';
  if (firstPath === 'getting-started' || firstPath === 'faq') return 'discover';

  // Optional query param `view=` (kept for backward-compat)
  try {
    const qs = s.includes('?') ? s.split('?', 2)[1] : '';
    const params = new URLSearchParams(qs || '');
    const viewParam = String(params.get('view') || '').trim().toLowerCase();
    if (viewParam === 'discover') return 'discover';
    if (viewParam === 'domains' || viewParam === 'domain') return 'domains';
    if (viewParam === 'publish') return 'publish';
    if (viewParam === 'contact') return 'contact';
    if (viewParam === 'docs') return 'docs';
    if (viewParam === 'getting-started' || viewParam === 'faq') return 'discover';
  } catch {}

  return 'discover';
}

function urlForView(view: HelpView): string {
  if (view === 'discover') return 'lumen://help/discover';
  if (view === 'domains') return 'lumen://help/domains';
  if (view === 'publish') return 'lumen://help/publish';
  if (view === 'contact') return 'lumen://help/contact';
  if (view === 'docs') return 'lumen://help/docs';
  return 'lumen://help';
}

function setView(view: HelpView) {
  currentView.value = view;
  const target = urlForView(view);
  const current = String(currentTabUrl?.value || '').trim();
  if (navigate && current && current !== target) {
    navigate(target, { push: false });
  }
}

function goto(url: string) {
  if (!navigate) return;
  navigate(url, { push: true });
}

function openInNewTabSafe(url: string) {
  if (openInNewTab) {
    openInNewTab(url);
    return;
  }
  goto(url);
}

watch(
  () => currentTabUrl?.value,
  (u) => {
    const v = normalizeViewFromUrl(u || '');
    if (v !== currentView.value) currentView.value = v;
  },
  { immediate: true },
);

function getViewTitle(): string {
  const titles: Record<string, string> = {
    discover: 'What is Lumen?',
    domains: 'Domains & Drive',
    publish: 'Publish My Site',
    contact: 'Contact Support',
    docs: 'Documentation',
  };
  return titles[currentView.value] || 'Help';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    discover: 'A quick overview of the Lumen stack',
    domains: 'Create a domain and link it to Drive content',
    publish: 'Go from local files to a live .lmn site',
    contact: 'Reach out to our team',
    docs: 'Website developer docs for window.lumen'
  };
  return descs[currentView.value] || '';
}
</script>

<style scoped>
.docs-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.9rem;
}

/* Docs view: the iframe scrolls internally (its own sidebar + content), so
   the outer .content-area must not also scroll — one scrollbar, not two. */
.docs-content-area {
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.docs-discover {
  flex: 1;
  min-height: 0;
}

.lumen-doc-frame {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 520px;
  border: var(--border-width) solid var(--border-color);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-sm);
  background: var(--card-bg);
}

.discover-card {
  display: flex;
  gap: 0.85rem;
  padding: 1rem 1rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
}

.discover-ico {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--fill-blue);
  border: 1px solid rgba(var(--ios-blue-rgb), 0.18);
  color: var(--ios-blue);
  flex: 0 0 auto;
}

.discover-card h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--text-primary);
}

.discover-card p {
  margin: 0.25rem 0 0;
  font-size: 0.86rem;
  color: var(--text-secondary);
  line-height: 1.35;
}

.discover-card code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.85em;
  padding: 0.1rem 0.35rem;
  border-radius: 0.4rem;
  background: var(--fill-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.discover-note {
  margin-top: 0.85rem;
  padding: 0.75rem 0.85rem;
  border-radius: 14px;
  background: var(--fill-blue);
  border: 1px solid rgba(var(--ios-blue-rgb), 0.14);
  color: var(--text-primary);
  font-size: 0.9rem;
  line-height: 1.35;
}

/* Main Content */
.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-secondary);
  margin: 0;
  border-radius: 0;
}

.content-header {
  margin-bottom: 1.5rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0.25rem 0 0 0;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 0.25rem;
}

.step-number {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  flex-shrink: 0;
}

.step-content h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.25rem 0;
}

.step-content p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0;
}

@media (max-width: 700px) {
  .help-page {
    flex-direction: column;
  }
  
  .main-content {
    margin: 0 0.5rem 0.5rem 0.5rem;
    padding: 1.5rem;
  }

  .actions-grid {
    grid-template-columns: 1fr;
  }

  .steps-grid {
    grid-template-columns: 1fr;
  }

  .features-grid {
    grid-template-columns: 1fr;
  }

  .contact-grid {
    grid-template-columns: 1fr;
  }

  .hero-features {
    flex-direction: column;
    gap: 0.75rem;
  }
}

/* Hero Section */
.hero-section {
  padding: 2rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: linear-gradient(135deg, var(--primary-a12) 0%, var(--card-bg) 100%);
  box-shadow: var(--shadow-sm);
  text-align: center;
}

.hero-section.small {
  padding: 1.5rem;
}

.hero-content {
  margin-bottom: 1.5rem;
}

.hero-title {
  font-size: 1.75rem;
  font-weight: 800;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.gradient-text {
  background: var(--gradient-primary);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-subtitle {
  margin: 0.5rem 0 0;
  color: var(--text-secondary);
  font-size: 1rem;
  line-height: 1.5;
}

.hero-features {
  display: flex;
  justify-content: center;
  gap: 2rem;
  flex-wrap: wrap;
}

.feature-point {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  text-align: left;
}

.point-icon {
  font-size: 1.5rem;
  line-height: 1;
}

.point-text {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.point-text strong {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.point-text span {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

/* Quick Actions */
.section-title {
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.actions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.action-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.action-card:hover {
  background: var(--hover-bg);
  transform: translateY(-1px);
}

.action-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.action-icon.drive {
  background: var(--fill-blue);
  color: var(--ios-blue);
}

.action-icon.domain {
  background: rgba(var(--ios-purple-rgb), 0.15);
  color: var(--ios-purple);
}


.action-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.action-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
}

.action-desc {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.action-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* Steps Grid */
.steps-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.step-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
}

.step-card .step-number {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--gradient-primary);
  color: white;
  font-weight: 700;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-card .step-content h4 {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.step-card .step-content p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* Features Grid */
.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.feature-card {
  display: flex;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
}

.feature-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--fill-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--ios-blue);
  flex-shrink: 0;
}

.feature-content h4 {
  margin: 0 0 0.25rem 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-primary);
}

.feature-content p {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.tutorial-step {
  padding: 1.25rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.tutorial-step .step-number {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--gradient-primary);
  color: white;
  font-weight: 700;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.step-header h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.tutorial-step p {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.step-action {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: var(--fill-tertiary);
  color: var(--text-primary);
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.15s ease;
}

.step-action:hover {
  background: var(--hover-bg);
}

/* Contact Grid */
.contact-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1rem;
}

.contact-card {
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.25rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: all 0.15s ease;
}

.contact-card:hover {
  background: var(--hover-bg);
  transform: translateY(-1px);
}

.contact-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.contact-icon.discord {
  background: rgba(var(--ios-purple-rgb), 0.15);
  color: var(--ios-purple);
}

.contact-icon.github {
  background: var(--fill-tertiary);
  color: var(--text-primary);
}

.contact-icon.website {
  background: var(--fill-blue);
  color: var(--ios-blue);
}

.contact-info {
  flex: 1;
  min-width: 0;
}

.contact-info h4 {
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.contact-info p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
}

.contact-arrow {
  color: var(--text-tertiary);
  flex-shrink: 0;
}
</style>
