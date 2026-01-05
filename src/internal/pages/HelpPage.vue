<template>
  <div class="help-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <HelpCircle :size="24" />
        </div>
        <span class="logo-text">Help</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Resources</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'getting-started' }"
            @click="currentView = 'getting-started'"
          >
            <Compass :size="18" />
            <span>Getting Started</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'faq' }"
            @click="currentView = 'faq'"
          >
            <MessageCircle :size="18" />
            <span>FAQ</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'docs' }"
            @click="currentView = 'docs'"
          >
            <Book :size="18" />
            <span>Documentation</span>
          </button>
        </div>

        <div class="nav-section">
          <span class="nav-label">Support</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'contact' }"
            @click="currentView = 'contact'"
          >
            <Mail :size="18" />
            <span>Contact</span>
          </button>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>
      </header>

      <!-- Getting Started View -->
      <div v-if="currentView === 'getting-started'" class="content-area">
        <div class="help-section">
          <h3>Welcome to Lumen Browser</h3>
          <p>Lumen is a decentralized web browser powered by IPFS. Here's how to get started:</p>
          <div class="steps">
            <div class="step">
              <div class="step-number">1</div>
              <div class="step-content">
                <h4>Configure IPFS</h4>
                <p>Ensure your local IPFS node is running on port 8088</p>
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
import { ref } from 'vue';
import { 
  HelpCircle,
  Compass,
  MessageCircle,
  Book,
  Mail,
  FileText,
  Code,
  Zap,
  Github
} from 'lucide-vue-next';

const currentView = ref<'getting-started' | 'faq' | 'docs' | 'contact'>('getting-started');

function getViewTitle(): string {
  const titles: Record<string, string> = {
    'getting-started': 'Getting Started',
    faq: 'Frequently Asked Questions',
    docs: 'Documentation',
    contact: 'Contact Support'
  };
  return titles[currentView.value] || 'Help';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    'getting-started': 'Learn how to use Lumen Browser',
    faq: 'Common questions and answers',
    docs: 'Comprehensive documentation',
    contact: 'Reach out to our team'
  };
  return descs[currentView.value] || '';
}
</script>

<style scoped>
.help-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-tertiary, #f0f2f5);
  overflow: hidden;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--bg-primary, #ffffff);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: var(--text-primary, #1a1a2e);
  border-right: 2px solid var(--border-color, #e5e7eb);
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
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
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
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.nav-item.active {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 4px 12px var(--primary-a30);
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-primary, #ffffff);
  margin: 0;
  border-radius: 0;
}

.content-header {
  margin-bottom: 1.5rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0.25rem 0 0 0;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

.help-section h3 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.75rem 0;
}

.help-section p {
  font-size: 0.9rem;
  color: var(--text-secondary, #64748b);
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
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.25rem 0;
}

.step-content p {
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.faq-list {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.faq-item {
  padding: 1.5rem;
  background: var(--bg-secondary, #f8fafc);
  border-radius: 12px;
}

.faq-item h4 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem 0;
}

.faq-item p {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.25rem;
}

.doc-card {
  padding: 1.75rem;
  background: var(--card-bg, #f8fafc);
  border-radius: 12px;
  text-align: center;
}

.doc-icon {
  width: 56px;
  height: 56px;
  background: var(--gradient-primary);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  margin: 0 auto 1rem;
}

.doc-card h4 {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem 0;
}

.doc-card p {
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
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
  color: var(--text-primary, #1e293b);
  margin: 0 0 0.5rem 0;
}

.contact-section > p {
  font-size: 0.9rem;
  color: var(--text-secondary, #64748b);
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
  background: var(--bg-secondary, #f8fafc);
  border-radius: 12px;
}

.contact-item strong {
  display: block;
  font-size: 0.9rem;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.25rem;
}

.contact-item p {
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
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
}
</style>
