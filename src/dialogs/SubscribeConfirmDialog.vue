<template>
  <UiModal :model-value="modelValue" :title="plan ? `Confirm subscription &quot;${planDisplayName(plan)}&quot;` : 'Confirm subscription'" panel-class="w-full max-w-520px" @update:model-value="$emit('close')">
          <p class="color-text-secondary mb-24px text-14px">
            Review the plan details and confirm your subscription.
          </p>

          <div v-if="plan">
            <div class="flex-justify-space-between text-12px">
              <span class="color-text-secondary">Gateway</span>
              <span class="fw-500 color-text-primary">
                {{ plan.gatewayName }}
                <template v-if="plan.gatewayEndpoint">
                  · {{ plan.gatewayEndpoint }}
                </template>
              </span>
            </div>
            <div class="flex-justify-space-between text-12px">
              <span class="color-text-secondary">Price / month</span>
              <span class="fw-500 color-text-primary">
                {{ formatPlanPrice(plan.priceUlmn) }}
              </span>
            </div>
            <div class="flex-justify-space-between text-12px">
              <span class="color-text-secondary">Storage</span>
              <span class="fw-500 color-text-primary">
                {{
                  plan.storageGbPerMonth
                    ? `${plan.storageGbPerMonth} GB / month`
                    : "Not specified"
                }}
              </span>
            </div>
            <div class="flex-justify-space-between text-12px">
              <span class="color-text-secondary">Egress</span>
              <span class="fw-500 color-text-primary">
                {{
                  plan.networkGbPerMonth
                    ? `${plan.networkGbPerMonth} GB / month`
                    : "Fair usage"
                }}
              </span>
            </div>
            <div class="flex-justify-space-between text-12px">
              <span class="color-text-secondary">Duration</span>
              <span class="fw-500 color-text-primary">
                {{ subscribeMonths }} month{{
                  subscribeMonths > 1 ? "s" : ""
                }}
              </span>
            </div>
            <div class="flex-justify-space-between text-12px">
              <span class="color-text-secondary">Total</span>
              <span class="fw-500 color-text-primary">
                {{
                  subscribeTotalPrice.toFixed(
                    subscribeTotalPrice >= 10 ? 0 : 2,
                  )
                }}
                LMN
              </span>
            </div>
            <div class="flex-justify-space-between text-12px">
              <span class="color-text-secondary">Balance</span>
              <span class="fw-500 color-text-primary">
                <template v-if="balance !== null">
                  {{
                    balance.toFixed(balance >= 10 ? 0 : 2)
                  }}
                  LMN
                </template>
                <template v-else-if="balanceLoading">
                  Loading...
                </template>
                <template v-else> — </template>
              </span>
            </div>
            <p
              v-if="insufficientFunds"
              class="text-11px line-height-12 color-error mt-8px"
            >
              You can't subscribe because your wallet balance is too low.
            </p>
          </div>

          <div v-if="error" class="text-11px line-height-12 color-error mt-16px">
            {{ error }}
          </div>

          <p v-if="busy" class="text-11px line-height-12 color-text-tertiary mt-4px">
            Submitting on-chain transaction… This can take ~1–2 minutes the
            first time (PQC setup + block confirmation).
          </p>
          <template #footer>
            <UiButton variant="secondary" type="button"
              @click="$emit('close')"
              :disabled="busy" class="disabled-fade-50">
              Cancel
            </UiButton>
            <UiButton variant="primary" type="button"
              @click="$emit('confirm')"
              :disabled="
                busy || insufficientFunds || !plan
              ">
              <UiSpinner v-if="busy" size="sm" />
              <span>{{ busy ? "Submitting..." : "Confirm" }}</span>
            </UiButton>
          </template>
  </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiButton from '../ui/UiButton.vue';
import UiSpinner from '../ui/UiSpinner.vue';
import type { PlanView } from '../types/drivePage';

/** Confirming a cloud plan subscription, with what it costs against what the
 * wallet holds. */
defineProps<{
  modelValue: boolean;
  plan: PlanView | null;
  planDisplayName: (plan: PlanView) => string;
  formatPlanPrice: (ulmn: number) => string;
  subscribeMonths: number;
  subscribeTotalPrice: number;
  balance: number | null;
  balanceLoading?: boolean;
  insufficientFunds?: boolean;
  busy?: boolean;
  error?: string;
}>();
defineEmits<{ (e: 'close'): void; (e: 'confirm'): void }>();
</script>