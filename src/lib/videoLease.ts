export type VideoLease = Readonly<{ id: number; fileId: string; uri: string }>;
export type VideoLeaseState = Readonly<{ mounted: VideoLease | null; failed: boolean }>;

/** Retirement includes explicit hook cleanup and Android's queued native release. */
export class VideoLeaseController {
  private desired: { fileId: string; uri: string } | null = null;
  private retiring: VideoLease | null = null;
  private waiting = false;
  private disposed = false;
  private serial = 0;
  private claimed: number | null = null;
  private state: VideoLeaseState = { mounted: null, failed: false };
  private listeners = new Set<() => void>();
  constructor(private readonly releaseBarrier: () => Promise<void>) {}
  snapshot = (): VideoLeaseState => this.state;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  request(file: { fileId: string; uri: string } | null): void {
    if (this.disposed) return;
    this.desired = file;
    const mounted = this.state.mounted;
    if (mounted?.fileId === file?.fileId && mounted?.uri === file?.uri) return;
    if (mounted) {
      this.retiring = this.claimed === mounted.id ? mounted : null;
      this.publish({ mounted: null, failed: false });
      if (!this.retiring) this.mountDesired();
    } else this.mountDesired();
  }
  claim(leaseId: number): boolean {
    if (this.disposed || this.state.mounted?.id !== leaseId || this.state.failed) return false;
    this.claimed = leaseId;
    return true;
  }
  didUnmount = (leaseId: number): void => {
    if (this.retiring?.id !== leaseId) return;
    this.retiring = null;
    this.claimed = null;
    this.waiting = true;
    void Promise.resolve().then(() => this.releaseBarrier()).then(() => {
      this.waiting = false;
      this.mountDesired();
    }, () => {
      this.waiting = false;
      this.desired = null;
      this.publish({ mounted: null, failed: true });
    });
  };
  dispose(): void {
    this.disposed = true;
    this.desired = null;
    if (this.state.mounted && this.claimed === this.state.mounted.id) this.retiring = this.state.mounted;
    this.publish({ mounted: null, failed: false });
  }
  failClosed(): void {
    this.desired = null;
    if (this.state.mounted && this.claimed === this.state.mounted.id) this.retiring = this.state.mounted;
    this.publish({ mounted: null, failed: true });
  }
  private mountDesired(): void {
    if (this.disposed || this.waiting || this.retiring || !this.desired || this.state.failed) return;
    this.publish({ mounted: { ...this.desired, id: ++this.serial }, failed: false });
  }
  private publish(state: VideoLeaseState): void { this.state = state; this.listeners.forEach((listener) => listener()); }
}
