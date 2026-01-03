<template>
  <div class="flex flex-column w-full h-full padding-100">
    <div class="bg-white border-radius-20px box-shadow-default padding-100 max-w-800 w-full margin-bottom-50" style="background: var(--bg-primary, white); border: 1px solid var(--border-color, #e5e7eb)">
      <h2 class="txt-md txt-weight-strong margin-bottom-25" style="color: var(--text-primary, #1e293b)">New tab</h2>
      <p class="txt-xs margin-bottom-25" style="color: var(--text-secondary, #64748b)">
        Internal page <code>lumen://newtab</code>.
      </p>
      <p class="txt-xs txt-weight-strong margin-bottom-10" style="color: var(--text-primary, #475569)">Available internal routes</p>
      <ul class="txt-xs">
        <li v-for="key in topRouteKeys" :key="key" class="margin-bottom-10">
          <button
            class="border-none bg-transparent padding-0 cursor-pointer color-blue hover-underline"
            @click="openRoute(key)"
          >
            <code>lumen://{{ key }}</code>
          </button>
          <ul v-if="key === 'home'" class="list-style-none margin-top-25 margin-left-25">
            <li v-for="child in homeChildren" :key="child" class="margin-bottom-5">
              <button
                class="border-none bg-transparent padding-0 cursor-pointer color-blue hover-underline"
                @click="openRoute(child)"
              >
                <code>lumen://{{ child }}</code>
              </button>
            </li>
          </ul>
          <ul v-if="key === 'network'" class="list-style-none margin-top-25 margin-left-25">
            <li v-for="child in networkChildren" :key="child" class="margin-bottom-5">
              <button
                class="border-none bg-transparent padding-0 cursor-pointer color-blue hover-underline"
                @click="openRoute(child)"
              >
                <code>lumen://{{ child }}</code>
              </button>
            </li>
          </ul>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, computed } from 'vue';
import { INTERNAL_ROUTE_KEYS } from '../routes';

const homeChildren = ['drive', 'wallet', 'domain'];
const networkChildren = ['explorer', 'dao', 'release'];
const HIDDEN_KEYS = ['newtab'];

const topRouteKeys = computed(() =>
  INTERNAL_ROUTE_KEYS.filter(
    (k) => !homeChildren.includes(k) && !networkChildren.includes(k) && !HIDDEN_KEYS.includes(k)
  )
);

const openInNewTab = inject<(url: string) => void>('openInNewTab');

function openRoute(key: string) {
  const url = `lumen://${key}`;
  openInNewTab?.(url);
}
</script>
