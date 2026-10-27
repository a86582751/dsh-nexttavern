import {parentPort, workerData, isMainThread} from 'node:worker_threads';

if (isMainThread || !parentPort) throw new Error('Probe worker must run in worker_threads');
const counter = new Int32Array(workerData.counter as SharedArrayBuffer);
parentPort.once('message', (message: {kind: string; values: number[]}) => {
  if (message.kind !== 'sum') throw new Error('Unexpected worker message');
  Atomics.add(counter, 0, 1);
  parentPort!.postMessage({kind: 'summed', sum: message.values.reduce((sum, value) => sum + value, 0),
    workerPlatform: process.platform, execPath: process.execPath});
  parentPort!.close();
});
parentPort.postMessage({kind: 'ready'});
