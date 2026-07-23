<template>
  <div class="help-page internal-page">
    <!-- Sidebar -->
    <InternalSidebar title="Help" :icon="HelpCircle" activeKey="help">
      <nav class="lsb-nav flex flex-column gap-12px">
        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em mb-4px py-8px px-10px">Resources</span>
          <button
            type="button"
            class="lsb-item hover-fill-primary-not-active border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-10px border-radius-10px w-full text-13px fw-500 text-left py-8px px-10px transition-all-fast"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'discover' }"
            @click="setView('discover')"
          >
            <Sparkles :size="18" />
            <span>Discover Lumen</span>
          </button>
          <button
            type="button"
            class="lsb-item hover-fill-primary-not-active border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-10px border-radius-10px w-full text-13px fw-500 text-left py-8px px-10px transition-all-fast"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'domains' }"
            @click="setView('domains')"
          >
            <Link2 :size="18" />
            <span>Domains & Drive</span>
          </button>
        </div>

        <div class="lsb-section flex flex-column gap-2px">
          <span class="lsb-label text-11px txt-weight-light color-text-tertiary text-uppercase letter-spacing-005em mb-4px py-8px px-10px">Support</span>
          <button
            type="button"
            class="lsb-item hover-fill-primary-not-active border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-10px border-radius-10px w-full text-13px fw-500 text-left py-8px px-10px transition-all-fast"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'publish' }"
            @click="setView('publish')"
          >
            <Rocket :size="18" />
            <span>Publish my site</span>
          </button>
          <button
            type="button"
            class="lsb-item hover-fill-primary-not-active border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-10px border-radius-10px w-full text-13px fw-500 text-left py-8px px-10px transition-all-fast"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'contact' }"
            @click="setView('contact')"
          >
            <MessageCircle :size="18" />
            <span>Support</span>
          </button>
          <button
            type="button"
            class="lsb-item hover-fill-primary-not-active border-none bg-transparent cursor-pointer color-text-secondary flex-align-center gap-10px border-radius-10px w-full text-13px fw-500 text-left py-8px px-10px transition-all-fast"
            :class="{ 'active bg-gradient-primary color-white shadow-primary': currentView === 'docs' }"
            @click="setView('docs')"
          >
            <BookOpen :size="18"/>
            <span>Documentation</span>
          </button>
        </div>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="helppage-main flex-1 flex flex-column m-0px min-w-0 overflow-hidden py-32px px-40px bg-secondary border-radius-0">
      <!-- Header -->
      <UiPageHeader :title="getViewTitle()" :subtitle="getViewDescription()" />

      <!-- Discover View -->
      <div v-if="currentView === 'discover'" class="helppage-content-area flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="discover flex flex-column gap-20px">
          <!-- Hero Section -->
          <section class="bg-gradient-primary-a12-card p-32px border-radius-16px text-center border-default shadow-sm">
            <div class="helppage-hero-content mb-24px">
              <h2 class="helppage-hero-title color-text-primary txt-weight-strong m-0px text-28px letter-spacing-n002">Welcome to <span class="gradient-text-clip bg-gradient-primary">Lumen</span></h2>
              <p class="m-0px mt-8px color-text-secondary text-16px line-height-15">The decentralized web browser for the next generation of internet</p>
            </div>
            <div class="helppage-hero-features flex flex-wrap-wrap flex-justify-center gap-24px">
              <div class="helppage-feature-point flex gap-12px text-left flex-align-start">
                <div class="helppage-point-icon text-24px line-height-1">🌐</div>
                <div class="helppage-point-text flex flex-column gap-2px">
                  <strong class="color-text-primary helppage-point-text-strong text-14px">Decentralized Storage</strong>
                  <span class="color-text-secondary helppage-point-text-span text-13px">Store and share content without central servers</span>
                </div>
              </div>
              <div class="helppage-feature-point flex gap-12px text-left flex-align-start">
                <div class="helppage-point-icon text-24px line-height-1">🔐</div>
                <div class="helppage-point-text flex flex-column gap-2px">
                  <strong class="color-text-primary helppage-point-text-strong text-14px">Blockchain Domains</strong>
                  <span class="color-text-secondary helppage-point-text-span text-13px">Own your identity with .lmn domains</span>
                </div>
              </div>
              <div class="helppage-feature-point flex gap-12px text-left flex-align-start">
                <div class="helppage-point-icon text-24px line-height-1">⚡</div>
                <div class="helppage-point-text flex flex-column gap-2px">
                  <strong class="color-text-primary helppage-point-text-strong text-14px">Secure by Design</strong>
                  <span class="color-text-secondary helppage-point-text-span text-13px">Encrypted connections and local-first data</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Quick Actions -->
          <section class="quick-actions flex flex-column gap-16px">
            <h3 class="helppage-section-title color-text-primary txt-weight-medium m-0px text-16px">Get Started</h3>
            <div class="helppage-actions-grid gap-12px grid grid-cols-2">
              <button class="helppage-action-card flex-align-center cursor-pointer gap-16px border-radius-16px text-left py-16px px-20px border-default bg-card transition-all-fast hover-bg-hover hover-lift-1" type="button" @click="goto('lumen://drive')">
                <div class="helppage-action-icon drive flex-align-justify-center size-48px border-radius-14px flex-shrink-0 color-ios-blue bg-fill-blue">
                  <FolderOpen :size="24" />
                </div>
                <div class="helppage-action-info flex-1 flex flex-column gap-2px min-w-0">
                  <span class="helppage-action-title color-text-primary txt-weight-medium text-15px">Drive</span>
                  <span class="helppage-action-desc color-text-secondary text-13px">Upload and manage your files</span>
                </div>
                <ArrowRight :size="16" class="helppage-action-arrow color-text-tertiary flex-shrink-0" />
              </button>
              <button class="helppage-action-card flex-align-center cursor-pointer gap-16px border-radius-16px text-left py-16px px-20px border-default bg-card transition-all-fast hover-bg-hover hover-lift-1" type="button" @click="goto('lumen://domain')">
                <div class="helppage-action-icon domain flex-align-justify-center size-48px border-radius-14px flex-shrink-0 helppage-action-icon-domain color-ios-purple background-ios-purple-a15">
                  <Link2 :size="24" />
                </div>
                <div class="helppage-action-info flex-1 flex flex-column gap-2px min-w-0">
                  <span class="helppage-action-title color-text-primary txt-weight-medium text-15px">Domains</span>
                  <span class="helppage-action-desc color-text-secondary text-13px">Register your .lmn domain</span>
                </div>
                <ArrowRight :size="16" class="helppage-action-arrow color-text-tertiary flex-shrink-0" />
              </button>
              <button class="helppage-action-card flex-align-center cursor-pointer gap-16px border-radius-16px text-left py-16px px-20px border-default bg-card transition-all-fast hover-bg-hover hover-lift-1" type="button" @click="goto('lumen://wallet')">
                <div class="helppage-action-icon wallet bg-fill-success color-success flex-align-justify-center size-48px border-radius-14px flex-shrink-0">
                  <Wallet :size="24" />
                </div>
                <div class="helppage-action-info flex-1 flex flex-column gap-2px min-w-0">
                  <span class="helppage-action-title color-text-primary txt-weight-medium text-15px">Wallet</span>
                  <span class="helppage-action-desc color-text-secondary text-13px">Manage your LMN tokens</span>
                </div>
                <ArrowRight :size="16" class="helppage-action-arrow color-text-tertiary flex-shrink-0" />
              </button>
              <button class="helppage-action-card flex-align-center cursor-pointer gap-16px border-radius-16px text-left py-16px px-20px border-default bg-card transition-all-fast hover-bg-hover hover-lift-1" type="button" @click="goto('lumen://search')">
                <div class="helppage-action-icon search bg-ios-orange-a15 color-warning flex-align-justify-center size-48px border-radius-14px flex-shrink-0">
                  <Search :size="24" />
                </div>
                <div class="helppage-action-info flex-1 flex flex-column gap-2px min-w-0">
                  <span class="helppage-action-title color-text-primary txt-weight-medium text-15px">Search</span>
                  <span class="helppage-action-desc color-text-secondary text-13px">Discover decentralized content</span>
                </div>
                <ArrowRight :size="16" class="helppage-action-arrow color-text-tertiary flex-shrink-0" />
              </button>
            </div>
          </section>

          <!-- How it Works -->
          <section class="how-it-works flex flex-column gap-16px">
            <h3 class="helppage-section-title color-text-primary txt-weight-medium m-0px text-16px">How Lumen Works</h3>
            <div class="helppage-steps-grid gap-16px grid grid-cols-3">
              <UiCard padding="none" :shadow="false" class="helppage-step-card flex gap-16px p-20px">
                <div class="helppage-step-number flex-align-justify-center size-36px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-16px">1</div>
                <div class="helppage-step-content">
                  <h4 class="color-text-primary txt-weight-medium helppage-step-content-h4 text-14px m-0px mb-4px">Blockchain Names</h4>
                  <p class="color-text-secondary text-13px line-height-14 m-0px">Domain names are stored on the blockchain - no central authority can take them away.</p>
                </div>
              </UiCard>
              <UiCard padding="none" :shadow="false" class="helppage-step-card flex gap-16px p-20px">
                <div class="helppage-step-number flex-align-justify-center size-36px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-16px">2</div>
                <div class="helppage-step-content">
                  <h4 class="color-text-primary txt-weight-medium helppage-step-content-h4 text-14px m-0px mb-4px">Distributed Storage</h4>
                  <p class="color-text-secondary text-13px line-height-14 m-0px">Content is stored across multiple nodes, ensuring availability even if some go offline.</p>
                </div>
              </UiCard>
              <UiCard padding="none" :shadow="false" class="helppage-step-card flex gap-16px p-20px">
                <div class="helppage-step-number flex-align-justify-center size-36px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-16px">3</div>
                <div class="helppage-step-content">
                  <h4 class="color-text-primary txt-weight-medium helppage-step-content-h4 text-14px m-0px mb-4px">Verified Access</h4>
                  <p class="color-text-secondary text-13px line-height-14 m-0px">Every piece of content is cryptographically verified for authenticity.</p>
                </div>
              </UiCard>
            </div>
          </section>

          <!-- Features Grid -->
          <section class="features-section flex flex-column gap-16px">
            <h3 class="helppage-section-title color-text-primary txt-weight-medium m-0px text-16px">Key Features</h3>
            <div class="helppage-features-grid gap-16px grid grid-cols-2">
              <UiCard padding="none" :shadow="false" class="helppage-feature-card flex gap-16px p-20px">
                <div class="h-44px flex-align-justify-center border-radius-12px bg-fill-tertiary color-ios-blue flex-shrink-0 w-44px">
                  <Globe :size="24" />
                </div>
                <div class="helppage-feature-content">
                  <h4 class="color-text-primary txt-weight-medium helppage-feature-content-h4 text-14px m-0px mb-4px">Human-Readable Links</h4>
                  <p class="color-text-secondary m-0px helppage-feature-content-p text-13px line-height-14">Type <code>demo.lmn</code> instead of long cryptographic hashes.</p>
                </div>
              </UiCard>
              <UiCard padding="none" :shadow="false" class="helppage-feature-card flex gap-16px p-20px">
                <div class="h-44px flex-align-justify-center border-radius-12px bg-fill-tertiary color-ios-blue flex-shrink-0 w-44px">
                  <Database :size="24" />
                </div>
                <div class="helppage-feature-content">
                  <h4 class="color-text-primary txt-weight-medium helppage-feature-content-h4 text-14px m-0px mb-4px">Content Everywhere</h4>
                  <p class="color-text-secondary m-0px helppage-feature-content-p text-13px line-height-14">Your website exists in many places, so it stays available.</p>
                </div>
              </UiCard>
              <UiCard padding="none" :shadow="false" class="helppage-feature-card flex gap-16px p-20px">
                <div class="h-44px flex-align-justify-center border-radius-12px bg-fill-tertiary color-ios-blue flex-shrink-0 w-44px">
                  <Server :size="24" />
                </div>
                <div class="helppage-feature-content">
                  <h4 class="color-text-primary txt-weight-medium helppage-feature-content-h4 text-14px m-0px mb-4px">Pro Cloud Service</h4>
                  <p class="color-text-secondary m-0px helppage-feature-content-p text-13px line-height-14">Optional premium service for faster loading and reliability.</p>
                </div>
              </UiCard>
              <UiCard padding="none" :shadow="false" class="helppage-feature-card flex gap-16px p-20px">
                <div class="h-44px flex-align-justify-center border-radius-12px bg-fill-tertiary color-ios-blue flex-shrink-0 w-44px">
                  <Wallet :size="24" />
                </div>
                <div class="helppage-feature-content">
                  <h4 class="color-text-primary txt-weight-medium helppage-feature-content-h4 text-14px m-0px mb-4px">Your Identity</h4>
                  <p class="color-text-secondary m-0px helppage-feature-content-p text-13px line-height-14">Your wallet proves what you own and enables transactions.</p>
                </div>
              </UiCard>
            </div>
          </section>
        </div>
      </div>

      <!-- Domains & Drive View -->
      <div v-else-if="currentView === 'domains'" class="helppage-content-area flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="discover flex flex-column gap-20px">
          <!-- Hero -->
          <section class="bg-gradient-primary-a12-card small border-radius-16px text-center border-default shadow-sm p-24px">
            <div class="helppage-hero-content mb-24px">
              <h2 class="helppage-hero-title color-text-primary txt-weight-strong m-0px text-28px letter-spacing-n002">Publish Your <span class="gradient-text-clip bg-gradient-primary">Website</span></h2>
              <p class="m-0px mt-8px color-text-secondary text-16px line-height-15">Create a domain and link it to your Drive content in 4 easy steps</p>
            </div>
          </section>

          <!-- Steps -->
          <div class="tutorial-steps flex flex-column gap-16px">
            <UiCard padding="none" :shadow="false" class="helppage-tutorial-step p-20px">
              <div class="helppage-step-header flex-align-center gap-12px mb-8px">
                <div class="helppage-step-number flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">1</div>
                <h4 class="color-text-primary m-0px txt-weight-medium helppage-step-header-h4 text-16px">Upload to Drive</h4>
              </div>
              <p class="color-text-secondary helppage-tutorial-step-p text-14px line-height-15 m-0px mb-12px">Go to Drive, upload a file or folder, then click <strong>Share</strong> to get a Lumen link.</p>
              <UiButton variant="primary" type="button" @click="goto('lumen://drive')" class="helppage-step-action">
                <FolderOpen :size="18" />
                <span>Open Drive</span>
              </UiButton>
            </UiCard>

            <UiCard padding="none" :shadow="false" class="helppage-tutorial-step p-20px">
              <div class="helppage-step-header flex-align-center gap-12px mb-8px">
                <div class="helppage-step-number flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">2</div>
                <h4 class="color-text-primary m-0px txt-weight-medium helppage-step-header-h4 text-16px">Buy Your Domain</h4>
              </div>
              <p class="color-text-secondary helppage-tutorial-step-p text-14px line-height-15 m-0px mb-12px">Go to Domains, click <strong>Buy domain</strong>, choose a name like <code>yourname.lmn</code>.</p>
              <UiButton variant="primary" type="button" @click="goto('lumen://domain')" class="helppage-step-action">
                <Link2 :size="18" />
                <span>Open Domains</span>
              </UiButton>
            </UiCard>

            <UiCard padding="none" :shadow="false" class="helppage-tutorial-step p-20px">
              <div class="helppage-step-header flex-align-center gap-12px mb-8px">
                <div class="helppage-step-number flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">3</div>
                <h4 class="color-text-primary m-0px txt-weight-medium helppage-step-header-h4 text-16px">Link Domain to Content</h4>
              </div>
              <p class="color-text-secondary helppage-tutorial-step-p text-14px line-height-15 m-0px mb-12px">In Domain settings, add a record with <code>Key: cid</code> and <code>Value: your-content-hash</code>.</p>
            </UiCard>

            <UiCard padding="none" :shadow="false" class="helppage-tutorial-step p-20px">
              <div class="helppage-step-header flex-align-center gap-12px mb-8px">
                <div class="helppage-step-number flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">4</div>
                <h4 class="color-text-primary m-0px txt-weight-medium helppage-step-header-h4 text-16px">Visit Your Site</h4>
              </div>
              <p class="color-text-secondary helppage-tutorial-step-p text-14px line-height-15 m-0px mb-12px">Type <code>lumen://yourname.lmn</code> in the address bar to access your decentralized website!</p>
              <UiButton variant="primary" type="button" @click="goto('lumen://newtab')" class="helppage-step-action">
                <Globe :size="18" />
                <span>Open New Tab</span>
              </UiButton>
            </UiCard>
          </div>
        </div>
      </div>

      <!-- Publish My Site View -->
      <div v-else-if="currentView === 'publish'" class="helppage-content-area flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="discover flex flex-column gap-20px">
          <!-- Hero -->
          <section class="bg-gradient-primary-a12-card small border-radius-16px text-center border-default shadow-sm p-24px">
            <div class="helppage-hero-content mb-24px">
              <h2 class="helppage-hero-title color-text-primary txt-weight-strong m-0px text-28px letter-spacing-n002">Create Your <span class="gradient-text-clip bg-gradient-primary">First Website</span></h2>
              <p class="m-0px mt-8px color-text-secondary text-16px line-height-15">Publish a site on the decentralized web in four simple steps — no server required.</p>
            </div>
          </section>

          <!-- Steps -->
          <div class="tutorial-steps flex flex-column gap-16px">
            <UiCard padding="none" :shadow="false" class="helppage-tutorial-step p-20px">
              <div class="helppage-step-header flex-align-center gap-12px mb-8px">
                <div class="helppage-step-number flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">1</div>
                <h4 class="color-text-primary m-0px txt-weight-medium helppage-step-header-h4 text-16px">Build Your Website</h4>
              </div>
              <p class="color-text-secondary helppage-tutorial-step-p text-14px line-height-15 m-0px mb-12px">Create it like you normally would — plain HTML/CSS/JS, or the export of any static site builder. All you need is a folder with an <code>index.html</code> at its root.</p>
            </UiCard>

            <UiCard padding="none" :shadow="false" class="helppage-tutorial-step p-20px">
              <div class="helppage-step-header flex-align-center gap-12px mb-8px">
                <div class="helppage-step-number flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">2</div>
                <h4 class="color-text-primary m-0px txt-weight-medium helppage-step-header-h4 text-16px">Upload It to Drive</h4>
              </div>
              <p class="color-text-secondary helppage-tutorial-step-p text-14px line-height-15 m-0px mb-12px">Open Drive, upload that folder, then copy its Lumen link — that's your content's address.</p>
              <UiButton variant="primary" type="button" @click="goto('lumen://drive')" class="helppage-step-action">
                <FolderOpen :size="18" />
                <span>Open Drive</span>
              </UiButton>
            </UiCard>

            <UiCard padding="none" :shadow="false" class="helppage-tutorial-step p-20px">
              <div class="helppage-step-header flex-align-center gap-12px mb-8px">
                <div class="helppage-step-number flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">3</div>
                <h4 class="color-text-primary m-0px txt-weight-medium helppage-step-header-h4 text-16px">Get a Domain</h4>
              </div>
              <p class="color-text-secondary helppage-tutorial-step-p text-14px line-height-15 m-0px mb-12px">Open Domains and register a name for your site, like <code>yourname.lmn</code>, if you don't have one yet.</p>
              <UiButton variant="primary" type="button" @click="goto('lumen://domain')" class="helppage-step-action">
                <Link2 :size="18" />
                <span>Open Domains</span>
              </UiButton>
            </UiCard>

            <UiCard padding="none" :shadow="false" class="helppage-tutorial-step p-20px">
              <div class="helppage-step-header flex-align-center gap-12px mb-8px">
                <div class="helppage-step-number flex-align-justify-center size-28px border-radius-circle txt-weight-medium bg-gradient-primary color-white flex-shrink-0 text-14px">4</div>
                <h4 class="color-text-primary m-0px txt-weight-medium helppage-step-header-h4 text-16px">Link Your Domain to Your Content</h4>
              </div>
              <p class="color-text-secondary helppage-tutorial-step-p text-14px line-height-15 m-0px mb-12px">Edit your domain, then add a new record: set <strong>Key</strong> to <code>cid</code> and <strong>Value</strong> to the link you copied in step 2. Save.</p>
            </UiCard>
          </div>

          <div class="helppage-discover-note color-text-primary mt-16px border-radius-14px text-14px py-12px px-16px bg-fill-blue line-height-14 border-1-ios-blue-a15">
            <strong>That's it — you're live.</strong> Visit <code>lumen://yourname.lmn</code> to see your site.
            If it still shows as unavailable, double-check that <code>index.html</code> sits at the root of the
            uploaded folder, and give it a minute to propagate.
          </div>
        </div>
      </div>

      <!-- Contact View -->
      <div v-else-if="currentView === 'contact'" class="helppage-content-area flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="discover flex flex-column gap-20px">
          <!-- Hero -->
          <section class="bg-gradient-primary-a12-card small border-radius-16px text-center border-default shadow-sm p-24px">
            <div class="helppage-hero-content mb-24px">
              <h2 class="helppage-hero-title color-text-primary txt-weight-strong m-0px text-28px letter-spacing-n002">Get <span class="gradient-text-clip bg-gradient-primary">Help</span></h2>
              <p class="m-0px mt-8px color-text-secondary text-16px line-height-15">Connect with our community and get support</p>
            </div>
          </section>

          <!-- Contact Cards -->
          <div class="helppage-contact-grid gap-16px grid grid-cols-1">
            <button class="helppage-contact-card flex-align-center w-full cursor-pointer gap-20px p-20px border-radius-16px text-left border-default bg-card transition-all-fast hover-bg-hover hover-lift-1" type="button" @click="openInNewTabSafe('https://discord.gg/DwK6V9shKc')">
              <div class="helppage-contact-icon discord flex-align-justify-center size-56px border-radius-14px flex-shrink-0 helppage-contact-icon-discord color-ios-purple background-ios-purple-a15">
                <MessageCircle :size="28" />
              </div>
              <div class="helppage-contact-info min-w-0">
                <h4 class="color-text-primary txt-weight-medium helppage-contact-info-h4 text-16px m-0px mb-4px">Discord Community</h4>
                <p class="color-text-secondary m-0px text-14px helppage-contact-info-p line-height-14">Join our active community, ask questions, and get help from other users.</p>
              </div>
              <ArrowRight :size="18" class="helppage-contact-arrow color-text-tertiary flex-shrink-0" />
            </button>

            <button class="helppage-contact-card flex-align-center w-full cursor-pointer gap-20px p-20px border-radius-16px text-left border-default bg-card transition-all-fast hover-bg-hover hover-lift-1" type="button" @click="openInNewTabSafe('https://github.com/network-lumen/')">
              <div class="helppage-contact-icon github flex-align-justify-center color-text-primary size-56px border-radius-14px flex-shrink-0 bg-fill-tertiary">
                <Github :size="28" />
              </div>
              <div class="helppage-contact-info min-w-0">
                <h4 class="color-text-primary txt-weight-medium helppage-contact-info-h4 text-16px m-0px mb-4px">GitHub</h4>
                <p class="color-text-secondary m-0px text-14px helppage-contact-info-p line-height-14">Report bugs, contribute to the codebase, or explore our open-source projects.</p>
              </div>
              <ArrowRight :size="18" class="helppage-contact-arrow color-text-tertiary flex-shrink-0" />
            </button>

            <button class="helppage-contact-card flex-align-center w-full cursor-pointer gap-20px p-20px border-radius-16px text-left border-default bg-card transition-all-fast hover-bg-hover hover-lift-1" type="button" @click="openInNewTabSafe('lumen://lumen.lmn')">
              <div class="helppage-contact-icon website flex-align-justify-center size-56px border-radius-14px flex-shrink-0 color-ios-blue bg-fill-blue">
                <Globe :size="28" />
              </div>
              <div class="helppage-contact-info min-w-0">
                <h4 class="color-text-primary txt-weight-medium helppage-contact-info-h4 text-16px m-0px mb-4px">Official Website</h4>
                <p class="color-text-secondary m-0px text-14px helppage-contact-info-p line-height-14">Visit our website for documentation, news, and updates.</p>
              </div>
              <ArrowRight :size="18" class="helppage-contact-arrow color-text-tertiary flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
      
      <!-- Docs View -->
      <div v-else-if="currentView === 'docs'" class="helppage-content-area helppage-docs-content-area flex flex-column overflow-hidden flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="discover helppage-docs-discover flex flex-column gap-20px flex-1 min-h-0">
          <iframe
            class="helppage-doc-frame w-full h-full border-radius-16px block border-default shadow-sm bg-card min-h-520px"
            :src="lumenDocFrameSrc"
            title="window.lumen API Reference"
            loading="lazy"
          ></iframe>

          <!-- Documentation Grid -->
          <div class="helppage-docs-grid gap-12px grid grid-cols-1" v-if="false" aria-hidden="true">
            <!-- What is Lumen Browser -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <BookOpen :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">What is Lumen Browser?</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                  nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                  nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                  incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis
                  nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                </p>
              </div>
            </UiCard>

            <!-- Secure your Wallet -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Wallet :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">Secure your Wallet</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in
                  reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                  Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                </p>
              </div>
            </UiCard>

            <!-- Upload -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <FolderOpen :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">Upload</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vel sem nec arcu
                  tincidunt tristique. Mauris posuere, nisl non hendrerit varius, risus neque blandit
                  massa, vitae fermentum velit quam a odio.
                </p>
              </div>
            </UiCard>

            <!-- Cloud -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Database :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">Cloud</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed viverra, arcu in tincidunt
                  gravida, metus ante accumsan justo, sit amet consequat libero dolor sed ligula.
                  Praesent faucibus, elit vitae fermentum viverra, odio tellus laoreet purus.
                </p>
              </div>
            </UiCard>

            <!-- How to Manage Domain -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Link2 :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">How to Manage Domain</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Neque porro quisquam est,
                  qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit. Quis autem vel eum iure
                  reprehenderit qui in ea voluptate velit esse.
                </p>
              </div>
            </UiCard>

            <!-- Domain Setting -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Globe :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">Domain Setting</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras id tortor vitae justo
                  vulputate aliquet. Nulla facilisi. Vestibulum ante ipsum primis in faucibus orci luctus
                  et ultrices posuere cubilia curae.
                </p>
              </div>
            </UiCard>

            <!-- How to Linked Domain -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Link2 :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">How to Linked Domain</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minima veniam,
                  quis nostrum exercitationem ullam corporis suscipit laboriosam. Nisi ut aliquid ex ea commodi
                  consequatur.
                </p>
              </div>
            </UiCard>

            <!-- Publish Website with .lmn -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Server :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">Publish Website with .lmn</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus ultricies, est vitae
                  fermentum malesuada, elit sapien ullamcorper justo, at ultricies mi tortor vitae ex.
                  Integer vitae lectus sed magna ultricies cursus.
                </p>
              </div>
            </UiCard>

            <!-- Theme -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Sparkles :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">Theme</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed consequat elit nec neque
                  gravida, a vestibulum est feugiat. Maecenas tincidunt nisl in enim tincidunt, sit amet
                  convallis libero viverra.
                </p>
              </div>
            </UiCard>

            <!-- Font Size -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Sparkles :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">Font Size</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean sit amet lectus et
                  metus dapibus fermentum. Integer dictum mi at orci pellentesque, eget consequat nibh
                  auctor.
                </p>
              </div>
            </UiCard>

            <!-- Brightness -->
            <UiCard padding="md" shadow class="flex gap-12px">
              <div class="helppage-discover-ico flex-align-justify-center flex-0-0-auto border-radius-14px color-ios-blue bg-fill-blue w-42px h-42px border-1-ios-blue-a15">
                <Sparkles :size="20" />
              </div>
              <div>
                <h4 class="color-text-primary m-0px txt-weight-strong helppage-discover-card-h4 text-15px">Brightness</h4>
                <p class="color-text-secondary helppage-discover-card-p text-14px line-height-14 m-0px mt-4px">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce lacinia volutpat eros,
                  ac laoreet purus euismod vitae. Etiam in sem nec turpis iaculis pellentesque.
                  Quisque feugiat tellus at malesuada suscipit.
                </p>
              </div>
            </UiCard>
          </div>
        </div>
      </div>  
    </main>
  </div>
</template>

<script setup lang="ts">
import UiButton from '../../ui/UiButton.vue';
import { computed, inject, ref, watch } from 'vue';
import type { ComputedRef } from 'vue';
import UiCard from '../../ui/UiCard.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
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

