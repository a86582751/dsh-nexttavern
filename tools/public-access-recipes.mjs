export function adaptPublicAccess(source, recipe) {
  let before, after;
  if (recipe === 'remote-settings') {
    before = 'const persistence = ctx.remote.$host.isLoopback ? "host" : "memory";';
    after = 'const persistence = "host";';
  } else if (recipe === 'continuous-reconnect') {
    before = ['if (!immediate && this.attempt > 0 && this.isFinalBackoffTier(this.attempt)) {',
      '\t\t\t\t\t\t\tconst retryDelay = new AbortController();',
      '\t\t\t\t\t\t\tthis.retryDelay = retryDelay;',
      '\t\t\t\t\t\t\tthis.emitState("disconnected");',
      '\t\t\t\t\t\t\tawait waitForAbort(retryDelay.signal);',
      '\t\t\t\t\t\t\tif (this.retryDelay === retryDelay) this.retryDelay = null;',
      '\t\t\t\t\t\t\tcontinue;', '\t\t\t\t\t\t}'].join('\n');
    after = 'if (!immediate && this.attempt > 0 && this.isFinalBackoffTier(this.attempt)) {\n\t\t\t\t\t\t\tthis.attempt = Math.max(0, this.attempt - 1);\n\t\t\t\t\t\t}';
  } else if (recipe === 'verified-upload') {
    before = 'if (!LOOPBACK_HOST.test(host)) {';
    after = 'if (!LOOPBACK_HOST.test(host) && req[Symbol.for("@isund/dsh-auth-webserver/verified-access")] !== true) {';
  } else throw Error('Unknown public-access recipe');
  if (source.split(before).length !== 2) throw Error('Public-access adaptation anchor changed: ' + recipe);
  return source.replace(before, after);
}
