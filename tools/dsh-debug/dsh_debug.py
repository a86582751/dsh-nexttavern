#!/usr/bin/env python3
"""DSH administrative CLI, using existing REST and native Connection RPC."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import stat
import time
import uuid
from urllib.parse import urlencode

VERSION = '1.7.0'
CONFIG = Path.home() / '.dsh-debug' / 'config.json'
CARD_BYTES_LIMIT = 20_000_000
HOST_PATTERN = re.compile(r'\[?[A-Za-z0-9_.:-]+\]?')


class CliError(Exception):
    def __init__(self, code, message, details=None):
        super().__init__(message)
        self.code, self.details = code, details


class Parser(argparse.ArgumentParser):
    def error(self, message):
        raise CliError('arguments', message)


def parse(argv):
    parser = Parser(description='DSH debug CLI: native queue, worldlines, Tavern state/models/jobs/exports. Writes never auto-retry.')
    parser.add_argument('--json', action='store_true', help='Stable JSON envelope (also the default)')
    parser.add_argument('--config', default=str(CONFIG))
    parser.add_argument('--timeout', type=int, default=30, help='HTTP deadline, 1–120 seconds; timeout does not cancel a write')
    parser.add_argument('--version', action='version', version=VERSION)
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('doctor', help='Verify the configured target and authenticated API reachability')
    init = sub.add_parser('init', help='Save non-secret target settings: SSH, or a directly reachable host/port')
    init.add_argument('--target', choices=['ssh', 'local'], default='ssh',
        help='ssh (default) or local: reuse the same worker in this process against --host:--port')
    init.add_argument('--ssh-host', help='Required for --target ssh')
    init.add_argument('--ssh-key', help='Required for --target ssh')
    init.add_argument('--ssh-port', type=int, default=22, help='--target ssh only; non-default SSH port')
    init.add_argument('--host', default='127.0.0.1', help='--target local only; reachable DSH host (wrap a bare IPv6 literal in brackets)')
    init.add_argument('--scheme', choices=['http', 'https'], default='http', help='--target local only')
    init.add_argument('--cookie-file', help='--target local only; file holding the Cookie header for a non-loopback host (referenced, never copied)')
    init.add_argument('--port', type=int, default=3081)
    init.add_argument('--remote-python', default='/usr/bin/python3', help='--target ssh only')
    init.add_argument('--dsh-home', help='Target DSH_HOME; defaults to that environment or ~/.dsh')
    init.add_argument('--harness-root', help='Harness installation root for the native credential adapter')
    init.add_argument('--service', default='deepseek-harness', help='Target systemd unit, when available')
    p = sub.add_parser('create', help='Create a native roleplay session (no model call)')
    location = p.add_mutually_exclusive_group(required=True)
    location.add_argument('--cwd', help='Existing server directory (legacy, leaves the session ungrouped)')
    location.add_argument('--workspace-id', help='Existing native workspace ID to select and bind')
    location.add_argument('--workspace-path', help='Existing server directory to register/resolve, then bind')
    p.add_argument('--dry-run', action='store_true')
    p = sub.add_parser('workspaces', help='Read the native workspace projection')
    p.add_argument('--dry-run', action='store_true')
    p = sub.add_parser('workspace-create', help='Register or resolve an existing server directory as a native workspace')
    p.add_argument('--path', required=True, help='Existing server directory path')
    p.add_argument('--dry-run', action='store_true')
    for command in ['sessions', 'resolve', 'conversations']:
        p = sub.add_parser(command, help='Discover sessions / resolve title or ID / read worldline ownership')
        p.add_argument('--query', default='')
        p.add_argument('--cursor')
        p.add_argument('--limit', type=int, default=20)
        if command == 'sessions': p.add_argument('--source',
             choices=['catalog',
                 'native'],
             default='native',
             help='Native summaries by default; catalog returns only registered Tavern worldline families')
    for command in ['state',
         'activity',
         'models',
         'jobs',
         'resources',
         'logs',
         'usage',
         'history',
         'wake',
         'cancel',
         'clone',
         'send',
         'regenerate',
         'edit-send',
         'edit-message',
         'delete-message',
         'delete-user',
         'worldline',
         'model-set',
         'model-route',
         'upload-card',
         'upload',
         'export',
         'job-action',
         'download',
         'settings',
         'settings-set',
         'cluster',
         'cluster-set',
         'cluster-route']:
        p = sub.add_parser(command, help={
            'send': 'Queue player input using native requestId (text or UTF-8 file)',
            'regenerate': 'Prepare/register a worldline, then queue the original player input',
            'edit-send': 'Prepare/register a player-edit worldline, then queue edited input',
            'edit-message': 'Replace one durable user or assistant message in the selected session',
            'delete-message': 'Delete one assistant branch version while retaining the audit record',
            'delete-user': 'Create a truncated worldline without one player turn',
            'model-route': 'Set one validated purpose route while preserving other policy routes',
            'upload-card': 'Role card: legacy staging without --import; official raw upload and recoverable import with --import',
            'upload': 'Upload a local file into the exact session\'s registered workspace',
            'clone': 'Explicit native clone into a separate conversation',
            'worldline': 'Read a branch operation or select an existing worldline',
            'model-set': 'Save revision-checked Tavern policy from JSON file',
            'export': 'Start card/novel export as a normal durable job',
            'history': 'Read a bounded native session page',
            'settings': 'Read current roleplay settings and revision',
            'settings-set': 'Update roleplay context settings with revision checking',
        }.get(command, f'{command}: existing DSH API'))
        p.add_argument('--session', required=True, help='Exact execution session ID, not inferred from the browser')
        p.add_argument('--dry-run', action='store_true', help='Show request plan without connecting')
        if command == 'cluster-set':
            p.add_argument('--enabled', choices=['true', 'false'], required=True)
        if command == 'cluster-route':
            p.add_argument('--character', help='Exact roster ID; omit to change the default character route')
            route = p.add_mutually_exclusive_group(required=True)
            route.add_argument('--main', action='store_true', help='Follow the main agent model dynamically')
            route.add_argument('--inherit', action='store_true', help='Clear override: character inherits default; default inherits main')
            route.add_argument('--provider')
            p.add_argument('--model')
            p.add_argument('--effort', help='Provider-supported effort; omitted means provider default')
        if command in ['send', 'edit-send', 'edit-message']:
            group = p.add_mutually_exclusive_group(required=True)
            group.add_argument('--text')
            group.add_argument('--text-file')
        if command == 'send': p.add_argument('--request-id')
        if command in ['regenerate', 'edit-send']:
            group = p.add_mutually_exclusive_group(required=True)
            group.add_argument('--user-seq', type=int)
            group.add_argument('--message-id')
        if command == 'edit-message':
            p.add_argument('--role', choices=['user', 'assistant'], required=True)
            p.add_argument('--seq', type=int, help='Required for role=user')
            p.add_argument('--message-id', help='Required for role=assistant')
        if command in ['delete-message', 'delete-user']:
            p.add_argument('--message-id', required=True, help='Exact assistant message ID anchor')
        if command == 'clone': p.add_argument('--at-seq', type=int, required=True)
        if command == 'history':
            p.add_argument('--before-seq', type=int)
            p.add_argument('--through-seq', type=int, required=True, help='Inclusive durable log boundary')
            p.add_argument('--limit', type=int, default=20)
        if command == 'worldline':
            p.add_argument('--action', choices=['select-worldline', 'operation-status'], required=True)
            p.add_argument('--operation-id')
        if command == 'model-set':
            p.add_argument('--body-file', required=True, help='Object with scope, settings, expectedRevision')
        if command == 'model-route':
            p.add_argument('--purpose', choices=['status', 'decision', 'memory'], required=True)
            p.add_argument('--provider', required=True)
            p.add_argument('--model', required=True)
            p.add_argument('--effort', default='medium', help='Provider-supported reasoning effort, e.g. low, medium, off')
            p.add_argument('--scope', choices=['session', 'global'], default='session')
        if command == 'upload-card':
            source = p.add_mutually_exclusive_group(required=True)
            source.add_argument('--file', help='Local .md/.txt/.json/.png role card, maximum 20,000,000 bytes')
            source.add_argument('--resume', action='store_true', help='Confirm the saved import identity without uploading again; requires --import')
            p.add_argument('--import', dest='import_card', action='store_true', help='Explicitly import through official raw upload and durable jobs')
            p.add_argument('--request-id', help='Stable request ID for --import')
            p.add_argument('--recovery-file', help='Local recovery index; defaults to config-directory/card-imports/target-session-hash.json')
            p.add_argument('--end', action='store_true', help='With --import --resume, verify failed/cancelled task and clear only the local index')
        if command == 'upload':
            p.add_argument('--file', required=True, help='Local regular file, maximum 20 MiB')
            p.add_argument('--dir', required=True, help='Relative target directory inside the exact session\'s registered workspace')
        if command == 'export': p.add_argument('--kind', choices=['card-export', 'novel-export'], required=True)
        if command == 'job-action':
            p.add_argument('--job-id', required=True)
            p.add_argument('--action', choices=['retry', 'cancel'], required=True)
        if command == 'download':
            p.add_argument('--resource-id', required=True)
            p.add_argument('--out', required=True, help='New local file; will not overwrite')
        if command == 'settings-set':
            for flag in ['target-context-tokens', 'archive-tokens', 'context-window-tokens', 'continuity-tail-tokens']:
                p.add_argument('--' + flag, dest=flag.replace('-', '_'), type=int)
            p.add_argument('--auto-notes-every-turns', type=int)
        if command in ['settings', 'settings-set']:
            p.add_argument('--scope', choices=['global', 'session'], default='session')
    p = sub.add_parser('request', help='Raw existing REST route; GET by default. Explicit POST for writes.')
    p.add_argument('path')
    p.add_argument('--method', choices=['GET', 'POST'], default='GET')
    p.add_argument('--body-file')
    p.add_argument('--dry-run', action='store_true')
    p = sub.add_parser('userinfo', help='Read the global roleplay persona/user information')
    p.add_argument('--dry-run', action='store_true')
    p = sub.add_parser('persona-set', help='Update global persona via /api/roleplay/userinfo')
    p.add_argument('--body-file', required=True, help='JSON object; supported fields are name and gender')
    p.add_argument('--dry-run', action='store_true')
    args = parser.parse_args(argv)
    if args.command == 'cluster-route':
        if bool(args.provider) != bool(args.model): parser.error('--provider and --model must be supplied together')
        if args.inherit and args.effort: parser.error('--inherit cannot set --effort; use --main or a provider/model')
        if args.character and not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}',
             args.character): parser.error('invalid character ID; read cluster for exact IDs')
        if args.effort and not re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', args.effort): parser.error('invalid reasoning effort')
    if not 1 <= args.timeout <= 120: parser.error('timeout must be 1–120')
    if hasattr(args, 'limit') and not 1 <= args.limit <= 200: parser.error('limit must be 1–200')
    for name in ['user_seq', 'before_seq', 'at_seq', 'through_seq']:
        if getattr(args, name, None) is not None and getattr(args, name) < 0: parser.error(name + ' must be nonnegative')
    if args.command == 'edit-message':
        if args.role == 'user' and args.seq is None: parser.error('--seq is required when --role=user')
        if args.role == 'assistant' and not args.message_id: parser.error('--message-id is required when --role=assistant')
        if args.seq is not None and args.seq < 0: parser.error('seq must be nonnegative')
    if args.command == 'settings-set':
        fields = ['target_context_tokens', 'archive_tokens', 'context_window_tokens', 'continuity_tail_tokens', 'auto_notes_every_turns']
        if not any(getattr(args, field) is not None for field in fields): parser.error('settings-set requires at least one settings flag')
        for field in fields:
            value = getattr(args, field)
            if value is None: continue
            minimum = 1000 if field in ['context_window_tokens', 'continuity_tail_tokens'] else 0
            if value != 0 and value < minimum: parser.error(field.replace('_', '-') + f' must be 0 or at least {minimum}')
        if args.auto_notes_every_turns is not None and args.auto_notes_every_turns != 0 and args.auto_notes_every_turns < 1: parser.error('auto-notes-every-turns must be 0 or at least 1')
    return args


def validate_path(path):
    from urllib.parse import unquote
    if not path.startswith('/api/') or '..' in unquote(path).split('?')[0].split('/') or any(c in path for c in '\r\n\\'):
        raise CliError('path', 'Only local /api/ paths without traversal are accepted')
    return path


def redact(value):
    if isinstance(value, dict):
        return {k: '[REDACTED]' if re.search(r'(?i)^(api.?key|authorization|cookie|set.cookie|access.?token|refresh.?token|secret|password|headers)$',
                 k) else redact(v) for k,
             v in value.items()}
    if isinstance(value, list): return [redact(v) for v in value]
    if isinstance(value, str):
        value = re.sub(r'(?i)([?&]token=)[^\s&]+', r'\1[REDACTED]', value)
        return re.sub(r'(?i)Bearer\s+[^\s"\']+', 'Bearer [REDACTED]', value)
    return value


def unwrap(value):
    if isinstance(value, dict) and value.get('type') == 'server-response': value = value['result']
    if isinstance(value, dict) and value.get('ok') is False:
        error = value.get('error', 'DSH request failed')
        raise CliError(error.get('code',
                 'api-error') if isinstance(error,
                 dict) else 'api-error',
             str(error.get('message',
                     error)) if isinstance(error,
                 dict) else str(error),
             error.get('details') if isinstance(error,
                 dict) else None)
    if isinstance(value, dict) and value.get('ok') is True and 'value' in value: return value['value']
    return value


def rest(path, body=None, **extra):
    return {'method': 'GET' if body is None else 'POST',
         'path': validate_path('/api/roleplay/' + path),
         **({'body': body} if body is not None else {}),
         **extra}


def rpc(method, request):
    key = '_request' if method == 'session/list' else 'request'
    return {'method': 'POST',
         'path': '/api/' + method,
         'body': {'type': 'client-request',
             'rpcId': str(uuid.uuid4()),
             'method': method,
             'payload': {'args': {key: request}}}}


def text_input(args):
    value = Path(args.text_file).read_text(encoding='utf-8-sig') if getattr(args, 'text_file', None) else args.text
    if not value.strip(): raise CliError('input', 'Player input must not be empty')
    return value


def card_file(args):
    path = Path(args.file)
    extension = path.suffix.lower()
    if extension not in {'.md', '.txt', '.json', '.png'}:
        raise CliError('input', 'Role card file extension must be .md, .txt, .json or .png')
    if not path.is_file():
        raise CliError('input', 'Role card file does not exist or is not a regular file')
    size = path.stat().st_size
    if size > CARD_BYTES_LIMIT:
        raise CliError('input', 'Role card file exceeds 20,000,000 bytes')
    with path.open('rb') as source:
        raw = source.read(CARD_BYTES_LIMIT + 1)
    if len(raw) > CARD_BYTES_LIMIT or (args.import_card and not raw):
        raise CliError('input', 'Imported role card must be nonempty and at most 20,000,000 bytes')
    token = uuid.uuid4().hex
    return {'fileName': token + extension,
         'bytes': len(raw),
         'sha256': hashlib.sha256(raw).hexdigest(),
         'fileData': base64.b64encode(raw).decode('ascii')}


def workspace_file(args):
    """Read one bounded local file into a content-addressed workspace upload plan."""
    path = Path(args.file)
    if not path.is_file():
        raise CliError('input', 'Upload file does not exist or is not a regular file')
    size = path.stat().st_size
    if size > 20 * 1024 * 1024:
        raise CliError('input', 'Upload file exceeds 20 MiB')
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    suffix = path.suffix.lower()
    # The extension is only a reader hint. Its narrow grammar keeps the
    # server-side content-addressed filename independent from source paths.
    if suffix and not re.fullmatch(r'\.[a-z0-9][a-z0-9._-]{0,31}', suffix):
        suffix = ''
    return {
        'fileName': digest + suffix,
        'bytes': len(raw),
        'sha256': digest,
        'fileData': base64.b64encode(raw).decode('ascii'),
    }


def build_plan(args):
    from urllib.parse import urlencode
    command = args.command
    sid = getattr(args, 'session', None)
    body = {'sessionId': sid}
    if command == 'doctor': return rest('conversations')
    if command == 'userinfo': return rest('userinfo')
    if command == 'persona-set':
        value = json.loads(Path(args.body_file).read_text(encoding='utf-8-sig'))
        if not isinstance(value, dict) or not any(key in value for key in ['name', 'gender']):
            raise CliError('input', 'Persona body requires name or gender')
        return rest('userinfo', {key: value[key] for key in ['name', 'gender'] if key in value})
    if command == 'workspaces': return {**rpc('workspace/follow', {}), 'stream': True}
    if command == 'workspace-create': return rpc('workspace/create', {'path': args.path})
    if command == 'create':
        if args.workspace_path: return {'workflow': ['workspace/create',
                 'session/create'],
             'workspacePath': args.workspace_path,
             'agentPreset': 'roleplay'}
        location = {'workspaceId': args.workspace_id} if args.workspace_id else {'cwd': args.cwd}
        return rpc('session/create', {**location, 'agentPreset': 'roleplay'})
    if command in ['sessions', 'resolve']:
        if command == 'sessions' and args.source == 'catalog': return rest('conversations')
        offset=int(args.cursor or 0)
        if offset<0: raise CliError('cursor','cursor must be nonnegative')
        return {**rpc('session/list', {}),'summary':'sessions','query':args.query,'limit':args.limit,'offset':offset}
    if command == 'conversations': return rest('conversations')
    if command in ['state', 'activity', 'models', 'jobs', 'resources', 'logs', 'usage']:
        return rest(command + '?' + urlencode(body))
    if command == 'settings': return rest('memory-settings?' + urlencode(body))
    if command in ['cluster', 'cluster-set', 'cluster-route']: return rest('character-cluster?' + urlencode(body))
    if command == 'settings-set': return rest('memory-settings?' + urlencode(body), settingsWrite=True)
    if command == 'history':
        return rpc('session/page',
             {'address': {'kind': 'session',
                     'sessionId': sid},
                 'throughSeq': args.through_seq,
                 'maxMessages': args.limit,
                 **({'beforeSeq': args.before_seq} if args.before_seq is not None else {})})
    if command == 'wake': return rest('wake', body)
    if command == 'cancel': return rpc('session/cancel', body)
    if command == 'clone': return rpc('session/fork', {**body, 'atSeq': args.at_seq})
    if command == 'send':
        return rpc('session/prompt',
             {**body,
                 'requestId': args.request_id
                or str(uuid.uuid4()),
                 'mode': 'queue',
                 'content': [{'type': 'text',
                         'text': text_input(args)}],
                 'clientTimeZone': 'Asia/Hong_Kong'})
    if command == 'upload-card':
        if (args.resume or args.recovery_file or args.end or args.request_id) and not args.import_card:
            raise CliError('arguments', '--resume/--recovery-file/--end/--request-id require --import')
        if args.end and not args.resume:
            raise CliError('arguments', '--end requires --resume')
        if args.request_id is not None and not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', args.request_id):
            raise CliError('arguments', 'Invalid import request ID')
        if args.resume:
            return {'method': 'RESUME', 'action': 'resume-card-import', 'sessionId': sid,
                'import': True, 'requestId': args.request_id, 'end': args.end}
        payload = card_file(args)
        if args.import_card:
            # Keep a safe name hint, while the official service owns the raw bytes.
            payload['fileName'] = payload['sha256'] + Path(args.file).suffix.lower()
        return {'method': 'UPLOAD',
             'action': 'upload-native-card' if args.import_card else 'upload-card',
             'sessionId': sid,
             'import': bool(args.import_card),
             'requestId': (args.request_id
                or str(uuid.uuid4())) if args.import_card else None,
             **payload}
    if command == 'upload':
        return {'method': 'UPLOAD', 'action': 'upload-workspace', 'sessionId': sid, 'targetDirectory': args.dir, **workspace_file(args)}
    if command == 'edit-message':
        value = {'action': 'replace-message', **body, 'role': args.role, 'text': text_input(args)}
        if args.role == 'user': value['seq'] = args.seq
        else: value['messageId'] = args.message_id
        return rest('branch', value)
    if command == 'delete-message': return rest('branch', {**body, 'action': 'delete', 'messageId': args.message_id})
    if command == 'delete-user': return rest('branch', {**body, 'action': 'prepare', 'kind': 'delete-user', 'messageId': args.message_id})
    if command in ['regenerate', 'edit-send']:
        return rest('branch',
             {**body,
                 'action': 'prepare',
                 'kind': 'player-edit' if command == 'edit-send' else 'regenerate',
                 **({'userSeq': args.user_seq} if args.user_seq is not None else {'messageId': args.message_id})})
    if command == 'worldline':
        if args.action == 'operation-status' and not args.operation_id: raise CliError('input', 'operation-status requires --operation-id')
        return rest('branch', {**body, 'action': args.action, **({'operationId': args.operation_id} if args.operation_id else {})})
    if command == 'model-set':
        settings = json.loads(Path(args.body_file).read_text(encoding='utf-8-sig'))
        if not isinstance(settings,
             dict) or not all(k in settings for k in ['scope',
                 'settings',
                 'expectedRevision']): raise CliError('input',
             'Model body requires scope/settings/expectedRevision')
        return rest('models', {**settings, **body})
    if command == 'model-route': return rest('models?' + urlencode(body), readPolicy=True)
    if command == 'export': return rest('jobs', {**body, 'kind': args.kind})
    if command == 'job-action': return rest('jobs', {**body, 'action': args.action, 'jobId': args.job_id})
    if command == 'download': return rest('download?' + urlencode({**body, 'resourceId': args.resource_id}), download=True)
    if command == 'request':
        body = json.loads(Path(args.body_file).read_text(encoding='utf-8-sig')) if args.body_file else None
        if args.method == 'GET' and body is not None: raise CliError('input', 'GET cannot carry a body')
        return {'method': args.method, 'path': validate_path(args.path), **({'body': body} if body is not None else {})}
    raise CliError('command', command)


def cluster_change(args):
    if args.command == 'cluster-set': return {'enabled': args.enabled == 'true'}
    route = None if args.inherit else ({'main': True} if args.main else {'provider': args.provider, 'model': args.model})
    if route is not None and args.effort: route['reasoningEffort'] = args.effort
    return {'characters': {args.character: route}} if args.character else {'defaultRoute': route}


def cluster_record(value, name, require_characters=False):
    """Validate an unmerged cluster scope before using it as a write base."""
    if not isinstance(value, dict) or value.get('schemaVersion') != 1 or type(value.get('revision')) is not int or value['revision'] < 0:
        raise CliError('cluster-invalid-response', f'Missing supported {name} cluster settings/revision; no write sent')
    if require_characters and (type(value.get('enabled')) is not bool or not isinstance(value.get('characters'), dict)):
        raise CliError('cluster-invalid-response', f'Missing supported {name} cluster settings/characters; no write sent')
    return value


def cluster_write_scope(args):
    if args.command == 'cluster-set':
        return 'session'
    return 'session' if args.character else 'global'


def cluster_write_settings(args):
    change = cluster_change(args)
    if cluster_write_scope(args) == 'global':
        return {'defaultRoute': change['defaultRoute']}
    return {'preserve': 'enabled/defaultRoute/other characters', 'change': change}


def endpoint_parts(config):
    """Validate a directly reachable endpoint; a bare IPv6 literal must be bracketed."""
    scheme = str(config.get('scheme') or 'http').lower()
    if scheme not in ('http', 'https'):
        raise CliError('config', 'scheme must be http or https')
    host = str(config.get('host') or '127.0.0.1').strip()
    if not HOST_PATTERN.fullmatch(host) or host.startswith('-') or ('[' in host) != (']' in host):
        raise CliError('config', 'Run dsh-debug init with a valid host')
    if ':' in host and not host.startswith('['):
        raise CliError('config', 'Bracket a bare IPv6 host, for example [::1]')
    try:
        port = int(config.get('port', 3081))
    except (TypeError, ValueError):
        raise CliError('config', 'port must be 1-65535') from None
    if not 1 <= port <= 65535: raise CliError('config', 'port must be 1-65535')
    return scheme, host, port


def target_name(config):
    return str(config.get('target') or ('local' if config.get('local') else 'ssh')).lower()


def load_config(path):
    file = Path(path)
    result = json.loads(file.read_text(encoding='utf-8-sig')) if file.exists() else {}
    for key in ['target', 'ssh_host', 'ssh_key', 'ssh_port', 'remote_python', 'host', 'scheme', 'cookie_file',
                'port', 'service', 'dsh_home', 'harness_root']:
        if os.environ.get('DSH_DEBUG_' + key.upper()): result[key] = os.environ['DSH_DEBUG_' + key.upper()]
    return result


def worker_packet(config, plan):
    packet = {'plan': plan,
         'port': config.get('port',
             3081),
         'service': config.get('service',
             'deepseek-harness'),
         'timeout': config.get('timeout',
             30),
         'dsh_home': config.get('dsh_home'),
         'harness_root': config.get('harness_root')}
    if target_name(config) == 'local':
        scheme, host, port = endpoint_parts(config)
        packet.update({'scheme': scheme, 'host': host, 'port': port})
        if config.get('cookie_file'): packet['cookie_file'] = str(Path(config['cookie_file']).expanduser())
    return packet


def local_transport(config, plan):
    """Run the exact same single-file worker in this process.

    Direct targets keep the SSH worker's contract, allowlist and credential
    handling; only the process boundary and the SSH key are gone. A loopback
    host uses the native DSH credential; any other host must carry its own
    cookie file, and the value stays inside this process.
    """
    worker = Path(__file__).with_name('http_worker.py')
    if not worker.is_file(): raise CliError('config', 'Local worker file missing next to the CLI')
    namespace = {'__name__': 'dsh-debug-local-worker', '__file__': str(worker)}
    exec(compile(worker.read_text(encoding='utf-8'), str(worker), 'exec'), namespace)
    run = namespace.get('run')
    if not callable(run): raise CliError('config', 'Local worker exposes no run entry')
    try:
        return run(worker_packet(config, plan))
    except TimeoutError:
        raise CliError('transport-timeout',
             'Request outcome unknown; inspect the request ID / operation before retrying') from None
    except CliError:
        raise
    except Exception as error:
        # Exception text may embed the token exchange URL; never echo it.
        raise CliError(type(error).__name__, 'Local DSH worker request failed') from None


def ssh_transport(config, plan):
    host, key = config.get('ssh_host', ''), config.get('ssh_key', '')
    if not re.fullmatch(r'[a-zA-Z0-9_.@-]+',
         host) or host.startswith('-'): raise CliError('config',
         'Run dsh-debug init with a valid SSH destination')
    if not Path(key).is_file(): raise CliError('config', 'SSH key file missing')
    try:
        ssh_port = int(config.get('ssh_port', 22))
    except (TypeError, ValueError):
        raise CliError('config', 'ssh_port must be 1-65535') from None
    if not 1 <= ssh_port <= 65535: raise CliError('config', 'ssh_port must be 1-65535')
    python = config.get('remote_python', '/usr/bin/python3')
    if not re.fullmatch(r'/[a-zA-Z0-9_./-]+', python): raise CliError('config', 'Invalid remote Python path')
    code = base64.b64encode(Path(__file__).with_name('http_worker.py').read_bytes()).decode('ascii')
    # Send worker code through stdin too: Windows CreateProcess has a small
    # command-line limit, and worker growth must not break every CLI command.
    command = shlex.quote(python) + ' -c ' + shlex.quote("import sys,base64;exec(compile(base64.b64decode(sys.stdin.readline()),'<dsh-worker>','exec'))")
    packet = worker_packet(config, plan)
    try:
        process = subprocess.run(['ssh',
                 '-i',
                 key,
                 '-p',
                 str(ssh_port),
                 '-o',
                 'IdentitiesOnly=yes',
                 '-o',
                 'BatchMode=yes',
                 '-o',
                 'ConnectTimeout=10',
                 '-o',
                 'StrictHostKeyChecking=yes',
                 host,
                 command],
             input=code+'\n'+json.dumps(packet,
                 ensure_ascii=True),
             capture_output=True,
             text=True,
             encoding='utf-8',
             timeout=int(packet['timeout']) * 2 + 20)
    except subprocess.TimeoutExpired:
        raise CliError('transport-timeout', 'Request outcome unknown; inspect the request ID / operation before retrying') from None
    if process.returncode: raise CliError('ssh', 'SSH command failed; check host, key, known_hosts and remote Python')
    try: return json.loads(process.stdout)
    except ValueError: raise CliError('transport-json', 'SSH worker returned invalid JSON') from None


def transport(config, plan):
    """Select the target: remote SSH by default, or a directly reachable host/port."""
    target = target_name(config)
    if target == 'local': return local_transport(config, plan)
    if target != 'ssh': raise CliError('config', 'target must be ssh or local')
    return ssh_transport(config, plan)


# Keep handlers local: the CLI archive and remote worker have single-file loading contracts.
def dry_run_result(args, plan):
    if args.command in ['upload-card', 'upload']:
        safe = {key: value for key, value in plan.items() if key != 'fileData'}
        if 'fileData' in plan: safe['fileData'] = '<base64 omitted>'
        if args.command == 'upload-card':
            workflow = (['read the strict target/session-bound local recovery index; never upload again',
                'verify terminal task and clear only local identity' if args.end else 'confirm jobs using the saved receipt/request ID']
                if args.resume else ['validate local file and SHA-256',
                'POST original bytes to official /api/session/uploadFileBinary',
                'atomically persist and read back the bounded recovery identity before jobs POST',
                'start or recover one attachment card-import job without a player prompt'] if args.import_card
                else ['validate local file', 'stage on the configured DSH host'])
        else:
            workflow = [
                'validate local regular file and SHA-256',
                'read exact native session metadata and registered workspace snapshot on the server',
                'resolve <registered workspace>/' + args.dir + '/' + plan['fileName'] + ' with symlink containment',
                'reuse an identical hash or exclusively create, then read back bytes and SHA-256',
            ]
        return {'dryRun': True, 'plan': safe, 'workflow': workflow}
    if args.command in ['cluster-set', 'cluster-route']:
        scope = cluster_write_scope(args)
        revision = '<global revision returned by read>' if scope == 'global' else '<session revision returned by read>'
        settings = cluster_write_settings(args)
        if scope == 'session':
            settings = {'enabled': '<session enabled>',
                 'defaultRoute': '<session defaultRoute>',
                 'characters': '<session characters>',
                 'change': settings['change']}
        return {'dryRun': True,
             'plan': {'read': plan,
                 'write': rest('character-cluster',
                     {'sessionId': args.session,
                         'scope': scope,
                         'expectedRevision': revision,
                         'settings': settings})},
             'workflow': ['wake named session without prompt',
                 'read effective settings plus raw session/global scopes and roster',
                 'merge selected setting in its owning scope',
                 'revision-checked write; no automatic retry']}
    if args.command == 'model-route':
        preview = {'scope': args.scope,
             'settings': {'preserve': 'existing allMain/routes',
                 'routes': {args.purpose: {'provider': args.provider,
                         'model': args.model,
                         'reasoningEffort': args.effort}}},
             'expectedRevision': '<revision returned by read>'}
        return {'dryRun': True,
             'plan': {'read': plan,
                 'write': rest('models',
                     {**{'sessionId': args.session},
                         'scope': args.scope,
                         **preview})},
             'workflow': ['read models',
                 'merge selected purpose route',
                 'write models']}
    if args.command == 'settings-set':
        return {'dryRun': True,
             'plan': {'read': plan,
                 'write': {'method': 'POST',
                     'path': '/api/roleplay/memory-settings',
                     'body': {'sessionId': args.session,
                         'scope': args.scope,
                         'settings': '<selected fields>',
                         'expectedRevision': '<revision returned by read>'}}},
             'workflow': ['read memory-settings',
                 'select supplied fields',
                 'write /api/roleplay/memory-settings']}
    workflow = None
    if args.command in ['regenerate', 'edit-send']:
        workflow = ['wake', 'prepare', 'create-worldline', 'wake-child', 'register', 'native-queue']
    elif args.command == 'delete-user':
        workflow = ['wake', 'prepare', 'create-worldline', 'wake-child', 'truncate-worldline']
    return {'dryRun': True, 'plan': plan, 'workflow': workflow}


def execute_settings_write(args, plan, call):
    current = call(plan)
    fields = {'target_context_tokens': 'targetContextTokens',
         'archive_tokens': 'archiveTokens',
         'context_window_tokens': 'contextWindowTokens',
         'continuity_tail_tokens': 'continuityTailTokens',
         'auto_notes_every_turns': 'autoNotesEveryTurns'}
    selected = {}
    for source, target in fields.items():
        value = getattr(args, source)
        if value is not None: selected[target] = value
    target = current.get(args.scope) if isinstance(current, dict) else None
    revision = target.get('revision') if isinstance(target, dict) else None
    write_plan = rest('memory-settings', {'sessionId': args.session, 'scope': args.scope, 'settings': selected, 'expectedRevision': revision})
    saved = call(write_plan)
    target_saved = saved.get(args.scope) if isinstance(saved, dict) else None
    return {'sessionId': args.session,
         'scope': args.scope,
         'settings': target_saved.get('settings',
             selected) if isinstance(target_saved,
             dict) else selected,
         'settingsRevision': target_saved.get('revision',
             revision) if isinstance(target_saved,
             dict) else revision}


def execute_workspace_create(args, plan, call):
    try:
        adopted = call(rpc('workspace/create', {'path': args.workspace_path}))
        workspace = adopted.get('workspace') if isinstance(adopted, dict) else None
        workspace_id = workspace.get('workspaceId') if isinstance(workspace, dict) else None
        if not workspace_id:
            raise CliError('workspace-invalid-response', 'Workspace create returned no workspace ID', {'path': args.workspace_path})
        return call(rpc('session/create', {'workspaceId': workspace_id, 'agentPreset': 'roleplay'}))
    except CliError:
        raise
    except Exception as error:
        raise CliError('workspace-create-failed', str(error), {'path': args.workspace_path}) from None


def execute_cluster_write(args, plan, call):
    try:
        current = call(plan)
        if not isinstance(current, dict):
            raise CliError('cluster-invalid-response', 'Missing supported cluster response; no write sent')
        scope = cluster_write_scope(args)
        session = cluster_record(current.get('session'), 'session', require_characters=True)
        global_settings = cluster_record(current.get('global'), 'global')
        change = cluster_change(args)
        if 'characters' in change:
            roster = {c.get('id') for c in current.get('characters', []) if isinstance(c, dict)}
            if args.character not in roster: raise CliError('cluster-unknown-character',
                 'Character is not in the current roster; refresh cluster first')
            change['characters'] = {**session['characters'], **change['characters']}
        if scope == 'global':
            body = {'sessionId': args.session,
                 'scope': 'global',
                 'expectedRevision': global_settings['revision'],
                 'settings': {'defaultRoute': change['defaultRoute']}}
        else:
            body = {'sessionId': args.session,
                 'scope': 'session',
                 'expectedRevision': session['revision'],
                 'settings': {**{key: session[key] for key in ['enabled',
                             'defaultRoute',
                             'characters']},
                     **change}}
        return call(rest('character-cluster', body))
    except CliError as error:
        raise CliError(error.code, str(error), {'sessionId': args.session, 'automaticRetry': False, 'cause': error.details}) from None


def execute_player_worldline(args, plan, call):
    progress = {'sourceSessionId': args.session, 'requestId': str(uuid.uuid4())}
    try:
        main = call(rest('models?sessionId=' + args.session)).get('main')
        prepared = call(plan)
        progress['operationId'] = prepared['operationId']
        created = call(rest('branch', {'action': 'create-worldline', 'sessionId': args.session, 'operationId': prepared['operationId']}))
        child = progress['executionSessionId'] = created['childSessionId']
        call(rest('wake', {'sessionId': child}))
        if main and main.get('provider') and main.get('model'):
            call(rpc('session/selectModel', {'sessionId': child, **{k: main[k] for k in ['provider', 'model', 'reasoningEffort'] if main.get(k)}}))
        text = text_input(args) if args.command == 'edit-send' else prepared['promptText']
        call(rest('branch',
                 {'action': 'register',
                     'operationId': prepared['operationId'],
                     'childSessionId': child,
                     'requestId': progress['requestId'],
                     'promptText': text}))
        result = call(rpc('session/prompt',
                 {'sessionId': child,
                     'requestId': progress['requestId'],
                     'mode': 'queue',
                     'content': [{'type': 'text',
                             'text': text}]}))
        return {**progress,
             'admission': result,
             'completion': 'Check worldline --action operation-status; submission does not mean generation completed'}
    except Exception as error:
        raise CliError('worldline-incomplete', str(error), {**progress, 'automaticRetry': False, 'automaticAbort': False}) from None


def execute_delete_user_worldline(args, plan, call):
    progress = {'sourceSessionId': args.session}
    try:
        prepared = call(plan)
        progress['operationId'] = prepared['operationId']
        created = call(rest('branch', {'action': 'create-worldline', 'sessionId': args.session, 'operationId': prepared['operationId']}))
        child = progress['executionSessionId'] = created['childSessionId']
        call(rest('wake', {'sessionId': child}))
        registered = call(rest('branch', {'action': 'register', 'operationId': prepared['operationId'], 'childSessionId': child}))
        if not isinstance(registered, dict) or registered.get('truncated') is not True or registered.get('childSessionId') != child:
            raise CliError('worldline-incomplete', 'Delete-user registration returned no truncation proof', {**progress, 'registration': registered})
        return {**progress, 'truncated': True, 'completion': 'Deleted player turn is represented by the new worldline'}
    except Exception as error:
        raise CliError('worldline-incomplete', str(error), {**progress, 'automaticRetry': False, 'automaticAbort': False}) from None


def execute_model_route(args, plan, call):
    try:
        current = call(plan)
        scope = args.scope
        stored = current.get(scope) if isinstance(current, dict) else None
        if scope == 'session' and stored is None:
            # A missing session record inherits global policy. Saving one
            # route must not materialize every inherited route locally.
            inherited = current.get('effective') if isinstance(current, dict) else None
            stored = {'allMain': bool((inherited or {}).get('allMain', False)), 'routes': {}}
        stored = stored or {'allMain': False, 'routes': {}}
        settings = {
            'allMain': bool(stored.get('allMain', False)),
            'routes': dict(stored.get('routes') or {}),
        }
        settings['routes'][args.purpose] = {'provider': args.provider, 'model': args.model, 'reasoningEffort': args.effort}
        revision = int((current.get(scope) or {}).get('revision', 0)) if isinstance(current, dict) else 0
        write_plan = rest('models', {'sessionId': args.session, 'scope': scope, 'settings': settings, 'expectedRevision': revision})
        result = call(write_plan)
        return {'scope': scope, 'purpose': args.purpose, 'settings': settings, 'expectedRevision': revision, 'saved': result}
    except CliError as error:
        raise CliError(error.code, str(error), {'automaticRetry': False}) from None


def card_import_target_id(config):
    """Hash routing identity only: credentials and local source paths never enter the journal."""
    target = target_name(config)
    if target == 'local':
        scheme, host, port = endpoint_parts(config)
        route = [target, scheme, host.casefold(), port]
    elif target == 'ssh':
        destination = str(config.get('ssh_host') or '').strip()
        if destination and (not re.fullmatch(r'[A-Za-z0-9_.@-]+', destination) or destination.startswith('-')):
            raise CliError('config', 'Invalid SSH routing identity')
        user, separator, host = destination.rpartition('@')
        route = [target, user if separator else '', (host if separator else destination).casefold(),
            int(config.get('ssh_port', 22)), 'http', '127.0.0.1', int(config.get('port', 3081))]
    else:
        raise CliError('config', 'target must be ssh or local')
    return hashlib.sha256(json.dumps(route, ensure_ascii=True, separators=(',', ':')).encode('ascii')).hexdigest()


class CardImportJournal:
    """Own the single local pending identity and serialize explicit CLI attempts."""
    fields = {'schemaVersion', 'targetId', 'sessionId', 'receiptId', 'requestId', 'createdAt'}

    def __init__(self, args, config):
        self.target_id, self.session_id = card_import_target_id(config), args.session
        if not isinstance(self.session_id, str) or not 1 <= len(self.session_id) <= 256 or re.search(r'[\x00-\x1f\x7f]', self.session_id):
            raise CliError('import-recovery', 'Invalid import session identity')
        label = hashlib.sha256(json.dumps([self.target_id, self.session_id], ensure_ascii=True).encode('ascii')).hexdigest()
        default = Path(args.config).expanduser().absolute().parent / 'card-imports' / (label + '.json')
        self.path = Path(args.recovery_file).expanduser().absolute() if args.recovery_file else default
        self.lock_path = self.path.with_name(self.path.name + '.lock')
        self.lock_owned = False
        self.lock_owner = {'schemaVersion': 1, 'pid': os.getpid(), 'token': uuid.uuid4().hex}
        self.lock_identity = None

    def release_lock(self):
        """Never remove a replacement/unknown lock, including after interrupted entry."""
        if not self.lock_owned: return
        try:
            descriptor = os.open(self.lock_path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
            with os.fdopen(descriptor, 'rb') as lock:
                identity = os.fstat(lock.fileno())
                if not stat.S_ISREG(identity.st_mode) or (identity.st_dev, identity.st_ino) != self.lock_identity: return
                raw = lock.read(513)
            if len(raw) > 512: return
            def owner_fields(pairs):
                if len(pairs) != 3 or {key for key, _ in pairs} != {'schemaVersion', 'pid', 'token'}:
                    raise ValueError('unknown or duplicate owner fields')
                return dict(pairs)
            owner = json.loads(raw.decode('utf-8'), object_pairs_hook=owner_fields)
            if (not isinstance(owner, dict) or set(owner) != {'schemaVersion', 'pid', 'token'}
                or type(owner['schemaVersion']) is not int or type(owner['pid']) is not int
                or not isinstance(owner['token'], str) or not re.fullmatch(r'[a-f0-9]{32}', owner['token'])
                or owner != self.lock_owner): return
            current = self.lock_path.stat(follow_symlinks=False)
            if stat.S_ISREG(current.st_mode) and (current.st_dev, current.st_ino) == self.lock_identity:
                self.lock_path.unlink()
        except (OSError, ValueError, UnicodeError):
            pass
        finally:
            self.lock_owned = False

    def __enter__(self):
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            if self.path.is_symlink() or self.lock_path.is_symlink():
                raise OSError('symlink index')
            descriptor = os.open(self.lock_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            self.lock_owned = True
            created = os.fstat(descriptor)
            self.lock_identity = (created.st_dev, created.st_ino)
            with os.fdopen(descriptor, 'w', encoding='utf-8') as lock:
                lock.write(json.dumps(self.lock_owner, separators=(',', ':')))
                lock.flush()
                os.fsync(lock.fileno())
            return self
        except OSError:
            self.release_lock()
            raise CliError('import-recovery-lock',
                'Recovery identity is locked or inaccessible; check any active CLI attempt before manually removing a stale lock') from None

    def __exit__(self, *_):
        self.release_lock()

    def read(self):
        try:
            descriptor = os.open(self.path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0))
        except FileNotFoundError:
            return None
        except OSError:
            raise CliError('import-recovery-read', 'Cannot read recovery identity; import submission stopped') from None
        try:
            with os.fdopen(descriptor, 'rb') as source:
                if not stat.S_ISREG(os.fstat(source.fileno()).st_mode): raise ValueError('nonregular index')
                raw = source.read(2049)
            if len(raw) > 2048: raise ValueError('oversized index')
            def exact_fields(pairs):
                value = {}
                for key, item in pairs:
                    if key in value: raise ValueError('duplicate field')
                    value[key] = item
                return value
            index = json.loads(raw.decode('utf-8'), object_pairs_hook=exact_fields)
            if not isinstance(index, dict) or set(index) != self.fields: raise ValueError('index fields')
            if type(index['schemaVersion']) is not int or index['schemaVersion'] != 1: raise ValueError('schema')
            if index['targetId'] != self.target_id or index['sessionId'] != self.session_id: raise ValueError('scope')
            if not all(isinstance(index[field], str) and re.fullmatch(r'[A-Za-z0-9_-]{1,128}', index[field])
                    for field in ['receiptId', 'requestId']): raise ValueError('identifiers')
            if type(index['createdAt']) is not int or not 0 <= index['createdAt'] <= 8_640_000_000_000_000:
                raise ValueError('timestamp')
            return index
        except (OSError, ValueError, UnicodeError):
            raise CliError('import-recovery-invalid',
                'Recovery identity is damaged, unsupported, or belongs to another target/session; preserve it and inspect the original task') from None

    def prepare(self, receipt_id, request_id):
        if self.read() is not None:
            raise CliError('import-recovery-pending', 'An import identity already exists; use --import --resume without a file')
        index = {'schemaVersion': 1, 'targetId': self.target_id, 'sessionId': self.session_id,
            'receiptId': receipt_id, 'requestId': request_id, 'createdAt': int(time.time() * 1000)}
        temporary = self.path.with_name(self.path.name + '.tmp-' + uuid.uuid4().hex)
        try:
            descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, 'w', encoding='utf-8', newline='\n') as output:
                output.write(json.dumps(index, ensure_ascii=True, separators=(',', ':')) + '\n')
                output.flush()
                os.fsync(output.fileno())
            # All CLI writers hold this exclusive lock; re-read before the atomic publication.
            if self.read() is not None: raise OSError('identity appeared during upload')
            os.replace(temporary, self.path)
            if os.name == 'posix':
                directory = os.open(self.path.parent, os.O_RDONLY | os.O_DIRECTORY)
                try: os.fsync(directory)
                finally: os.close(directory)
            if self.read() != index: raise OSError('readback mismatch')
            return index
        except (OSError, CliError):
            raise CliError('import-recovery-write',
                'Recovery identity could not be saved and verified; no import POST was sent. Preserve any existing index and check local storage') from None
        finally:
            try: temporary.unlink(missing_ok=True)
            except OSError: pass

    def clear(self, index):
        current = self.read()
        if current is None: return True
        if current != index: return False
        try:
            self.path.unlink()
            if self.read() is not None: raise OSError('index remains')
        except (OSError, CliError):
            raise CliError('import-recovery-clear', 'Cannot clear the local recovery identity; confirm the same task again') from None
        return True


def verified_card_upload(uploaded, plan):
    valid = isinstance(uploaded, dict) and isinstance(uploaded.get('receiptId'), str)
    valid = valid and re.fullmatch(r'[A-Za-z0-9_-]{1,128}', uploaded['receiptId'])
    file = uploaded.get('file') if isinstance(uploaded, dict) else None
    if not valid or not isinstance(file, dict) or set(file) != {'attachmentId', 'name', 'bytes'}:
        raise CliError('upload-verification', 'Official upload returned an invalid receipt or file reference')
    if (type(file['bytes']) is not int or file['bytes'] != plan['bytes']
        or file['attachmentId'] != 'sha256:' + plan['sha256'] or file['name'] != plan['fileName']):
        raise CliError('upload-verification', 'Official upload file reference does not match the original bytes, SHA-256, or name')
    return uploaded['receiptId']


def execute_card_import(args, plan, config, call):
    journal, index, receipt_id, stage = None, None, None, 'prepare'
    try:
        with CardImportJournal(args, config) as journal:
            index = journal.read()
            if args.resume:
                if index is None: raise CliError('import-recovery-absent', 'No saved import identity')
                if args.request_id is not None and args.request_id != index['requestId']:
                    raise CliError('import-recovery-conflict', 'Request ID differs from the saved import')
            elif index is not None:
                raise CliError('import-recovery-pending', 'An import is pending')
            stage = 'jobs-get' if args.end else 'jobs-post' if args.resume else 'upload'
            call(rest('wake', {'sessionId': args.session}))
            if index is None:
                receipt_id = verified_card_upload(call(plan), plan)
                stage = 'prepare'
                index = journal.prepare(receipt_id, plan['requestId'])
            result = {'sessionId': args.session, 'receiptId': index['receiptId'], 'requestId': index['requestId'],
                'recoveryFile': str(journal.path), 'resumed': bool(args.resume), 'automaticRetry': False}
            if args.end:
                stage = 'jobs-get'
                response = call(rest('jobs?' + urlencode({'sessionId': args.session})))
                jobs = response.get('jobs') if isinstance(response, dict) and response.get('ok') is True else None
                matches = [job for job in jobs if isinstance(job, dict) and job.get('kind') == 'card-import'
                    and job.get('requestId') == index['requestId']] if isinstance(jobs, list) else []
                job = matches[0] if len(matches) == 1 else None
                if (not job or job.get('status') not in ['failed', 'cancelled'] or not isinstance(job.get('id'), str)
                    or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', job['id'])):
                    raise CliError('import-end-unconfirmed', 'Original task is not uniquely confirmed failed/cancelled; recovery identity retained')
                if not journal.clear(index): raise CliError('import-recovery-conflict', 'Recovery identity changed; it was not cleared')
                return {**result, 'ended': True, 'job': job, 'completion':
                    'Only the local recovery identity was cleared; original task/source/history retained, current card not rolled back'}
            stage = 'jobs-post'
            response = call(rest('jobs', {'sessionId': args.session, 'kind': 'card-import',
                'attachment': {'receiptId': index['receiptId']}, 'requestId': index['requestId']}))
            job = response.get('job') if isinstance(response, dict) and response.get('ok') is True else None
            completed = isinstance(job, dict) and job.get('status') == 'completed'
            if completed:
                if (job.get('kind') != 'card-import' or job.get('requestId') != index['requestId']
                    or not isinstance(job.get('id'), str)
                    or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', job['id'])):
                    raise CliError('import-completion-unconfirmed', 'Completed receipt identity does not match; recovery index retained')
                if not journal.clear(index): raise CliError('import-recovery-conflict', 'Recovery identity changed; it was not cleared')
            return {**result, 'job': job, 'completion': 'completed' if completed else
                'Unconfirmed/noncompleted: recovery identity retained; inspect jobs, then explicitly --import --resume'}
    except CliError as error:
        original_details = error.details if isinstance(error.details, dict) else {}
        http_status = original_details.get('httpStatus')
        explicit_status = type(http_status) is int and 100 <= http_status <= 599
        details = {'sessionId': args.session, 'stage': stage, 'automaticRetry': False,
            'serverRejected': bool(explicit_status and 400 <= http_status < 500)}
        if explicit_status: details['httpStatus'] = http_status
        if journal is not None: details['recoveryFile'] = str(journal.path)
        if index is not None: details.update({'receiptId': index['receiptId'], 'requestId': index['requestId']})
        else:
            details['requestId'] = plan.get('requestId')
            if receipt_id is not None: details['receiptId'] = receipt_id
        if stage in ['upload', 'prepare']:
            message = 'Card import stopped before this attempt sent any jobs POST; preserve any saved identity and inspect storage/upload state.'
        elif stage == 'jobs-get':
            message = 'Original task could not be confirmed failed/cancelled; recovery identity retained. '
            message += 'No-job or pre-admission expired-receipt cases cannot use --end; inspect manually.'
        else:
            message = 'Import outcome is unconfirmed; preserve the original identity and retry only with --resume. '
            message += 'HTTP rejection does not prove no side effects. A cold pre-admission receipt may be invalid; inspect manually.'
        raise CliError(error.code, message, details) from None


def execute_card_upload(args, plan, call):
    request_id = plan.get('requestId')
    try:
        uploaded = call(plan)
        if (not isinstance(uploaded, dict) or uploaded.get('sha256') != plan['sha256']
                or uploaded.get('bytes') != plan['bytes'] or not uploaded.get('path')):
            raise CliError('upload-verification',
                 'Upload worker returned mismatched path, size or SHA-256',
                 {'requestId': request_id,
                     'targetFileName': plan.get('fileName'),
                     'path': uploaded.get('path') if isinstance(uploaded,
                         dict) else None})
        result = {'path': uploaded['path'],
             'bytes': uploaded['bytes'],
             'sha256': uploaded['sha256'],
             'requestId': plan['requestId'] if args.import_card else None}
        return result
    except CliError as error:
        error.details = {**(error.details
                or {}),
             'requestId': request_id,
             'targetFileName': plan.get('fileName'),
             'path': (error.details
                or {}).get('path'),
             'automaticRetry': False}
        raise


def execute_workspace_upload(args, plan, call):
    try:
        uploaded = call(plan)
        if (not isinstance(uploaded, dict) or uploaded.get('sha256') != plan['sha256']
                or uploaded.get('bytes') != plan['bytes'] or not uploaded.get('path')
                or not uploaded.get('workspaceId')):
            raise CliError('upload-verification', 'Workspace upload worker returned mismatched path, workspace, size or SHA-256', {
                'sessionId': args.session,
                'targetDirectory': args.dir,
                'path': uploaded.get('path') if isinstance(uploaded, dict) else None,
            })
        return {key: uploaded[key] for key in ['path', 'bytes', 'sha256', 'workspaceId', 'reused'] if key in uploaded}
    except CliError:
        raise
    except Exception as error:
        raise CliError('upload-workspace-failed',
             str(error),
             {'sessionId': args.session,
                 'targetDirectory': args.dir,
                 'automaticRetry': False}) from None


def format_common_result(args, plan, result):
    if args.command == 'send': return {'requestId': plan['body']['payload']['args']['request']['requestId'], 'admission': result}
    if args.command == 'download':
        raw = base64.b64decode(result['binary'], validate=True)
        with open(args.out, 'xb') as target: target.write(raw)
        return {'path': str(Path(args.out).resolve()), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
    if args.command in ['sessions', 'resolve']:
        if isinstance(result, dict) and 'conversations' in result:
            rows = list(result['conversations'].values())
            if args.command == 'resolve': rows += list(result.get('worldlines', {}).values())
            rows = [r for r in rows if args.query.lower() in json.dumps(r).lower()]
            offset = int(args.cursor or 0)
            if offset < 0: raise CliError('cursor', 'cursor must be nonnegative')
            return {'sessions': rows[offset:offset+args.limit],
                 'total': len(rows),
                 'nextCursor': str(offset+args.limit) if offset+args.limit < len(rows) else None,
                 'source': 'Tavern ownership catalog',
                 'lookup': 'ID/prefix; titles are not stored in this catalog. Explicit clones appear after their first catalog registration.'}
        rows = result if isinstance(result, list) else result.get('sessions', result.get('items', []))
        return {'sessions': rows[:args.limit],
             'total': result.get('total',
                len(rows)) if isinstance(result,
                dict) else len(rows),
             'returnedByServer': len(rows),
             'truncatedLocally': len(rows) > args.limit,
             'nextCursor': result.get('nextCursor',
                 result.get('cursor')) if isinstance(result,
                 dict) else None,
             'source':result.get('source') if isinstance(result,
                dict) else None}
    return result


def execute(args, config, transport=transport):
    plan = build_plan(args)
    if getattr(args, 'dry_run', False):
        return dry_run_result(args, plan)
    def call(p): return unwrap(transport(config, p))
    if args.command == 'upload-card' and args.import_card:
        return execute_card_import(args, plan, config, call)
    if args.command == 'settings-set':
        return execute_settings_write(args, plan, call)
    if args.command == 'create' and args.workspace_path:
        return execute_workspace_create(args, plan, call)
    if args.command == 'workspaces':
        return call(plan)
    if args.command == 'doctor':
        target = target_name(config)
        call(plan)
        if target == 'local':
            scheme, host, port = endpoint_parts(config)
            endpoint = f'{scheme}://{host}:{port}'
            explicit = bool(config.get('cookie_file')
                or os.environ.get('DSH_DEBUG_COOKIE_FILE')
                or os.environ.get('DSH_DEBUG_COOKIE'))
            auth = ('explicit cookie referenced for this run; never printed, copied or stored'
                if explicit else
                'native DSH browser credential signed for the loopback authority inside the CLI process')
        else:
            ssh_port = int(config.get('ssh_port', 22))
            endpoint = str(config.get('ssh_host', '')) + ('' if ssh_port == 22 else f':{ssh_port}')
            auth = 'SSH + native DSH browser credential, signed/exchanged only on server'
        return {'version': VERSION,
             'reachable': True,
             'target': target,
             'endpoint': endpoint,
             'auth': auth,
             'credentialsReturned': False,
             'newServerEndpoint': False}
    if args.command == 'download' and Path(args.out).exists(): raise CliError('exists', 'Download target already exists; choose a new --out path')
    # Agent-owned routes may be absent after a restart. Explicit wake resumes the
    # named Agent only; it sends no prompt. No retries of paid/writing requests.
    if getattr(args, 'session', None) and args.command not in ['history', 'cancel', 'clone', 'upload']:
        call(rest('wake', {'sessionId': args.session}))
    if args.command in ['cluster-set', 'cluster-route']:
        return execute_cluster_write(args, plan, call)
    if args.command in ['regenerate', 'edit-send']:
        return execute_player_worldline(args, plan, call)
    if args.command == 'delete-user':
        return execute_delete_user_worldline(args, plan, call)
    if args.command == 'model-route':
        return execute_model_route(args, plan, call)
    if args.command == 'upload-card':
        return execute_card_upload(args, plan, call)
    if args.command == 'upload':
        return execute_workspace_upload(args, plan, call)
    try: result = call(plan)
    except CliError as error:
        if args.command == 'send': error.details = {'requestId': plan['body']['payload']['args']['request']['requestId'],
             'sessionId': args.session,
             'automaticRetry': False}
        raise
    return format_common_result(args, plan, result)


def main():
    try:
        args = parse(sys.argv[1:])
        if args.command == 'init':
            path = Path(args.config)
            if path.exists(): raise CliError('exists', 'Config already exists; edit it explicitly')
            path.parent.mkdir(parents=True, exist_ok=True)
            if args.target == 'ssh' and not (args.ssh_host and args.ssh_key):
                raise CliError('arguments', '--target ssh requires --ssh-host and --ssh-key; '
                    'use --target local for a directly reachable DSH host/port')
            if not 1 <= args.port <= 65535: raise CliError('arguments', 'port must be 1-65535')
            value = {'target': args.target,
                 'port': args.port,
                 'service': args.service,
                 'dsh_home': args.dsh_home,
                 'harness_root': args.harness_root}
            if args.target == 'ssh':
                if not 1 <= args.ssh_port <= 65535: raise CliError('arguments', 'ssh port must be 1-65535')
                value['ssh_host'] = args.ssh_host
                value['ssh_key'] = str(Path(args.ssh_key).resolve())
                value['ssh_port'] = args.ssh_port
                value['remote_python'] = args.remote_python
            else:
                endpoint_parts({'scheme': args.scheme, 'host': args.host, 'port': args.port})
                value['scheme'] = args.scheme
                value['host'] = args.host
                if args.cookie_file:
                    cookie_file = Path(args.cookie_file).expanduser()
                    if not cookie_file.is_file(): raise CliError('arguments', 'cookie file not found')
                    value['cookie_file'] = str(cookie_file.resolve())
            path.write_text(json.dumps(value, indent=2), encoding='utf-8')
            result = {'config': str(path), 'target': args.target, 'secretsStored': False, 'cookieStored': False}
        else:
            config = load_config(args.config)
            config['timeout'] = args.timeout
            result = execute(args, config)
        output, code = {'schemaVersion': 1, 'ok': True, 'data': redact(result)}, 0
    except Exception as error:
        output, code = {'schemaVersion': 1,
             'ok': False,
             'error': {'code': getattr(error,
                     'code',
                     type(error).__name__),
                 'message': redact(str(error)),
                 'details': redact(getattr(error,
                         'details',
                         None))}}, 1
    print(json.dumps(output, ensure_ascii=True))
    return code


if __name__ == '__main__':
    sys.exit(main())
