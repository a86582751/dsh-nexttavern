"""Deterministic release archives and exact, selected published components."""
import gzip
import base64
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import os
import shutil
import sys
import tarfile
import tempfile


def safe_name(name):
    if not name or '\\' in name or ':' in name or name.startswith('/') or any(x in ('', '.', '..') for x in name.split('/')):
        raise ValueError('unsafe archive entry')


class HashingReader:
    def __init__(self, source, integrity=None, shasum=None):
        self.source, self.digest, self.bytes = source, hashlib.sha256(), 0
        self.sha512 = hashlib.sha512() if integrity is not None else None
        self.sha1 = hashlib.sha1() if shasum is not None else None

    def read(self, size=-1):
        data = self.source.read(size)
        self.digest.update(data)
        if self.sha512 is not None:
            self.sha512.update(data)
        if self.sha1 is not None:
            self.sha1.update(data)
        self.bytes += len(data)
        return data


def stream_archive(target, visit, expected_sha256=None, integrity=None, shasum=None):
    # Hash the compressed bytes as tarfile consumes them. Drain any gzip/tar
    # padding after its final header so the identity covers the actual tgz.
    with target.open('rb') as source:
        reader = HashingReader(source, integrity, shasum)
        with tarfile.open(fileobj=reader, mode='r|gz') as archive:
            for member in archive:
                visit(archive, member)
        while reader.read(1024 * 1024):
            pass
        result = {'sha256': reader.digest.hexdigest(), 'bytes': reader.bytes}
        if integrity is not None and integrity != 'sha512-' + base64.b64encode(reader.sha512.digest()).decode('ascii'):
            raise ValueError('published npm integrity mismatch')
        if shasum is not None and shasum != reader.sha1.hexdigest():
            raise ValueError('published npm shasum mismatch')
    if expected_sha256 is not None and result['sha256'] != expected_sha256:
        raise ValueError('released archive SHA-256 mismatch')
    return result


def inspect_archive(job):
    root = 'package/'
    wanted = {root + name: None for name in ('package.json', 'provenance.json', 'nexttavern.dependencies.json')}
    found = {}

    def visit(archive, member):
        if member.name not in wanted:
            return
        if member.name in found or not member.isfile():
            raise ValueError('invalid published archive metadata member')
        found[member.name] = json.loads(archive.extractfile(member).read().decode('utf-8-sig'))

    result = stream_archive(Path(job['archive']), visit, job.get('expectedSha256'), job.get('integrity'), job.get('shasum'))
    if found.keys() != wanted.keys():
        raise ValueError('missing published archive metadata')
    metadata, provenance = found[root + 'package.json'], found[root + 'provenance.json']
    header = {key: provenance[key] for key in
              ('schemaVersion', 'sourceCommit', 'version', 'dirty', 'product', 'foundation', 'audience')
              if key in provenance}
    # Early public receipts omitted version; their own package metadata still
    # supplies it. An explicitly different provenance version is never replaced.
    header.setdefault('version', metadata['version'])
    result.update(rootPrefix=root, metadata={key: metadata[key] for key in ('name', 'version')},
                  provenance=header, inventory=found[root + 'nexttavern.dependencies.json'])
    return result


def extract_components(job):
    selections, published = [], []
    try:
        outputs = [Path(component['output']).absolute() for component in job['components']]
        for index, output in enumerate(outputs):
            if os.path.lexists(output):
                raise ValueError('released component output must be new')
            if any(output == other or output in other.parents or other in output.parents
                   for other in outputs[:index]):
                raise ValueError('overlapping released component outputs')
        for component, output in zip(job['components'], outputs):
            prefix = component['prefix']
            safe_name(prefix.rstrip('/'))
            expected = {}
            directories = set()
            for entry in component['files']:
                safe_name(entry['path'])
                if entry['path'] in expected:
                    raise ValueError('duplicate released component member')
                expected[entry['path']] = entry['sha256']
                directories.update(str(parent) for parent in PurePosixPath(entry['path']).parents if str(parent) != '.')
            output.parent.mkdir(parents=True, exist_ok=True)
            stage = Path(tempfile.mkdtemp(prefix=output.name + '.extract-', dir=output.parent))
            selections.append({'prefix': prefix, 'output': output, 'stage': stage,
                               'expected': expected, 'directories': directories})

        def visit(archive, member):
            selected = [selection for selection in selections
                        if member.name.rstrip('/') == selection['prefix'].rstrip('/') or member.name.startswith(selection['prefix'])]
            if not selected:
                return
            if member.name.rstrip('/') == selected[0]['prefix'].rstrip('/'):
                if not member.isdir():
                    raise ValueError('released component root is not a directory')
                return
            relative = member.name[len(selected[0]['prefix']):]
            if member.isdir():
                relative = relative.rstrip('/')
            if member.isdir():
                if any(relative not in selection['directories'] for selection in selected):
                    raise ValueError('extra released component directory')
                return
            if not member.isfile():
                raise ValueError('released component links or special members are unavailable')
            data = archive.extractfile(member).read()
            digest = hashlib.sha256(data).hexdigest()
            for selection in selected:
                expected = selection['expected'].pop(relative, None)
                if expected is None or digest != expected:
                    raise ValueError('released component member mismatch: ' + relative)
                target = selection['stage'].joinpath(*PurePosixPath(relative).parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as output:
                    output.write(data)
                target.chmod(member.mode & 0o777)

        # Inspection owns the compressed archive identity. Extraction consumes
        # that inventory and verifies only the selected complete payloads.
        with tarfile.open(job['archive'], mode='r|gz') as archive:
            for member in archive:
                visit(archive, member)
        if any(selection['expected'] for selection in selections):
            raise ValueError('missing released component member')
        # Publish only complete components. If a later rename fails, remove
        # this invocation's earlier outputs before propagating the failure.
        for selection in selections:
            if os.path.lexists(selection['output']):
                raise ValueError('released component output changed during extraction')
            selection['stage'].rename(selection['output'])
            published.append(selection['output'])
        return {'components': len(selections)}
    except BaseException:
        for output in reversed(published):
            shutil.rmtree(output)
        raise
    finally:
        for selection in selections:
            if selection['stage'].exists():
                shutil.rmtree(selection['stage'])


def run(job):
    if job['action'] == 'inspect':
        return inspect_archive(job)
    if job['action'] == 'extract-components':
        return extract_components(job)
    entries = job['entries']
    names = [entry['name'] for entry in entries]
    if len(set(names)) != len(names): raise ValueError('duplicate archive entry')
    for name in names:
        safe_name(name)
    target = Path(job['archive'])
    if job['action'] == 'create':
        with target.open('xb') as out, gzip.GzipFile(filename='', mode='wb', fileobj=out, mtime=0) as zipped, tarfile.open(fileobj=zipped, mode='w', format=tarfile.PAX_FORMAT) as archive:
            for entry in sorted(entries, key=lambda entry: entry['name']):
                data = Path(entry['source']).read_bytes()
                if hashlib.sha256(data).hexdigest() != entry['sha256']: raise ValueError('archive input drift')
                info = tarfile.TarInfo(entry['name'])
                info.size, info.mode, info.mtime = len(data), 0o644, 0
                archive.addfile(info, io.BytesIO(data))
    with tarfile.open(target, 'r:gz') as archive:
        expected = {entry['name']: entry for entry in entries}
        # Check payloads while the gzip reader is beside each header. Listing
        # all members first would scan the payload and then rewind to read it.
        for member in archive:
            entry = expected.pop(member.name, None)
            if entry is None: raise ValueError('archive entry mismatch')
            if not member.isfile() or member.size != entry['bytes']: raise ValueError('archive type/size mismatch')
            if hashlib.sha256(archive.extractfile(member).read()).hexdigest() != entry['sha256']: raise ValueError('archive payload drift')
        if expected: raise ValueError('archive entry mismatch')
    return {'entries': len(entries), 'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}


if __name__ == '__main__':
    print(json.dumps(run(json.load(sys.stdin))))
