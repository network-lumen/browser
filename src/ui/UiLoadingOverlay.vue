<template>
  <Transition name="fade">
    <div v-if="visible" class="loading-overlay">
      <div class="loading-content">
        <div class="loading-spinner">
          <div class="spinner-ring"></div>
        </div>
        <span v-if="message" class="loading-message">{{ message }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
interface Props {
  visible?: boolean;
  message?: string;
}

withDefaults(defineProps<Props>(), {
  visible: false,
  message: ''
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 99998;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 24px 32px;
  background: var(--bg-primary, #fff);
  border-radius: var(--border-radius-lg, 14px);
  box-shadow: var(--shadow-lg, 0 8px 32px rgba(0, 0, 0, 0.2));
}

.loading-spinner {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-ring {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border-secondary, rgba(0, 0, 0, 0.1));
  border-top-color: var(--ios-blue, #007aff);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-message {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #1d1d1f);
  text-align: center;
  max-width: 200px;
}

/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Dark mode */
:root[data-theme="dark"] .loading-content {
  background: rgba(44, 44, 46, 0.95);
}

:root[data-theme="dark"] .spinner-ring {
  border-color: rgba(255, 255, 255, 0.1);
  border-top-color: var(--ios-blue, #0a84ff);
}
</style>
