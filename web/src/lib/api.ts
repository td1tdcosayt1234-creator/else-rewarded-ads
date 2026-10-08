export interface User {
  id: string; name: string; email?: string | null; username?: string | null;
  country: string; city?: string | null; balance: number;
  totalAds: number; level: number; spinTickets: number;
  referralCode: string; streak: number; banned: boolean; isAdmin?: boolean;
  sub?: { plan: string; status: string; expiresAt: string; mult: number } | null;
}
export interface Plan { id: string; name: string; price: number; days: number; mult: number; dailyMax: number; active: boolean }
export interface Sub { id: string; planId: string; planName: string; price: number; mult: number; dailyMax: number; days: number; method: string; status: string; expiresAt: string | null; at: string; name?: string }
export type TaskItem = { id: string; title_en: string; title_bn: string; reward: number; needAds?: number; needReferrals?: number; needStreak?: number };
export interface Config {
  maintenance: boolean; forceUpdate: boolean; latestVersion: string;
  notice: { en: string; bn: string };
  ads: { enabled: boolean; rewarded: boolean; interstitial: boolean; banner: boolean; cooldownSec: number; dailyMax: number };
  rewardByCountry: Record<string, number>;
  minWithdraw: number; referralCommission: number;
  checkinBonus: number[]; spinRewards: number[];
  levels: { level: number; minAds: number; mult: number }[];
  tasks: TaskItem[];
}
export interface Task extends TaskItem { done: boolean; progress: string }
export interface Tx { id: string; type: string; amount: number; reason: string; at: string }
export interface Withdraw { id: string; amount: number; method: string; account: string; status: string; at: string; name?: string }
export interface Ticket { id: string; name?: string; msg: string; reply: string; status: string; at?: string }
export interface Provider { id: string; name: string; enabled: boolean; feePct: number; minAmount: number; hint: string }
export interface BillingCfg { mode: string; currency: string; providers: Provider[] }
export interface AuthSettings { requireLogin: boolean; deviceLock: boolean; vpnBlock: boolean; emulatorBlock: boolean }
export interface Webhooks { admobSsvPath: string; postbackUrl: string }
export interface Product { id: string; name: string; type: string; country: string; price: number; active: boolean }
export interface NotifCfg { pushTitle: string; pushBody: string; emailSubject: string; emailBody: string; notice?: string | null }
export interface DevCfg { publicKey: string; webhookSecret: string }

const TOKEN_KEY = 'else_token';
const DEV_KEY = 'else_device';

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t: string) { localStorage.setItem(TOKEN_KEY, t); }
export function clearToken() { localStorage.removeItem(TOKEN_KEY); }
// stable per-browser device id (1 device = 1 account lock)
export function getDeviceId(): string {
  let d = localStorage.getItem(DEV_KEY);
  if (!d) { d = 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEV_KEY, d); }
  return d;
}

export async function req<T>(path: string, method = 'GET', body?: unknown, admin = false): Promise<T> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  const tok = getToken();
  if (tok) h.Authorization = 'Bearer ' + tok;
  if (admin) h['x-admin-key'] = localStorage.getItem('else_admin_key') || 'else-admin-123';
  const r = await fetch(path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  if (r.status === 401 || r.status === 403) {
    // login must: only nuke user session when a USER token was sent and rejected.
    // Admin-key failures must not log the user out.
    if (h.Authorization) {
      clearToken();
      if (!window.location.pathname.includes('/login')) window.location.href = '/app/login';
    }
  }
  const data = await r.json().catch(() => ({ error: 'bad response' }));
  if (!r.ok) throw new Error((data as { error?: string }).error || ('HTTP ' + r.status));
  return data as T;
}

export const api = {
  req,
  config: () => req<Config>('/api/config'),
  login: (identifier: string, password: string) =>
    req<{ token: string; user: User }>('/api/auth/login', 'POST', { identifier, password, deviceId: getDeviceId() }),
  signup: (b: { firstName: string; lastName: string; country: string; city: string; zip: string; username: string; birthday: string; email: string; password: string; referralCode?: string }) =>
    req<{ token: string; user: User }>('/api/auth/signup', 'POST', { ...b, deviceId: getDeviceId() }),
  me: () => req<{ user: User }>('/api/me'),
  adStart: () => req<{ sessionId: string }>('/api/ads/rewarded/start', 'POST', {}),
  adComplete: (sessionId: string) => req<{ reward: number; balance: number; level: number; todayCount: number }>('/api/ads/rewarded/complete', 'POST', { sessionId }),
  interstitial: () => req<{ ok: boolean }>('/api/ads/interstitial/view', 'POST', {}),
  banner: () => req<{ ok: boolean }>('/api/ads/banner/impression', 'POST', {}),
  checkin: () => req<{ streak: number; bonus: number; balance: number }>('/api/checkin', 'POST', {}),
  spin: () => req<{ reward: number; balance: number; tickets: number }>('/api/spin', 'POST', {}),
  tasks: () => req<Task[]>('/api/tasks'),
  taskClaim: (id: string) => req<{ reward: number; balance: number }>(`/api/tasks/${id}/complete`, 'POST', {}),
  referral: () => req<{ code: string; count: number; commission: number }>('/api/referral/my'),
  wallet: () => req<{ balance: number; history: Tx[] }>('/api/wallet'),
  leaderboard: () => req<{ name: string; balance: number; totalAds: number }[]>('/api/leaderboard'),
  withdraw: (amount: number, method: string, account: string) =>
    req<Withdraw>('/api/withdraw', 'POST', { amount, method, account }),
  myWithdraws: () => req<Withdraw[]>('/api/withdraw/my'),
  support: (msg: string) => req<Ticket>('/api/support', 'POST', { msg }),
  myTickets: () => req<Ticket[]>('/api/support/my'),
  adminStats: () => req<{ users: number; totalPaid: number; adViews: number; pendingW: number; openTickets: number }>('/api/admin/stats', 'GET', undefined, true),
  adminUsers: () => req<User[]>('/api/admin/users', 'GET', undefined, true),
  adminWithdraws: () => req<Withdraw[]>('/api/admin/withdraws', 'GET', undefined, true),
  adminWithdrawAct: (id: string, act: 'approve' | 'reject') => req<Withdraw>(`/api/admin/withdraw/${id}/${act}`, 'POST', {}, true),
  adminBan: (id: string) => req<{ banned: boolean }>(`/api/admin/user/${id}/ban`, 'POST', {}, true),
  adminTickets: () => req<Ticket[]>('/api/admin/tickets', 'GET', undefined, true),
  adminReply: (id: string, reply: string) => req<Ticket>(`/api/admin/tickets/${id}/reply`, 'POST', { reply }, true),
  adminConfigSave: (cfg: Partial<Config>) => req<Config>('/api/admin/config', 'POST', cfg, true),
  // Else Pay console (real)
  consoleOverview: () => req<{ users: number; adViews: number; totalRewards: number; totalWithdraw: number; pendingW: number; openTickets: number; recentTx: Tx[] }>('/api/console/overview', 'GET', undefined, true),
  consoleBilling: () => req<BillingCfg>('/api/console/billing', 'GET', undefined, true),
  consoleBillingSave: (b: Partial<BillingCfg> & { minWithdraw?: number }) => req<BillingCfg>('/api/console/billing', 'POST', b, true),
  consoleProviderToggle: (id: string) => req<Provider>('/api/console/billing/provider/' + id + '/toggle', 'POST', {}, true),
  consoleProviderSave: (id: string, b: Partial<Provider>) => req<Provider>('/api/console/billing/provider/' + id, 'POST', b, true),
  consoleAuthGet: () => req<AuthSettings>('/api/console/auth-settings', 'GET', undefined, true),
  consoleAuthSave: (b: Partial<AuthSettings>) => req<AuthSettings>('/api/console/auth-settings', 'POST', b, true),
  consoleWebhooksGet: () => req<Webhooks>('/api/console/webhooks', 'GET', undefined, true),
  consoleWebhooksSave: (b: Partial<Webhooks>) => req<Webhooks>('/api/console/webhooks', 'POST', b, true),
  consoleChangeKey: (newKey: string) => req<{ ok: boolean }>('/api/console/change-key', 'POST', { newKey }, true),
  consoleAdminAccount: () => req<{ deviceId: string; name: string; balance: number; referralCode: string; passwordSet: boolean }>('/api/console/admin-account', 'GET', undefined, true),
  consoleAdminReset: () => req<{ deviceId: string }>('/api/console/admin-account/reset', 'POST', {}, true),
  consoleAdminPass: (newPass: string) => req<{ ok: boolean }>('/api/console/admin-account/password', 'POST', { newPass }, true),
  consoleAdminPassReset: () => req<{ password: string }>('/api/console/admin-account/password/reset', 'POST', {}, true),
  paymentMethods: () => req<Provider[]>('/api/payments/methods'),
  // Paddle-like console (real)
  consoleProducts: () => req<Product[]>('/api/console/products', 'GET', undefined, true),
  consoleProductCreate: (b: Partial<Product>) => req<Product>('/api/console/products', 'POST', b, true),
  consoleProductSave: (id: string, b: Partial<Product>) => req<Product>('/api/console/products/' + id, 'POST', b, true),
  consoleProductToggle: (id: string) => req<Product>('/api/console/products/' + id + '/toggle', 'POST', {}, true),
  consoleNotifGet: () => req<NotifCfg>('/api/console/notifications', 'GET', undefined, true),
  consoleNotifSave: (b: Partial<NotifCfg>) => req<NotifCfg>('/api/console/notifications', 'POST', b, true),
  consoleDevGet: () => req<DevCfg>('/api/console/developers', 'GET', undefined, true),
  consoleDevRegen: (key: 'publicKey' | 'webhookSecret') => req<DevCfg>('/api/console/developers/regenerate', 'POST', { key }, true),
  consoleTxs: () => req<Tx[]>('/api/console/transactions', 'GET', undefined, true),
  consoleReports: () => req<{ byCountry: Record<string, number>; byMethod: Record<string, number>; totals: { rewards: number; payouts: number } }>('/api/console/reports', 'GET', undefined, true),
  consoleEvents: () => req<{ id: string; type: string; msg: string; at: string }[]>('/api/console/events', 'GET', undefined, true),
  // subscriptions (real)
  plans: () => req<Plan[]>('/api/plans'),
  subscribe: (planId: string, method: string, account: string) => req<Sub>('/api/subscribe', 'POST', { planId, method, account }),
  mySub: () => req<{ active: Sub | null; history: Sub[] }>('/api/subscription/my'),
  consolePlans: () => req<Plan[]>('/api/console/plans', 'GET', undefined, true),
  consolePlanCreate: (b: Partial<Plan>) => req<Plan>('/api/console/plans', 'POST', b, true),
  consolePlanSave: (id: string, b: Partial<Plan>) => req<Plan>('/api/console/plans/' + id, 'POST', b, true),
  consolePlanToggle: (id: string) => req<Plan>('/api/console/plans/' + id + '/toggle', 'POST', {}, true),
  consoleSubs: () => req<Sub[]>('/api/console/subscriptions', 'GET', undefined, true),
  consoleSubAct: (id: string, act: 'approve' | 'reject') => req<Sub>('/api/console/subscriptions/' + id + '/' + act, 'POST', {}, true),
};
