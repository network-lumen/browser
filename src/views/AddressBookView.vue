<template>
  <div class="flex flex-column gap-24px w-full max-w-full">
    <UiEmptyState v-if="loading" class="mt-32px" title="Loading contacts…">
      <Users :size="32" />
    </UiEmptyState>

    <UiEmptyState
      v-else-if="!contacts.length"
      class="mt-32px"
      title="No Contacts Yet"
      description="Add addresses you frequently send to for quick access."
    >
      <Users :size="32" />
      <template #actions>
        <UiButton variant="primary" @click="$emit('add')">
          <Plus :size="16" />
          <span>Add First Contact</span>
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
            <span>Send</span>
          </UiButton>
          <UiButton variant="secondary" @click="copyToClipboardWithToast(contact.address)">
            <Copy :size="16" />
            <span>Copy</span>
          </UiButton>
          <UiButton variant="secondary" @click="$emit('edit', contact)">
            <Edit :size="16" />
            <span>Edit</span>
          </UiButton>
          <UiButton variant="secondary" @click="$emit('delete', contact)" class="hover-bg-fill-error">
            <Trash2 :size="16" />
            <span>Delete</span>
          </UiButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Copy, Edit, Plus, Send, Trash2, Users } from 'lucide-vue-next';
import UiButton from '../ui/UiButton.vue';
import UiEmptyState from '../ui/UiEmptyState.vue';
import AddressLabel from '../entities/AddressLabel.vue';
import { copyToClipboardWithToast } from '../composables/useClipboard';
import type { AddressBookContact } from '../types/walletPage';

/**
 * The saved addresses, as cards.
 *
 * The list itself stays with the page rather than being loaded here, because
 * the send modal's contact picker reads the same one - two copies would drift
 * the moment either saved a contact.
 *
 * Sending is an emit for the same reason it could not move: it resets the send
 * form, the IBC route and the asset context before opening a modal that is the
 * page's. Copying is not, because it ends where it starts.
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
