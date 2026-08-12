<template>
  <slot />

  <PasswordPromptModal
    :visible="mustUnlock"
    :message="unlockMessage"
    :cancelable="false"
    @confirm="handleUnlockConfirm"
    @cancel="handleUnlockCancel"
  />
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { appSettingsState } from "../internal/services/appSettings";
import { getSecuritySessionTimeoutIdleText } from "../internal/services/securitySessionTimeout";
import PasswordPromptModal from "../dialogs/PasswordPromptModal.vue";
import { useInternalLumen } from '../composables/useInternalLumen';
import type { LockReason } from '../types/securityGate';

const passwordEnabled = ref(false);
const hasPassword = ref(false);
const sessionActive = ref(true);
const lockReason = ref<LockReason>("startup");

let everUnlocked = false;
let unsubscribeSessionChanged: null | (() => void) = null;

const mustUnlock = computed(
  () => passwordEnabled.value && hasPassword.value && !sessionActive.value,
);
const idleLockText = computed(() =>
  getSecuritySessionTimeoutIdleText(appSettingsState.value.securitySessionTimeoutMs),
);

const unlockMessage = computed(() => {
  if (!mustUnlock.value) return "";
  if (lockReason.value === "idle") {
    if (!idleLockText.value) {
      return t("Session locked. Enter your password to continue.");
    }
    return `Session locked after ${idleLockText.value}. Enter your password to continue.`;
  }
  return t("Enter your password to unlock the app.");
});

async function refreshSecurityStatus() {
  const api: any = useInternalLumen()?.security;
  if (!api || typeof api.getStatus !== "function") return;

  const status = await api.getStatus().catch(() => null);
  passwordEnabled.value = !!status?.passwordEnabled;
  hasPassword.value = !!status?.hasPassword;

  if (!passwordEnabled.value || !hasPassword.value) {
    sessionActive.value = true;
    return;
  }

  if (typeof api.checkSession !== "function") {
    sessionActive.value = false;
    lockReason.value = "startup";
    return;
  }

  const session = await api.checkSession().catch(() => null);
  sessionActive.value = !!session?.active;
  if (!sessionActive.value) {
    lockReason.value = everUnlocked ? "idle" : "startup";
  }
}

function handleUnlockConfirm(_password: string) {
  sessionActive.value = true;
  everUnlocked = true;
}

function handleUnlockCancel() {
  // Keep the app locked: don't allow dismissing the lock screen.
  sessionActive.value = false;
}

let lastTouchAt = 0;
const TOUCH_THROTTLE_MS = 15_000;

function touchSessionFromUserAction() {
  if (!passwordEnabled.value || !hasPassword.value) return;
  if (!sessionActive.value) return;

  const now = Date.now();
  if (now - lastTouchAt < TOUCH_THROTTLE_MS) return;
  lastTouchAt = now;

  const api: any = useInternalLumen()?.security;
  if (api && typeof api.touchSession === "function") {
    void api.touchSession().catch(() => null);
  } else if (api && typeof api.extendSession === "function") {
    void api.extendSession().catch(() => null);
  }
}

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "pointerdown",
  "keydown",
  "wheel",
  "mousemove",
  "touchstart",
];

onMounted(async () => {
  await refreshSecurityStatus();
  everUnlocked = sessionActive.value;

  const api: any = useInternalLumen()?.security;
  if (api && typeof api.onSessionChanged === "function") {
    unsubscribeSessionChanged = api.onSessionChanged((payload: any) => {
      const active = !!payload?.active;
      if (active) {
        everUnlocked = true;
        lockReason.value = "startup";
      } else if (everUnlocked) {
        lockReason.value = "idle";
      }
      // Re-fetch passwordEnabled/hasPassword too, not just sessionActive - a
      // sessionChanged broadcast also fires when password protection itself
      // was just turned off (Settings > Security > Remove Password), and
      // trusting the old cached passwordEnabled/hasPassword here would show
      // an unlock prompt for a password that no longer exists, with no way
      // to satisfy it short of fully restarting the app.
      void refreshSecurityStatus();
    });
  }

  for (const evt of ACTIVITY_EVENTS) {
    window.addEventListener(evt, touchSessionFromUserAction, { passive: true });
  }
});

onBeforeUnmount(() => {
  try {
    unsubscribeSessionChanged?.();
  } catch {}
  unsubscribeSessionChanged = null;

  for (const evt of ACTIVITY_EVENTS) {
    window.removeEventListener(evt, touchSessionFromUserAction);
  }
});
</script>
