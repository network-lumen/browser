<template>
  <div class="release-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Rocket :size="24" />
        </div>
        <span class="logo-text">Releases</span>
      </div>
      
      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Versions</span>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'latest' }"
            @click="currentView = 'latest'"
          >
            <Star :size="18" />
            <span>Latest</span>
          </button>
          <button 
            class="nav-item"
            :class="{ active: currentView === 'all' }"
            @click="currentView = 'all'"
          >
            <FileText :size="18" />
            <span>All Releases</span>
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

      <!-- Latest View -->
      <div v-if="currentView === 'latest'" class="content-area">
        <div class="release-card featured">
          <div class="release-badge">Latest</div>
          <h2>Lumen Browser v1.0.0</h2>
          <p class="release-date">Released on January 15, 2025</p>
          <div class="release-content">
            <h3>What's New</h3>
            <ul>
              <li>Initial release of Lumen Browser</li>
              <li>IPFS integration with local node support</li>
              <li>Web3 wallet functionality</li>
              <li>Blockchain explorer</li>
              <li>DAO governance interface</li>
              <li>Domain management system</li>
            </ul>
          </div>
          <button class="btn-primary">Download</button>
        </div>
      </div>

      <!-- All Releases View -->
      <div v-else-if="currentView === 'all'" class="content-area">
        <div class="timeline">
          <div class="timeline-item">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <div class="release-card">
                <h3>v1.0.0</h3>
                <p class="release-date">January 15, 2025</p>
                <p>Initial stable release with all core features.</p>
              </div>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <div class="release-card">
                <h3>v0.9.0-beta</h3>
                <p class="release-date">December 10, 2024</p>
                <p>Beta release for testing and feedback.</p>
              </div>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <div class="release-card">
                <h3>v0.5.0-alpha</h3>
                <p class="release-date">November 1, 2024</p>
                <p>Early alpha with basic IPFS functionality.</p>
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
import { Rocket, Star, FileText } from 'lucide-vue-next';

const currentView = ref<'latest' | 'all'>('latest');

function getViewTitle(): string {
  return currentView.value === 'latest' ? 'Latest Release' : 'Release History';
}

function getViewDescription(): string {
  return currentView.value === 'latest' 
    ? 'Download the newest version of Lumen'
    : 'View all previous releases';
}
</script>

<style scoped>
.release-page {
  display: flex;
  height: 100%;
  background: #f0f2f5;
  overflow: hidden;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: #ffffff;
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: #1a1a2e;
  border-right: 1px solid #e5e7eb;
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
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-text {
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
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
  color: #94a3b8;
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
  color: #64748b;
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.nav-item.active {
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: #fff;
  margin: 0.5rem 0.5rem 0.5rem 0;
  border-radius: 16px;
}

.content-header {
  margin-bottom: 1.5rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: #64748b;
  margin: 0.25rem 0 0 0;
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

.release-card {
  padding: 2rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  position: relative;
}

.release-card.featured {
  background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
  border-color: #3498db;
}

.release-badge {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  padding: 0.35rem 0.75rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  color: white;
  border-radius: 20px;
  font-size: 0.75rem;
  font-weight: 600;
}

.release-card h2 {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 0.5rem 0;
}

.release-card h3 {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0 0 0.25rem 0;
}

.release-date {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0 0 1.5rem 0;
}

.release-content {
  margin-bottom: 1.5rem;
}

.release-content h3 {
  margin: 0 0 0.75rem 0;
}

.release-content ul {
  margin: 0;
  padding-left: 1.5rem;
}

.release-content li {
  font-size: 0.9rem;
  color: #64748b;
  margin-bottom: 0.5rem;
}

.btn-primary {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(52, 152, 219, 0.35);
}

.timeline {
  position: relative;
  padding-left: 2rem;
}

.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e2e8f0;
}

.timeline-item {
  position: relative;
  padding-bottom: 2rem;
}

.timeline-marker {
  position: absolute;
  left: -2rem;
  top: 0.5rem;
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
  border-radius: 50%;
  border: 3px solid white;
  box-shadow: 0 0 0 2px #e2e8f0;
}

.timeline-content {
  margin-left: 1rem;
}

@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
}

@media (max-width: 700px) {
  .release-page {
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
