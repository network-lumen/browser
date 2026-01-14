<template>
  <Transition name="fade">
    <div v-if="current && modalType === 'permission'" class="modal-overlay" @click.stop>
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="modal-title-wrapper">
            <div class="modal-icon">
              <Shield :size="18" />
            </div>
            <h3>Permission required</h3>
          </div>
          <button class="modal-close" type="button" @click="denyPermission">
            <X :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <div class="info-banner">
            <span>
              Allow this website to open wallet/save modals?
            </span>
          </div>

          <div class="perm-box">
            <div class="perm-row">
              <span class="perm-k">Site</span>
              <span class="perm-v mono">{{ siteLabel }}</span>
            </div>
            <div class="perm-row" v-if="actionKind">
              <span class="perm-k">Action</span>
              <span class="perm-v">{{ actionKind }}</span>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" @click="denyPermission">
            Deny
          </button>
          <button class="btn-secondary" type="button" @click="allowOnce">
            Allow once
          </button>
          <button class="btn-primary" type="button" @click="allowAlways">
            Always allow
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="current && modalType === 'sendToken'" class="modal-overlay" @click="closeSend(false)">
      <div class="modal-content send-modal" @click.stop>
        <div class="modal-header">
          <div class="modal-title-wrapper">
            <div class="modal-icon">
              <Send :size="18" />
            </div>
            <h3>Send LMN</h3>
          </div>
          <button class="modal-close" type="button" @click="closeSend(false)" :disabled="sending">
            <X :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <div class="info-banner" v-if="siteLabel">
            <span>Requested by <span class="mono">{{ siteLabel }}</span></span>
          </div>

          <div v-if="sendError" class="modal-error">{{ sendError }}</div>

          <div class="form-group">
            <label>From</label>
            <div class="input-wrapper readonly">
              <input class="form-input" type="text" :value="activeAddress || '-'" readonly />
            </div>
          </div>

          <div class="form-group">
            <label>To <span class="required">*</span></label>
            <div class="input-wrapper">
              <input class="form-input" type="text" v-model="sendTo" placeholder="lmn1..." :disabled="sending" />
            </div>
          </div>

          <div class="form-group">
            <label>Amount (LMN) <span class="required">*</span></label>
            <div class="input-wrapper">
              <input class="form-input" type="text" v-model="sendAmount" placeholder="0.000000" :disabled="sending" />
              <span class="input-suffix">LMN</span>
            </div>
            <div class="balance-hint" v-if="balanceUlmn !== null">
              Available: {{ balanceLmnDisplay }} LMN
            </div>
            <div class="balance-hint error" v-else>
              Balance unavailable
            </div>
            <div class="balance-hint error" v-if="insufficientFunds">
              not enough funds
            </div>
          </div>

          <div class="form-group">
            <label>Memo (optional)</label>
            <div class="input-wrapper">
              <input class="form-input" type="text" v-model="sendMemo" :disabled="sending" />
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" @click="closeSend(false)" :disabled="sending">
            Cancel
          </button>
          <button class="btn-primary" type="button" @click="submitSend" :disabled="!canSend">
            <span class="spinner" v-if="sending"></span>
            <span>{{ sending ? 'Sending...' : 'Send' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="fade">
    <div v-if="current && modalType === 'pin'" class="modal-overlay" @click="closePin(false)">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div class="modal-title-wrapper">
            <div class="modal-icon">
              <Save :size="18" />
            </div>
            <h3>Save to Drive</h3>
          </div>
          <button class="modal-close" type="button" @click="closePin(false)" :disabled="pinning">
            <X :size="18" />
          </button>
        </div>
        <div class="modal-body">
          <div class="info-banner" v-if="siteLabel">
            <span>Requested by <span class="mono">{{ siteLabel }}</span></span>
          </div>
          <div v-if="pinError" class="modal-error">{{ pinError }}</div>

          <div class="form-group">
            <label>Name <span class="required">*</span></label>
            <div class="input-wrapper">
              <input
                class="form-input"
                type="text"
                v-model="saveNameDraft"
                placeholder="Enter a name"
                :disabled="pinning"
                @keydown.enter.prevent="submitPin"
              />
            </div>
          </div>

          <div class="perm-box">
            <div class="perm-row">
              <span class="perm-k">Target</span>
              <span class="perm-v mono">{{ pinTargetDisplay }}</span>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" type="button" @click="closePin(false)" :disabled="pinning">
            Cancel
          </button>
          <button class="btn-primary" type="button" @click="submitPin" :disabled="pinning || !pinTarget">
            <span class="spinner" v-if="pinning"></span>
            <span>{{ pinning ? 'Saving...' : 'Save' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Save, Send, Shield, X } from "lucide-vue-next";

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
  const api: any = (window as any).lumen;
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
  const api: any = (window as any).lumen;
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
  const api: any = (window as any).lumen;
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

const LOCAL_NAMES_KEY = "lumen_drive_saved_names";

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

function resetPinState() {
  pinning.value = false;
  pinError.value = "";
  pinTarget.value = normalizePinTarget(String(current.value?.data?.cidOrUrl || ""));
  saveNameDraft.value = String(
    current.value?.data?.name || current.value?.data?.meta?.title || "",
  ).trim();
}

async function submitPin() {
  const api: any = (window as any).lumen;
  if (!pinTarget.value) return;

  const name = String(saveNameDraft.value || "").trim();
  if (!name) {
    pinError.value = "Please enter a name.";
    return;
  }

  if (!api?.ipfsPinAdd) {
    pinError.value = "IPFS API not available.";
    return;
  }
  pinning.value = true;
  pinError.value = "";
  try {
    const res = await api.ipfsPinAdd(pinTarget.value);
    if (!res?.ok) {
      respond(res ?? { ok: false, error: "save_failed" });
      return;
    }
    const pins = Array.isArray(res?.pins) ? res.pins : Array.isArray(res?.Pins) ? res.Pins : [];
    const pinnedCid = String(res?.pinnedCid || pins?.[0] || "").trim();
    const key = pinnedCid || extractCid(pinTarget.value);
    try {
      const stored = localStorage.getItem(LOCAL_NAMES_KEY);
      const parsed = stored ? JSON.parse(stored) : {};
      const base = parsed && typeof parsed === "object" ? parsed : {};
      const next = { ...base, [key]: name };
      localStorage.setItem(LOCAL_NAMES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    respond({ ...(res || {}), ok: true, cid: key, name, target: pinTarget.value });
  } catch (e: any) {
    pinError.value = String(e?.message || e || "save_failed");
  } finally {
    pinning.value = false;
  }
}

function closePin(confirm: boolean) {
  if (pinning.value) return;
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
      return;
    }
  },
  { immediate: true },
);

onMounted(() => {
  const api: any = (window as any).lumen;
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
});

onBeforeUnmount(() => {
  try {
    unsub?.();
  } catch {}
  unsub = null;
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 9999;
}
.modal-content {
  background: white;
  border-radius: 12px;
  width: min(520px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow: auto;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
}
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.modal-title-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
}
.modal-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.12);
  color: rgb(37, 99, 235);
}
.modal-close {
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
}
.modal-close:disabled {
  opacity: 0.5;
  cursor: default;
}
.modal-body {
  padding: 14px 16px 6px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 12px 16px 16px;
}
.btn-primary,
.btn-secondary {
  border: none;
  padding: 10px 14px;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
}
.btn-primary {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: white;
}
.btn-secondary {
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
}
.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: default;
}
.info-banner {
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.25);
  color: #0f172a;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 12px;
}
.perm-box {
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  padding: 10px 12px;
}
.perm-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
}
.perm-k {
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
}
.perm-v {
  font-size: 13px;
  color: #0f172a;
  text-align: right;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.modal-error {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #991b1b;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 13px;
  margin-bottom: 12px;
}

/* Send modal bits (simple reuse-ish) */
.send-modal .form-group {
  margin-bottom: 12px;
}
.send-modal label {
  display: block;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
  margin-bottom: 6px;
}
.required {
  color: #ef4444;
}
.input-wrapper {
  position: relative;
}
.form-input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid rgba(0, 0, 0, 0.12);
  font-size: 14px;
}
.input-wrapper.readonly .form-input {
  background: rgba(15, 23, 42, 0.04);
}
.input-suffix {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: rgba(15, 23, 42, 0.6);
}
.balance-hint {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(15, 23, 42, 0.7);
}
.balance-hint.error {
  color: #991b1b;
}
.spinner {
  width: 14px;
  height: 14px;
  border-radius: 999px;
  border: 2px solid rgba(255, 255, 255, 0.5);
  border-top-color: rgba(255, 255, 255, 1);
  display: inline-block;
  margin-right: 8px;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.12s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
