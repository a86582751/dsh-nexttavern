"""Ephemeral SSH worker: standard DSH token exchange, then one HTTP request.

No service/plugin installation, credential copying or authentication changes.
The launch token and browser cookie stay inside this remote process.
"""
import base64
import http.cookiejar
import json
import hashlib
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

UPLOAD_ROOT = os.path.join(os.environ.get('DSH_HOME', os.path.expanduser('~/.dsh')), 'roleplay', 'cli-imports')
MAX_WS_MESSAGE = 32 * 1024 * 1024


def _ws_frame(payload, opcode=1):
    raw = payload if isinstance(payload, bytes) else payload.encode('utf-8')
    mask = os.urandom(4)
    masked = bytes(value ^ mask[index % 4] for index, value in enumerate(raw))
    size = len(raw)
    header = bytes([0x80 | opcode, 0x80 | size]) if size < 126 else bytes([0x80 | opcode, 0x80 | 126]) + size.to_bytes(2, 'big')
    return header + mask + masked


def _ws_read(sock, buffer, deadline):
    def read_exact(size):
        value = b''
        while len(value) < size:
            if buffer:
                take = min(size - len(value), len(buffer))
                value += bytes(buffer[:take])
                del buffer[:take]
                continue
            if time.monotonic() >= deadline: raise TimeoutError('WebSocket deadline exceeded')
            sock.settimeout(max(0, deadline - time.monotonic()))
            part = sock.recv(size - len(value))
            if not part: raise ValueError('WebSocket closed')
            buffer.extend(part)
        return value
    first, second = read_exact(1)[0], read_exact(1)[0]
    length = second & 0x7f
    if length == 126: length = int.from_bytes(read_exact(2), 'big')
    elif length == 127: length = int.from_bytes(read_exact(8), 'big')
    if length > MAX_WS_MESSAGE: raise ValueError('WebSocket frame exceeds 32 MiB')
    if second & 0x80: mask = read_exact(4)
    else: mask = None
    value = read_exact(length)
    if mask: value = bytes(item ^ mask[index % 4] for index, item in enumerate(value))
    return first, value


def _ws_message(sock, buffer, deadline):
    """Read one complete WebSocket message, retaining control frames."""
    while True:
        first, value = _ws_read(sock, buffer, deadline)
        opcode, fin = first & 0x0f, bool(first & 0x80)
        if opcode == 9:
            sock.sendall(_ws_frame(value, opcode=10))
            continue
        if opcode in (8, 10): return opcode, value
        if opcode not in (0, 1, 2): raise ValueError('WebSocket invalid opcode')
        if opcode == 0: raise ValueError('WebSocket unexpected continuation')
        parts = [value]
        while not fin:
            first, value = _ws_read(sock, buffer, deadline)
            nested = first & 0x0f
            if nested == 9:
                sock.sendall(_ws_frame(value, opcode=10))
                continue
            if nested in (8, 10): return nested, value
            if first & 0x0f != 0: raise ValueError('WebSocket invalid fragmented message')
            parts.append(value)
            if sum(map(len, parts)) > MAX_WS_MESSAGE: raise ValueError('WebSocket message exceeds 32 MiB')
            fin = bool(first & 0x80)
        return opcode, b''.join(parts)


def read_workspace_baseline(port, cookie, timeout, endpoint='workspace/follow'):
    deadline = time.monotonic() + timeout
    key = base64.b64encode(os.urandom(16)).decode('ascii')
    sock = socket.create_connection(('127.0.0.1', port), timeout=timeout)
    stream_id = None
    try:
        request = (f'GET /api/remote.mux HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n'
                   f'Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\n'
                   f'Sec-WebSocket-Version: 13\r\nCookie: {cookie}\r\n\r\n').encode()
        sock.settimeout(max(0, deadline - time.monotonic()))
        sock.sendall(request)
        header = b''
        while b'\r\n\r\n' not in header:
            sock.settimeout(max(0, deadline - time.monotonic()))
            part = sock.recv(4096)
            if not part: raise ValueError('WebSocket handshake EOF')
            header += part
            if len(header) > 65536: raise ValueError('WebSocket handshake too large')
        if not header.startswith(b'HTTP/1.1 101'): raise ValueError('WebSocket handshake rejected')
        buffer = bytearray(header.split(b'\r\n\r\n', 1)[1])
        stream_id = str(uuid.uuid4())
        sock.sendall(_ws_frame(json.dumps({'type': 'open', 'streamId': stream_id, 'endpoint': endpoint, 'payload': {'args': {}}}, separators=(',', ':'))))
        while True:
            kind, raw = _ws_message(sock, buffer, deadline)
            if kind == 9:
                sock.sendall(_ws_frame(raw, opcode=10))
                continue
            if kind == 8: raise ValueError('workspace stream closed')
            if kind != 1: continue
            frame = json.loads(raw)
            if frame.get('type') == 'item' and frame.get('streamId') == stream_id:
                return frame['value']
            if frame.get('type') == 'error' and frame.get('streamId') == stream_id:
                error = frame.get('error', {})
                raise ValueError(f"{error.get('code', 'workspace-error')}: {error.get('message', 'workspace stream failed')}")
    finally:
        try:
            if stream_id is not None:
                try: sock.sendall(_ws_frame(json.dumps({'type': 'cancel', 'streamId': stream_id}, separators=(',', ':'))))
                except Exception: pass
        finally: sock.close()


def stage_card(plan, root=UPLOAD_ROOT):
    """Stage one validated card; root is an internal test seam, never packet input."""
    extension = str(plan.get('fileName', '')).rsplit('.', 1)[-1].lower()
    name = str(plan.get('fileName', ''))
    if extension not in {'md', 'txt', 'json', 'png'} or not re.fullmatch(r'[0-9a-f]{32}\.(?:md|txt|json|png)', name):
        raise ValueError('invalid upload filename')
    raw = base64.b64decode(str(plan.get('fileData', '')), validate=True)
    if len(raw) != int(plan.get('bytes', -1)) or len(raw) > 20 * 1024 * 1024:
        raise ValueError('invalid upload size')
    digest = hashlib.sha256(raw).hexdigest()
    if digest != str(plan.get('sha256', '')):
        raise ValueError('upload hash mismatch')
    os.makedirs(root, mode=0o700, exist_ok=True)
    root_real = os.path.realpath(root)
    if root_real != root or os.path.islink(root):
        raise ValueError('upload directory must not be a symlink')
    target = os.path.join(root_real, name)
    if os.path.commonpath([root_real, os.path.realpath(os.path.dirname(target))]) != root_real:
        raise ValueError('upload path escapes directory')
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        offset = 0
        while offset < len(raw):
            written = os.write(fd, raw[offset:])
            if written <= 0:
                raise OSError('short write')
            offset += written
        os.fsync(fd)
        os.fchmod(fd, 0o600)
    finally:
        os.close(fd)
    with open(target, 'rb') as saved:
        check = saved.read(20 * 1024 * 1024 + 1)
    if len(check) != len(raw) or hashlib.sha256(check).hexdigest() != digest:
        raise ValueError('staged file verification failed')
    return {'ok': True, 'path': target, 'bytes': len(check), 'sha256': digest}


def project_response(data, plan):
    """Bound native list data before crossing SSH; never mutate API objects."""
    if plan.get('summary') != 'sessions' or data.get('result', {}).get('ok') is not True:
        return data
    value = data['result']['value']
    rows = []
    for row in value.get('items', []):
        values = row.get('projections', {}).get('values', {})
        item = {k: row[k] for k in ['sessionId', 'updatedAt', 'running', 'blank', 'parentSessionId', 'origin', 'cwd'] if k in row}
        item['projections'] = {'values': {k: values[k] for k in ['title', 'agentPreset', 'modelSelection'] if k in values}}
        if plan.get('query', '').casefold() in json.dumps(item, ensure_ascii=False).casefold():
            rows.append(item)
    offset = max(0, int(plan.get('offset', 0)))
    limit = min(200, max(1, int(plan.get('limit', 20))))
    summary = {'items': rows[offset:offset+limit], 'total': len(rows), 'nextCursor': str(offset+limit) if offset+limit<len(rows) else None, 'source': 'native session/list, projected before SSH', 'omitted': ['contextHeaders', 'contextTimeline', 'turnOutline', 'other non-list projections']}
    return {**data, 'result': {**data['result'], 'value': summary}}


def run(value):
    global UPLOAD_ROOT
    dsh_home = os.path.abspath(os.path.expanduser(value.get('dsh_home') or os.environ.get('DSH_HOME', '~/.dsh')))
    UPLOAD_ROOT = os.path.join(dsh_home, 'roleplay', 'cli-imports')
    plan = value['plan']
    if plan.get('action') == 'upload-card':
        return stage_card(plan)
    port = int(value.get('port', 3081))
    if not 1 <= port <= 65535:
        raise ValueError('port')
    base = f'http://127.0.0.1:{port}'
    path = plan['path']
    decoded = urllib.parse.unquote(path)
    if not path.startswith('/api/') or '..' in decoded.split('?')[0].split('/') or any(c in path for c in '\r\n\\'):
        raise ValueError('API path')
    timeout = min(120, max(1, int(value.get('timeout', 30))))
    service = value.get('service', 'deepseek-harness')
    if not re.fullmatch(r'[a-zA-Z0-9_.@-]+', service):
        raise ValueError('service')
    try:
        journal = subprocess.run(['journalctl', '-u', service, '-n', '1', '--grep', 'token=', '-o', 'cat', '--no-pager'], capture_output=True, text=True, timeout=8, check=True)
        tokens = re.findall(r'[?&]token=([A-Za-z0-9_-]+)', journal.stdout)
    except (FileNotFoundError, subprocess.CalledProcessError):
        tokens = []
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    cookie = None
    if tokens:
        with opener.open(base + '/?token=' + urllib.parse.quote(tokens[-1]), timeout=timeout) as response:
            response.read(4096)
    else:
        # Some installations never log launch tokens. A server administrator
        # already owns this native credential. Sign a 60-second loopback-only
        # browser credential using the existing v1 scheme, entirely on-server.
        # Fail closed on a changed record shape. Never modify the credential file.
        code = r'''
const fs=require('node:fs'),crypto=require('node:crypto'),yaml=require('yaml');
const record=yaml.parse(fs.readFileSync(process.argv[2],'utf8')).records?.['client-connection/browser-session'];
if(record?.kind!=='grant'||record.payload?.version!==1)throw Error('unsupported credential');
const secret=Buffer.from(record.payload.secret,'base64url');if(secret.length!==32)throw Error('bad secret');
const authority='127.0.0.1:'+process.argv[1],now=Date.now();
const body=Buffer.from(JSON.stringify({version:1,authority,issuedAt:now,expiresAt:now+60000})).toString('base64url');
const name='dsh-auth-'+crypto.createHash('sha256').update(authority).digest('base64url');
process.stdout.write(name+'=v1.'+body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url'));
'''
        harness_root = value.get('harness_root') or os.environ.get('DSH_HARNESS_ROOT')
        if not harness_root or not os.path.isdir(harness_root):
            return {'ok': False, 'error': {'code': 'auth-unavailable', 'message': 'Set harness_root/DSH_HARNESS_ROOT for the native credential adapter, or use a service with a launch token'}}
        signed = subprocess.run(['node', '-e', code, str(port), os.path.join(dsh_home, '.credentials.yaml')], cwd=harness_root, capture_output=True, text=True, timeout=8)
        if signed.returncode or not signed.stdout.startswith('dsh-auth-'):
            return {'ok': False, 'error': {'code': 'auth-unavailable', 'message': 'Native server credential unavailable or unsupported; no auth configuration was changed'}}
        cookie = signed.stdout
    if plan.get('stream'):
        try:
            return {'ok': True, 'value': read_workspace_baseline(port, cookie or '', timeout)}
        except Exception as error:
            return {'ok': False, 'error': {'code': 'workspace-stream', 'message': str(error)}}
    body = plan.get('body')
    request = urllib.request.Request(base + path, data=None if body is None else json.dumps(body, ensure_ascii=False).encode('utf-8'), method=plan['method'], headers={'Content-Type': 'application/json', **({'Cookie': cookie} if cookie else {})})
    try:
        response = opener.open(request, timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(32 * 1024 * 1024 + 1)
        if len(raw) > 32 * 1024 * 1024:
            raise ValueError('response exceeds 32 MiB')
        try:
            data = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            data = None
        if response.status >= 400:
            return {'ok': False, 'error': {'code': 'http-error', 'status': response.status, 'message': data.get('error', 'DSH HTTP error') if isinstance(data, dict) else 'DSH HTTP error'}}
        if plan.get('download'):
            return {'ok': True, 'binary': base64.b64encode(raw).decode('ascii'), 'bytes': len(raw)}
        if data is None:
            return {'ok': False, 'error': {'code': 'non-json', 'message': 'DSH returned a non-JSON response'}}
        return project_response(data, plan)


if __name__ == '__main__':
    try:
        result = run(json.load(sys.stdin))
    except Exception as error:
        # Never include exception URLs (the token exchange URL contains a secret).
        result = {'ok': False, 'error': {'code': type(error).__name__, 'message': 'SSH worker request failed; a timed-out write may already have been accepted. Read state before retrying.'}}
    print(json.dumps(result, ensure_ascii=True))
