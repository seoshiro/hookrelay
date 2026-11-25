import { EventEmitter } from 'node:events';
import type { StreamMessage } from '@hookrelay/shared';

/** In-process fan-out. One API instance on the free tier; swap for Postgres LISTEN/NOTIFY when scaling out. */
export class EventBus {
  private readonly emitter = new EventEmitter();
  constructor() {
    this.emitter.setMaxListeners(0);
  }
  publish(msg: StreamMessage & { sandbox: boolean; ownerId: string | null }): void {
    this.emitter.emit('msg', msg);
  }
  subscribe(fn: (msg: StreamMessage & { sandbox: boolean; ownerId: string | null }) => void): () => void {
    this.emitter.on('msg', fn);
    return () => this.emitter.off('msg', fn);
  }
}
