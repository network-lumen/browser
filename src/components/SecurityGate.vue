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
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import PasswordPromptModal from "./PasswordPromptModal.vue";

type LockReason = "startup" | "idle";

const passwordEnabled = ref(false);
const hasPassword = ref(false);
const sessionActive = ref(true);
const lockReason = ref<LockReason>("startup");

let everUnlocked = false;
let unsubscribeSessionChanged: null | (() => void) = null;

const mustUnlock = computed(
  () => passwordEnabled.value && hasPassword.value && !sessionActive.value,
);

const unlockMessage = computed(() => {
  if (!mustUnlock.value) return "";
  if (lockReason.value === "idle") {
    return "Session locked after 10 minutes of inactivity. Enter your password to continue.";
  }
  return "Enter your password to unlock the app.";
});

async function refreshSecurityStatus() {
  const api: any = (window as any).lumen?.security;
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

  const api: any = (window as any).lumen?.security;
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

  const api: any = (window as any).lumen?.security;
  if (api && typeof api.onSessionChanged === "function") {
    unsubscribeSessionChanged = api.onSessionChanged((payload: any) => {
      const active = !!payload?.active;
      if (active) {
        sessionActive.value = true;
        everUnlocked = true;
        lockReason.value = "startup";
        return;
      }

      if (everUnlocked) lockReason.value = "idle";
      sessionActive.value = false;
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
