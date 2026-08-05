<template>
  <UiModal :model-value="!!(current && modalType === 'permission')" panel-class="w-min-520px-92vw max-h-100vh-32px" @update:model-value="denyPermission">
    <template #header>
      <UiModalHeader title="Permission required" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Shield :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info">
            <span>
              Allow this website to open Lumen action modals?
            </span>
          </UiBanner>

          <div class="border-radius-10px border-default py-10px px-12px">
            <UiDetailRow variant="baseline" label="Site" :value="siteLabel" label-extra-class="flex-shrink-0" value-class="mono color-text-primary text-right text-13px overflow-wrap-anywhere min-w-0" />
            <UiDetailRow v-if="actionKind" variant="baseline" label="Action" :value="actionKind" />
          </div>
    <template #footer>
      <UiButton variant="secondary" type="button" @click="denyPermission">
        Deny
      </UiButton>
      <UiButton variant="secondary" type="button" @click="allowOnce">
        Allow once
      </UiButton>
      <UiButton variant="primary" type="button" @click="allowAlways">
        Always allow
      </UiButton>
    </template>
  </UiModal>

  <UiModal :model-value="!!(current && modalType === 'sendToken')" panel-class="sitemodal-send w-min-520px-92vw max-h-100vh-32px" :closable="!sending" @update:model-value="closeSend(false)">
    <template #header>
      <UiModalHeader title="Send LMN" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Send :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info" v-if="siteLabel">
            <span class="overflow-wrap-anywhere">Requested by <span class="mono">{{ siteLabel }}</span></span>
          </UiBanner>

          <UiBanner v-if="sendError" variant="error" class="mb-12px">{{ sendError }}</UiBanner>

          <UiFormGroup label="From" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input class="w-full border-radius-10px color-text-primary text-14px border-default py-10px px-12px bg-secondary" type="text" :value="activeAddress || '-'" readonly />
          </UiFormGroup>

          <UiFormGroup required label="To" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" type="text" v-model="sendTo" placeholder="lmn1..." :disabled="sending" />
          </UiFormGroup>

          <UiFormGroup required label="Amount (LMN)" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" type="text" v-model="sendAmount" placeholder="0.000000" :disabled="sending" />
            <span class="text-12px color-text-secondary absolute top-half translate-y-center right-12px">LMN</span>
            <template #hint>
              <div v-if="balanceUlmn !== null">Available: {{ balanceLmnDisplay }} LMN</div>
              <div v-else class="color-error">Balance unavailable</div>
              <div v-if="insufficientFunds" class="color-error mt-8px">not enough funds</div>
            </template>
          </UiFormGroup>

          <UiFormGroup label="Memo (optional)" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" type="text" v-model="sendMemo" :disabled="sending" />
          </UiFormGroup>
    <template #footer>
      <UiButton variant="secondary" type="button" @click="closeSend(false)" :disabled="sending">
        Cancel
      </UiButton>
      <UiButton variant="primary" type="button" @click="submitSend" :disabled="!canSend">
        <UiSpinnerRing v-if="sending" />
        <span>{{ sending ? 'Sending...' : 'Send' }}</span>
      </UiButton>
    </template>
  </UiModal>

  <UiModal :model-value="!!(current && modalType === 'pin')" panel-class="w-min-520px-92vw max-h-100vh-32px" :closable="!pinning" @update:model-value="closePin(false)">
    <template #header>
      <UiModalHeader title="Save to Drive" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Save :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info" v-if="siteLabel">
            <span class="overflow-wrap-anywhere">Requested by <span class="mono">{{ siteLabel }}</span></span>
          </UiBanner>
          <UiBanner v-if="pinError" variant="error" class="mb-12px">{{ pinError }}</UiBanner>

          <UiFormGroup required label="Name" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input
              class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px"
              type="text"
              v-model="saveNameDraft"
              placeholder="Enter a name"
              :disabled="pinning"
              @keydown.enter.prevent="submitPin"
            />
          </UiFormGroup>

          <div class="border-radius-10px border-default py-10px px-12px">
            <UiDetailRow variant="baseline" label="Target" :value="pinTargetDisplay" label-extra-class="flex-shrink-0" value-class="mono color-text-primary text-right text-13px overflow-wrap-anywhere min-w-0" />
          </div>

          <UiPinProgressCard
            v-if="pinJobId"
            :status="pinStatusLabel"
            :counter="pinProgressCounter"
            :percent="pinProgressPercent"
            :indeterminate="pinProgressPercent == null && pinIsRunning"
            :text="pinProgressText || (pinIsRunning ? 'Saving content from the network…' : 'Waiting for action.')"
          />
    <template #footer>
      <UiButton variant="secondary" type="button" @click="closePin(false)" :disabled="pinIsRunning">
        Cancel
      </UiButton>
      <UiButton variant="secondary" v-if="pinCanPause"
        type="button"
        @click="pausePinJob">
        Pause
      </UiButton>
      <UiButton variant="secondary" v-if="pinCanResume"
        type="button"
        @click="resumePinJob">
        Resume
      </UiButton>
      <UiButton variant="danger" v-if="pinCanStop"
        type="button"
        @click="cancelPinJob">
        Stop
      </UiButton>
      <UiButton variant="primary" type="button" @click="submitPin" :disabled="pinIsRunning || !pinTarget">
        <UiSpinnerRing v-if="pinning" />
        <span>{{ pinJobId ? (pinCanResume ? 'Resume save' : (pinIsRunning ? 'Saving...' : 'Save')) : 'Save' }}</span>
      </UiButton>
    </template>
  </UiModal>

  <UiModal :model-value="!!(current && modalType === 'stableLink')" panel-class="w-min-520px-92vw max-h-100vh-32px" :closable="!stableLinkSaving" @update:model-value="closeStableLink(false)">
    <template #header>
      <UiModalHeader title="Choose or create a stable link for your live" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Link :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info" v-if="siteLabel">
            <span class="overflow-wrap-anywhere">Requested by <span class="mono">{{ siteLabel }}</span></span>
          </UiBanner>
          <UiBanner v-if="stableLinkError" variant="error" class="mb-12px">{{ stableLinkError }}</UiBanner>

          <div class="border-radius-10px grid gap-4px p-4px mb-12px bg-fill-tertiary grid-cols-2-minmax0">
            <button type="button" class="color-text-secondary cursor-pointer txt-weight-medium border-radius-8px py-8px px-10px bg-transparent border-none" :class="{ 'bg-card color-text-primary shadow-sm': stableLinkMode === 'existing' }" @click="stableLinkMode = 'existing'">
              Existing
            </button>
            <button type="button" class="color-text-secondary cursor-pointer txt-weight-medium border-radius-8px py-8px px-10px bg-transparent border-none" :class="{ 'bg-card color-text-primary shadow-sm': stableLinkMode === 'create' }" @click="stableLinkMode = 'create'">
              Create new
            </button>
          </div>

          <UiFormGroup v-if="stableLinkMode === 'existing'" label="Stable link" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <select class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" v-model="stableLinkSelectedName" :disabled="stableLinkSaving || stableLinkLoading">
              <option value="">{{ stableLinkLoading ? 'Loading stable links...' : 'Select a stable link' }}</option>
              <option v-for="item in stableLinks" :key="item.name" :value="item.name">
                {{ item.label }} — {{ shortStableIpns(item.id) }}
              </option>
            </select>
          </UiFormGroup>

          <UiFormGroup v-else label="New stable link label" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <input
              class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px"
              type="text"
              v-model="stableLinkNewLabel"
              placeholder="my-live"
              :disabled="stableLinkSaving"
              @keydown.enter.prevent="submitStableLink"
            />
          </UiFormGroup>

          <div class="border-radius-10px border-default py-10px px-12px">
            <UiDetailRow variant="baseline" label="Live" :value="stableLinkLiveTitle || 'Untitled live'" />
            <UiDetailRow variant="baseline" label="Records">
              <UiButton variant="primary" type="button" @click="stableLinkRecordsExpanded = !stableLinkRecordsExpanded">
                <span class="mono">{{ stableLinkRecords.length }} record{{ stableLinkRecords.length === 1 ? '' : 's' }}</span>
                <ChevronDown :size="14" class="transition-transform-02" :class="{ 'rotate-180': stableLinkRecordsExpanded }" />
              </UiButton>
            </UiDetailRow>
            <div v-if="stableLinkRecordsExpanded" class="grid gap-6px mt-8px pt-8px border-top-default">
              <div v-for="record in stableLinkRecords" :key="record.key" class="grid gap-10px grid-cols-70-1fr align-items-start">
                <span class="mono text-12px color-text-secondary">{{ record.key }}</span>
                <span class="mono text-12px color-text-primary overflow-wrap-anywhere" :title="record.value">{{ record.value }}</span>
              </div>
            </div>
          </div>

          <p class="text-12px color-text-secondary mt-8px">
            The stable link URL will be copied after it is attached to this live.
          </p>
    <template #footer>
      <UiButton variant="secondary" type="button" @click="closeStableLink(false)" :disabled="stableLinkSaving">
        Cancel
      </UiButton>
      <UiButton variant="primary" type="button" @click="submitStableLink" :disabled="!canSubmitStableLink">
        <UiSpinnerRing v-if="stableLinkSaving" />
        <Plus v-else-if="stableLinkMode === 'create'" :size="16" />
        <Save v-else :size="16" />
        <span>{{ stableLinkSaving ? 'Saving...' : (stableLinkMode === 'create' ? 'Create and copy link' : 'Use and copy link') }}</span>
      </UiButton>
    </template>
  </UiModal>

  <UiModal :model-value="!!(current && modalType === 'stableLinkSetup')" panel-class="w-min-520px-92vw max-h-100vh-32px" :closable="!stableLinkSetupLoading" @update:model-value="closeStableLinkSetup(false)">
    <template #header>
      <UiModalHeader title="Select a live link" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><Link :size="18" /></template>
      </UiModalHeader>
    </template>
          <UiBanner variant="info" v-if="siteLabel">
            <span class="overflow-wrap-anywhere">Requested by <span class="mono">{{ siteLabel }}</span></span>
          </UiBanner>
          <UiBanner v-if="stableLinkSetupError" variant="error" class="mb-12px">{{ stableLinkSetupError }}</UiBanner>
          <UiFormGroup label="Live link" wrapper-class="mb-12px" label-class="text-12px color-text-secondary block mb-4px">
            <select class="w-full border-radius-10px color-text-primary text-14px border-default bg-card py-10px px-12px" v-model="stableLinkSetupSelectedName" :disabled="stableLinkSetupLoading">
              <option value="">{{ stableLinkSetupLoading ? 'Loading live links...' : 'Select a live link' }}</option>
              <option v-for="item in stableLinks" :key="item.name" :value="item.name">
                {{ item.label }} — {{ shortStableIpns(item.id) }}
              </option>
            </select>
          </UiFormGroup>
          <p class="text-12px color-text-secondary mt-8px">
            Previous live settings will be loaded from this link if records are available.
          </p>
    <template #footer>
      <UiButton variant="secondary" type="button" @click="closeStableLinkSetup(false)" :disabled="stableLinkSetupLoading">
        Cancel
      </UiButton>
      <UiButton variant="primary" type="button" @click="submitStableLinkSetup" :disabled="stableLinkSetupLoading || !stableLinkSetupSelectedName">
        <UiSpinnerRing v-if="stableLinkSetupLoading" />
        <Link v-else :size="16" />
        <span>{{ stableLinkSetupLoading ? 'Loading...' : 'Load previous settings' }}</span>
      </UiButton>
    </template>
  </UiModal>

  <UiModal :model-value="!!(current && modalType === 'siteDataKeyExport')" panel-class="w-min-520px-92vw max-h-100vh-32px" @update:model-value="closeKeyExport">
    <template #header>
      <UiModalHeader title="Export this site identity" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><KeyRound :size="18" /></template>
      </UiModalHeader>
    </template>
    <UiBanner variant="info" v-if="siteLabel">
      <span class="overflow-wrap-anywhere">Requested by <span class="mono">{{ siteLabel }}</span></span>
    </UiBanner>
    <UiBanner variant="warning" class="mt-12px">
      <span class="overflow-wrap-anywhere">
        This downloads the <strong>private key</strong> of your identity on this site — the key to the vault.
        Anyone who holds that file <strong>is you</strong> on this site, permanently: an identity key cannot be
        revoked or reissued. Keep it like a password, and never send it to anyone.
      </span>
    </UiBanner>
    <UiDetailRow v-if="keyFlowIpnsName" label="Identity" :flex="true" class="mt-12px">
      <span class="mono text-12px overflow-wrap-anywhere">{{ keyFlowIpnsName }}</span>
    </UiDetailRow>
    <p class="text-12px color-text-secondary mt-8px">
      You choose where the file is saved. The page never receives the key itself.
    </p>
    <template #footer>
      <UiButton variant="secondary" type="button" @click="closeKeyExport">Cancel</UiButton>
      <UiButton variant="primary" type="button" @click="confirmKeyExport">
        <KeyRound :size="16" />
        <span>Choose a location and export</span>
      </UiButton>
    </template>
  </UiModal>

  <UiModal :model-value="!!(current && modalType === 'siteDataKeyImport')" panel-class="w-min-520px-92vw max-h-100vh-32px" @update:model-value="closeKeyImport">
    <template #header>
      <UiModalHeader title="Restore an identity on this site" badge-class="w-32px h-32px bg-fill-blue color-primary" gap-class="gap-10px">
        <template #icon><KeyRound :size="18" /></template>
      </UiModalHeader>
    </template>
    <UiBanner variant="info" v-if="siteLabel">
      <span class="overflow-wrap-anywhere">Requested by <span class="mono">{{ siteLabel }}</span></span>
    </UiBanner>
    <UiBanner variant="warning" class="mt-12px" v-if="keyFlowHasExisting">
      <span class="overflow-wrap-anywhere">
        This site already has an identity. Importing a key file <strong>replaces it</strong>: from now on this
        site publishes as the imported identity, and the current one stops being used here.
      </span>
    </UiBanner>
    <UiDetailRow v-if="keyFlowIpnsName" label="Current identity" :flex="true" class="mt-12px">
      <span class="mono text-12px overflow-wrap-anywhere">{{ keyFlowIpnsName }}</span>
    </UiDetailRow>
    <label v-if="keyFlowHasExisting" class="flex flex-inline-align-center gap-8px mt-12px cursor-pointer">
      <input type="checkbox" v-model="keyImportBackupFirst" />
      <span class="text-13px color-text-primary">
        Save the identity I'm about to replace to my computer first, so I can restore it later
      </span>
    </label>
    <p class="text-12px color-text-secondary mt-8px">
      You pick the key file yourself — the page cannot choose it or read it.
    </p>
    <template #footer>
      <UiButton variant="secondary" type="button" @click="closeKeyImport">Cancel</UiButton>
      <UiButton variant="primary" type="button" @click="confirmKeyImport">
        <KeyRound :size="16" />
        <span>{{ keyImportBackupFirst && keyFlowHasExisting ? 'Save current, then choose a key' : 'Choose a key file' }}</span>
      </UiButton>
    </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiButton from '../ui/UiButton.vue';
import UiModal from '../ui/UiModal.vue';
import UiFormGroup from '../ui/UiFormGroup.vue';
import UiBanner from '../ui/UiBanner.vue';
import UiModalHeader from '../ui/UiModalHeader.vue';
import UiDetailRow from '../ui/UiDetailRow.vue';
import UiSpinnerRing from '../ui/UiSpinnerRing.vue';
import UiPinProgressCard from '../ui/UiPinProgressCard.vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ChevronDown, KeyRound, Link, Plus, Save, Send, Shield } from "lucide-vue-next";
import { useInternalLumen } from '../composables/useInternalLumen';
import { bytesToText, errorMessage } from '../internal/services/coerce';
import { readPinJobSnapshot } from '../internal/services/pinJobs';
import { sanitizeStableLinkLabel, stableLinkDisplayName, stableLinkKeyNameFromLabel } from '../internal/services/stableLinks';
import {
  driveFilesKey,
  driveLocalNamesKey,
  nextDriveBackupSeq
} from '../internal/services/driveStorage';
import { readJson, writeJson } from '../internal/services/storage';
import type { UiReq, StableLinkItem } from '../types/lumenSiteModalHost';
import type { DriveSavedFile } from '../types/driveSavedFile';

const queue = ref<UiReq[]>([]);
let unsub: null | (() => void) = null;

const current = computed(() => (queue.value.length ? queue.value[0] : null));
const modalType = computed(() => String(current.value?.type || ""));

const siteLabel = computed(() => {
  const key = String(current.value?.data?.siteKey || "");
  if (!key) return "";
  if (key.startsWith("ipfs:")) return `lumen://ipfs/${key.slice("ipfs:".length)}`;
  if (key.startsWith("ipns:")) return `lumen://ipns/${key.slice("ipns:".length)}`;
  if (key.startsWith("domain:")) return `lumen://${key.slice("domain:".length)}`;
  return key;
});

const actionKind = computed(() => String(current.value?.data?.actionKind || ""));

function respond(payload: any) {
  const api: any = useInternalLumen();
  const id = String(current.value?.id || "");
  if (!api?.lumenSite?.respondUiRequest || !id) {
    queue.value.shift();
    return;
  }
  try {
    api.lumenSite.respondUiRequest(id, payload ?? null);
  } catch {
    // ignore
  } finally {
    queue.value.shift();
  }
}

// Identity key export/import. Both modals are pure consent: they carry no key
// material and do no work themselves - the main process owns the file dialogs
// and the keystore, and only ever hears back whether the user agreed.
const keyImportBackupFirst = ref(true);

const keyFlowIpnsName = computed(() => String(current.value?.data?.ipnsName || ""));
const keyFlowHasExisting = computed(() => !!current.value?.data?.hasExisting);

function closeKeyExport() {
  respond({ ok: false, error: "user_cancelled" });
}
function confirmKeyExport() {
  respond({ ok: true, confirm: true });
}
function closeKeyImport() {
  respond({ ok: false, error: "user_cancelled" });
}
function confirmKeyImport() {
  respond({ ok: true, confirm: true, backupFirst: keyImportBackupFirst.value && keyFlowHasExisting.value });
}

function denyPermission() {
  respond({ ok: true, decision: "deny" });
}
function allowOnce() {
  respond({ ok: true, decision: "once" });
}
function allowAlways() {
  respond({ ok: true, decision: "always" });
}

// Send token modal state
const sending = ref(false);
const sendError = ref("");
const activeProfileId = ref("");
const activeAddress = ref("");
const balanceUlmn = ref<bigint | null>(null);
const sendTo = ref("");
const sendAmount = ref("");
const sendMemo = ref("");

function parseUlmnString(s: string): bigint {
  const raw = String(s || "").trim().replace(/[,_\s]/g, "");
  if (!raw) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function parseLmnToUlmn(amount: string): bigint | null {
  const raw = String(amount || "").trim().replace(",", ".");
  if (!raw) return null;
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;
  const [whole, fracRaw = ""] = raw.split(".");
  const frac = (fracRaw + "000000").slice(0, 6);
  try {
    return BigInt(whole) * 1000000n + BigInt(frac);
  } catch {
    return null;
  }
}

function formatUlmnToLmn(ulmn: bigint): string {
  const whole = ulmn / 1000000n;
  const frac = ulmn % 1000000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(6, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
}

const balanceLmnDisplay = computed(() =>
  balanceUlmn.value == null ? "-" : formatUlmnToLmn(balanceUlmn.value),
);

const amountUlmn = computed(() => parseLmnToUlmn(sendAmount.value));
const insufficientFunds = computed(() => {
  if (balanceUlmn.value == null) return false;
  if (amountUlmn.value == null) return false;
  return amountUlmn.value > balanceUlmn.value;
});

const canSend = computed(() => {
  if (sending.value) return false;
  if (!activeProfileId.value || !activeAddress.value) return false;
  if (balanceUlmn.value == null) return false;
  if (!sendTo.value.trim()) return false;
  if (amountUlmn.value == null || amountUlmn.value <= 0n) return false;
  if (amountUlmn.value > balanceUlmn.value) return false;
  return true;
});

async function loadActiveWalletContext() {
  const api: any = useInternalLumen();
  activeProfileId.value = "";
  activeAddress.value = "";
  balanceUlmn.value = null;
  if (!api?.profiles?.getActive) return;
  try {
    const prof = await api.profiles.getActive();
    activeProfileId.value = String(prof?.id || prof?.profileId || "");
    activeAddress.value = String(prof?.address || prof?.walletAddress || "");
  } catch {
    // ignore
  }
  if (!activeAddress.value || !api?.wallet?.getBalance) return;
  try {
    const res = await api.wallet.getBalance(activeAddress.value, { denom: "ulmn" });
    const amt = String(res?.balance?.amount || "0");
    balanceUlmn.value = parseUlmnString(amt);
  } catch {
    balanceUlmn.value = null;
  }
}

function resetSendState() {
  sending.value = false;
  sendError.value = "";
  sendTo.value = String(current.value?.data?.defaults?.to || "");
  sendMemo.value = String(current.value?.data?.defaults?.memo || "");
  const defaultAmount = current.value?.data?.defaults?.amountLmn;
  sendAmount.value =
    typeof defaultAmount === "number" && Number.isFinite(defaultAmount) && defaultAmount > 0
      ? String(defaultAmount)
      : "";
}

async function submitSend() {
  if (!current.value) return;
  if (!canSend.value) return;
  const api: any = useInternalLumen();
  if (!api?.wallet?.sendTokens) {
    sendError.value = "Wallet API not available.";
    return;
  }
  sending.value = true;
  sendError.value = "";
  try {
    const amountLmn = Number(String(sendAmount.value).replace(",", "."));
    const res = await api.wallet.sendTokens({
      profileId: activeProfileId.value,
      from: activeAddress.value,
      to: sendTo.value.trim(),
      amount: amountLmn,
      denom: "ulmn",
      memo: sendMemo.value
    });
    respond(res ?? { ok: false, error: "send_failed" });
  } catch (e) {
    sendError.value = errorMessage(e, "send_failed");
  } finally {
    sending.value = false;
  }
}

function closeSend(confirm: boolean) {
  if (sending.value) return;
  if (!confirm) respond({ ok: false, error: "user_cancelled" });
}

// Pin modal state
const pinning = ref(false);
const pinError = ref("");
const pinTarget = ref("");
const saveNameDraft = ref("");
const pinJobId = ref("");
const pinJobStatus = ref("");
const pinProgressText = ref("");
const pinProgressCurrent = ref<number | null>(null);
const pinProgressTotal = ref<number | null>(null);
const pinProgressPercent = ref<number | null>(null);
const pinProgressUnit = ref("");
const pinWaitJobId = ref("");
let unsubPinProgress: null | (() => void) = null;

function extractCid(cidOrUrl: string): string {
  const raw = String(cidOrUrl || "").trim();
  if (!raw) return "";
  const lumen = raw.replace(/^lumen:\/\//i, "");
  let m = lumen.match(/^ipfs\/([^/?#]+)/i);
  if (m && m[1]) return m[1];
  m = lumen.match(/^ipns\/([^/?#]+)/i);
  if (m && m[1]) return m[1];
  m = raw.match(/^\/ipfs\/([^/?#]+)/i);
  if (m && m[1]) return m[1];
  m = raw.match(/^\/ipns\/([^/?#]+)/i);
  if (m && m[1]) return m[1];
  // Assume raw is a CID itself.
  return raw;
}

function normalizePinTarget(cidOrUrl: string): string {
  const raw = String(cidOrUrl || "").trim();
  if (!raw) return "";

  const lumen = raw.replace(/^lumen:\/\//i, "");
  if (/^(ipfs|ipns)\//i.test(lumen)) return "/" + lumen.replace(/^\/+/, "");

  if (/^\/(ipfs|ipns)\//i.test(raw)) return raw;
  if (/^(ipfs|ipns)\//i.test(raw)) return "/" + raw.replace(/^\/+/, "");

  try {
    const u = new URL(raw);
    const m = u.pathname.match(/\/(ipfs|ipns)\/.+/i);
    if (m && m[0]) return m[0];
  } catch {
    // ignore
  }

  return raw;
}

function formatMiddleEllipsis(s: string, head = 28, tail = 34): string {
  const v = String(s || "");
  if (v.length <= head + tail + 3) return v;
  return v.slice(0, head) + "…" + v.slice(-tail);
}

const pinTargetDisplay = computed(() => {
  const t = String(pinTarget.value || "").trim();
  if (!t) return "";
  if (t.startsWith("/ipfs/")) return formatMiddleEllipsis(`lumen://ipfs/${t.slice("/ipfs/".length)}`);
  if (t.startsWith("/ipns/")) return formatMiddleEllipsis(`lumen://ipns/${t.slice("/ipns/".length)}`);
  return formatMiddleEllipsis(t);
});

const pinIsRunning = computed(() =>
  ["queued", "running", "retry_waiting"].includes(String(pinJobStatus.value || "").trim().toLowerCase()),
);
const pinCanPause = computed(() => !!pinJobId.value && pinIsRunning.value);
const pinCanResume = computed(() =>
  !!pinJobId.value && ["paused", "failed"].includes(String(pinJobStatus.value || "").trim().toLowerCase()),
);
const pinCanStop = computed(() =>
  !!pinJobId.value &&
  !["completed", "cancelled"].includes(String(pinJobStatus.value || "").trim().toLowerCase()),
);
const pinStatusLabel = computed(() => {
  const status = String(pinJobStatus.value || "").trim().toLowerCase();
  if (status === "queued") return "Queued";
  if (status === "running") return "Saving";
  if (status === "retry_waiting") return "Retrying";
  if (status === "paused") return "Paused";
  if (status === "failed") return "Failed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Stopped";
  return pinning.value ? "Saving" : "Idle";
});
const pinProgressCounter = computed(() => {
  const current =
    pinProgressCurrent.value != null && Number.isFinite(pinProgressCurrent.value)
      ? String(pinProgressCurrent.value)
      : "";
  const total =
    pinProgressTotal.value != null && Number.isFinite(pinProgressTotal.value)
      ? String(pinProgressTotal.value)
      : "";
  const unit = String(pinProgressUnit.value || "").trim();
  if (current && total) return `${current}/${total}${unit ? ` ${unit}` : ""}`;
  if (current) return `${current}${unit ? ` ${unit}` : ""}`;
  if (pinProgressPercent.value != null && Number.isFinite(pinProgressPercent.value)) {
    return `${pinProgressPercent.value.toFixed(0)}%`;
  }
  return "";
});

function clearPinJobState() {
  pinJobId.value = "";
  pinJobStatus.value = "";
  pinProgressText.value = "";
  pinProgressCurrent.value = null;
  pinProgressTotal.value = null;
  pinProgressPercent.value = null;
  pinProgressUnit.value = "";
  pinWaitJobId.value = "";
}

function applyPinJobSnapshot(job: any) {
  const snapshot = readPinJobSnapshot(job);
  if (!snapshot) return;
  pinJobId.value = snapshot.id;
  pinJobStatus.value = snapshot.status;
  pinProgressText.value = snapshot.progressText;
  pinProgressCurrent.value = snapshot.progressCurrent;
  pinProgressTotal.value = snapshot.progressTotal;
  pinProgressPercent.value = snapshot.progressPercent;
  pinProgressUnit.value = snapshot.progressUnit;
  pinning.value = snapshot.active;
}

function resetPinState() {
  pinning.value = false;
  pinError.value = "";
  pinTarget.value = normalizePinTarget(String(current.value?.data?.cidOrUrl || ""));
  saveNameDraft.value = String(
    current.value?.data?.name || current.value?.data?.meta?.title || "",
  ).trim();
  clearPinJobState();
}

async function waitForPinCompletion(jobId: string) {
  const api: any = useInternalLumen();
  const id = String(jobId || "").trim();
  if (!id || pinWaitJobId.value === id) return;
  pinWaitJobId.value = id;
  try {
    const res = await api?.ipfsPinWait?.(id, { timeoutMs: 0 });
    if (pinWaitJobId.value !== id) return;
    if (res?.job) applyPinJobSnapshot(res.job);

    if (res?.ok && res?.job) {
      const pinnedCid = String(res?.job?.pinnedCid || "").trim();
      const key = pinnedCid || extractCid(pinTarget.value);
      const name = String(saveNameDraft.value || "").trim();
      const pid = String(activeProfileId.value || "").trim() || "default";
      {
        const parsed = readJson<unknown>(driveFilesKey(pid), []);
        const base = Array.isArray(parsed) ? (parsed as any[]) : [];
        const filtered = base.filter((f) => String(f?.cid || "").trim() !== key);
        const next: DriveSavedFile = {
          cid: key,
          name,
          size: 0,
          uploadedAt: Date.now(),
        };
        writeJson(driveFilesKey(pid), [next, ...filtered].slice(0, 500));
      }
      {
        const parsed = readJson<unknown>(driveLocalNamesKey(pid), {});
        const base = parsed && typeof parsed === "object" ? parsed : {};
        writeJson(driveLocalNamesKey(pid), { ...base, [key]: name });
      }
      try {
        nextDriveBackupSeq(pid);
      } catch {}
      try {
        window.dispatchEvent(
          new CustomEvent("lumen:drive:updated", {
            detail: { profileId: pid, cid: key, name },
          }),
        );
      } catch {
        // ignore
      }
      respond({ ...(res || {}), ok: true, cid: key, name, target: pinTarget.value });
      return;
    }

    if (res?.cancelled || String(res?.error || "").trim().toLowerCase() === "user_cancelled") {
      respond({ ok: false, error: "user_cancelled", cancelled: true, job: res?.job || null });
      return;
    }

    pinError.value = String(res?.error || "save_failed");
    pinning.value = false;
  } catch (e) {
    pinError.value = errorMessage(e, "save_failed");
    pinning.value = false;
  } finally {
    if (pinWaitJobId.value === id) pinWaitJobId.value = "";
  }
}

async function submitPin() {
  const api: any = useInternalLumen();
  if (!pinTarget.value || pinIsRunning.value) return;

  const name = String(saveNameDraft.value || "").trim();
  if (!name) {
    pinError.value = "Please enter a name.";
    return;
  }

  if (!api?.ipfsPinStart || !api?.ipfsPinWait) {
    pinError.value = "IPFS API not available.";
    return;
  }
  pinning.value = true;
  pinError.value = "";
  try {
    const res = await api.ipfsPinStart({ cidOrPath: pinTarget.value, name });
    if (!res?.ok || !res?.job?.id) {
      pinError.value = String(res?.error || "save_failed");
      pinning.value = false;
      return;
    }
    applyPinJobSnapshot(res.job);
    void waitForPinCompletion(String(res.job.id || ""));
  } catch (e) {
    pinError.value = errorMessage(e, "save_failed");
    pinning.value = false;
  }
}

async function pausePinJob() {
  const api: any = useInternalLumen();
  if (!pinJobId.value || !api?.ipfsPinPause) return;
  const res = await api.ipfsPinPause(pinJobId.value).catch(() => null);
  if (res?.job) applyPinJobSnapshot(res.job);
}

async function resumePinJob() {
  const api: any = useInternalLumen();
  if (!pinJobId.value || !api?.ipfsPinResume) return;
  pinError.value = "";
  const res = await api.ipfsPinResume(pinJobId.value).catch(() => null);
  if (res?.job) {
    applyPinJobSnapshot(res.job);
    void waitForPinCompletion(String(res.job.id || ""));
    return;
  }
  if (res?.error) pinError.value = String(res.error);
}

async function cancelPinJob() {
  const api: any = useInternalLumen();
  if (!pinJobId.value || !api?.ipfsPinCancel) return;
  const res = await api.ipfsPinCancel(pinJobId.value).catch(() => null);
  if (res?.job) applyPinJobSnapshot(res.job);
}

function closePin(confirm: boolean) {
  if (pinIsRunning.value) return;
  if (!confirm) respond({ ok: false, error: "user_cancelled" });
}

const stableLinkLoading = ref(false);
const stableLinkSaving = ref(false);
const stableLinkError = ref("");
const stableLinkMode = ref<"existing" | "create">("existing");
const stableLinkSelectedName = ref("");
const stableLinkNewLabel = ref("");
const stableLinks = ref<StableLinkItem[]>([]);
const stableLinkRecordsExpanded = ref(false);
const stableLinkSetupLoading = ref(false);
const stableLinkSetupError = ref("");
const stableLinkSetupSelectedName = ref("");

const stableLinkRecords = computed(() => {
  const records = Array.isArray(current.value?.data?.records) ? current.value?.data?.records : [];
  return records
    .map((record: any) => ({
      key: String(record?.key || "").trim(),
      value: String(record?.value || "").trim(),
    }))
    .filter((record: { key: string; value: string }) => record.key && record.value);
});

const stableLinkLiveTitle = computed(() => String(current.value?.data?.title || "").trim());

const canSubmitStableLink = computed(() => {
  if (stableLinkSaving.value) return false;
  if (!stableLinkRecords.value.length) return false;
  if (stableLinkMode.value === "existing") return !!stableLinkSelectedName.value;
  return !!sanitizeStableLinkLabel(stableLinkNewLabel.value);
});


function shortStableIpns(id: string): string {
  const s = String(id || "").trim();
  if (s.length <= 16) return s || "-";
  return `${s.slice(0, 8)}…${s.slice(-6)}`;
}

function defaultStableLiveLabel(): string {
  const suggested = sanitizeStableLinkLabel(String(current.value?.data?.suggestedName || ""));
  if (suggested) return suggested;
  const title = sanitizeStableLinkLabel(stableLinkLiveTitle.value);
  return title || `live-${Date.now().toString(36)}`;
}

async function loadStableLinksForModal() {
  const api: any = useInternalLumen();
  stableLinkLoading.value = true;
  stableLinks.value = [];
  try {
    const res = await api?.ipfsKeyList?.();
    const keys = Array.isArray(res?.keys) ? res.keys : [];
    stableLinks.value = keys
      .map((key: any) => {
        const name = String(key?.Name || key?.name || "").trim();
        const id = String(key?.Id || key?.id || "").trim();
        return { name, id, label: stableLinkDisplayName(name) };
      })
      .filter((item: StableLinkItem) => item.name.startsWith("stable:"))
      .sort((a: StableLinkItem, b: StableLinkItem) => a.label.localeCompare(b.label));
    stableLinkSelectedName.value = stableLinks.value[0]?.name || "";
    if (!stableLinks.value.length) stableLinkMode.value = "create";
  } finally {
    stableLinkLoading.value = false;
  }
}

function normalizeSetupRecords(input: any): Array<{ key: string; value: string }> {
  const raw = Array.isArray(input)
    ? input
    : Array.isArray(input?.records)
      ? input.records
      : input && typeof input === "object"
        ? Object.entries(input).map(([key, value]) => ({ key, value }))
        : [];
  return raw
    .map((record: any) => ({
      key: String(record?.key || "").trim(),
      value: String(record?.value ?? "").trim(),
    }))
    .filter((record: { key: string; value: string }) => record.key && record.value);
}

function setupRecordsMap(records: Array<{ key: string; value: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const record of records) {
    const key = String(record?.key || "").trim();
    if (key) out[key] = String(record?.value ?? "").trim();
  }
  const site = String(out.site || "");
  const queryIndex = site.indexOf("?");
  if (queryIndex >= 0) {
    const query = site.slice(queryIndex + 1).split("#")[0] || "";
    const params = new URLSearchParams(query);
    ["title", "description", "tags", "audioSource", "imageCid", "offlineImageCid"].forEach((key) => {
      if (!out[key] && params.get(key)) out[key] = String(params.get(key) || "");
    });
  }
  return out;
}

function normalizeIpfsCid(value: any): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const lumenMatch = raw.match(/^lumen:\/\/ipfs\/([^/?#]+)/i);
  if (lumenMatch) return lumenMatch[1] || "";
  const ipfsMatch = raw.match(/^\/?ipfs\/([^/?#]+)/i);
  if (ipfsMatch) return ipfsMatch[1] || "";
  return raw.split(/[/?#]/)[0] || raw;
}

async function loadStableLinkSetupRecords(ipnsName: string) {
  const api: any = useInternalLumen();
  const resolved = await api?.ipfsResolveIPNS?.(ipnsName).catch(() => null);
  const path = String(resolved?.path || "");
  const m = path.match(/\/ipfs\/([^/]+)/i);
  const cid = String(m?.[1] || "").trim();
  if (!cid) return [];
  const got = await api?.ipfsGet?.(`/ipfs/${cid}`, { timeoutMs: 8000 }).catch(() => null);
  if (!got?.ok) return [];
  const text = bytesToText(got.data);
  if (!text) return [];
  try {
    return normalizeSetupRecords(JSON.parse(text));
  } catch {
    return [];
  }
}

async function loadStableLinkSetupImage(cidRaw: string) {
  const cid = normalizeIpfsCid(cidRaw);
  if (!cid) return null;
  const api: any = useInternalLumen();
  const got = await api?.ipfsGet?.(`/ipfs/${cid}`, { timeoutMs: 8000 }).catch(() => null);
  if (!got?.ok) return { cid, name: "", type: "" };
  const text = bytesToText(got.data);
  if (!text) return { cid, name: "", type: "" };
  try {
    const payload = JSON.parse(text);
    return {
      cid,
      name: String(payload?.name || ""),
      type: String(payload?.type || ""),
      imageDataUrl: String(payload?.imageDataUrl || ""),
    };
  } catch {
    return { cid, name: "", type: "" };
  }
}

async function loadStableLinkSetupImages(records: Array<{ key: string; value: string }>) {
  const values = setupRecordsMap(records);
  const [cover, offline] = await Promise.all([
    loadStableLinkSetupImage(values.imageCid),
    loadStableLinkSetupImage(values.offlineImageCid),
  ]);
  return {
    imageCid: cover,
    offlineImageCid: offline,
  };
}

async function loadStableLinksForSetup() {
  await loadStableLinksForModal();
  stableLinkSetupSelectedName.value = stableLinks.value[0]?.name || "";
}

function resetStableLinkState() {
  stableLinkError.value = "";
  stableLinkSaving.value = false;
  stableLinkMode.value = "existing";
  stableLinkSelectedName.value = "";
  stableLinkNewLabel.value = defaultStableLiveLabel();
  stableLinkRecordsExpanded.value = false;
  void loadStableLinksForModal();
}

function resetStableLinkSetupState() {
  stableLinkSetupError.value = "";
  stableLinkSetupLoading.value = false;
  stableLinkSetupSelectedName.value = "";
  void loadStableLinksForSetup();
}

async function publishStableLinkRecords(keyName: string) {
  const api: any = useInternalLumen();
  const body = JSON.stringify({
    lumenRecordsVersion: 1,
    type: "lumen.stable-link.records",
    updatedAt: new Date().toISOString(),
    records: stableLinkRecords.value,
  }, null, 2);
  const bodyBytes = Array.from(new TextEncoder().encode(body));
  const add = await api?.ipfsAdd?.(bodyBytes, `${stableLinkDisplayName(keyName) || "stable-link"}.lumen-records.json`);
  if (!add?.ok || !add.cid) return { ok: false, error: add?.error || "ipfs_add_failed" };
  const published = await api?.ipfsPublishToIPNS?.(add.cid, keyName, { timeoutMs: 60000 });
  if (!published?.ok) return { ok: false, error: published?.error || "ipns_publish_failed" };
  return { ok: true };
}

async function submitStableLink() {
  if (!canSubmitStableLink.value) return;
  const api: any = useInternalLumen();
  stableLinkSaving.value = true;
  stableLinkError.value = "";
  try {
    let keyName = "";
    let ipnsName = "";
    if (stableLinkMode.value === "create") {
      keyName = stableLinkKeyNameFromLabel(stableLinkNewLabel.value);
      const created = await api?.ipfsKeyGen?.(keyName);
      if (!created?.ok) {
        stableLinkError.value = String(created?.error || "Could not create stable link.");
        return;
      }
      keyName = String(created.name || keyName);
      ipnsName = String(created.id || "");
    } else {
      keyName = String(stableLinkSelectedName.value || "").trim();
      const existing = stableLinks.value.find((item) => item.name === keyName);
      ipnsName = String(existing?.id || "");
    }

    const saved = await publishStableLinkRecords(keyName);
    if (!saved.ok) {
      stableLinkError.value = String(saved.error || "Could not attach live records.");
      return;
    }

    if (!ipnsName) {
      await loadStableLinksForModal();
      ipnsName = String(stableLinks.value.find((item) => item.name === keyName)?.id || "");
    }
    const url = ipnsName ? `lumen://ipns/${ipnsName}/` : "";
    if (url && api?.clipboardWriteText) await api.clipboardWriteText(url).catch(() => null);
    respond({ ok: true, url, keyName, ipnsName, copied: !!url });
  } catch (e) {
    stableLinkError.value = errorMessage(e, "stable_link_failed");
  } finally {
    stableLinkSaving.value = false;
  }
}

function closeStableLink(confirm: boolean) {
  if (stableLinkSaving.value) return;
  if (!confirm) respond({ ok: false, error: "user_cancelled" });
}

async function submitStableLinkSetup() {
  const keyName = String(stableLinkSetupSelectedName.value || "").trim();
  if (!keyName) return;
  stableLinkSetupLoading.value = true;
  stableLinkSetupError.value = "";
  try {
    const selected = stableLinks.value.find((item) => item.name === keyName);
    if (!selected?.id) {
      stableLinkSetupError.value = "Select a live link first.";
      return;
    }
    const records = await loadStableLinkSetupRecords(selected.id);
    const imagePreviews = await loadStableLinkSetupImages(records);
    respond({
      ok: true,
      keyName,
      ipnsName: selected.id,
      url: `lumen://ipns/${selected.id}/`,
      records,
      imagePreviews,
    });
  } catch (e) {
    stableLinkSetupError.value = errorMessage(e, "stable_link_setup_failed");
  } finally {
    stableLinkSetupLoading.value = false;
  }
}

function closeStableLinkSetup(confirm: boolean) {
  if (stableLinkSetupLoading.value) return;
  if (!confirm) respond({ ok: false, error: "user_cancelled" });
}

watch(
  () => current.value?.id,
  async (id) => {
    if (!id) return;
    if (modalType.value === "sendToken") {
      resetSendState();
      await loadActiveWalletContext();
      return;
    }
    if (modalType.value === "pin") {
      resetPinState();
      await loadActiveWalletContext();
      return;
    }
    if (modalType.value === "stableLink") {
      resetStableLinkState();
      return;
    }
    if (modalType.value === "stableLinkSetup") {
      resetStableLinkSetupState();
      return;
    }
    if (modalType.value === "siteDataKeyImport") {
      // Back to ticked for every request: unticking is a per-import decision,
      // and the safe default should never be inherited from a previous one.
      keyImportBackupFirst.value = true;
      return;
    }
  },
  { immediate: true },
);

onMounted(() => {
  const api: any = useInternalLumen();
  if (!api?.lumenSite?.onUiRequest) return;
  try {
    unsub = api.lumenSite.onUiRequest((payload: any) => {
      const id = String(payload?.id || "");
      const type = String(payload?.type || "");
      if (!id || !type) return;
      queue.value.push({ id, type, data: payload?.data ?? null });
    });
  } catch {
    // ignore
  }
  try {
    if (api?.ipfsOnPinProgress) {
      unsubPinProgress = api.ipfsOnPinProgress((payload: any) => {
        const job = payload?.job || null;
        if (!job || String(job.id || "") !== String(pinJobId.value || "")) return;
        applyPinJobSnapshot(job);
      });
    }
  } catch {
    // ignore
  }
});

onBeforeUnmount(() => {
  try {
    unsub?.();
  } catch {}
  unsub = null;
  try {
    unsubPinProgress?.();
  } catch {}
  unsubPinProgress = null;
});
</script>
