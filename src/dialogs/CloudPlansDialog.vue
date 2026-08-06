<template>
  <UiModal :model-value="modelValue" title="Cloud plans" panel-class="drivepage-plans-modal w-full max-w-860px" @update:model-value="$emit('close')">
        <div class="p-24px">

          <UiLoadingBlock v-if="plansLoading" wrapper-class="flex-column gap-12px fw-500 color-text-primary w-full align-middle min-h-220px" spinner-class="" />

          <div v-else-if="plansError">
            <p>{{ plansError }}</p>
          </div>

          <div v-else-if="!plans.length">
            <p>No plans available at the moment.</p>
          </div>

          <div v-else class="flex flex-column flex-wrap-wrap gap-12px">
             <!-- Filters -->
             <div class="flex-align-center-justify-space-between flex-column gap-12px mt-12px mb-8px pb-8px border-bottom-1">
               <div class="flex-align-center-justify-space-between gap-12px w-full flex-wrap-nowrap">
                 <div class="flex-align-center gap-12px flex-1-1-auto min-w-0 flex-wrap-nowrap">
                   <div class="flex-align-center gap-8px size-40px border-radius-10px flex-1-1-auto border-1 bg-secondary p-0px pr-12px pl-12px min-w-220px">
                     <Search :size="16" class="color-text-secondary opacity-70" />
                     <input
                       v-model.trim="planFilter"
                       type="search"
                       placeholder="Search gateways or plans"
                       class="flex-1 min-w-0 outline-none color-text-primary h-full text-14px bg-secondary border-none bg-transparent py-12px px-16px focus-outline-none focus-border-primary focus-bg-primary focus-ring focus-shadow"
                       @keydown.stop
                       aria-label="Search gateways"
                     />
                   </div>

                   <select
                     v-model="planRegion"
                     class="hover-border-accent size-40px border-radius-10px color-text-primary cursor-pointer outline-none border-1 bg-primary text-14px min-w-180px focus-border-primary focus-ring focus-outline-none focus-shadow p-0px pr-12px pl-12px"
                     aria-label="Region filter"
                   >
                     <option value="">All regions</option>
                     <option v-for="r in planRegions" :key="r" :value="r">
                       {{ r }}
                     </option>
                   </select>
                 </div>

                 <div class="flex-align-center gap-12px flex-wrap-nowrap">
                   <select
                     v-model="planSortBy"
                     class="hover-border-accent size-40px border-radius-10px color-text-primary cursor-pointer outline-none border-1 bg-primary text-14px min-w-180px focus-border-primary focus-ring focus-outline-none focus-shadow p-0px pr-12px pl-12px"
                     aria-label="Sort by"
                   >
                     <option value="score-desc">Sort: Score (high-low)</option>
                     <option value="name-asc">Sort: Name (A-Z)</option>
                     <option value="name-desc">Sort: Name (Z-A)</option>
                   </select>
                 </div>
               </div>

               <div class="flex-align-center-justify-space-between gap-12px w-full flex-justify-end flex-wrap-nowrap">
                 <UiCheckbox v-model="planOnlineOnly">Online only</UiCheckbox>
               </div>
             </div>

             <UiEmptyState v-if="!planGroups.length" title="No gateways match your filters" description="Try clearing filters or search.">
               <template #actions>
                 <UiButton variant="secondary" v-if="planFilter"
                   type="button"
                   @click="planFilter = ''">
                   Clear search
                 </UiButton>
                 <UiButton variant="secondary" v-if="hasPlanFilters"
                   type="button"
                   @click="$emit('reset-filters')">
                   Reset filters
                 </UiButton>
                 <UiButton variant="secondary" type="button" @click="$emit('retry')">
                   Reload
                 </UiButton>
               </template>
             </UiEmptyState>

             <!-- Grouped by gateway -->
             <div v-if="planGroups.length" class="flex flex-column gap-12px mt-12px">
               <article
                 v-for="group in planPagedGroups"
                 :key="group.gateway.id"
                 class="flex flex-column border-radius-10px gap-12px border-1 bg-primary py-12px px-16px shadow-md"
                 :class="{ 'is-offline': !group.gateway.active }"
               >
                <header class="flex-align-center-justify-space-between gap-8px">
                  <div class="flex-align-center gap-8px min-w-0">
                    <span
                      class="border-radius-full w-10px h-10px bg-success"
                      :class="group.gateway.active ? '' : 'bg-error'"
                    ></span>
                    <span
                      class="txt-weight-light color-text-primary text-14px truncate max-w-260px"
                      :title="gatewayDisplayName(group.gateway)"
                    >
                      {{ gatewayDisplayName(group.gateway) }}
                    </span>
                  </div>
                  <div class="flex-justify-end flex-wrap-wrap gap-y-4px gap-x-12px">
                    <span
                      v-if="group.gateway.regions.length"
                      class="flex-inline-align-center gap-6px border-radius-full text-12px color-text-secondary border-1 bg-secondary py-2px px-8px max-w-220px"
                      :title="formatRegionsTitle(group.gateway.regions)"
                    >
                      <MapPin :size="14" class="flex-0-0-auto opacity-70" />
                      <span class="truncate">{{
                        formatRegionsLabel(group.gateway.regions)
                      }}</span>
                    </span>
                    <span class="flex flex-wrap-wrap gap-8px">
                      <UiTag
                        v-for="plan in group.plans"
                        :key="plan.id + '-chip'"
                      >
                        <span class="mono">
                          {{ formatPlanPriceShort(plan.priceUlmn) }}
                        </span>
                      </UiTag>
                    </span>
                    <UiButton variant="secondary" type="button"
                      @click.stop="toggleGateway(group.gateway.id)">
                      {{
                        gatewayExpanded(group.gateway.id)
                          ? "Hide details"
                          : "Show details"
                      }}
                    </UiButton>
                  </div>
                </header>

                <div class="flex flex-column gap-12px pt-12px border-top-1">
                  <div
                    v-if="gatewayExpanded(group.gateway.id)"
                  >
                    <div
                      v-for="plan in group.plans"
                      :key="plan.id"
                      class="basis-full flex flex-column gap-8px p-16px border-radius-12px border-1 bg-secondary mb-8px"
                    >
                      <div class="flex flex-column flex-1 gap-6px">
                        <div class="flex-align-center-justify-space-between gap-8px">
                          <span class="txt-weight-light color-text-primary text-15px">{{
                            planDisplayName(plan)
                          }}</span>
                        </div>
                        <div class="color-text-secondary text-13px">
                          {{ plan.gatewayName }}
                          <template v-if="plan.gatewayEndpoint">
                            · {{ plan.gatewayEndpoint }}
                          </template>
                        </div>
                      </div>
                      <div class="flex flex-column gap-4px min-w-170px">
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
                          <span class="color-text-secondary">Price</span>
                          <span class="fw-500 color-text-primary">
                            {{ formatPlanPrice(plan.priceUlmn) }}
                          </span>
                        </div>
                      </div>
                      <div class="flex-justify-end mt-4px">
                        <UiButton variant="secondary" v-if="statusOf(plan) === 'none'"
                          type="button"
                          @click.stop="$emit('subscribe', plan)">
                          {{ planStatusLabel(statusOf(plan)) }}
                        </UiButton>
                        <span
                          v-else
                          class="border-radius-full txt-weight-light color-text-secondary text-11px bg-primary border-1 py-2px px-10px"
                          :class="planStatusBadgeClass(statusOf(plan))"
                        >
                          {{ planStatusLabel(statusOf(plan)) }}
                        </span>
                      </div>
                    </div>
                 </div>
               </div>
             </article>
           </div>

           <div v-if="planGroups.length" class="flex-align-center-justify-space-between flex-wrap-wrap gap-12px mt-16px">
             <div class="flex-align-center gap-8px">
               <span class="color-text-secondary text-13px nowrap">
                 Showing {{ planPageStart + 1 }}-{{
                   Math.min(planPageEnd, planGroups.length)
                 }}
                 of {{ planGroups.length }}
               </span>
             </div>
             <div class="flex-align-justify-center flex-wrap-wrap gap-6px">
               <UiButton variant="secondary" type="button"
                 :disabled="planPage === 1"
                 @click="planPage = 1" class="disabled-fade-50">
                 ⟪
               </UiButton>
               <UiButton variant="secondary" type="button"
                 :disabled="planPage === 1"
                 @click="planPage--" class="disabled-fade-50">
                 Prev
               </UiButton>
               <span class="color-text-secondary text-13px nowrap">
                 Page {{ planPage }} / {{ planTotalPages || 1 }}
               </span>
               <UiButton variant="secondary" type="button"
                 :disabled="planPage === planTotalPages"
                 @click="planPage++" class="disabled-fade-50">
                 Next
               </UiButton>
               <UiButton variant="secondary" type="button"
                 :disabled="planPage === planTotalPages"
                 @click="planPage = planTotalPages" class="disabled-fade-50">
                 ⟫
               </UiButton>
             </div>
             <div class="flex-align-center gap-8px">
               <select
                 v-model.number="planPageSize"
                 aria-label="Rows per page"
                 class="hover-border-accent color-text-primary cursor-pointer outline-none border-radius-8px border-1 bg-primary text-13px transition-all-fast py-8px px-10px focus-border-primary focus-ring focus-outline-none focus-shadow"
               >
                 <option :value="8">8 / page</option>
                 <option :value="16">16 / page</option>
                 <option :value="24">24 / page</option>
               </select>
             </div>
           </div>
         </div>
       </div>
   </UiModal>
</template>

<script setup lang="ts">
import UiModal from '../ui/UiModal.vue';
import UiLoadingBlock from '../ui/UiLoadingBlock.vue';
import UiEmptyState from '../ui/UiEmptyState.vue';
import UiCheckbox from '../ui/UiCheckbox.vue';
import UiButton from '../ui/UiButton.vue';
import UiTag from '../ui/UiTag.vue';
import { ref, watch } from 'vue';
import { MapPin, Search } from 'lucide-vue-next';
import {
  formatRegionsLabel,
  formatRegionsTitle,
  gatewayDisplayName,
} from '../internal/services/gateways';
import {
  formatPlanPrice,
  formatPlanPriceShort,
  planDisplayName,
  planStatusBadgeClass,
  planStatusLabel,
} from '../internal/services/plans';
import type { PlanGroup, PlanView } from '../types/drivePage';

/**
 * Browsing the cloud plans on offer, grouped by gateway.
 *
 * The filters are models rather than local state: the page also clears them,
 * and it is the page that derives the grouped and paged lists from them. So
 * this component holds the controls and shows the result, and owns neither.
 *
 * `statusOf` is the one thing still passed in, and it is the one thing that
 * cannot be worked out here: whether a plan is subscribed comes from the
 * subscriptions the page holds. Everything else about how a plan reads - its
 * name, its price, the words and colour of its badge - now comes from the
 * services, so the dialog is not asking its parent how to draw a plan card.
 */
const props = defineProps<{
  modelValue: boolean;
  plans: PlanView[];
  planGroups: PlanGroup[];
  planPagedGroups: PlanGroup[];
  planRegions: string[];
  planTotalPages: number;
  hasPlanFilters: boolean;
  statusOf: (plan: PlanView) => string;
  planPageStart: number;
  planPageEnd: number;
  plansLoading?: boolean;
  plansError?: string;
}>();
defineEmits<{
  (e: 'close'): void;
  (e: 'retry'): void;
  (e: 'reset-filters'): void;
  (e: 'subscribe', plan: PlanView): void;
}>();

/** Which gateways are showing their plans - seen nowhere but this list. */
const expandedGatewayIds = ref<Set<string>>(new Set());

function gatewayExpanded(id: string): boolean {
  return expandedGatewayIds.value.has(String(id || '').trim());
}

function toggleGateway(id: string) {
  const key = String(id || '').trim();
  if (!key) return;
  const next = new Set(expandedGatewayIds.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  expandedGatewayIds.value = next;
}

/** Open collapsed, as the page did when it held this. */
watch(
  () => props.modelValue,
  (open) => {
    if (open) expandedGatewayIds.value = new Set();
  }
);

const planFilter = defineModel<string>('planFilter', { required: true });
const planRegion = defineModel<string>('planRegion', { required: true });
const planOnlineOnly = defineModel<boolean>('planOnlineOnly', { required: true });
const planSortBy = defineModel<string>('planSortBy', { required: true });
const planPage = defineModel<number>('planPage', { required: true });
const planPageSize = defineModel<number>('planPageSize', { required: true });
</script>
