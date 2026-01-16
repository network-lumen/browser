<template>
    <div class="app-layout">

        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="brand-text">
                    Browser Docs <span class="badge badge-primary">beta</span>
                </div>
            </div>

            <div class="sidebar-content">
                <nav class="nav-section" v-for="(group, idx) in navigation" :key="idx">
                    <div class="nav-label">{{ group.title }}</div>

                    <a v-for="item in group.items" :key="item.slug" href="#" class="nav-item"
                        :class="{ 'active': currentSlug === item.slug }" @click.prevent="navigate(item.slug)">
                        {{ item.label }}
                        <span v-if="currentSlug === item.slug" class="active-dot"></span>
                    </a>
                </nav>
            </div>
        </aside>

        <div class="main-wrapper">

            <main class="content-area">
                <div class="content-max-width">

                    <article>
                        <section id="intro" style="padding-top: 1rem; margin-bottom: 4rem;">
                            <h1 class="page-title">Introducing Lumen Browser: The evolution of the browser</h1>
                            <p class="lead-text">
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer nec odio. Praesent
                                libero. Sed cursus ante dapibus diam. Sed nisi. Nulla quis sem at nibh elementum
                                imperdiet.
                            </p>

                        </section>

                        <section id="what-is-lumen" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>What is Lumen Browser?</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
                                incididunt ut labore et dolore magna aliqua.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minim veniam, quis
                                nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                            </p>
                        </section>

                        <section id="import-export" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>Secure your Wallet</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in
                                reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                            </p>

                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Excepteur sint occaecat
                                cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                            </p>
                        </section>

                        <section id="upload" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>Upload</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vel sem nec arcu
                                tincidunt tristique. Mauris posuere, nisl non hendrerit varius, risus neque blandit
                                massa, vitae fermentum velit quam a odio.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec luctus, lorem et feugiat
                                tempus, justo erat gravida erat, vitae maximus lorem urna sed nulla.
                            </p>
                        </section>

                        <section id="cloud" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>Cloud</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed viverra, arcu in tincidunt
                                gravida, metus ante accumsan justo, sit amet consequat libero dolor sed ligula.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent faucibus, elit vitae
                                fermentum viverra, odio tellus laoreet purus, eu facilisis nunc justo nec arcu.
                            </p>
                        </section>
                        <section id="manage-domain" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>How to Manage Domain</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Neque porro quisquam est,
                                qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quis autem vel eum iure
                                reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.
                            </p>
                        </section>

                        
                        
                        <section id="domain-setting" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>Domain Setting</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Cras id tortor vitae justo
                                vulputate aliquet. Nulla facilisi. Vestibulum ante ipsum primis in faucibus orci luctus
                                et ultrices posuere cubilia curae.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut nec sapien eget lacus
                                sollicitudin laoreet quis sit amet risus.
                            </p>
                        </section>
                        
                        <section id="linked-domain" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>How to Linked Domain</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut enim ad minima veniam,
                                quis nostrum exercitationem ullam corporis suscipit laboriosam.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nisi ut aliquid ex ea commodi
                                consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse.
                            </p>
                        </section>
                        <section id="publish-website" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>Publish Website with .lmn</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vivamus ultricies, est vitae
                                fermentum malesuada, elit sapien ullamcorper justo, at ultricies mi tortor vitae ex.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Integer vitae lectus sed magna
                                ultricies cursus nec sit amet lacus.
                            </p>
                        </section>

                        <section id="theme" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>Theme</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed consequat elit nec neque
                                gravida, a vestibulum est feugiat. Maecenas tincidunt nisl in enim tincidunt, sit amet
                                convallis libero viverra.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec in lorem non est varius
                                tincidunt quis vitae tortor.
                            </p>
                        </section>

                        <section id="font-size" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>Font Size</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aenean sit amet lectus et
                                metus dapibus fermentum. Integer dictum mi at orci pellentesque, eget consequat nibh
                                auctor.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nam ac ultrices justo. Proin
                                pellentesque, ipsum at iaculis vestibulum, ligula lectus tincidunt ligula, sed suscipit
                                tortor lorem sed massa.
                            </p>
                        </section>

                        <section id="brightness" style="scroll-margin-top: 100px; margin-bottom: 4rem;">
                            <h2>Brightness</h2>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce lacinia volutpat eros,
                                ac laoreet purus euismod vitae. Etiam in sem nec turpis iaculis pellentesque.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque feugiat tellus at
                                malesuada suscipit. Pellentesque habitant morbi tristique senectus et netus et malesuada
                                fames ac turpis egestas.
                            </p>
                        </section>

                    </article>



                    <footer class="legal-footer">
                        &copy; {{ currentYear }} Lumen Browser. Powered by Lumen Network.
                    </footer>
                </div>
            </main>

        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue';

// --- STATE ---
const currentSlug = ref('intro');

// --- DATA NAVIGATION (Sesuai Request) ---
const navigation = [
    {
        title: 'General',
        items: [
            { label: 'Introduction', slug: 'intro' },
            { label: 'What is Lumen Browser?', slug: 'what-is-lumen' },
            { label: 'Secure your Wallet', slug: 'import-export' }
        ]
    },
    {
        title: 'Drive',
        items: [
            { label: 'Upload', slug: 'upload' },
            { label: 'Cloud', slug: 'cloud' },
        ]
    },
    {
        title: 'Domain',
        items: [
            { label: 'Manage Domain', slug: 'manage-domain' },
            { label: 'Domain Setting', slug: 'domain-setting' },
            { label: 'Linked Domain', slug: 'linked-domain' },
            { label: 'Publish website with .lmn', slug: 'publish-website' },
        ]
    },
        {
        title: 'Settings',
        items: [
            { label: 'Theme', slug: 'theme' },
            { label: 'Font Size', slug: 'font-size' },
            { label: 'Brightness', slug: 'brightness' }
        ]
    }
];

// --- COMPUTED TITLE ---
const currentTitle = computed(() => {
    for (const group of navigation) {
        const found = group.items.find(i => i.slug === currentSlug.value);
        if (found) return found.label;
    }
    return 'Docs';
});

const currentYear = new Date().getFullYear();

// --- METHODS ---
// --- SCROLL SPY LOGIC ---
const isScrolling = ref(false);
let observer: IntersectionObserver | null = null;

const scrollToSlug = async (
    slug: string,
    behavior: ScrollBehavior = 'smooth',
    updateHash = false
) => {
    currentSlug.value = slug;
    isScrolling.value = true;

    await nextTick();
    const element = document.getElementById(slug);
    if (element) {
        element.scrollIntoView({ behavior, block: 'start' });
        if (updateHash) {
            history.replaceState(null, '', `#${slug}`);
        }
    }
    setTimeout(() => { isScrolling.value = false; }, 800);
};

const navigate = async (slug: string) => {
    await scrollToSlug(slug, 'smooth', true);
};

const handleHashChange = () => {
    const slug = window.location.hash.replace('#', '');
    if (slug) {
        scrollToSlug(slug, 'smooth');
    }
};

const updateSidebarOffset = () => {
    const appLayout = document.querySelector('.app-layout') as HTMLElement | null;
    if (!appLayout) return;

    const tabsHeader = document.querySelector('.tabs-header') as HTMLElement | null;
    const navBar = document.querySelector('.navbar') as HTMLElement | null;
    const topOffset = (tabsHeader?.offsetHeight ?? 0) + (navBar?.offsetHeight ?? 0);
    const fallback = 64;
    appLayout.style.setProperty('--docs-top-offset', `${Math.max(fallback, topOffset)}px`);
};

onMounted(() => {
    const root = document.querySelector('.main-wrapper');
    if (root) {
        observer = new IntersectionObserver((entries) => {
            if (isScrolling.value) return;

            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    currentSlug.value = entry.target.id;
                }
            });
        }, {
            root,
            rootMargin: '-72px 0px -70% 0px',
            threshold: 0
        });

        navigation.forEach(group => {
            group.items.forEach(item => {
                const el = document.getElementById(item.slug);
                if (el) observer?.observe(el);
            });
        });
    }

    nextTick(() => {
        const slug = window.location.hash.replace('#', '');
        if (slug) {
            scrollToSlug(slug, 'auto');
        }
    });

    nextTick(updateSidebarOffset);
    window.addEventListener('resize', updateSidebarOffset);
    window.addEventListener('hashchange', handleHashChange);
});

onUnmounted(() => {
    if (observer) observer.disconnect();
    window.removeEventListener('resize', updateSidebarOffset);
    window.removeEventListener('hashchange', handleHashChange);
});
</script>

<style scoped>
.app-layout {
    display: flex;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background-color: var(--bg-primary);
    color: var(--text-primary);
    position: relative;
    --docs-top-offset: 64px;
}

.sidebar {
    width: 260px;
    background-color: var(--bg-secondary);
    border-right: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    position: fixed;
    top: var(--docs-top-offset);
    bottom: 0;
    left: 0;
    z-index: 50;
    flex-shrink: 0;
}

:global(.dark) .sidebar {
    background-color: #161618;
    border-right-color: #2E2E32;
}

.sidebar-header {
    height: 64px;
    display: flex;
    align-items: center;
    padding: 0 1.5rem;
    border-bottom: 1px solid var(--border-light);
    flex-shrink: 0;
}

:global(.dark) .sidebar-header {
    border-bottom-color: #2E2E32;
}

.logo-box {
    width: 28px;
    height: 28px;
    background: var(--gradient-brand);
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 10px;
    font-size: 14px;
}

.brand-text {
    font-weight: 700;
    font-size: var(--fs-base);
    display: flex;
    align-items: center;
    gap: 6px;
}

.sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem 1rem;
    min-height: 0;
}

/* Nav Items */
.nav-section {
    margin-bottom: 1.5rem;
}

.nav-label {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: var(--text-tertiary);
    margin-bottom: 8px;
    padding-left: 10px;
}

.nav-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    font-size: var(--fs-sm);
    color: var(--text-secondary);
    border-radius: 6px;
    text-decoration: none;
    font-weight: 500;
    margin-bottom: 2px;
    transition: all 0.2s;
}

:global(.dark) .nav-item {
    color: #8E8E93;
}

.nav-item:hover {
    background-color: var(--hover-bg);
    color: var(--text-primary);
}

:global(.dark) .nav-item:hover {
    background-color: #2C2C2E;
    color: white;
}

.nav-item.active {
    background-color: white;
    color: var(--ios-blue);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    font-weight: 600;
}

:global(.dark) .nav-item.active {
    background-color: var(--ios-blue);
    color: white;
    box-shadow: none;
}

.active-dot {
    width: 6px;
    height: 6px;
    background: currentColor;
    border-radius: 50%;
}

.sidebar-footer {
    padding: 1rem;
    border-top: 1px solid var(--border-light);
    flex-shrink: 0;
}

:global(.dark) .sidebar-footer {
    border-top-color: #2E2E32;
}

.user-card {
    display: flex;
    align-items: center;
    gap: 10px;
}

.avatar-circle {
    width: 32px;
    height: 32px;
    background: var(--ios-gray-4);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: bold;
}

.user-info .name {
    font-size: 13px;
    font-weight: 600;
}

.user-info .role {
    font-size: 11px;
    color: var(--text-tertiary);
}

.main-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background-color: var(--bg-primary);
    position: relative;
    scroll-behavior: smooth;
    margin-left: 260px;
    width: calc(100% - 260px);
    min-height: 0;
}

:global(.dark) .main-wrapper {
    background-color: #000000;
}

.content-area {
    padding: 1.5rem 2rem;
    flex: 1;
}

article section {
    scroll-margin-top: calc(var(--docs-top-offset) + 16px);
}

.content-max-width {
    max-width: 760px;
    margin: 0 auto;
}

.page-title {
    font-size: 2.5rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: var(--text-primary);
    line-height: 1.1;
}

:global(.dark) .page-title {
    color: #FFFFFF;
}

.lead-text {
    font-size: 1.125rem;
    color: var(--text-secondary);
    line-height: 1.7;
    margin-bottom: 2.5rem;
}

:global(.dark) .lead-text {
    color: #A1A1A6;
}

article h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-top: 3rem;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-light);
    color: var(--text-primary);
}

:global(.dark) article h2 {
    border-bottom-color: #2E2E32;
    color: #FFFFFF;
}

article p {
    line-height: 1.75;
    margin-bottom: 1.5rem;
    color: var(--text-secondary);
}

:global(.dark) article p {
    color: #D1D1D6;
}

.callout {
    padding: 1.25rem;
    border-radius: 12px;
    display: flex;
    gap: 1rem;
    margin-bottom: 2rem;
    border: 1px solid transparent;
}

.callout-info {
    background: rgba(10, 132, 255, 0.1);
    border-color: rgba(10, 132, 255, 0.2);
}

:global(.dark) .callout-info {
    background: rgba(10, 132, 255, 0.15);
    border-color: rgba(10, 132, 255, 0.1);
}

.callout-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    background: var(--ios-blue);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
}

.callout-body p {
    margin: 0;
    font-size: 0.95rem;
}

.code-block {
    background: #1C1C1E;
    border: 1px solid #2C2C2E;
    border-radius: 12px;
    padding: 1.25rem;
    margin: 1.5rem 0;
    color: #fff;
    overflow-x: auto;
}

.code-header {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
}

.dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
}

.table-container {
    border: 1px solid var(--border-color);
    border-radius: 12px;
    overflow: hidden;
    margin: 2rem 0;
}

:global(.dark) .table-container {
    border-color: #2E2E32;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th {
    text-align: left;
    padding: 12px 16px;
    background: #F2F2F7;
    font-size: 12px;
    text-transform: uppercase;
    color: #636366;
    font-weight: 600;
}

:global(.dark) th {
    background: #1C1C1E;
    color: #8E8E93;
}

td {
    padding: 14px 16px;
    border-top: 1px solid var(--border-light);
    font-size: 14px;
    color: var(--text-primary);
}

:global(.dark) td {
    border-top-color: #2E2E32;
    color: #D1D1D6;
}

.code-font {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: #FF2D55;
}

:global(.dark) .code-font {
    color: #FF375F;
}

.type-text {
    color: #007AFF;
    font-size: 11px;
    border: 1px solid rgba(0, 122, 255, 0.2);
    padding: 2px 6px;
    border-radius: 4px;
}

:global(.dark) .type-text {
    color: #0A84FF;
    border-color: rgba(10, 132, 255, 0.3);
}

.legal-footer {
    margin-top: 4rem;
    text-align: center;
    color: var(--text-secondary);
    font-size: 12px;
}

::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

::-webkit-scrollbar-track {
    background: transparent;
}

::-webkit-scrollbar-thumb {
    background: #C7C7CC;
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: #AEAEB2;
}

:global(.dark) ::-webkit-scrollbar-thumb {
    background: #48484A;
}

:global(.dark) ::-webkit-scrollbar-thumb:hover {
    background: #636366;
}
</style>
