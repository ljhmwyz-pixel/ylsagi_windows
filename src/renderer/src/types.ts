export interface ApifoxModel {
  code: number;
  msg: string;
  state: State;
  [property: string]: unknown;
}

export interface State {
  package: StatePackage;
  toDay: string;
  user: User;
  userAccountInfo: UserAccountInfo;
  userPackgeUsage: UserPackgeUsage;
  userPackgeUsage_week: UserPackgeUsage;
  [property: string]: unknown;
}

export interface CodexStateView extends State {
  dayLabel: string;
  packageInfo: StatePackage;
  todayUsage: UserPackgeUsage;
  weekUsage: UserPackgeUsage;
}

export interface StatePackage {
  cache: boolean;
  package_level: number;
  packages: PackageElement[];
  total_quota: number;
  weeklyQuota: number;
  [property: string]: unknown;
}

export interface PackageElement {
  __v: number;
  _id: string;
  amount: number;
  createdAt: string;
  duration: number;
  expires_at: string;
  is_deleted: boolean;
  is_refundable: boolean;
  order_id: string;
  package_level: number;
  package_quota: number;
  package_status: string;
  package_type: string;
  remark: string;
  start_at: string;
  sub_type: string;
  uid: string;
  updatedAt: string;
  [property: string]: unknown;
}

export interface User {
  email: string;
  uid: string;
  [property: string]: unknown;
}

export interface UserAccountInfo {
  accountId: string | null;
  total_balance: number;
  [property: string]: unknown;
}

export interface UserPackgeUsage {
  cache_read_cost: number;
  input_cost: number;
  input_tokens: number;
  input_tokens_cached: number;
  output_cost: number;
  output_tokens: number;
  output_tokens_reasoning: number;
  remaining_quota: number;
  request_count: number;
  total_cost: number;
  total_quota: number;
  total_tokens: number;
  used_percentage: string;
  [property: string]: unknown;
}

export interface Settings {
  hasToken: boolean;
  tokenSource: 'env' | 'saved' | 'none';
  tokenStorage: 'env' | 'safeStorage' | 'plain' | 'unavailable' | 'none';
  schemaVersion: number;
  refreshSeconds: number;
  compact: boolean;
  alwaysOnTop: boolean;
  panelLightDismiss: boolean;
  launchAtLogin: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  status: number | null;
}

export interface DataState {
  phase: 'idle' | 'loading' | 'fresh' | 'cached' | 'stale-cache' | 'error' | 'no-token';
  loading: boolean;
  data: ApifoxModel | null;
  fetchedAt: string | null;
  freshness: {
    ageMs: number | null;
    stale: boolean;
    expired: boolean;
  };
  cached: boolean;
  error: ApiError | null;
  warning: ApiError | null;
}

export interface FloatingApi {
  getSettings(): Promise<Settings>;
  saveSettings(settings: Partial<Settings> & { token?: string }): Promise<{ ok: boolean }>;
  clearToken(): Promise<{ ok: boolean }>;
  getDataState(): Promise<DataState>;
  refreshData(): Promise<DataState>;
  hide(): Promise<void>;
  setAlwaysOnTop(value: boolean): Promise<{ ok: boolean }>;
  beginDrag(): Promise<{ ok: boolean }>;
  moveBy(delta: { dx: number; dy: number }): Promise<{ ok: boolean }>;
  togglePanel(): Promise<{ ok: boolean }>;
  hidePanel(): Promise<{ ok: boolean }>;
  resizePanelToContent(height: number): Promise<{ ok: boolean }>;
  snapBubble(): Promise<{ ok: boolean }>;
  revealDockedBubble(): Promise<{ ok: boolean }>;
  hideDockedBubble(): Promise<{ ok: boolean }>;
  showBubbleMenu(): Promise<{ ok: boolean }>;
  openLogs(): Promise<{ ok: boolean }>;
  openSettingsDir(): Promise<{ ok: boolean }>;
  copyDiagnostics(): Promise<{ ok: boolean }>;
  resetPlacement(): Promise<{ ok: boolean }>;
  onOpenSettings(callback: () => void): () => void;
  onSettingsChanged(callback: () => void): () => void;
  onDataState(callback: (state: DataState) => void): () => void;
  onDockPreview(callback: (preview: DockPreview) => void): () => void;
  onPanelLayout(callback: (layout: PanelLayout) => void): () => void;
  onPanelVisibility(callback: (visible: boolean) => void): () => void;
}

export interface DockPreview {
  active: boolean;
  edge: 'left' | 'right' | 'top' | 'bottom' | null;
}

export interface PanelLayout {
  side: 'left' | 'right';
  arrowY: number;
}

declare global {
  interface Window {
    floatingApi: FloatingApi;
  }
}
