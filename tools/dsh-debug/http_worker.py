"""Ephemeral worker: standard DSH credential use, then one HTTP request.

It runs either over SSH on the DSH host or inside the CLI process against a
directly reachable host/port. No service/plugin installation, credential
copying or authentication changes. The launch token and browser cookie stay
inside this process and are never printed.
"""
import base64
import errno
import http.cookiejar
import json
import hashlib
import os
import re
import socket
import stat
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid

UPLOAD_ROOT = os.path.join(os.environ.get('DSH_HOME', os.path.expanduser('~/.dsh')), 'roleplay', 'cli-imports')
MAX_WS_MESSAGE = 32 * 1024 * 1024
HOST_PATTERN = re.compile(r'\[?[A-Za-z0-9_.:-]+\]?')


def endpoint(value):
    """Validate the direct endpoint; the default is loopback."""
    scheme = str(value.get('scheme') or 'http').lower()
    if scheme not in ('http', 'https'): raise ValueError('scheme')
    host = str(value.get('host') or '127.0.0.1').strip()
    if not HOST_PATTERN.fullmatch(host) or host.startswith('-') or ('[' in host) != (']' in host):
        raise ValueError('host')
    if ':' in host and not host.startswith('['): raise ValueError('host')
    try:
        port = int(value.get('port', 3081))
    except (TypeError, ValueError):
        raise ValueError('port') from None
    if not 1 <= port <= 65535: raise ValueError('port')
    authority = f'{host}:{port}'
    return scheme, host, port, authority, f'{scheme}://{authority}'


def is_loopback(host):
    value = host.strip('[]').casefold()
    if value == 'localhost': return True
    if value in ('::1', '0:0:0:0:0:0:0:1'): return True
    parts = value.split('.')
    return len(parts) == 4 and parts[0] == '127' and all(part.isdigit() and 0 <= int(part) <= 255 for part in parts)


def explicit_cookie(value):
    """Return an operator-supplied cookie, or None. Never logs its value."""
    direct = os.environ.get('DSH_DEBUG_COOKIE')
    if direct and '\n' not in direct and '\r' not in direct:
        return direct.strip()
    path = value.get('cookie_file') or os.environ.get('DSH_DEBUG_COOKIE_FILE')
    if not path: return None
    try:
        with open(os.path.abspath(os.path.expanduser(str(path))), 'r', encoding='utf-8-sig') as handle:
            line = handle.readline().strip()
    except OSError:
        raise ValueError('cookie file unreadable') from None
    if line.lower().startswith('cookie:'): line = line.split(':', 1)[1].strip()
    if not line or '=' not in line: raise ValueError('cookie file has no Cookie header value')
    return line


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


def read_workspace_baseline(port, cookie, timeout, stream_endpoint='workspace/follow', host='127.0.0.1'):
    deadline = time.monotonic() + timeout
    key = base64.b64encode(os.urandom(16)).decode('ascii')
    authority = f'{host}:{port}'
    sock = socket.create_connection((host.strip('[]'), port), timeout=timeout)
    stream_id = None
    try:
        request = (f'GET /api/remote.mux HTTP/1.1\r\nHost: {authority}\r\n'
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
        sock.sendall(_ws_frame(json.dumps({'type': 'open', 'streamId': stream_id, 'endpoint': stream_endpoint, 'payload': {'args': {}}}, separators=(',', ':'))))
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


def workspace_relative_directory(value):
    """Accept one portable relative directory, never an absolute or traversal path."""
    if not isinstance(value, str) or not value or os.path.isabs(value) or value.startswith(('\\', '/')):
        raise ValueError('workspace target directory must be a non-empty relative path')
    if '\\' in value or ':' in value:
        raise ValueError('workspace target directory must use relative POSIX components')
    parts = value.split('/')
    if any(not part or part in {'.', '..'} or '\x00' in part for part in parts):
        raise ValueError('workspace target directory contains traversal or an empty component')
    return parts


def workspace_upload_bytes(plan):
    """Validate the byte packet and its content-addressed reader hint."""
    raw = base64.b64decode(str(plan.get('fileData', '')), validate=True)
    if type(plan.get('bytes')) is not int or len(raw) != plan['bytes'] or len(raw) > 20 * 1024 * 1024:
        raise ValueError('invalid workspace upload size')
    digest = hashlib.sha256(raw).hexdigest()
    if digest != str(plan.get('sha256', '')):
        raise ValueError('workspace upload hash mismatch')
    name = str(plan.get('fileName', ''))
    suffix = name[len(digest):] if name.startswith(digest) else None
    if suffix is None or name != digest + suffix or not re.fullmatch(r'(?:\.[a-z0-9][a-z0-9._-]{0,31})?', suffix):
        raise ValueError('invalid content-addressed upload filename')
    return raw, digest, name


class WorkspaceUploadError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def read_regular_at(parent_fd, name, maximum):
    flags = os.O_RDONLY | os.O_NOFOLLOW
    fd = os.open(name, flags, dir_fd=parent_fd)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise WorkspaceUploadError('workspace-upload-target', 'Workspace upload target is not a regular file')
        parts = []
        total = 0
        while True:
            part = os.read(fd, min(1024 * 1024, maximum + 1 - total))
            if not part:
                break
            parts.append(part)
            total += len(part)
            if total > maximum:
                raise WorkspaceUploadError('workspace-upload-target', 'Workspace upload target exceeds maximum size')
        return b''.join(parts)
    finally:
        os.close(fd)


def resolve_workspace(session_id, session_value, workspace_value):
    """Use only native metadata: no client-supplied server root is accepted."""
    if isinstance(workspace_value, dict) and workspace_value.get('type') == 'baseline':
        workspace_value = workspace_value.get('value')
    sessions = session_value.get('items') if isinstance(session_value, dict) else None
    workspaces = workspace_value.get('items') if isinstance(workspace_value, dict) else None
    if not isinstance(sessions, list) or not isinstance(workspaces, list):
        raise ValueError('native session/workspace metadata has an unsupported shape')
    rows = [row for row in sessions if isinstance(row, dict) and row.get('sessionId') == session_id]
    if len(rows) != 1 or not isinstance(rows[0].get('cwd'), str) or not os.path.isabs(rows[0]['cwd']):
        raise ValueError('exact session is missing from native metadata or has no absolute cwd')
    memberships = [row for row in workspaces if isinstance(row, dict) and isinstance(row.get('sessionIds'), list) and session_id in row['sessionIds']]
    if len(memberships) != 1:
        raise ValueError('exact session is not in exactly one registered workspace')
    workspace = memberships[0]
    if not isinstance(workspace.get('workspaceId'), str) or not isinstance(workspace.get('path'), str) or not os.path.isabs(workspace['path']):
        raise ValueError('registered workspace metadata is invalid')
    if workspace['path'] != rows[0]['cwd']:
        raise ValueError('native session cwd does not match its registered workspace path')
    return workspace


def open_or_create_directory_at(parent_fd, name):
    flags = os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW
    try:
        return os.open(name, flags, dir_fd=parent_fd)
    except PermissionError:
        raise
    except OSError as error:
        if error.errno != errno.ENOENT:
            raise WorkspaceUploadError('workspace-upload-directory', 'Workspace target directory has a symlink or non-directory component') from error
    try:
        os.mkdir(name, 0o700, dir_fd=parent_fd)
    except FileExistsError:
        pass
    try:
        return os.open(name, flags, dir_fd=parent_fd)
    except OSError as error:
        raise WorkspaceUploadError('workspace-upload-directory', 'Workspace target directory changed or is not safely accessible') from error


def unlink_created_at(parent_fd, name, expected):
    """Remove only the inode created by this invocation after a failed write."""
    try:
        current = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        if (current.st_dev, current.st_ino) == expected:
            os.unlink(name, dir_fd=parent_fd)
    except OSError:
        pass


def stage_workspace_upload(plan, workspace):
    """Linux dirfd staging below one registered Workspace, safe from parent swaps."""
    if os.name != 'posix':
        raise WorkspaceUploadError('workspace-upload-platform', 'Workspace upload requires the Linux service worker')
    raw, digest, name = workspace_upload_bytes(plan)
    parts = workspace_relative_directory(plan.get('targetDirectory'))
    root = workspace['path']
    # O_NOFOLLOW protects one component, not an entire absolute path. Walk
    # from / so even a registered workspace's parents cannot redirect writes.
    if not isinstance(root, str) or not os.path.isabs(root) or '..' in root.split('/'):
        raise WorkspaceUploadError('workspace-upload-root', 'Registered workspace path must be absolute without parent traversal')
    root_real = os.path.normpath(root)
    root_fd = os.open('/', os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        for component in root_real.split('/'):
            if not component:
                continue
            next_fd = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=root_fd)
            os.close(root_fd)
            root_fd = next_fd
    except PermissionError:
        os.close(root_fd)
        raise
    except OSError as error:
        os.close(root_fd)
        raise WorkspaceUploadError('workspace-upload-root', 'Registered workspace path changed, contains a symlink, or is unavailable') from error
    directory_fd = root_fd
    try:
        for part in parts:
            next_fd = open_or_create_directory_at(directory_fd, part)
            if directory_fd != root_fd:
                os.close(directory_fd)
            directory_fd = next_fd
        target_path = os.path.join(root_real, *parts, name)
        try:
            existing = read_regular_at(directory_fd, name, 20 * 1024 * 1024)
        except FileNotFoundError:
            existing = None
        if existing is not None:
            if len(existing) != len(raw) or hashlib.sha256(existing).hexdigest() != digest:
                raise WorkspaceUploadError('workspace-upload-conflict', 'Content-addressed target exists with different bytes')
            return {'ok': True, 'path': target_path, 'bytes': len(existing), 'sha256': digest, 'workspaceId': workspace['workspaceId'], 'reused': True}
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
        fd = os.open(name, flags, 0o600, dir_fd=directory_fd)
        created = os.fstat(fd)
        try:
            offset = 0
            while offset < len(raw):
                written = os.write(fd, raw[offset:])
                if written <= 0:
                    raise OSError('short write')
                offset += written
            os.fsync(fd)
            os.fchmod(fd, 0o600)
        except Exception:
            os.close(fd)
            unlink_created_at(directory_fd, name, (created.st_dev, created.st_ino))
            fd = None
            raise WorkspaceUploadError('workspace-upload-write', 'Workspace upload write failed; this invocation removed its partial file when safe') from None
        finally:
            if fd is not None:
                os.close(fd)
        try:
            check = read_regular_at(directory_fd, name, 20 * 1024 * 1024)
        except Exception:
            unlink_created_at(directory_fd, name, (created.st_dev, created.st_ino))
            raise WorkspaceUploadError('workspace-upload-verification', 'Workspace upload readback failed; this invocation removed its file when safe') from None
        if len(check) != len(raw) or hashlib.sha256(check).hexdigest() != digest:
            unlink_created_at(directory_fd, name, (created.st_dev, created.st_ino))
            raise WorkspaceUploadError('workspace-upload-verification', 'Workspace upload hash verification failed; this invocation removed its file when safe')
        return {'ok': True, 'path': target_path, 'bytes': len(check), 'sha256': digest, 'workspaceId': workspace['workspaceId'], 'reused': False}
    finally:
        if directory_fd != root_fd:
            os.close(directory_fd)
        os.close(root_fd)


def native_rpc(opener, base, cookie, method, request, timeout):
    key = '_request' if method == 'session/list' else 'request'
    body = {'type': 'client-request', 'rpcId': str(uuid.uuid4()), 'method': method, 'payload': {'args': {key: request}}}
    wire = urllib.request.Request(base + '/api/' + method, data=json.dumps(body, ensure_ascii=False).encode('utf-8'), method='POST', headers={'Content-Type': 'application/json', **({'Cookie': cookie} if cookie else {})})
    try:
        response = opener.open(wire, timeout=timeout)
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(32 * 1024 * 1024 + 1)
        if len(raw) > 32 * 1024 * 1024:
            raise ValueError('native metadata response exceeds 32 MiB')
        try:
            data = json.loads(raw)
        except (ValueError, UnicodeDecodeError) as error:
            raise ValueError('native metadata response is not JSON') from error
        if response.status >= 400:
            raise ValueError('native metadata request failed')
    result = data.get('result') if isinstance(data, dict) and data.get('type') == 'server-response' else data
    if not isinstance(result, dict) or result.get('ok') is not True or 'value' not in result:
        raise ValueError('native metadata request returned an error')
    return result['value']


def exact_session_metadata(opener, base, cookie, session_id, timeout, rpc_call=native_rpc):
    """Walk native list continuation pages until the exact session is found."""
    cursor = None
    seen = set()
    for _ in range(1024):
        request = {} if cursor is None else {'cursor': cursor}
        page = rpc_call(opener, base, cookie, 'session/list', request, timeout)
        items = page.get('items') if isinstance(page, dict) else None
        if not isinstance(items, list):
            raise WorkspaceUploadError('workspace-upload-metadata', 'Native session metadata has an unsupported shape')
        matches = [row for row in items if isinstance(row, dict) and row.get('sessionId') == session_id]
        if len(matches) == 1:
            return {'items': matches}
        if len(matches) > 1:
            raise WorkspaceUploadError('workspace-upload-metadata', 'Native session metadata returned duplicate exact session rows')
        next_cursor = page.get('nextCursor')
        if next_cursor is None:
            raise WorkspaceUploadError('workspace-upload-session', 'Exact session was not found in native metadata')
        if not isinstance(next_cursor, str) or not next_cursor or next_cursor in seen:
            raise WorkspaceUploadError('workspace-upload-metadata', 'Native session metadata returned an invalid continuation cursor')
        seen.add(next_cursor)
        cursor = next_cursor
    raise WorkspaceUploadError('workspace-upload-metadata', 'Native session metadata exceeded the continuation-page limit')


def service_identity(service):
    """Read the configured unit's actual MainPID credential from procfs."""
    try:
        main = subprocess.run(['systemctl', 'show', service, '--property=MainPID', '--value'], capture_output=True, text=True, timeout=8, check=True).stdout.strip()
        if not re.fullmatch(r'[1-9][0-9]*', main):
            raise ValueError('invalid MainPID')
        status = open(os.path.join('/proc', main, 'status'), encoding='utf-8').read().splitlines()
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        raise WorkspaceUploadError('workspace-upload-service', 'Configured service MainPID/identity is unavailable; no workspace file was written') from error
    values = {}
    for line in status:
        key, _, value = line.partition(':')
        if key in {'Uid', 'Gid', 'Groups'}:
            values[key] = value.split()
    if len(values.get('Uid', [])) < 2 or len(values.get('Gid', [])) < 2:
        raise WorkspaceUploadError('workspace-upload-service', 'Configured service proc identity is incomplete; no workspace file was written')
    try:
        groups = [int(value) for value in values.get('Groups', [])]
        return {'uid': int(values['Uid'][1]), 'gid': int(values['Gid'][1]), 'groups': groups}
    except ValueError as error:
        raise WorkspaceUploadError('workspace-upload-service', 'Configured service proc identity is invalid; no workspace file was written') from error


def stage_as_service_identity(plan, workspace, identity):
    """Fork, drop to the running service's UID/GID/groups, then stage exactly once."""
    if os.name != 'posix':
        raise WorkspaceUploadError('workspace-upload-platform', 'Workspace upload requires the Linux service worker')
    uid, gid, groups = identity.get('uid'), identity.get('gid'), identity.get('groups')
    if type(uid) is not int or type(gid) is not int or not isinstance(groups, list) or any(type(group) is not int for group in groups):
        raise WorkspaceUploadError('workspace-upload-service', 'Configured service identity is invalid; no workspace file was written')
    identity_matches = (os.geteuid(), os.getegid()) == (uid, gid) and set(os.getgroups()) == set(groups)
    if not identity_matches and os.geteuid() != 0:
        raise WorkspaceUploadError('workspace-upload-service', 'Worker cannot switch to the configured service identity; no workspace file was written')
    read_fd, write_fd = os.pipe()
    child = os.fork()
    if child == 0:
        os.close(read_fd)
        try:
            if os.geteuid() == 0:
                os.setgroups(groups)
                os.setgid(gid)
                os.setuid(uid)
            result = {'ok': True, 'value': stage_workspace_upload(plan, workspace)}
        except WorkspaceUploadError as error:
            result = {'ok': False, 'error': {'code': error.code, 'message': str(error)}}
        except PermissionError:
            result = {'ok': False, 'error': {'code': 'workspace-upload-permission', 'message': 'Configured service account cannot write the requested existing workspace directory; no ownership was changed'}}
        except Exception:
            result = {'ok': False, 'error': {'code': 'workspace-upload-failed', 'message': 'Workspace upload failed under the configured service account'}}
        wire = json.dumps(result, ensure_ascii=True).encode('ascii')
        try:
            os.write(write_fd, wire)
        finally:
            os.close(write_fd)
        os._exit(0)
    os.close(write_fd)
    chunks = []
    while True:
        part = os.read(read_fd, 8192)
        if not part:
            break
        chunks.append(part)
        if sum(map(len, chunks)) > 65536:
            break
    os.close(read_fd)
    _, status = os.waitpid(child, 0)
    try:
        result = json.loads(b''.join(chunks))
    except (ValueError, UnicodeDecodeError) as error:
        raise WorkspaceUploadError('workspace-upload-service', 'Configured service staging process returned no valid result') from error
    if status != 0 or not isinstance(result, dict) or result.get('ok') is not True:
        error = result.get('error') if isinstance(result, dict) else None
        code = error.get('code') if isinstance(error, dict) else 'workspace-upload-service'
        message = error.get('message') if isinstance(error, dict) else 'Configured service staging process failed'
        raise WorkspaceUploadError(code, message)
    return result['value']


def project_response(data, plan):
    """Bound native list data before crossing the transport; never mutate API objects."""
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
    summary = {'items': rows[offset:offset+limit], 'total': len(rows), 'nextCursor': str(offset+limit) if offset+limit<len(rows) else None, 'source': 'native session/list, projected before transfer', 'omitted': ['contextHeaders', 'contextTimeline', 'turnOutline', 'other non-list projections']}
    return {**data, 'result': {**data['result'], 'value': summary}}


def run(value):
    global UPLOAD_ROOT
    dsh_home = os.path.abspath(os.path.expanduser(value.get('dsh_home') or os.environ.get('DSH_HOME', '~/.dsh')))
    UPLOAD_ROOT = os.path.join(dsh_home, 'roleplay', 'cli-imports')
    plan = value['plan']
    scheme, host, port, authority, base = endpoint(value)
    loopback = is_loopback(host)
    if plan.get('action') in ('upload-card', 'upload-workspace') and not loopback:
        return {'ok': False, 'error': {'code': 'upload-requires-ssh',
            'message': 'File staging runs on the DSH host; use --target ssh for a non-loopback endpoint'}}
    if plan.get('action') == 'upload-card':
        return stage_card(plan)
    path = plan.get('path')
    if plan.get('action') != 'upload-workspace':
        if not isinstance(path, str):
            raise ValueError('API path')
        decoded = urllib.parse.unquote(path)
        if not path.startswith('/api/') or '..' in decoded.split('?')[0].split('/') or any(c in path for c in '\r\n\\'):
            raise ValueError('API path')
    timeout = min(120, max(1, int(value.get('timeout', 30))))
    service = value.get('service', 'deepseek-harness')
    if not re.fullmatch(r'[a-zA-Z0-9_.@-]+', service):
        raise ValueError('service')
    jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPCookieProcessor(jar))
    try:
        cookie = explicit_cookie(value)
    except ValueError as error:
        return {'ok': False, 'error': {'code': 'cookie-file', 'message': str(error)}}
    if cookie is None:
        if not loopback:
            return {'ok': False, 'error': {'code': 'auth-unavailable',
                'message': 'A non-loopback endpoint needs an operator cookie: set DSH_DEBUG_COOKIE, or configure --cookie-file during init; no authentication was changed'}}
        try:
            journal = subprocess.run(['journalctl', '-u', service, '-n', '1', '--grep', 'token=', '-o', 'cat', '--no-pager'], capture_output=True, text=True, timeout=8, check=True)
            tokens = re.findall(r'[?&]token=([A-Za-z0-9_-]+)', journal.stdout)
        except (FileNotFoundError, subprocess.CalledProcessError):
            tokens = []
        if tokens:
            with opener.open(base + '/?token=' + urllib.parse.quote(tokens[-1]), timeout=timeout) as response:
                response.read(4096)
            cookie = '; '.join(f'{item.name}={item.value}' for item in jar)
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
const authority=process.argv[3]+':'+process.argv[1],now=Date.now();
const body=Buffer.from(JSON.stringify({version:1,authority,issuedAt:now,expiresAt:now+60000})).toString('base64url');
const name='dsh-auth-'+crypto.createHash('sha256').update(authority).digest('base64url');
process.stdout.write(name+'=v1.'+body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url'));
'''
            harness_root = value.get('harness_root') or os.environ.get('DSH_HARNESS_ROOT')
            if not harness_root or not os.path.isdir(harness_root):
                return {'ok': False, 'error': {'code': 'auth-unavailable', 'message': 'Set harness_root/DSH_HARNESS_ROOT for the native credential adapter, or use a service with a launch token'}}
            signed = subprocess.run(['node', '-e', code, str(port), os.path.join(dsh_home, '.credentials.yaml'), host], cwd=harness_root, capture_output=True, text=True, timeout=8)
            if signed.returncode or not signed.stdout.startswith('dsh-auth-'):
                return {'ok': False, 'error': {'code': 'auth-unavailable', 'message': 'Native server credential unavailable or unsupported; no auth configuration was changed'}}
            cookie = signed.stdout
    if plan.get('stream'):
        try:
            return {'ok': True, 'value': read_workspace_baseline(port, cookie or '', timeout, host=host)}
        except Exception as error:
            return {'ok': False, 'error': {'code': 'workspace-stream', 'message': str(error)}}
    if plan.get('action') == 'upload-workspace':
        try:
            session_value = exact_session_metadata(opener, base, cookie, plan.get('sessionId'), timeout)
            workspace_value = read_workspace_baseline(port, cookie or '', timeout, host=host)
            workspace = resolve_workspace(plan.get('sessionId'), session_value, workspace_value)
            return stage_as_service_identity(plan, workspace, service_identity(service))
        except WorkspaceUploadError as error:
            return {'ok': False, 'error': {'code': error.code, 'message': str(error)}}
        except PermissionError:
            return {'ok': False, 'error': {'code': 'workspace-upload-permission', 'message': 'Configured service account cannot write the requested existing workspace directory; no ownership was changed'}}
        except (OSError, ValueError):
            return {'ok': False, 'error': {'code': 'workspace-upload-metadata', 'message': 'Native workspace metadata could not safely resolve the requested upload target'}}
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
        result = {'ok': False, 'error': {'code': type(error).__name__, 'message': 'Worker request failed; a timed-out write may already have been accepted. Read state before retrying.'}}
    print(json.dumps(result, ensure_ascii=True))
