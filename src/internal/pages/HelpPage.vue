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
            :class="{ active: currentView === 'getting-started' }"
            @click="setView('getting-started')"
          >
            <Compass :size="18" />
            <span>Getting Started</span>
          </button>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'faq' }"
            @click="setView('faq')"
          >
            <MessageCircle :size="18" />
            <span>FAQ</span>
          </button>
          <button
            type="button"
            class="lsb-item"
            :class="{ active: currentView === 'docs' }"
            @click="setView('docs')"
          >
            <Book :size="18" />
            <span>Documentation</span>
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
            <Mail :size="18" />
            <span>Contact</span>
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
          <section class="discover-hero">
            <h3>Lumen, explained simply</h3>
            <p>
              Think of Lumen like “the internet”, but with <strong>no central phonebook</strong> and <strong>no single
              server</strong> that can disappear. Names live on the blockchain, and content is stored in a distributed
              network.
            </p>
          </section>

          <section class="discover-grid">
            <div class="discover-card">
              <div class="discover-ico">
                <Globe :size="20" />
              </div>
              <div>
                <h4>Human links</h4>
                <p>You can type a name like <code>demo.lmn</code> instead of a long code.</p>
              </div>
            </div>

            <div class="discover-card">
              <div class="discover-ico">
                <Database :size="20" />
              </div>
              <div>
                <h4>Content everywhere</h4>
                <p>Your website can be stored in many places, so it stays available.</p>
              </div>
            </div>

            <div class="discover-card">
              <div class="discover-ico">
                <Server :size="20" />
              </div>
              <div>
                <h4>Decentralized cloud</h4>
                <p>Optional “Pro” cloud service for speed, search, and better reliability (SLA).</p>
              </div>
            </div>

            <div class="discover-card">
              <div class="discover-ico">
                <Wallet :size="20" />
              </div>
              <div>
                <h4>Your identity</h4>
                <p>Your profile and wallet prove what you own and what you pay for.</p>
              </div>
            </div>
          </section>

          <section class="discover-section">
            <h4 class="discover-section-title">1) Names stored on the blockchain</h4>
            <p class="discover-section-text">
              On today’s internet, the “address book” for websites is usually run by centralized services. On Lumen, the address
              book is stored on the blockchain: everyone can read it, and no single server owns it.
            </p>

            <div class="diagram">
              <div class="diagram-node">
                <div class="diagram-badge">You</div>
                <div class="diagram-title">Lumen Browser</div>
                <div class="diagram-desc">You type <code>lumen://demo.lmn</code></div>
              </div>
              <ArrowRight class="diagram-arrow" :size="18" />
              <div class="diagram-node diagram-accent">
                <div class="diagram-badge">Shared</div>
                <div class="diagram-title">Blockchain record</div>
                <div class="diagram-desc">Record: <code>demo.lmn → the website</code></div>
              </div>
              <ArrowRight class="diagram-arrow" :size="18" />
              <div class="diagram-node">
                <div class="diagram-badge">Result</div>
                <div class="diagram-title">Verified answer</div>
                <div class="diagram-desc">No central “address book” server</div>
              </div>
            </div>

            <div class="discover-note">
              In simple terms: the “address book” is public, shared, and hard to tamper with.
            </div>
          </section>

          <section class="discover-section">
            <h4 class="discover-section-title">2) Distributed hosting: no single website server</h4>
            <p class="discover-section-text">
              Instead of “one website = one server”, Lumen can load content from a distributed network.
              Think of it like a library: the same “book” can exist in many places, so it doesn’t disappear when one computer goes offline.
            </p>

            <div class="diagram">
              <div class="diagram-node">
                <div class="diagram-badge">Website</div>
                <div class="diagram-title">The content</div>
                <div class="diagram-desc">A page, a file, or a whole site</div>
              </div>
              <ArrowRight class="diagram-arrow" :size="18" />
              <div class="diagram-node diagram-wide">
                <div class="diagram-badge">Many copies</div>
                <div class="diagram-title">Distributed network</div>
                <div class="diagram-desc">Many computers can serve the same content</div>
              </div>
              <ArrowRight class="diagram-arrow" :size="18" />
              <div class="diagram-node">
                <div class="diagram-badge">You</div>
                <div class="diagram-title">You receive it</div>
                <div class="diagram-desc">Even if one host is down</div>
              </div>
            </div>

            <div class="discover-note">
              In simple terms: content can survive even if one computer goes offline.
            </div>
          </section>

          <section class="discover-section">
            <h4 class="discover-section-title">3) Pro cloud: better speed and reliability (SLA)</h4>
            <p class="discover-section-text">
              If you want a smoother experience, you can subscribe to a Pro cloud plan. It’s a professional service that helps with
              speed and reliability. “SLA” simply means: the service makes a clear promise about uptime and quality.
            </p>

            <div class="diagram">
              <div class="diagram-node">
                <div class="diagram-badge">You</div>
                <div class="diagram-title">Browser</div>
                <div class="diagram-desc">Open / search / save</div>
              </div>
              <ArrowRight class="diagram-arrow" :size="18" />
              <div class="diagram-node diagram-accent">
                <div class="diagram-badge">Pro</div>
                <div class="diagram-title">Pro cloud</div>
                <div class="diagram-desc">Fast loading, search, keeps content available</div>
              </div>
              <ArrowRight class="diagram-arrow" :size="18" />
              <div class="diagram-node">
                <div class="diagram-badge">Network</div>
                <div class="diagram-title">Distributed hosting</div>
                <div class="diagram-desc">Content stored in many places</div>
              </div>
            </div>

            <div class="discover-note">
              In simple terms: you can use Lumen without Pro, but Pro makes it feel “premium” and dependable.
            </div>
          </section>

          <section class="discover-cta">
            <button class="cta-btn" type="button" @click="goto('lumen://search')">
              <Search :size="18" />
              <span>Try Search</span>
            </button>
            <button class="cta-btn" type="button" @click="goto('lumen://drive')">
              <FolderOpen :size="18" />
              <span>Open Drive</span>
            </button>
            <button class="cta-btn" type="button" @click="goto('lumen://domain')">
              <Link2 :size="18" />
              <span>Manage Domains</span>
            </button>
          </section>
        </div>
      </div>

      <!-- Getting Started View -->
      <div v-else-if="currentView === 'getting-started'" class="content-area">
        <div class="help-section">
          <h3>Welcome to Lumen Browser</h3>
          <p>Lumen is a decentralized web browser powered by IPFS. Here's how to get started:</p>
          <div class="steps">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>Configure IPFS</h4>
                <p>Ensure your local IPFS node is running</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">2</div>
              <div class="step-content">
                <h4>Explore Files</h4>
                <p>Visit the Drive page to upload and manage your IPFS content</p>
              </div>
            </div>
            <div class="step">
              <div class="step-number">3</div>
              <div class="step-content">
                <h4>Connect Wallet</h4>
                <p>Set up your Web3 wallet to interact with blockchain features</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- FAQ View -->
      <div v-else-if="currentView === 'faq'" class="content-area">
        <div class="faq-list">
          <div class="faq-item">
            <h4>What is IPFS?</h4>
            <p>IPFS (InterPlanetary File System) is a protocol and peer-to-peer network for storing and sharing data in a distributed file system.</p>
          </div>
          <div class="faq-item">
            <h4>How do I upload files?</h4>
            <p>Navigate to the Drive page and click the upload button. Select your files and they will be added to IPFS.</p>
          </div>
          <div class="faq-item">
            <h4>Is my data secure?</h4>
            <p>All content uploaded to IPFS is content-addressed and cryptographically hashed, ensuring integrity and authenticity.</p>
          </div>
          <div class="faq-item">
            <h4>How do I connect a wallet?</h4>
            <p>Visit the Wallet page and click the connect button to link your Web3 wallet to Lumen.</p>
          </div>
        </div>
      </div>

      <!-- Docs View -->
      <div v-else-if="currentView === 'docs'" class="content-area">
        <div class="docs-grid">
          <div class="doc-card">
            <div class="doc-icon">
              <FileText :size="24" />
            </div>
            <h4>User Guide</h4>
            <p>Complete guide to using Lumen Browser</p>
            <a href="#" class="doc-link">Read More →</a>
          </div>
          <div class="doc-card">
            <div class="doc-icon">
              <Code :size="24" />
            </div>
            <h4>Developer Docs</h4>
            <p>Technical documentation for developers</p>
            <a href="#" class="doc-link">Read More →</a>
          </div>
          <div class="doc-card">
            <div class="doc-icon">
              <Zap :size="24" />
            </div>
            <h4>API Reference</h4>
            <p>Complete API documentation</p>
            <a href="#" class="doc-link">Read More →</a>
          </div>
        </div>
      </div>

      <!-- Contact View -->
      <div v-else-if="currentView === 'contact'" class="content-area">
        <div class="contact-section">
          <h3>Get in Touch</h3>
          <p>Need help? We're here to assist you.</p>
          <div class="contact-methods">
            <div class="contact-item">
              <Mail :size="20" />
              <div>
                <strong>Email</strong>
                <p>support@lumen-browser.com</p>
              </div>
            </div>
            <div class="contact-item">
              <MessageCircle :size="20" />
              <div>
                <strong>Discord</strong>
                <p>Join our community</p>
              </div>
            </div>
            <div class="contact-item">
              <Github :size="20" />
              <div>
                <strong>GitHub</strong>
                <p>Report issues and contribute</p>
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
  Compass,
  MessageCircle,
  Book,
  Mail,
  FileText,
  Code,
  Zap,
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

type HelpView = 'discover' | 'getting-started' | 'faq' | 'docs' | 'contact';

const currentTabUrl = inject<ComputedRef<string>>(
  'currentTabUrl',
  computed(() => 'lumen://help'),
);
const navigate = inject<((url: string, opts?: { push?: boolean }) => void) | null>(
  'navigate',
  null,
);

const currentView = ref<HelpView>('getting-started');

function normalizeViewFromUrl(rawUrl: string): HelpView {
  const s = String(rawUrl || '').trim();
  if (!s) return 'getting-started';

  // Avoid URL() edge cases with custom schemes by doing minimal parsing ourselves.
  if (!/^lumen:\/\//i.test(s)) return 'getting-started';
  const withoutScheme = s.slice('lumen://'.length);
  const beforeQuery = withoutScheme.split(/[?#]/, 1)[0] || '';
  const segs = beforeQuery.split('/').filter(Boolean);
  const host = String(segs[0] || '').toLowerCase();
  if (host !== 'help') return 'getting-started';

  const firstPath = String(segs[1] || '').toLowerCase();
  if (firstPath === 'discover') return 'discover';
  if (firstPath === 'getting-started') return 'getting-started';
  if (firstPath === 'faq') return 'faq';
  if (firstPath === 'docs') return 'docs';
  if (firstPath === 'contact') return 'contact';

  // Optional query param `view=` (kept for backward-compat)
  try {
    const qs = s.includes('?') ? s.split('?', 2)[1] : '';
    const params = new URLSearchParams(qs || '');
    const viewParam = String(params.get('view') || '').trim().toLowerCase();
    if (viewParam === 'discover') return 'discover';
    if (viewParam === 'getting-started') return 'getting-started';
    if (viewParam === 'faq') return 'faq';
    if (viewParam === 'docs') return 'docs';
    if (viewParam === 'contact') return 'contact';
  } catch {}

  return 'getting-started';
}

function urlForView(view: HelpView): string {
  if (view === 'discover') return 'lumen://help/discover';
  if (view === 'getting-started') return 'lumen://help/getting-started';
  if (view === 'faq') return 'lumen://help/faq';
  if (view === 'docs') return 'lumen://help/docs';
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
    'getting-started': 'Getting Started',
    faq: 'Frequently Asked Questions',
    docs: 'Documentation',
    contact: 'Contact Support'
  };
  return titles[currentView.value] || 'Help';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    discover: 'A quick overview of the Lumen stack',
    'getting-started': 'Learn how to use Lumen Browser',
    faq: 'Common questions and answers',
    docs: 'Comprehensive documentation',
    contact: 'Reach out to our team'
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
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.18);
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
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.08);
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
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.14);
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
  border: 1px solid rgba(15, 23, 42, 0.10);
  background: rgba(15, 23, 42, 0.03);
  padding: 0.85rem 0.9rem;
  min-width: 0;
}

.diagram-node.diagram-accent {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(15, 23, 42, 0.02));
  border-color: rgba(59, 130, 246, 0.22);
}

.diagram-node.diagram-wide {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(15, 23, 42, 0.02));
  border-color: rgba(34, 197, 94, 0.20);
}

.diagram-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 850;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgba(15, 23, 42, 0.7);
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid rgba(15, 23, 42, 0.10);
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
  color: rgba(15, 23, 42, 0.35);
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
  background: rgba(59, 130, 246, 0.12);
  color: var(--text-primary);
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
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
  color: rgba(15, 23, 42, 0.35);
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
  background: rgba(15, 23, 42, 0.04);
  color: var(--text-primary);
  padding: 0.7rem 0.9rem;
  font-weight: 750;
  cursor: pointer;
  transition: background var(--transition-fast), transform var(--transition-fast);
}

.cta-btn:hover {
  background: rgba(15, 23, 42, 0.07);
}

.cta-btn:active {
  transform: scale(0.99);
}

.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--sidebar-bg);
  backdrop-filter: var(--backdrop-blur);
  -webkit-backdrop-filter: var(--backdrop-blur);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary);
  border-right: var(--border-width) solid var(--border-color);
  flex-shrink: 0;
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 2rem;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-lg);
  color: white;
  box-shadow: var(--shadow-primary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 1.5rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.875rem;
  border: none;
  background: transparent;
  border-radius: var(--border-radius-sm);
  cursor: pointer;
  font-size: var(--fs-base);
  font-weight: 400;
  color: var(--text-primary);
  transition: all var(--transition-fast);
  letter-spacing: -0.022em;
}

.nav-item:hover {
  background: var(--hover-bg);
}

.nav-item.active {
  background: var(--ios-blue);
  color: white;
  font-weight: 600;
  box-shadow: var(--shadow-primary);
}

.nav-item:active {
  transform: scale(0.98);
}

.nav-item.active {
  background: var(--gradient-primary);
  color: white;
  box-shadow: var(--shadow-primary);
}

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

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.faq-item {
  padding: 1.5rem;
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
}

.faq-item h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.faq-item p {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin: 0;
}

.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.25rem;
}

.doc-card {
  padding: 1.75rem;
  background: var(--card-bg);
  border-radius: var(--border-radius-lg);
  text-align: center;
}

.doc-icon {
  width: 56px;
  height: 56px;
  background: var(--gradient-primary);
  border-radius: var(--border-radius-lg);
  color: white;
  box-shadow: var(--shadow-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1rem;
}

.doc-card h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem 0;
}

.doc-card p {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin: 0 0 1rem 0;
}

.doc-link {
  font-size: 0.85rem;
  color: var(--accent-primary);
  text-decoration: none;
  font-weight: 500;
}

.doc-link:hover {
  text-decoration: underline;
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

@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
}

@media (max-width: 700px) {
  .help-page {
    flex-direction: column;
  }
  
  .sidebar {
    width: 100%;
    max-width: 100%;
    min-width: 100%;
    flex-direction: row;
    padding: 1rem;
    overflow-x: auto;
  }
  
  .sidebar-header {
    margin-bottom: 0;
    margin-right: 1rem;
  }
  
  .sidebar-nav {
    flex-direction: row;
    gap: 0.5rem;
  }
  
  .nav-section {
    flex-direction: row;
  }
  
  .nav-label {
    display: none;
  }
  
  .nav-item span {
    display: none;
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
}
</style>
