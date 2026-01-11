<template>
  <div class="help-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Help" :icon="HelpCircle" activeKey="help">
      <nav class="lsb-nav">
        <div class="lsb-section">
          <span class="lsb-label">Resources</span>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'discover' }"
            @click="setView('discover')"
          >
            <Sparkles :size="18" />
            <span>Discover Lumen</span>
          </button>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'domains' }"
            @click="setView('domains')"
          >
            <Link2 :size="18" />
            <span>Domains & Drive</span>
          </button>
        </div>

        <div class="lsb-section">
          <span class="lsb-label">Support</span>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'contact' }"
            @click="setView('contact')"
          >
            <MessageCircle :size="18" />
            <span>Support</span>
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
        <div class="discover">
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
          <section class="quick-actions">
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
                <div class="action-icon wallet">
                  <Wallet :size="24" />
                </div>
                <div class="action-info">
                  <span class="action-title">Wallet</span>
                  <span class="action-desc">Manage your LMN tokens</span>
                </div>
                <ArrowRight :size="16" class="action-arrow" />
              </button>
              <button class="action-card" type="button" @click="goto('lumen://search')">
                <div class="action-icon search">
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
          <section class="how-it-works">
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
          <section class="features-section">
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
        <div class="discover">
          <!-- Hero -->
          <section class="hero-section small">
            <div class="hero-content">
              <h2 class="hero-title">Publish Your <span class="gradient-text">Website</span></h2>
              <p class="hero-subtitle">Create a domain and link it to your Drive content in 4 easy steps</p>
            </div>
          </section>

          <!-- Steps -->
          <div class="tutorial-steps">
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

      <!-- Contact View -->
      <div v-else-if="currentView === 'contact'" class="content-area">
        <div class="discover">
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

            <button class="contact-card" type="button" @click="openInNewTabSafe('https://lumen.network')">
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
  Link2
} from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';

type HelpView = 'discover' | 'domains' | 'contact';

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
  if (firstPath === 'contact') return 'contact';
  // Backward-compat: old tabs now redirect to Discover.
  if (firstPath === 'docs') return 'discover';
  if (firstPath === 'getting-started' || firstPath === 'faq') return 'discover';

  // Optional query param `view=` (kept for backward-compat)
  try {
    const qs = s.includes('?') ? s.split('?', 2)[1] : '';
    const params = new URLSearchParams(qs || '');
    const viewParam = String(params.get('view') || '').trim().toLowerCase();
    if (viewParam === 'discover') return 'discover';
    if (viewParam === 'domains' || viewParam === 'domain') return 'domains';
    if (viewParam === 'contact') return 'contact';
    if (viewParam === 'docs') return 'discover';
    if (viewParam === 'getting-started' || viewParam === 'faq') return 'discover';
  } catch {}

  return 'discover';
}

function urlForView(view: HelpView): string {
  if (view === 'discover') return 'lumen://help/discover';
  if (view === 'domains') return 'lumen://help/domains';
  if (view === 'contact') return 'lumen://help/contact';
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
    contact: 'Contact Support',
  };
  return titles[currentView.value] || 'Help';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    discover: 'A quick overview of the Lumen stack',
    domains: 'Create a domain and link it to Drive content',
    contact: 'Reach out to our team',
  };
  return descs[currentView.value] || '';
}
</script>

<style scoped>
.discover {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.discover-hero {
  padding: 1.25rem 1.25rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: linear-gradient(135deg, var(--primary-a12) 0%, var(--card-bg) 60%);
  box-shadow: var(--shadow-sm);
}

.discover-hero h3 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.discover-hero p {
  margin: 0.55rem 0 0;
  color: var(--text-secondary);
  line-height: 1.35;
}

.discover-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
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

.mono-inline {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 0.85em;
  padding: 0.1rem 0.35rem;
  border-radius: 0.4rem;
  background: var(--fill-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
}

.discover-flow {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr auto 1fr;
  align-items: center;
  gap: 0.55rem;
}

.discover-section {
  padding: 1.1rem 1.1rem;
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
}

.discover-section-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 850;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.discover-section-text {
  margin: 0.45rem 0 0.85rem;
  color: var(--text-secondary);
  line-height: 1.4;
  font-size: 0.92rem;
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

.diagram {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto 1fr;
  align-items: stretch;
  gap: 0.6rem;
}

.diagram-node {
  border-radius: 16px;
  border: 1px solid var(--border-color);
  background: var(--fill-tertiary);
  padding: 0.85rem 0.9rem;
  min-width: 0;
}

.diagram-node.diagram-accent {
  background: linear-gradient(135deg, rgba(var(--ios-blue-rgb), 0.14), var(--fill-tertiary));
  border-color: rgba(var(--ios-blue-rgb), 0.22);
}

.diagram-node.diagram-wide {
  background: linear-gradient(135deg, rgba(var(--ios-green-rgb), 0.12), var(--fill-tertiary));
  border-color: rgba(var(--ios-green-rgb), 0.20);
}

.diagram-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  padding: 0.18rem 0.5rem;
  border-radius: 999px;
  margin-bottom: 0.5rem;
}

.diagram-title {
  font-weight: 850;
  color: var(--text-primary);
  margin-bottom: 0.2rem;
}

.diagram-desc {
  color: var(--text-secondary);
  font-size: 0.88rem;
  line-height: 1.3;
  word-break: break-word;
}

.diagram-arrow {
  color: var(--text-tertiary);
  align-self: center;
}

.flow-node {
  border-radius: var(--border-radius-lg);
  border: var(--border-width) solid var(--border-color);
  background: var(--card-bg);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
  min-width: 0;
}

.flow-top {
  font-weight: 800;
  font-size: 0.8rem;
  padding: 0.45rem 0.65rem;
  background: var(--fill-blue);
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.flow-body {
  padding: 0.7rem 0.75rem 0.8rem;
}

.flow-title {
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 0.15rem;
}

.flow-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  line-height: 1.25;
}

.flow-arrow {
  color: var(--text-tertiary);
  flex: 0 0 auto;
}

.discover-cta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.cta-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  background: var(--fill-tertiary);
  color: var(--text-primary);
  padding: 0.7rem 0.9rem;
  font-weight: 750;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}

.cta-btn:hover {
  background: var(--hover-bg);
}

.cta-btn:active {
  transform: scale(0.99);
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
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.6) transparent;
}

.content-area::-webkit-scrollbar {
  width: 6px;
}

.content-area::-webkit-scrollbar-track {
  background: transparent;
}

.content-area::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.45);
  border-radius: 999px;
}

.content-area::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.65);
}

.help-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem 0;
}

.help-section p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem 0;
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.step {
  display: flex;
  gap: 1rem;
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

.contact-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.contact-section > p {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 1.5rem 0;
}

.contact-methods {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.contact-item {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
}

.contact-link {
  width: 100%;
  text-align: left;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.15s ease;
}

.contact-link:hover {
  background: var(--hover-bg);
}

.contact-link:active {
  transform: translateY(1px);
}

.contact-item strong {
  display: block;
  font-size: 0.9rem;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.contact-item p {
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

  .discover-grid {
    grid-template-columns: 1fr;
  }

  .discover-flow {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .diagram {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .flow-arrow {
    transform: rotate(90deg);
    justify-self: center;
  }

  .diagram-arrow {
    transform: rotate(90deg);
    justify-self: center;
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
.quick-actions,
.how-it-works,
.features-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

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
  background: var(--fill-purple);
  color: var(--ios-purple);
}

.action-icon.wallet {
  background: var(--fill-green);
  color: var(--ios-green);
}

.action-icon.search {
  background: var(--fill-orange);
  color: var(--ios-orange);
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

/* Tutorial Steps */
.tutorial-steps {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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
  background: var(--fill-purple);
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
