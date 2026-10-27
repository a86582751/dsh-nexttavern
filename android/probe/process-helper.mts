import {fork} from 'node:child_process';
import type {ChildProcess} from 'node:child_process';

export interface ChildExit {code: number | null; signal: NodeJS.Signals | null}
export interface ChildMessage {kind: string; [key: string]: unknown}

/** Fork the same installed executable; never replace it with a shell wrapper. */
export class ChildSession {
  child: ChildProcess;
  exited: Promise<ChildExit>;
  stderr = '';
  private messages: ChildMessage[] = [];
  private pending: {kind: string; resolve: (message: ChildMessage) => void; reject: (error: Error) => void}[] = [];
  private exit: ChildExit | undefined;
  private spawnError: Error | undefined;
  private signal: AbortSignal;
  private onAbort: () => void;

  constructor(role: string, args: string[], signal: AbortSignal) {
    this.signal = signal;
    this.child = fork(new URL('./child.mts', import.meta.url), [role, ...args], {
      execPath: process.execPath,
      // Deliberately preserve Node's fork IPC environment/fd setup and loader flags.
      execArgv: process.execArgv.filter(arg => !arg.startsWith('--test')),
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    this.child.stderr!.on('data', chunk => {this.stderr = (this.stderr + String(chunk)).slice(-8192);});
    this.child.on('message', value => {
      if (!value || typeof value !== 'object' || typeof (value as ChildMessage).kind !== 'string') return;
      const message = value as ChildMessage;
      const index = this.pending.findIndex(waiter => waiter.kind === message.kind);
      if (index < 0) this.messages.push(message);
      else this.pending.splice(index, 1)[0].resolve(message);
    });
    this.child.on('error', error => {
      this.spawnError = error;
      for (const waiter of this.pending.splice(0)) waiter.reject(error);
    });
    this.exited = new Promise(resolve => {
      this.child.once('exit', (code, exitSignal) => {
        this.exit = {code, signal: exitSignal};
        for (const waiter of this.pending.splice(0)) waiter.reject(new Error(`Child exited before ${waiter.kind}: ${code}/${exitSignal}; ${this.stderr}`));
        resolve(this.exit);
      });
      // A failed spawn may not emit exit, but always emits close.
      this.child.once('close', (code, exitSignal) => resolve({code, signal: exitSignal}));
    });
    this.onAbort = () => {this.child.kill('SIGKILL');};
    signal.addEventListener('abort', this.onAbort, {once: true});
    if (signal.aborted) this.onAbort();
  }

  receive(kind: string): Promise<ChildMessage> {
    const index = this.messages.findIndex(message => message.kind === kind);
    if (index >= 0) return Promise.resolve(this.messages.splice(index, 1)[0]);
    if (this.spawnError) return Promise.reject(this.spawnError);
    if (this.exit) return Promise.reject(new Error(`Child already exited before ${kind}; ${this.stderr}`));
    return new Promise((resolve, reject) => this.pending.push({kind, resolve, reject}));
  }

  send(message: ChildMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      this.child.send(message, error => error ? reject(error) : resolve());
    });
  }

  async close(): Promise<void> {
    this.signal.removeEventListener('abort', this.onAbort);
    if (this.exit === undefined && this.spawnError === undefined) this.child.kill('SIGKILL');
    await this.exited;
  }
}
