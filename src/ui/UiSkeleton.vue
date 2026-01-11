<template>
  <div class="skeleton" :class="[variant, sizeClass]" :style="customStyle">
    <div class="skeleton-shimmer"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'text' | 'circle' | 'rect' | 'card';
  width?: string;
  height?: string;
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'text',
  size: 'md'
});

const sizeClass = computed(() => `skeleton-${props.size}`);

const customStyle = computed(() => {
  const style: Record<string, string> = {};
  if (props.width) style.width = props.width;
  if (props.height) style.height = props.height;
  return style;
});
</script>

<style scoped>
.skeleton {
  position: relative;
  overflow: hidden;
  background: var(--bg-tertiary, rgba(0, 0, 0, 0.05));
  border-radius: var(--border-radius-sm, 6px);
}

.skeleton-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.4) 50%,
    transparent 100%
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}

/* Variants */
.text {
  height: 14px;
  width: 100%;
  border-radius: 4px;
}

.circle {
  border-radius: 50%;
}

.rect {
  border-radius: var(--border-radius-sm, 6px);
}

.card {
  border-radius: var(--border-radius-md, 10px);
  min-height: 80px;
}

/* Sizes */
.skeleton-sm.text {
  height: 12px;
}

.skeleton-md.text {
  height: 14px;
}

.skeleton-lg.text {
  height: 18px;
}

.skeleton-sm.circle {
  width: 24px;
  height: 24px;
}

.skeleton-md.circle {
  width: 40px;
  height: 40px;
}

.skeleton-lg.circle {
  width: 64px;
  height: 64px;
}

/* Dark mode */
:root[data-theme="dark"] .skeleton {
  background: rgba(255, 255, 255, 0.08);
}

:root[data-theme="dark"] .skeleton-shimmer {
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.1) 50%,
    transparent 100%
  );
}
</style>
