import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Edit,
  Plus,
  ShieldCheck,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-vue-next';
import type {
  ActivityDescriptor,
  ActivityLike,
  ChainMessageEntry,
} from '../../types/walletPage';

/**
 * What a chain message is, and how an activity row shows it.
 *
 * One row per message type, because five separate chains used to walk the same
 * six types in the same order: the icon, whether to show the domain name, the
 * label, the badge colour, and whether the CSV export calls it special.
 * Adding a message type meant remembering all five, and a type added to four
 * of them would look right until the one place it was missed.
 */

/**
 * A message type appears with and without its leading slash depending on which
 * endpoint reported it, so it is matched both ways rather than guessing which
 * a given node uses.
 */
function matchesType(action: string, type: string): boolean {
  return action === `/${type}` || action === type;
}


const MESSAGES: ChainMessageEntry[] = [
  { type: 'lumen.dns.v1.MsgUpdate', label: 'Dns update', tint: 'purple', icon: Edit, carriesDomainName: true },
  { type: 'lumen.dns.v1.MsgTransfer', label: 'Dns transfer', tint: 'primary', icon: Users, carriesDomainName: true },
  { type: 'lumen.dns.v1.MsgRegister', label: 'Dns register', tint: 'warning', icon: Plus, carriesDomainName: true },
  {
    type: 'cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
    label: 'Withdraw rewards',
    tint: 'yellow',
    icon: TrendingUp,
    carriesDomainName: true,
  },
  {
    type: 'lumen.release.v1.MsgPublishRelease',
    label: 'Publish release',
    tint: 'indigo',
    icon: Upload,
    carriesDomainName: true,
  },
  // The one message of the six with no domain attached, which used to be said
  // by leaving it out of two long chains of ORs rather than stating it.
  {
    type: 'lumen.pqc.v1.MsgLinkAccountPQC',
    label: 'PQC link',
    tint: 'pink',
    icon: ShieldCheck,
    carriesDomainName: false,
  },
];

/** For a plain transfer, which carries no message type worth naming. */
const BY_DIRECTION: Record<string, Omit<ChainMessageEntry, 'type'>> = {
  send: { label: 'Send', tint: 'error', icon: ArrowUpRight, carriesDomainName: false },
  receive: { label: 'Receive', tint: 'success', icon: ArrowDownLeft, carriesDomainName: false },
};

const UNKNOWN: Omit<ChainMessageEntry, 'type'> = {
  label: 'Unknown',
  tint: '',
  icon: ArrowLeftRight,
  carriesDomainName: false,
};

export function describeActivity(tx: ActivityLike): ActivityDescriptor {
  const action = String(tx?.action ?? '').trim();
  const known = MESSAGES.find((entry) => matchesType(action, entry.type));
  if (known) {
    const { type, ...descriptor } = known;
    void type;
    return descriptor;
  }
  return BY_DIRECTION[String(tx?.type ?? '').trim()] || UNKNOWN;
}

/** No tint means no badge, which is how an unrecognised message stays quiet. */
export function activityBadgeStyle(tx: ActivityLike): Record<string, string> {
  const { tint } = describeActivity(tx);
  if (!tint) return {};
  return {
    background: `rgba(var(--color-${tint}-rgb), 0.1)`,
    color: `var(--color-${tint})`,
  };
}
