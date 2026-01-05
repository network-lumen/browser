<template>
  <div class="gateways-page">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo-icon">
          <Server :size="24" />
        </div>
        <span class="logo-text">Gateways</span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <span class="nav-label">Manage</span>
          <button
            class="nav-item"
            :class="{ active: currentView === 'list' }"
            @click="currentView = 'list'"
          >
            <List :size="18" />
            <span>Gateway plans</span>
          </button>
          <button
            class="nav-item"
            :class="{ active: currentView === 'add' }"
            @click="currentView = 'add'"
          >
            <Plus :size="18" />
            <span>Advanced</span>
          </button>
        </div>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <!-- Header -->
      <header class="content-header">
        <div>
          <h1>{{ getViewTitle() }}</h1>
          <p>{{ getViewDescription() }}</p>
        </div>
        <button
          v-if="currentView === 'list'"
          class="btn-primary"
          @click="refreshPlans"
          :disabled="loading"
        >
          <span v-if="!loading">Refresh</span>
          <span v-else>Loading…</span>
        </button>
      </header>

      <!-- List View: on-chain gateway plans -->
      <div v-if="currentView === 'list'" class="content-area">
        <div v-if="!hasProfile" class="empty-state-card">
          <h2 class="empty-title">No active profile</h2>
          <p class="empty-sub">
            Select or create a profile to view gateway plans.
          </p>
        </div>

        <div v-else-if="loading" class="empty-state-card">
          <div class="spinner"></div>
          <p class="empty-sub">Loading available gateway plans…</p>
        </div>

        <div v-else-if="error" class="empty-state-card">
          <h2 class="empty-title">Unable to load plans</h2>
          <p class="empty-sub">{{ error }}</p>
          <button class="btn-secondary" @click="refreshPlans">Try again</button>
        </div>

        <div v-else-if="!plans.length" class="empty-state-card">
          <h2 class="empty-title">No plans found</h2>
          <p class="empty-sub">
            Gateways have not published plans yet. Check back later.
          </p>
        </div>

        <div v-else class="gateways-list">
          <div
            v-for="plan in plans"
            :key="plan.id"
            class="gateway-card"
            :class="{ default: planStatus(plan) === 'active' }"
          >
            <div
              class="gateway-status"
              :class="{
                online:
                  planStatus(plan) === 'active' ||
                  planStatus(plan) === 'pending'
              }"
            ></div>
            <div class="gateway-info">
              <div class="gateway-header">
                <span class="gateway-name">{{ planDisplayName(plan) }}</span>
                <span
                  v-if="planStatus(plan) !== 'none'"
                  class="gateway-badge"
                  :class="statusClass(planStatus(plan))"
                >
                  {{ planStatusLabel(plan) }}
                </span>
              </div>
              <span class="gateway-url">
                {{ plan.gatewayName }}
                <template v-if="plan.gatewayEndpoint">
                  · {{ plan.gatewayEndpoint }}
                </template>
              </span>
              <div class="gateway-stats">
                <span class="stat">
                  Storage:
                  <strong>
                    {{
                      plan.storageGbPerMonth
                        ? `${plan.storageGbPerMonth} GB / month`
                        : 'Not specified'
                    }}
                  </strong>
                </span>
                <span class="stat">
                  Egress:
                  <strong>
                    {{
                      plan.networkGbPerMonth
                        ? `${plan.networkGbPerMonth} GB / month`
                        : 'Fair usage'
                    }}
                  </strong>
                </span>
                <span class="stat">
                  Price:
                  <strong>{{ formatPrice(plan.priceUlmn) }}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced / placeholder view -->
      <div v-else-if="currentView === 'add'" class="content-area">
        <div class="empty-state-card">
          <h2 class="empty-title">Advanced gateway configuration</h2>
          <p class="empty-sub">
            Custom gateway management will be available in a future update.
          </p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Server, List, Plus } from 'lucide-vue-next';

const currentView = ref<'list' | 'add'>('list');

type PlanView = {
  id: string;
  planId: string;
  gatewayId: string;
  gatewayName: string;
  gatewayEndpoint?: string;
  priceUlmn: number;
  priceLabel?: string;
  storageGbPerMonth?: number;
  networkGbPerMonth?: number;
  monthsTotal: number;
  description?: string;
};

type SubscriptionView = {
  id: string;
  gatewayId: string;
  status: string;
  metadata?: Record<string, any>;
  nextPayoutTime?: number;
  startTime?: number;
  raw?: any;
};

const plans = ref<PlanView[]>([]);
const subscriptions = ref<SubscriptionView[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

const activeProfileId = ref<string>('');
const hasProfile = computed(() => !!activeProfileId.value);

async function resolveActiveProfile() {
  try {
    const api: any = (window as any).lumen;
    const profilesApi = api?.profiles;
    if (!profilesApi) {
      activeProfileId.value = '';
      return;
    }
    const active = await profilesApi.getActive?.().catch(() => null);
    activeProfileId.value = active?.id || '';
  } catch {
    activeProfileId.value = '';
  }
}

async function loadPlansOverview() {
  loading.value = true;
  error.value = null;
  plans.value = [];
  subscriptions.value = [];

  try {
    const api: any = (window as any).lumen;
    const gwApi = api?.gateway;
    if (!gwApi || !gwApi.getPlansOverview) {
      error.value = 'Gateway plans API unavailable.';
      return;
    }
    if (!hasProfile.value) {
      return;
    }

    const res: any = await gwApi
      .getPlansOverview(activeProfileId.value)
      .catch(() => null);
    if (!res || res.ok === false) {
      error.value = String(res?.error || 'Unable to load plans.');
      return;
    }

    const list = Array.isArray(res.plans) ? res.plans : [];
    plans.value = list
      .map((p: any) => ({
        id: String(p?.id ?? ''),
        planId: String(p?.planId ?? p?.id ?? ''),
        gatewayId: String(p?.gatewayId ?? ''),
        gatewayName: String(
          p?.gatewayName ?? p?.gateway ?? `Gateway ${p?.gatewayId ?? ''}`
        ),
        gatewayEndpoint: p?.gatewayEndpoint,
        priceUlmn: Number(p?.priceUlmn ?? 0),
        priceLabel: p?.priceLabel,
        storageGbPerMonth:
          p?.storageGbPerMonth != null
            ? Number(p.storageGbPerMonth)
            : undefined,
        networkGbPerMonth:
          p?.networkGbPerMonth != null
            ? Number(p.networkGbPerMonth)
            : undefined,
        monthsTotal: Math.max(1, Number(p?.monthsTotal ?? 1)),
        description: p?.description ?? '',
      }))
      .filter((p: PlanView) => p.planId && p.gatewayId);

    const subsRaw = Array.isArray(res.subscriptions) ? res.subscriptions : [];
    subscriptions.value = subsRaw.map((s: any) => ({
      id: String(s?.id ?? ''),
      gatewayId: String(s?.gatewayId ?? s?.gateway_id ?? ''),
      status: String(s?.status ?? '').toLowerCase(),
      metadata:
        typeof s?.metadata === 'object'
          ? s.metadata
          : undefined,
      nextPayoutTime:
        typeof s?.nextPayoutTime === 'number'
          ? s.nextPayoutTime
          : typeof s?.nextPayout_time === 'number'
          ? s.nextPayout_time
          : undefined,
      startTime:
        typeof s?.startTime === 'number'
          ? s.startTime
          : typeof s?.start_time === 'number'
          ? s.start_time
          : undefined,
      raw: s,
    }));
  } catch (e: any) {
    error.value = e?.message || 'Unable to load plans.';
  } finally {
    loading.value = false;
  }
}

function refreshPlans() {
  void loadPlansOverview();
}

function getViewTitle(): string {
  return currentView.value === 'list' ? 'Gateway plans' : 'Advanced gateway';
}

function getViewDescription(): string {
  return currentView.value === 'list'
    ? 'View on-chain storage plans published by gateways.'
    : 'Custom gateway management (coming soon).';
}

function planKey(plan: PlanView): string {
  return `${plan.gatewayId}:${plan.planId}`.toLowerCase();
}

function subscriptionMap() {
  const map = new Map<string, SubscriptionView[]>();
  for (const sub of subscriptions.value) {
    const metaPlanId = String(sub.metadata?.planId ?? '').toLowerCase();
    const key = metaPlanId
      ? `${sub.gatewayId}:${metaPlanId}`.toLowerCase()
      : `${sub.gatewayId}`.toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(sub);
  }
  return map;
}

const planSubscriptions = computed(() => subscriptionMap());

function planStatus(plan: PlanView): string {
  const key = planKey(plan);
  const candidates = planSubscriptions.value.get(key);
  if (candidates && candidates.length) {
    const active = candidates.find((s) => s.status === 'active');
    if (active) return 'active';
    const pending = candidates.find((s) => s.status === 'pending');
    if (pending) return 'pending';
    return candidates[0].status || 'unknown';
  }
  const fallback = planSubscriptions.value.get(plan.gatewayId.toLowerCase());
  if (fallback && fallback.length) return fallback[0].status || 'unknown';
  return 'none';
}

function planStatusLabel(plan: PlanView): string {
  const status = planStatus(plan);
  switch (status) {
    case 'active':
      return 'Subscribed';
    case 'pending':
      return 'Pending';
    case 'cancelled':
    case 'canceled':
      return 'Cancelled';
    case 'completed':
      return 'Completed';
    default:
      return 'Not subscribed';
  }
}

function statusClass(status: string): string {
  if (status === 'active') return 'badge-success';
  if (status === 'pending') return 'badge-warn';
  return '';
}

function planDisplayName(plan: PlanView): string {
  return plan.planId?.split(':').pop() || 'Plan';
}

function formatPrice(ulmn: number): string {
  const lmn = ulmn / 1_000_000;
  if (!ulmn) return 'Free';
  return `${lmn.toFixed(lmn >= 10 ? 0 : 2)} LMN / mo`;
}

onMounted(async () => {
  await resolveActiveProfile();
  await loadPlansOverview();
});
</script>

<style scoped>
.gateways-page {
  display: flex;
  height: 100vh;
  min-height: 100vh;
  background: var(--bg-tertiary, #f0f2f5);
  overflow: hidden;
}

.sidebar {
  width: 260px;
  min-width: 260px;
  max-width: 260px;
  background: var(--bg-primary, #ffffff);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  color: #1a1a2e;
  border-right: 2px solid var(--border-color, #e2e8f0);
}

.sidebar-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem;
  margin-bottom: 1.5rem;
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 12px;
  background: var(--gradient-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.logo-text {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-tertiary, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 1rem;
  margin-bottom: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border: none;
  background: transparent;
  border-radius: 10px;
  cursor: pointer;
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  transition: all 0.2s ease;
}

.nav-item:hover {
  background: var(--hover-bg, #f1f5f9);
  color: var(--text-primary, #1e293b);
}

.nav-item.active {
  background: var(--gradient-primary);
  color: white;
  box-shadow: 0 4px 12px var(--primary-a30);
}

.main-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 2rem 2.5rem;
  background: var(--bg-primary, #ffffff);
}

.content-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
}

.content-header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--text-primary, #1e293b);
  margin: 0;
}

.content-header p {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0.25rem 0 0;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--gradient-primary);
  border: none;
  border-radius: 10px;
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--primary-a30);
}

.btn-secondary {
  padding: 0.5rem 1rem;
  background: var(--hover-bg, #f1f5f9);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 8px;
  font-size: 0.8rem;
  color: var(--text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: var(--border-color, #e2e8f0);
  color: var(--text-primary, #1e293b);
}

.content-area {
  flex: 1;
  overflow-y: auto;
}

.gateways-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.gateway-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  border-radius: 12px;
}

.gateway-card.default {
  border-color: var(--accent-primary);
  background: var(--card-bg, #f8fafc);
}

.gateway-status {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--text-tertiary, #94a3b8);
}

.gateway-status.online {
  background: #22c55e;
}

.gateway-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.gateway-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.gateway-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
}

.gateway-badge {
  padding: 0.2rem 0.6rem;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 600;
}

.badge-success {
  background: #dcfce7;
  color: #15803d;
}

.badge-warn {
  background: #fef3c7;
  color: #b45309;
}

.gateway-url {
  font-size: 0.85rem;
  color: var(--text-secondary, #64748b);
  font-family: monospace;
}

.gateway-stats {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.stat {
  font-size: 0.75rem;
  color: var(--text-secondary, #64748b);
}

.empty-state-card {
  max-width: 520px;
  margin: 2rem auto;
  padding: 2rem;
  border-radius: 16px;
  background: var(--bg-primary, #ffffff);
  border: 1px solid var(--border-color, #e2e8f0);
  text-align: center;
}

.empty-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--text-primary, #1e293b);
  margin-bottom: 0.5rem;
}

.empty-sub {
  font-size: 0.875rem;
  color: var(--text-secondary, #64748b);
  margin: 0;
}

.spinner {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 3px solid var(--border-color, #e2e8f0);
  border-top-color: var(--accent-primary);
  margin: 0 auto 1rem;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .sidebar {
    width: 200px;
    min-width: 200px;
    max-width: 200px;
  }
}

@media (max-width: 700px) {
  .gateways-page {
    flex-direction: column;
  }

  .sidebar {
    width: 100%;
    max-width: 100%;
    min-width: 100%;
    flex-direction: row;
    padding: 1rem;
    overflow-x: auto;
  }

  .sidebar-header {
    margin-bottom: 0;
    margin-right: 1rem;
  }

  .sidebar-nav {
    flex-direction: row;
    gap: 0.5rem;
  }

  .nav-section {
    flex-direction: row;
  }

  .nav-label {
    display: none;
  }

  .nav-item span {
    display: none;
  }

  .main-content {
    margin: 0 0.5rem 0.5rem 0.5rem;
    padding: 1.5rem;
  }
}
</style>

