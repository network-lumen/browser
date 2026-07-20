<template>
  <Transition name="sitemodal-fade">
    <div v-if="current && modalType === 'permission'" class="overlay-scrim sitemodal-overlay padding-100 z-9999" @click.stop>
      <div class="sitemodal-content bg-card border-radius-12px overflow-auto w-min-520px-92vw max-h-100vh-32px shadow-modal" @click.stop>
        <div class="sitemodal-header flex-align-center flex-justify-space-between border-bottom-default padding-87-100">
          <div class="sitemodal-title-wrapper flex-align-center gap-62">
            <div class="sitemodal-icon flex-align-justify-center border-radius-10px color-ios-blue w-34px h-34px bg-fill-blue">
              <Shield :size="18" />
            </div>
            <h3>Permission required</h3>
          </div>
          <button class="sitemodal-close border-none bg-transparent cursor-pointer color-text-primary border-radius-8px padding-25" type="button" @click="denyPermission">
            <X :size="18" />
          </button>
        </div>
        <div class="sitemodal-body padding-14px-16px-6px">
          <div class="sitemodal-info-banner border-radius-10px fs-13px color-text-primary margin-bottom-75 bg-fill-blue padding-62-75 border-width-ios-blue-a25">
            <span>
              Allow this website to open Lumen action modals?
            </span>
          </div>

          <div class="sitemodal-perm-box border-radius-10px border-default padding-62-75">
            <div class="sitemodal-perm-row flex-align-baseline flex-justify-space-between gap-75 padding-6px-0">
              <span class="sitemodal-perm-k fs-12px color-text-secondary">Site</span>
              <span class="sitemodal-perm-v mono fs-13px color-text-primary text-right overflow-hidden txt-overflow-ellipsis max-w-360px">{{ siteLabel }}</span>
            </div>
            <div class="sitemodal-perm-row flex-align-baseline flex-justify-space-between gap-75 padding-6px-0" v-if="actionKind">
              <span class="sitemodal-perm-k fs-12px color-text-secondary">Action</span>
              <span class="sitemodal-perm-v fs-13px color-text-primary text-right overflow-hidden txt-overflow-ellipsis max-w-360px">{{ actionKind }}</span>
            </div>
          </div>
        </div>
        <div class="sitemodal-actions flex flex-justify-end gap-62 padding-0 padding-top-75 padding-right-100 padding-bottom-100 padding-left-100">
          <button class="sitemodal-btn-secondary border-none border-radius-10px cursor-pointer txt-weight-light color-text-primary bg-fill-tertiary padding-62-75" type="button" @click="denyPermission">
            Deny
          </button>
          <button class="sitemodal-btn-secondary border-none border-radius-10px cursor-pointer txt-weight-light color-text-primary bg-fill-tertiary padding-62-75" type="button" @click="allowOnce">
            Allow once
          </button>
          <button class="sitemodal-btn-primary border-none border-radius-10px cursor-pointer txt-weight-light color-white bg-gradient-primary padding-62-75" type="button" @click="allowAlways">
            Always allow
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="sitemodal-fade">
    <div v-if="current && modalType === 'sendToken'" class="overlay-scrim sitemodal-overlay padding-100 z-9999" @click="closeSend(false)">
      <div class="sitemodal-content sitemodal-send bg-card border-radius-12px overflow-auto w-min-520px-92vw max-h-100vh-32px shadow-modal" @click.stop>
        <div class="sitemodal-header flex-align-center flex-justify-space-between border-bottom-default padding-87-100">
          <div class="sitemodal-title-wrapper flex-align-center gap-62">
            <div class="sitemodal-icon flex-align-justify-center border-radius-10px color-ios-blue w-34px h-34px bg-fill-blue">
              <Send :size="18" />
            </div>
            <h3>Send LMN</h3>
          </div>
          <button class="sitemodal-close border-none bg-transparent cursor-pointer color-text-primary border-radius-8px padding-25" type="button" @click="closeSend(false)" :disabled="sending">
            <X :size="18" />
          </button>
        </div>
        <div class="sitemodal-body padding-14px-16px-6px">
          <div class="sitemodal-info-banner border-radius-10px fs-13px color-text-primary margin-bottom-75 bg-fill-blue padding-62-75 border-width-ios-blue-a25" v-if="siteLabel">
            <span>Requested by <span class="mono">{{ siteLabel }}</span></span>
          </div>

          <div v-if="sendError" class="sitemodal-error border-radius-10px fs-13px color-error bg-fill-error margin-bottom-75 padding-62-75 border-width-ios-red-a25">{{ sendError }}</div>

          <div class="sitemodal-form-group">
            <label class="fs-12px color-text-secondary sitemodal-send-label block margin-bottom-25">From</label>
            <div class="sitemodal-input-wrapper readonly relative">
              <input class="sitemodal-form-input w-full border-radius-10px color-text-primary fs-14px border-default bg-card padding-62-75" type="text" :value="activeAddress || '-'" readonly />
            </div>
          </div>

          <div class="sitemodal-form-group">
            <label class="fs-12px color-text-secondary sitemodal-send-label block margin-bottom-25">To <span class="color-error">*</span></label>
            <div class="sitemodal-input-wrapper relative">
              <input class="sitemodal-form-input w-full border-radius-10px color-text-primary fs-14px border-default bg-card padding-62-75" type="text" v-model="sendTo" placeholder="lmn1..." :disabled="sending" />
            </div>
          </div>

          <div class="sitemodal-form-group">
            <label class="fs-12px color-text-secondary sitemodal-send-label block margin-bottom-25">Amount (LMN) <span class="color-error">*</span></label>
            <div class="sitemodal-input-wrapper relative">
              <input class="sitemodal-form-input w-full border-radius-10px color-text-primary fs-14px border-default bg-card padding-62-75" type="text" v-model="sendAmount" placeholder="0.000000" :disabled="sending" />
              <span class="sitemodal-input-suffix fs-12px color-text-secondary absolute top-half right-12px">LMN</span>
            </div>
            <div class="sitemodal-balance-hint fs-12px color-text-secondary margin-top-37" v-if="balanceUlmn !== null">
              Available: {{ balanceLmnDisplay }} LMN
            </div>
            <div class="sitemodal-balance-hint error fs-12px margin-top-37" v-else>
              Balance unavailable
            </div>
            <div class="sitemodal-balance-hint error fs-12px margin-top-37" v-if="insufficientFunds">
              not enough funds
            </div>
          </div>

          <div class="sitemodal-form-group">
            <label class="fs-12px color-text-secondary sitemodal-send-label block margin-bottom-25">Memo (optional)</label>
            <div class="sitemodal-input-wrapper relative">
              <input class="sitemodal-form-input w-full border-radius-10px color-text-primary fs-14px border-default bg-card padding-62-75" type="text" v-model="sendMemo" :disabled="sending" />
            </div>
          </div>
        </div>
        <div class="sitemodal-actions flex flex-justify-end gap-62 padding-0 padding-top-75 padding-right-100 padding-bottom-100 padding-left-100">
          <button class="sitemodal-btn-secondary border-none border-radius-10px cursor-pointer txt-weight-light color-text-primary bg-fill-tertiary padding-62-75" type="button" @click="closeSend(false)" :disabled="sending">
            Cancel
          </button>
          <button class="sitemodal-btn-primary border-none border-radius-10px cursor-pointer txt-weight-light color-white bg-gradient-primary padding-62-75" type="button" @click="submitSend" :disabled="!canSend">
            <span class="sitemodal-spinner border-radius-full inline-block margin-right-50 w-14px h-14px border-2-white-a50 spinner-white" v-if="sending"></span>
            <span>{{ sending ? 'Sending...' : 'Send' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="sitemodal-fade">
    <div v-if="current && modalType === 'pin'" class="overlay-scrim sitemodal-overlay padding-100 z-9999" @click="closePin(false)">
      <div class="sitemodal-content bg-card border-radius-12px overflow-auto w-min-520px-92vw max-h-100vh-32px shadow-modal" @click.stop>
        <div class="sitemodal-header flex-align-center flex-justify-space-between border-bottom-default padding-87-100">
          <div class="sitemodal-title-wrapper flex-align-center gap-62">
            <div class="sitemodal-icon flex-align-justify-center border-radius-10px color-ios-blue w-34px h-34px bg-fill-blue">
              <Save :size="18" />
            </div>
            <h3>Save to Drive</h3>
          </div>
          <button class="sitemodal-close border-none bg-transparent cursor-pointer color-text-primary border-radius-8px padding-25" type="button" @click="closePin(false)" :disabled="pinning">
            <X :size="18" />
          </button>
        </div>
        <div class="sitemodal-body padding-14px-16px-6px">
          <div class="sitemodal-info-banner border-radius-10px fs-13px color-text-primary margin-bottom-75 bg-fill-blue padding-62-75 border-width-ios-blue-a25" v-if="siteLabel">
            <span>Requested by <span class="mono">{{ siteLabel }}</span></span>
          </div>
          <div v-if="pinError" class="sitemodal-error border-radius-10px fs-13px color-error bg-fill-error margin-bottom-75 padding-62-75 border-width-ios-red-a25">{{ pinError }}</div>

          <div class="sitemodal-form-group">
            <label>Name <span class="color-error">*</span></label>
            <div class="sitemodal-input-wrapper relative">
              <input
                class="sitemodal-form-input w-full border-radius-10px color-text-primary fs-14px border-default bg-card padding-62-75"
                type="text"
                v-model="saveNameDraft"
                placeholder="Enter a name"
                :disabled="pinning"
                @keydown.enter.prevent="submitPin"
              />
            </div>
          </div>

          <div class="sitemodal-perm-box border-radius-10px border-default padding-62-75">
            <div class="sitemodal-perm-row flex-align-baseline flex-justify-space-between gap-75 padding-6px-0">
              <span class="sitemodal-perm-k fs-12px color-text-secondary">Target</span>
              <span class="sitemodal-perm-v mono fs-13px color-text-primary text-right overflow-hidden txt-overflow-ellipsis max-w-360px">{{ pinTargetDisplay }}</span>
            </div>
          </div>

          <div v-if="pinJobId" class="sitemodal-pin-progress-card border-radius-10px margin-top-75 padding-62-75 bg-ios-blue-a06 border-width-ios-blue-a18">
            <div class="sitemodal-pin-progress-head flex-align-center flex-justify-space-between gap-75 margin-bottom-50">
              <span class="sitemodal-pin-progress-status fs-12px text-uppercase txt-weight-medium color-ios-blue letter-spacing-004em">{{ pinStatusLabel }}</span>
              <span v-if="pinProgressCounter" class="sitemodal-pin-progress-counter fs-12px color-text-secondary">{{ pinProgressCounter }}</span>
            </div>
            <div class="sitemodal-pin-progress-track relative overflow-hidden border-radius-full w-full h-8px">
              <div
                class="sitemodal-pin-progress-fill h-full bg-gradient-primary"
                :class="{ indeterminate: pinProgressPercent == null && pinIsRunning }"
                :style="{ width: pinProgressPercent == null ? '100%' : `${Math.max(0, Math.min(100, pinProgressPercent))}%` }"
              ></div>
            </div>
            <div class="sitemodal-pin-progress-text fs-12px color-text-secondary margin-top-50 break-word">
                {{ pinProgressText || (pinIsRunning ? 'Saving content from the network…' : 'Waiting for action.') }}
            </div>
          </div>
        </div>
        <div class="sitemodal-actions flex flex-justify-end gap-62 padding-0 padding-top-75 padding-right-100 padding-bottom-100 padding-left-100">
          <button class="sitemodal-btn-secondary border-none border-radius-10px cursor-pointer txt-weight-light color-text-primary bg-fill-tertiary padding-62-75" type="button" @click="closePin(false)" :disabled="pinIsRunning">
            Cancel
          </button>
          <button
            v-if="pinCanPause"
            class="sitemodal-btn-secondary border-none border-radius-10px cursor-pointer txt-weight-light color-text-primary bg-fill-tertiary padding-62-75"
            type="button"
            @click="pausePinJob"
          >
            Pause
          </button>
          <button
            v-if="pinCanResume"
            class="sitemodal-btn-secondary border-none border-radius-10px cursor-pointer txt-weight-light color-text-primary bg-fill-tertiary padding-62-75"
            type="button"
            @click="resumePinJob"
          >
            Resume
          </button>
          <button
            v-if="pinCanStop"
            class="sitemodal-btn-danger badge-error border-none border-radius-10px cursor-pointer txt-weight-light padding-62-75"
            type="button"
            @click="cancelPinJob"
          >
            Stop
          </button>
          <button class="sitemodal-btn-primary border-none border-radius-10px cursor-pointer txt-weight-light color-white bg-gradient-primary padding-62-75" type="button" @click="submitPin" :disabled="pinIsRunning || !pinTarget">
            <span class="sitemodal-spinner border-radius-full inline-block margin-right-50 w-14px h-14px border-2-white-a50 spinner-white" v-if="pinning"></span>
            <span>{{ pinJobId ? (pinCanResume ? 'Resume save' : (pinIsRunning ? 'Saving...' : 'Save')) : 'Save' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="sitemodal-fade">
    <div v-if="current && modalType === 'stableLink'" class="overlay-scrim sitemodal-overlay padding-100 z-9999" @click="closeStableLink(false)">
      <div class="sitemodal-content bg-card border-radius-12px overflow-auto w-min-520px-92vw max-h-100vh-32px shadow-modal" @click.stop>
        <div class="sitemodal-header flex-align-center flex-justify-space-between border-bottom-default padding-87-100">
          <div class="sitemodal-title-wrapper flex-align-center gap-62">
            <div class="sitemodal-icon flex-align-justify-center border-radius-10px color-ios-blue w-34px h-34px bg-fill-blue">
              <Link :size="18" />
            </div>
            <h3>Choose or create a stable link for your live</h3>
          </div>
          <button class="sitemodal-close border-none bg-transparent cursor-pointer color-text-primary border-radius-8px padding-25" type="button" @click="closeStableLink(false)" :disabled="stableLinkSaving">
            <X :size="18" />
          </button>
        </div>
        <div class="sitemodal-body padding-14px-16px-6px">
          <div class="sitemodal-info-banner border-radius-10px fs-13px color-text-primary margin-bottom-75 bg-fill-blue padding-62-75 border-width-ios-blue-a25" v-if="siteLabel">
            <span>Requested by <span class="mono">{{ siteLabel }}</span></span>
          </div>
          <div v-if="stableLinkError" class="sitemodal-error border-radius-10px fs-13px color-error bg-fill-error margin-bottom-75 padding-62-75 border-width-ios-red-a25">{{ stableLinkError }}</div>

          <div class="sitemodal-segmented-control border-radius-10px grid gap-25 padding-25 margin-bottom-75 bg-fill-tertiary">
            <button type="button" class="color-text-secondary cursor-pointer txt-weight-medium sitemodal-segmented-control-button border-radius-8px padding-50-62 bg-transparent border-0" :class="{ active: stableLinkMode === 'existing' }" @click="stableLinkMode = 'existing'">
              Existing
            </button>
            <button type="button" class="color-text-secondary cursor-pointer txt-weight-medium sitemodal-segmented-control-button border-radius-8px padding-50-62 bg-transparent border-0" :class="{ active: stableLinkMode === 'create' }" @click="stableLinkMode = 'create'">
              Create new
            </button>
          </div>

          <div class="sitemodal-form-group" v-if="stableLinkMode === 'existing'">
            <label>Stable link</label>
            <div class="sitemodal-input-wrapper relative">
              <select class="sitemodal-form-input w-full border-radius-10px color-text-primary fs-14px border-default bg-card padding-62-75" v-model="stableLinkSelectedName" :disabled="stableLinkSaving || stableLinkLoading">
                <option value="">{{ stableLinkLoading ? 'Loading stable links...' : 'Select a stable link' }}</option>
                <option v-for="item in stableLinks" :key="item.name" :value="item.name">
                  {{ item.label }} — {{ shortStableIpns(item.id) }}
                </option>
              </select>
            </div>
          </div>

          <div class="sitemodal-form-group" v-else>
            <label>New stable link label</label>
            <div class="sitemodal-input-wrapper relative">
              <input
                class="sitemodal-form-input w-full border-radius-10px color-text-primary fs-14px border-default bg-card padding-62-75"
                type="text"
                v-model="stableLinkNewLabel"
                placeholder="my-live"
                :disabled="stableLinkSaving"
                @keydown.enter.prevent="submitStableLink"
              />
            </div>
          </div>

          <div class="sitemodal-perm-box border-radius-10px border-default padding-62-75">
            <div class="sitemodal-perm-row flex-align-baseline flex-justify-space-between gap-75 padding-6px-0">
              <span class="sitemodal-perm-k fs-12px color-text-secondary">Live</span>
              <span class="sitemodal-perm-v fs-13px color-text-primary text-right overflow-hidden txt-overflow-ellipsis max-w-360px">{{ stableLinkLiveTitle || 'Untitled live' }}</span>
            </div>
            <div class="sitemodal-perm-row flex-align-baseline flex-justify-space-between gap-75 padding-6px-0">
              <span class="sitemodal-perm-k fs-12px color-text-secondary">Records</span>
              <button class="sitemodal-records-toggle flex-inline-align-center border-none bg-transparent color-text-primary cursor-pointer fs-13px gap-35 padding-2px-0" type="button" @click="stableLinkRecordsExpanded = !stableLinkRecordsExpanded">
                <span class="mono">{{ stableLinkRecords.length }} record{{ stableLinkRecords.length === 1 ? '' : 's' }}</span>
                <ChevronDown :size="14" :class="{ open: stableLinkRecordsExpanded }" />
              </button>
            </div>
            <div v-if="stableLinkRecordsExpanded" class="sitemodal-records-detail-list grid gap-35 margin-top-50 padding-top-50 border-top-default">
              <div v-for="record in stableLinkRecords" :key="record.key" class="sitemodal-record-detail-row grid gap-62">
                <span class="sitemodal-record-key mono fs-12px color-text-secondary">{{ record.key }}</span>
                <span class="sitemodal-record-value mono fs-12px color-text-primary" :title="record.value">{{ record.value }}</span>
              </div>
            </div>
          </div>

          <p class="sitemodal-balance-hint fs-12px color-text-secondary margin-top-37">
            The stable link URL will be copied after it is attached to this live.
          </p>
        </div>
        <div class="sitemodal-actions flex flex-justify-end gap-62 padding-0 padding-top-75 padding-right-100 padding-bottom-100 padding-left-100">
          <button class="sitemodal-btn-secondary border-none border-radius-10px cursor-pointer txt-weight-light color-text-primary bg-fill-tertiary padding-62-75" type="button" @click="closeStableLink(false)" :disabled="stableLinkSaving">
            Cancel
          </button>
          <button class="sitemodal-btn-primary border-none border-radius-10px cursor-pointer txt-weight-light color-white bg-gradient-primary padding-62-75" type="button" @click="submitStableLink" :disabled="!canSubmitStableLink">
            <span class="sitemodal-spinner border-radius-full inline-block margin-right-50 w-14px h-14px border-2-white-a50 spinner-white" v-if="stableLinkSaving"></span>
            <Plus v-else-if="stableLinkMode === 'create'" :size="16" />
            <Save v-else :size="16" />
            <span>{{ stableLinkSaving ? 'Saving...' : (stableLinkMode === 'create' ? 'Create and copy link' : 'Use and copy link') }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="sitemodal-fade">
    <div v-if="current && modalType === 'stableLinkSetup'" class="overlay-scrim sitemodal-overlay padding-100 z-9999" @click="closeStableLinkSetup(false)">
      <div class="sitemodal-content bg-card border-radius-12px overflow-auto w-min-520px-92vw max-h-100vh-32px shadow-modal" @click.stop>
        <div class="sitemodal-header flex-align-center flex-justify-space-between border-bottom-default padding-87-100">
          <div class="sitemodal-title-wrapper flex-align-center gap-62">
            <div class="sitemodal-icon flex-align-justify-center border-radius-10px color-ios-blue w-34px h-34px bg-fill-blue">
              <Link :size="18" />
            </div>
            <h3>Select a live link</h3>
          </div>
          <button class="sitemodal-close border-none bg-transparent cursor-pointer color-text-primary border-radius-8px padding-25" type="button" @click="closeStableLinkSetup(false)" :disabled="stableLinkSetupLoading">
            <X :size="18" />
          </button>
        </div>
        <div class="sitemodal-body padding-14px-16px-6px">
          <div class="sitemodal-info-banner border-radius-10px fs-13px color-text-primary margin-bottom-75 bg-fill-blue padding-62-75 border-width-ios-blue-a25" v-if="siteLabel">
            <span>Requested by <span class="mono">{{ siteLabel }}</span></span>
          </div>
          <div v-if="stableLinkSetupError" class="sitemodal-error border-radius-10px fs-13px color-error bg-fill-error margin-bottom-75 padding-62-75 border-width-ios-red-a25">{{ stableLinkSetupError }}</div>
          <div class="sitemodal-form-group">
            <label>Live link</label>
            <div class="sitemodal-input-wrapper relative">
              <select class="sitemodal-form-input w-full border-radius-10px color-text-primary fs-14px border-default bg-card padding-62-75" v-model="stableLinkSetupSelectedName" :disabled="stableLinkSetupLoading">
                <option value="">{{ stableLinkSetupLoading ? 'Loading live links...' : 'Select a live link' }}</option>
                <option v-for="item in stableLinks" :key="item.name" :value="item.name">
                  {{ item.label }} — {{ shortStableIpns(item.id) }}
                </option>
              </select>
            </div>
          </div>
          <p class="sitemodal-balance-hint fs-12px color-text-secondary margin-top-37">
            Previous live settings will be loaded from this link if records are available.
          </p>
        </div>
        <div class="sitemodal-actions flex flex-justify-end gap-62 padding-0 padding-top-75 padding-right-100 padding-bottom-100 padding-left-100">
          <button class="sitemodal-btn-secondary border-none border-radius-10px cursor-pointer txt-weight-light color-text-primary bg-fill-tertiary padding-62-75" type="button" @click="closeStableLinkSetup(false)" :disabled="stableLinkSetupLoading">
            Cancel
          </button>
          <button class="sitemodal-btn-primary border-none border-radius-10px cursor-pointer txt-weight-light color-white bg-gradient-primary padding-62-75" type="button" @click="submitStableLinkSetup" :disabled="stableLinkSetupLoading || !stableLinkSetupSelectedName">
            <span class="sitemodal-spinner border-radius-full inline-block margin-right-50 w-14px h-14px border-2-white-a50 spinner-white" v-if="stableLinkSetupLoading"></span>
            <Link v-else :size="16" />
            <span>{{ stableLinkSetupLoading ? 'Loading...' : 'Load previous settings' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { ChevronDown, Link, Plus, Save, Send, Shield, X } from "lucide-vue-next";
import { useInternalLumen } from '../composables/useInternalLumen';

type UiReq = { id: string; type: string; data: any };

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
  } catch (e: any) {
    sendError.value = String(e?.message || e || "send_failed");
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

type DriveSavedFile = {
  cid: string;
  name: string;
  size: number;
  uploadedAt: number;
  type?: "file" | "dir";
  rootCid?: string;
  relPath?: string;
};

const DRIVE_FILES_KEY_PREFIX = "lumen:drive:files:v1";
const DRIVE_LOCAL_NAMES_KEY_PREFIX = "lumen:drive:names:v1";
const DRIVE_BACKUP_SEQ_KEY_PREFIX = "lumen:driveBackup:seq:v1";

function driveFilesStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_FILES_KEY_PREFIX}:${pid}` : `${DRIVE_FILES_KEY_PREFIX}:guest`;
}

function driveLocalNamesStorageKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_LOCAL_NAMES_KEY_PREFIX}:${pid}` : `${DRIVE_LOCAL_NAMES_KEY_PREFIX}:guest`;
}

function driveBackupSeqKey(profileId: string): string {
  const pid = String(profileId || "").trim();
  return pid ? `${DRIVE_BACKUP_SEQ_KEY_PREFIX}:${pid}` : `${DRIVE_BACKUP_SEQ_KEY_PREFIX}:guest`;
}

function nextDriveBackupSeq(profileId: string): number {
  const key = driveBackupSeqKey(profileId);
  const current = Number.parseInt(String(localStorage.getItem(key) || "0"), 10);
  const base = Number.isFinite(current) && current >= 0 ? current : 0;
  const next = base + 1;
  try {
    localStorage.setItem(key, String(next));
  } catch {}
  return next;
}

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
  if (!job || typeof job !== "object") return;
  pinJobId.value = String(job.id || "").trim();
  pinJobStatus.value = String(job.status || "").trim();
  pinProgressText.value = String(job.progressText || "").trim();
  pinProgressCurrent.value =
    job.progressCurrent == null || !Number.isFinite(Number(job.progressCurrent))
      ? null
      : Number(job.progressCurrent);
  pinProgressTotal.value =
    job.progressTotal == null || !Number.isFinite(Number(job.progressTotal))
      ? null
      : Number(job.progressTotal);
  pinProgressPercent.value =
    job.progressPercent == null || !Number.isFinite(Number(job.progressPercent))
      ? null
      : Number(job.progressPercent);
  pinProgressUnit.value = String(job.progressUnit || "").trim();
  pinning.value = ["queued", "running", "retry_waiting"].includes(
    String(job.status || "").trim().toLowerCase(),
  );
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
      try {
        const stored = localStorage.getItem(driveFilesStorageKey(pid));
        const parsed = stored ? JSON.parse(stored) : [];
        const base = Array.isArray(parsed) ? (parsed as any[]) : [];
        const filtered = base.filter((f) => String(f?.cid || "").trim() !== key);
        const next: DriveSavedFile = {
          cid: key,
          name,
          size: 0,
          uploadedAt: Date.now(),
        };
        localStorage.setItem(
          driveFilesStorageKey(pid),
          JSON.stringify([next, ...filtered].slice(0, 500)),
        );
      } catch {
        // ignore
      }
      try {
        const stored = localStorage.getItem(driveLocalNamesStorageKey(pid));
        const parsed = stored ? JSON.parse(stored) : {};
        const base = parsed && typeof parsed === "object" ? parsed : {};
        const next = { ...base, [key]: name };
        localStorage.setItem(driveLocalNamesStorageKey(pid), JSON.stringify(next));
      } catch {
        // ignore
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
  } catch (e: any) {
    pinError.value = String(e?.message || e || "save_failed");
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
  } catch (e: any) {
    pinError.value = String(e?.message || e || "save_failed");
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

type StableLinkItem = { name: string; id: string; label: string };

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

function sanitizeStableLinkLabel(input: string): string {
  return String(input || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function stableLinkKeyNameFromLabel(input: string): string {
  const label = sanitizeStableLinkLabel(input);
  return label ? `stable:${label}` : "";
}

function stableLinkDisplayName(name: string): string {
  const raw = String(name || "").trim();
  const parts = raw.split(":").map((part) => part.trim()).filter(Boolean);
  if (parts[0] === "stable" && parts.length > 1) return parts[parts.length - 1];
  return raw;
}

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

function bytesToText(data: any): string {
  if (typeof data === "string") return data;
  try {
    const bytes = data instanceof Uint8Array
      ? data
      : Array.isArray(data)
        ? new Uint8Array(data)
        : null;
    return bytes ? new TextDecoder().decode(bytes) : "";
  } catch {
    return "";
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
  } catch (e: any) {
    stableLinkError.value = String(e?.message || e || "stable_link_failed");
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
  } catch (e: any) {
    stableLinkSetupError.value = String(e?.message || e || "stable_link_setup_failed");
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
