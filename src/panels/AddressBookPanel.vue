<template>
  <div class="flex flex-column gap-24px w-full max-w-full">
    <UiEmptyState v-if="loading" class="mt-32px" :title="t('Loading contacts…')">
      <Users :size="32" />
    </UiEmptyState>

    <UiEmptyState
      v-else-if="!contacts.length"
      class="mt-32px"
      :title="t('No contacts yet')"
      :description="t('Add addresses you frequently send to for quick access.')"
    >
      <Users :size="32" />
      <template #actions>
        <UiButton variant="primary" @click="$emit('add')">
          <Plus :size="16" />
          <span>{{ t('Add first contact') }}</span>
        </UiButton>
      </template>
    </UiEmptyState>

    <div v-else class="grid-cols-auto-fill-300 gap-16px mt-24px grid">
      <div
        v-for="contact in contacts"
        :key="contact.id"
        class="border-radius-12px p-20px bg-card border-1 transition-all-02 hover-border-accent hover-shadow-primary"
      >
        <div class="flex-align-center gap-12px mb-12px">
          <div class="flex-align-justify-center size-48px border-radius-circle txt-weight-medium bg-gradient-primary color-white text-20px flex-shrink-0">
            {{ contact.name.charAt(0).toUpperCase() }}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-16px txt-weight-light color-text-primary m-0px mb-4px">{{ contact.name }}</h4>
            <AddressLabel :address="contact.address" tone-class="color-text-tertiary text-13px" />
          </div>
        </div>
        <p class="color-text-secondary mb-16px text-14px line-height-15" v-if="contact.note">{{ contact.note }}</p>
        <div class="flex flex-wrap-wrap gap-8px">
          <UiButton variant="secondary" @click="$emit('send', contact)">
            <Send :size="16" />
            <span>{{ t('Send') }}</span>
          </UiButton>
          <UiButton variant="secondary" @click="copyToClipboardWithToast(contact.address)">
            <Copy :size="16" />
            <span>{{ t('Copy') }}</span>
          </UiButton>
          <UiButton variant="secondary" @click="$emit('edit', contact)">
            <Edit :size="16" />
            <span>{{ t('Edit') }}</span>
          </UiButton>
          <UiButton variant="secondary" @click="$emit('delete', contact)" class="hover-bg-fill-error">
            <Trash2 :size="16" />
            <span>{{ t('Delete') }}</span>
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { t } from '../stores/i18nStore';
import { Copy, Edit, Plus, Send, Trash2, Users } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiEmptyState from '../ui/UiEmptyState.vue';
import AddressLabel from '../entities/AddressLabel.vue';
import { copyToClipboardWithToast } from '../composables/useClipboard';
import type { AddressBookContact } from '../types/walletPage';

/**
 * The saved addresses, as cards
 */
defineProps<{
  contacts: AddressBookContact[];
  loading?: boolean;
}>();

defineEmits<{
  (e: 'add'): void;
  (e: 'send', contact: AddressBookContact): void;
  (e: 'edit', contact: AddressBookContact): void;
  (e: 'delete', contact: AddressBookContact): void;
}>();
</script>
