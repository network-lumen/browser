<template>
  <!-- ####### lumen://help HELP ####### -->
  <div class="internal-page flex">
    <InternalSidebar :title="t('Help')" :icon="HelpCircle" activeKey="help">
      <nav class="flex flex-column gap-12px">
        <UiSidebarNavSection :title="t('Resources')">
          <UiSidebarNavItem :active="currentView === 'discover'" @click="setView('discover')">
            <Sparkles :size="18" />
            <span>{{ t('Discover Lumen') }}</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>

        <UiSidebarNavSection :title="t('Support')">
          <UiSidebarNavItem :active="currentView === 'publish'" @click="setView('publish')">
            <Rocket :size="18" />
            <span>{{ t('Publish my site') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'contact'" @click="setView('contact')">
            <MessageCircle :size="18" />
            <span>{{ t('Support') }}</span>
          </UiSidebarNavItem>
          <UiSidebarNavItem :active="currentView === 'docs'" @click="setView('docs')">
            <BookOpen :size="18"/>
            <span>{{ t('Documentation') }}</span>
          </UiSidebarNavItem>
        </UiSidebarNavSection>
      </nav>
    </InternalSidebar>

    <!-- Main Content -->
    <main class="flex-1 flex flex-column m-0px min-w-0 overflow-hidden py-32px px-40px bg-secondary border-radius-0">
      <div v-if="currentView === 'discover'" class="flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="flex flex-column gap-20px">
          <!-- Hero Section -->
          <section class="bg-gradient-primary-a10-card p-32px border-radius-16px text-center border-default shadow-sm">
            <div class="mb-24px">
              <h2 class="color-text-primary txt-weight-strong m-0px text-28px letter-spacing-n002">{{ t('Welcome to') }} <span class="gradient-text-clip bg-gradient-primary">{{ t('Lumen') }}</span></h2>
              <p class="m-0px mt-8px color-text-secondary text-16px line-height-15">{{ t('The decentralized web browser for the next generation of internet') }}</p>
            </div>
            <div class="flex flex-wrap-wrap flex-justify-center gap-24px">
              <UiFeaturePoint icon="🌐" :title="t('Decentralized storage')" :description="t('Store and share content without central servers')" />
              <UiFeaturePoint icon="🔐" :title="t('Blockchain domains')" :description="t('Own your identity with .lmn domains')" />
              <UiFeaturePoint icon="⚡" :title="t('Secure by design')" :description="t('Encrypted connections and local-first data')" />
            </div>
          </section>

          <!-- Quick Actions -->
          <section class="flex flex-column gap-16px">
            <h3 class="color-text-primary txt-weight-medium m-0px text-16px">{{ t('Get started') }}</h3>
            <div class="gap-12px grid grid-cols-2">
              <UiActionCard :title="t('Drive')" :description="t('Upload and manage your files')" icon-class="color-primary bg-fill-blue" @click="open('lumen://drive')">
                <template #icon><FolderOpen :size="24" /></template>
              </UiActionCard>
              <UiActionCard :title="t('Domains')" :description="t('Register your .lmn domain')" icon-class="color-purple bg-purple-a15" @click="open('lumen://domain')">
                <template #icon><Link2 :size="24" /></template>
              </UiActionCard>
              <UiActionCard :title="t('Wallet')" :description="t('Manage your LMN tokens')" icon-class="bg-fill-success color-success" @click="open('lumen://wallet')">
                <template #icon><Wallet :size="24" /></template>
              </UiActionCard>
              <UiActionCard :title="t('Search')" :description="t('Discover decentralized content')" icon-class="bg-warning-a15 color-warning" @click="open('lumen://search')">
                <template #icon><Search :size="24" /></template>
              </UiActionCard>
            </div>
          </section>

        </div>
      </div>

      <!-- Publish My Site View -->
      <div v-else-if="currentView === 'publish'" class="flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="flex flex-column gap-20px">
          <!-- Hero -->
          <section class="bg-gradient-primary-a10-card border-radius-16px text-center border-default shadow-sm p-24px">
            <div class="mb-24px">
              <h2 class="color-text-primary txt-weight-strong m-0px text-28px letter-spacing-n002">{{ t('Create your') }} <span class="gradient-text-clip bg-gradient-primary">{{ t('First website') }}</span></h2>
              <p class="m-0px mt-8px color-text-secondary text-16px line-height-15">{{ t('Publish a site on the decentralized web in four simple steps — no server required.') }}</p>
            </div>
          </section>

          <div class="flex flex-column gap-16px">
            <UiTutorialStep :number="1" :title="t('Build your website')">
              {{ t('Create it like you normally would — plain HTML/CSS/JS, or the export of any static site builder. All you need is a folder with an {file} at its root.', { file: 'index.html' }) }}
            </UiTutorialStep>

            <UiTutorialStep :number="2" :title="t('Upload it to Drive')">
              {{ t("Open Drive, upload that folder, then copy its Lumen link — that's your content's address.") }}
              <template #action>
                <UiButton variant="primary" type="button" @click="open('lumen://drive')">
                  <FolderOpen :size="18" />
                  <span>{{ t('Open Drive') }}</span>
                </UiButton>
              </template>
            </UiTutorialStep>

            <UiTutorialStep :number="3" :title="t('Get a domain')">
              {{ t("Open Domains and register a name for your site, like {example}, if you don't have one yet.", { example: 'yourname.lmn' }) }}
              <template #action>
                <UiButton variant="primary" type="button" @click="open('lumen://domain')">
                  <Link2 :size="18" />
                  <span>{{ t('Open Domains') }}</span>
                </UiButton>
              </template>
            </UiTutorialStep>

            <UiTutorialStep :number="4" :title="t('Link your domain to your content')">
              {{ t('Edit your domain, then add a new record: set {keyField} to {cid} and {valueField} to the link you copied in step 2. Save.', { keyField: 'Key', cid: 'cid', valueField: 'Value' }) }}
            </UiTutorialStep>
          </div>

          <div class="color-text-primary mt-16px border-radius-14px text-14px py-12px px-16px bg-fill-blue line-height-14 border-1-primary-a15">
            <strong>{{ t("That's it — you're live.") }}</strong>
            {{ t('Visit {url} to see your site. If it still shows as unavailable, double-check that {file} sits at the root of the uploaded folder, and give it a minute to propagate.', { url: 'lumen://yourname.lmn', file: 'index.html' }) }}
          </div>
        </div>
      </div>

      <div v-else-if="currentView === 'contact'" class="flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="flex flex-column gap-20px">
          <!-- Hero -->
          <section class="bg-gradient-primary-a10-card border-radius-16px text-center border-default shadow-sm p-24px">
            <div class="mb-24px">
              <h2 class="color-text-primary txt-weight-strong m-0px text-28px letter-spacing-n002">{{ t('Get') }} <span class="gradient-text-clip bg-gradient-primary">{{ t('Help') }}</span></h2>
              <p class="m-0px mt-8px color-text-secondary text-16px line-height-15">{{ t('Connect with our community and get support') }}</p>
            </div>
          </section>

          <!-- Contact Cards -->
          <div class="gap-16px grid grid-cols-1">
            <UiActionCard
              :title="t('Discord community')"
              :description="t('Join our active community, ask questions, and get help from other users.')"
              icon-class="color-purple bg-purple-a15"
              icon-size-class="size-64px"
              card-class="gap-20px p-20px w-full"
              title-tag="h4"
              title-class="color-text-primary txt-weight-medium text-16px mb-4px"
              description-tag="p"
              description-class="color-text-secondary text-14px line-height-14"
              :arrow-size="18"
              @click="open('https://discord.gg/DwK6V9shKc', { blank: true })"
            >
              <template #icon><MessageCircle :size="28" /></template>
            </UiActionCard>

            <UiActionCard
              :title="t('GitHub')"
              :description="t('Report bugs, contribute to the codebase, or explore our open-source projects.')"
              icon-class="color-text-primary bg-fill-tertiary"
              icon-size-class="size-64px"
              card-class="gap-20px p-20px w-full"
              title-tag="h4"
              title-class="color-text-primary txt-weight-medium text-16px mb-4px"
              description-tag="p"
              description-class="color-text-secondary text-14px line-height-14"
              :arrow-size="18"
              @click="open('https://github.com/network-lumen/', { blank: true })"
            >
              <template #icon><Github :size="28" /></template>
            </UiActionCard>

            <UiActionCard
              :title="t('Official website')"
              :description="t('Visit our website for documentation, news, and updates.')"
              icon-class="color-primary bg-fill-blue"
              icon-size-class="size-64px"
              card-class="gap-20px p-20px w-full"
              title-tag="h4"
              title-class="color-text-primary txt-weight-medium text-16px mb-4px"
              description-tag="p"
              description-class="color-text-secondary text-14px line-height-14"
              :arrow-size="18"
              @click="open('lumen://lumen.lmn', { blank: true })"
            >
              <template #icon><Globe :size="28" /></template>
            </UiActionCard>
          </div>
        </div>
      </div>
      
      <div v-else-if="currentView === 'docs'" class="flex flex-column overflow-hidden flex-1 overflow-y-auto pr-4px overflow-x-hidden">
        <div class="flex flex-column gap-20px flex-1 min-h-0">
          <UiPageHeader class="flex-shrink-0" :title="getViewTitle()" :subtitle="getViewDescription()" title-size="20px" title-weight="strong" margin-class="mb-0px" />
          <iframe
            class="w-full h-full border-radius-16px block border-default shadow-sm bg-card min-h-520px"
            :src="lumenDocFrameSrc"
            :title="t('window.lumen API reference')"
            loading="lazy"
          ></iframe>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { t } from '../../stores/i18nStore';
import UiButton from '../../ui/UiButton.vue';
import UiPageHeader from '../../ui/UiPageHeader.vue';
import { computed, inject, ref, watch } from 'vue';
import type { ComputedRef } from 'vue';
import UiActionCard from '../../ui/UiActionCard.vue';
import UiTutorialStep from '../../ui/UiTutorialStep.vue';
import UiFeaturePoint from '../../ui/UiFeaturePoint.vue';
import UiSidebarNavSection from '../../ui/UiSidebarNavSection.vue';
import UiSidebarNavItem from '../../ui/UiSidebarNavItem.vue';
import { 
  HelpCircle,
  Sparkles,
  MessageCircle,
  Github,
  Globe,
  Wallet,
  Search,
  FolderOpen,
  Link2,
  BookOpen,
  Rocket
} from 'lucide-vue-next';
import InternalSidebar from '../../components/InternalSidebar.vue';
import type { HelpView } from '../../types/helpPage';

import { useTabNavigation } from '../../composables/useTabNavigation';
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

const { open, navigate } = useTabNavigation();
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
  // Domains & Drive was merged into Publish (same tutorial, kept the more complete copy).
  if (firstPath === 'domains' || firstPath === 'domain') return 'publish';
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
    if (viewParam === 'domains' || viewParam === 'domain') return 'publish';
    if (viewParam === 'publish') return 'publish';
    if (viewParam === 'contact') return 'contact';
    if (viewParam === 'docs') return 'docs';
    if (viewParam === 'getting-started' || viewParam === 'faq') return 'discover';
  } catch {}

  return 'discover';
}

function urlForView(view: HelpView): string {
  if (view === 'discover') return 'lumen://help/discover';
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
    discover: t('What is Lumen?'),
    publish: t('Publish my site'),
    contact: t('Contact support'),
    docs: t('Documentation'),
  };
  return titles[currentView.value] || 'Help';
}

function getViewDescription(): string {
  const descs: Record<string, string> = {
    discover: t('A quick overview of the Lumen stack'),
    publish: t('Go from local files to a live .lmn site'),
    contact: t('Reach out to our team'),
    docs: t('Website developer docs for window.lumen')
  };
  return descs[currentView.value] || '';
}
</script>
