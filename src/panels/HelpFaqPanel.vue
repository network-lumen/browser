<template>
  <!--
    The help centre's common questions.

    Recovered from the first prototype of the browser, then rewritten against
    what the code does today: that copy claimed `.lumen` names, a proof of work
    to register, a `window.lumen.identity` API and a PubSub monitor, none of
    which exist. Every answer below was checked against the chain modules or
    the app before it was written, so change the code and this together.
  -->
  <div class="flex flex-column gap-20px">
    <section class="bg-gradient-primary-a10-card border-radius-16px text-center border-default shadow-sm p-24px">
      <h2 class="color-text-primary txt-weight-strong m-0px text-28px letter-spacing-n002">
        <span class="gradient-text-clip bg-gradient-primary">{{ t('Common questions') }}</span>
      </h2>
      <p class="m-0px mt-8px color-text-secondary text-16px line-height-15">{{ t('Domains, publishing, your wallet, hosting, and building sites for Lumen') }}</p>
      <div class="flex flex-wrap-wrap flex-justify-center gap-8px mt-16px">
        <UiButton variant="secondary" size="sm" type="button" @click="jumpTo('faq-domains')">
          <Link2 :size="14" class="color-purple" />
          <span>{{ t('Domains') }}</span>
        </UiButton>
        <UiButton variant="secondary" size="sm" type="button" @click="jumpTo('faq-publishing')">
          <Rocket :size="14" class="color-primary" />
          <span>{{ t('Putting a site online') }}</span>
        </UiButton>
        <UiButton variant="secondary" size="sm" type="button" @click="jumpTo('faq-wallet')">
          <ShieldCheck :size="14" class="color-success" />
          <span>{{ t('Wallet and security') }}</span>
        </UiButton>
        <UiButton variant="secondary" size="sm" type="button" @click="jumpTo('faq-hosting')">
          <Server :size="14" class="color-warning" />
          <span>{{ t('Hosting and gateways') }}</span>
        </UiButton>
        <UiButton variant="secondary" size="sm" type="button" @click="jumpTo('faq-developers')">
          <CodeXml :size="14" class="color-text-primary" />
          <span>{{ t('For site developers') }}</span>
        </UiButton>
        <UiButton variant="secondary" size="sm" type="button" @click="jumpTo('faq-troubleshooting')">
          <LifeBuoy :size="14" class="color-error" />
          <span>{{ t('Troubleshooting') }}</span>
        </UiButton>
      </div>
    </section>

    <UiFaqSection id="faq-domains" :title="t('Domains')" icon-class="color-purple bg-purple-a15">
      <template #icon><Link2 :size="20" /></template>
      <UiFaqItem
        :question="t('How do .lmn domains work?')"
        :answer="t('A domain is an on-chain record that belongs to your wallet. Its records point to your content with a {cid}, {ipfs} or {ipns} key, and anyone who opens {url} in Lumen is sent to what they point to.', { cid: 'cid', ipfs: 'ipfs', ipns: 'ipns', url: 'lumen://yourname.lmn' })"
      >
        <template #action>
          <UiButton variant="secondary" size="sm" type="button" @click="open('lumen://domain')">
            <Link2 :size="14" />
            <span>{{ t('Open Domains') }}</span>
          </UiButton>
        </template>
      </UiFaqItem>
      <UiFaqItem
        :question="t('What happens when my domain expires?')"
        :answer="t('It enters a grace period in which only you can still renew it. After that it goes to public auction, and the highest bidder takes it once the auction is settled. Renew it from Domains before then to keep it.')"
      />
      <UiFaqItem
        :question="t('Why do I have to wait before saving my domain again?')"
        :answer="t('The chain accepts one update per domain within a short cooldown, and each update carries a small proof of work that Lumen computes for you. Registering a domain does not need one.')"
      />
      <UiFaqItem
        :question="t('What is an ugly domain?')"
        :answer="t('A free name backed by IPNS rather than the chain. Its address comes from a private key stored on your computer, so it costs nothing but is not human-readable. Export its key to keep using it on another device.')"
      />
    </UiFaqSection>

    <UiFaqSection id="faq-publishing" :title="t('Putting a site online')" icon-class="color-primary bg-fill-blue">
      <template #icon><Rocket :size="20" /></template>
      <UiFaqItem
        :question="t('How do I put my site online?')"
        :answer="t('Build a static folder with {file} at its root, upload it to Drive, then point your domain to it with a {cid} record. The step-by-step guide walks through each part.', { file: 'index.html', cid: 'cid' })"
      >
        <template #action>
          <UiButton variant="primary" size="sm" type="button" @click="open('lumen://help/publish')">
            <Rocket :size="14" />
            <span>{{ t('Publish my site') }}</span>
          </UiButton>
        </template>
      </UiFaqItem>
      <UiFaqItem
        :question="t('Can I update my site without editing my domain each time?')"
        :answer="t('Yes. Point the domain to an {ipns} name instead of a {cid}: an IPNS name keeps the same address while the content behind it changes, so each new version is published there and the domain record stays as it is.', { ipns: 'ipns', cid: 'cid' })"
      />
      <UiFaqItem
        :question="t('Does my site stay online when my computer is off?')"
        :answer="t('Content in Drive is served from your computer while Lumen is running. To keep it reachable when it is not, pin it to a gateway you subscribe to with a Cloud plan.')"
      >
        <template #action>
          <UiButton variant="secondary" size="sm" type="button" @click="open('lumen://drive')">
            <FolderOpen :size="14" />
            <span>{{ t('Open Drive') }}</span>
          </UiButton>
        </template>
      </UiFaqItem>
    </UiFaqSection>

    <UiFaqSection id="faq-wallet" :title="t('Wallet and security')" icon-class="bg-fill-success color-success">
      <template #icon><ShieldCheck :size="20" /></template>
      <UiFaqItem
        :question="t('How do I create or import a profile?')"
        :answer="t('Open the profile menu in the top bar and choose {create} or {import}. Profiles are kept apart, so you can have several side by side.', { create: t('New profile…'), import: t('Import profile…') })"
      />
      <!--
        The strongest claim on the page, and each half of it is load-bearing:
        x/pqc refuses to link a second key to an account (ErrAccountAlreadyLinked)
        and mainnet runs PQC_POLICY_REQUIRED, so an account that has linked a
        key and lost it cannot sign again - with or without its recovery phrase.
      -->
      <UiFaqItem
        :question="t('What should I back up?')"
        :answer="t('Two things. Your recovery phrase restores the wallet on any device. A profile backup, from {export} in the profile menu, also holds your post-quantum key, which the recovery phrase cannot recreate. The chain links that key to your account once and never lets it be replaced, so without it the account can no longer sign. Keep both offline and never share them.', { export: t('Export active profile…') })"
      />
      <UiFaqItem
        :question="t('Is browsing safe in Lumen?')"
        :answer="t('Websites run isolated from the app: they have no direct access to your files, web security stays on, and insecure content is blocked. A site reaches your wallet only through Lumen, and signing or sending tokens always opens a confirmation you approve or reject.')"
      />
    </UiFaqSection>

    <UiFaqSection id="faq-hosting" :title="t('Hosting and gateways')" icon-class="bg-warning-a15 color-warning">
      <template #icon><Server :size="20" /></template>
      <!--
        The refund is what x/gateways CancelContract computes: the price of
        every month not yet claimed, minus one. Said that way rather than as
        "the current month is kept", which depends on when the operator claims.
      -->
      <UiFaqItem
        :question="t('What is a Cloud plan?')"
        :answer="t('A gateway operator rents you storage and bandwidth by the month. When you subscribe, you pay into an on-chain escrow that the operator claims one month at a time. If you cancel, you get back every month not yet paid out except one.')"
      >
        <template #action>
          <UiButton variant="secondary" size="sm" type="button" @click="open('lumen://drive')">
            <FolderOpen :size="14" />
            <span>{{ t('Open Drive') }}</span>
          </UiButton>
        </template>
      </UiFaqItem>
      <UiFaqItem
        :question="t('How do I run my own gateway?')"
        :answer="t('There are two ways. In Gateways, register a public gateway on-chain with an operator address and a payout address; its server publishes the plans people can subscribe to. In My Gateways, start a private gateway on this computer and allow the wallet addresses you add to its whitelist.')"
      >
        <template #action>
          <div class="flex-align-center flex-wrap-wrap gap-8px">
            <UiButton variant="secondary" size="sm" type="button" @click="open('lumen://gateways')">
              <Globe :size="14" />
              <span>{{ t('Gateways') }}</span>
            </UiButton>
            <UiButton variant="secondary" size="sm" type="button" @click="open('lumen://my-gateways')">
              <KeyRound :size="14" />
              <span>{{ t('My Gateways') }}</span>
            </UiButton>
          </div>
        </template>
      </UiFaqItem>
    </UiFaqSection>

    <UiFaqSection id="faq-developers" :title="t('For site developers')" icon-class="color-text-primary bg-fill-tertiary">
      <template #icon><CodeXml :size="20" /></template>
      <UiFaqItem
        :question="t('How does a website talk to Lumen?')"
        :answer="t('Pages opened in Lumen get {api}, with {namespaces}. Sites built for Cosmos wallet extensions work too, through compatible {keplr} and {leap} objects.', { api: 'window.lumen', namespaces: 'profiles, wallet, dns, pubsub, siteData, stableLinks', keplr: 'window.keplr', leap: 'window.leap' })"
      >
        <template #action>
          <UiButton variant="secondary" size="sm" type="button" @click="open('lumen://help/docs')">
            <BookOpen :size="14" />
            <span>{{ t('Documentation') }}</span>
          </UiButton>
        </template>
      </UiFaqItem>
      <UiFaqItem
        :question="t('Does my site need a server?')"
        :answer="t('No. A static site is enough: data it needs to keep can live in {siteData}, a record the site publishes under its own key.', { siteData: 'window.lumen.siteData' })"
      />
    </UiFaqSection>

    <UiFaqSection id="faq-troubleshooting" :title="t('Troubleshooting')" icon-class="bg-fill-error color-error">
      <template #icon><LifeBuoy :size="20" /></template>
      <UiFaqItem
        :question="t('My domain opens nothing')"
        :answer="t('In Domains, check that its record uses the {cid}, {ipfs} or {ipns} key with the right value, and that {file} sits at the root of the uploaded folder. A record you just saved can take a minute to be picked up.', { cid: 'cid', ipfs: 'ipfs', ipns: 'ipns', file: 'index.html' })"
      />
      <UiFaqItem
        :question="t('Signing asks for my password or takes a while')"
        :answer="t('Your wallet locks after the delay chosen in Settings, and signing then asks for the password again. The first transaction of an account also links its post-quantum key, which can take a minute or two.')"
      >
        <template #action>
          <UiButton variant="secondary" size="sm" type="button" @click="open('lumen://settings')">
            <Settings :size="14" />
            <span>{{ t('Settings') }}</span>
          </UiButton>
        </template>
      </UiFaqItem>
    </UiFaqSection>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import UiButton from '../ui/UiButton.vue';
import UiFaqItem from '../ui/UiFaqItem.vue';
import UiFaqSection from '../ui/UiFaqSection.vue';
import { useTabNavigation } from '../composables/useTabNavigation';
import {
  BookOpen,
  CodeXml,
  FolderOpen,
  Globe,
  KeyRound,
  LifeBuoy,
  Link2,
  Rocket,
  Server,
  Settings,
  ShieldCheck
} from 'lucide-vue-next';

const { open } = useTabNavigation();

/** The chips at the top scroll the page to a section rather than navigating. */
function jumpTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
</script>
