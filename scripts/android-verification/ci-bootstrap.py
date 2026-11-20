#!/usr/bin/env python3
"""Fetch four immutable CI plugin artifacts from official Maven Central only.

This local repository repairs CI transport for RN's Foojay plugin classpath;
it neither changes runtime dependencies nor selects another artifact version.
"""

import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
from typing import NamedTuple
import urllib.error
import urllib.request


class Artifact(NamedTuple):
    path: str
    size_bytes: int
    sha256: str


ARTIFACTS = (
    Artifact('com/google/code/gson/gson/2.9.1/gson-2.9.1.pom', 8208,
             'e5966323d7142570b37a4be979e21bc2dae848107e4dc416d8f44d9aa3f02903'),
    Artifact('com/google/code/gson/gson/2.9.1/gson-2.9.1.jar', 265030,
             '378534e339e6e6d50b1736fb3abb76f1c15d1be3f4c13cec6d536412e23da603'),
    Artifact('com/google/code/gson/gson-parent/2.9.1/gson-parent-2.9.1.pom', 4488,
             '7ca0845e73685618de3e46bd3434d03a4a373d520fab93a680318ad6c8cb2a79'),
    Artifact('org/sonatype/oss/oss-parent/9/oss-parent-9.pom', 6569,
             'fb40265f982548212ff82e362e59732b2187ec6f0d80182885c14ef1f982827a'),
)
REPOSITORIES = ('https://repo.maven.apache.org/maven2/', 'https://repo1.maven.org/maven2/')
REQUEST_TIMEOUT_SECONDS = 15
MAX_ATTEMPTS_PER_REPOSITORY = 3
MAX_DOWNLOAD_BYTES = max(artifact.size_bytes for artifact in ARTIFACTS)
ALLOWED_URLS = frozenset(base + artifact.path for base in REPOSITORIES for artifact in ARTIFACTS)


class BootstrapError(RuntimeError):
    """A bounded, safe-to-print failure without response bodies or credentials."""


class TransportError(BootstrapError):
    pass


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        raise TransportError('Artifact redirects are not allowed.')


def fetch_bytes(url, timeout):
    if url not in ALLOWED_URLS:
        raise BootstrapError('Unsupported bootstrap artifact URL.')
    request = urllib.request.Request(url, headers={'User-Agent': 'chatStamp-CI-bootstrap/1'})
    started = time.monotonic()
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=timeout) as response:
            chunks = bytearray()
            while True:
                if time.monotonic() - started > timeout:
                    raise TransportError('Artifact request exceeded its deadline.')
                # read1 makes at most one underlying read; a trickling peer cannot
                # hide indefinitely inside a single full-body read().
                chunk = response.read1(min(64 * 1024, MAX_DOWNLOAD_BYTES + 1 - len(chunks)))
                if not chunk:
                    return bytes(chunks)
                chunks.extend(chunk)
                if len(chunks) > MAX_DOWNLOAD_BYTES:
                    raise BootstrapError('Artifact response exceeded the pinned size bound.')
    except urllib.error.HTTPError as error:
        raise TransportError(f'Artifact transport returned HTTP {error.code}.') from None
    except (urllib.error.URLError, OSError, TimeoutError):
        raise TransportError('Artifact transport failed or timed out.') from None


def validate_bytes(artifact, payload):
    if len(payload) != artifact.size_bytes or hashlib.sha256(payload).hexdigest() != artifact.sha256:
        raise BootstrapError(f'Pinned artifact integrity mismatch: {artifact.path}')


def _destination(repository, artifact):
    destination = repository / artifact.path
    if destination.is_symlink() or not destination.resolve().is_relative_to(repository):
        raise BootstrapError('Bootstrap repository contains an unsafe artifact path.')
    return destination


def _read_pinned_file(path, artifact):
    try:
        with path.open('rb') as stream:
            payload = stream.read(artifact.size_bytes + 1)
    except OSError:
        raise BootstrapError(f'Pinned artifact is unreadable: {artifact.path}') from None
    validate_bytes(artifact, payload)


def _download(artifact):
    for base in REPOSITORIES:
        for _ in range(MAX_ATTEMPTS_PER_REPOSITORY):
            try:
                payload = fetch_bytes(base + artifact.path, REQUEST_TIMEOUT_SECONDS)
            except (TransportError, urllib.error.URLError, OSError, TimeoutError):
                continue
            # An untrusted body is never retried against a different mirror.
            validate_bytes(artifact, payload)
            return payload
    raise BootstrapError(f'Pinned artifact unavailable from official Central: {artifact.path}')


def _atomic_publish(destination, artifact, payload):
    temporary = None
    try:
        destination.parent.mkdir(parents=True, exist_ok=True)
        descriptor, temporary = tempfile.mkstemp(prefix='.chatstamp-bootstrap-', dir=destination.parent)
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        _read_pinned_file(Path(temporary), artifact)
        os.replace(temporary, destination)
    except OSError:
        raise BootstrapError(f'Could not publish pinned artifact: {artifact.path}') from None
    finally:
        if temporary is not None:
            Path(temporary).unlink(missing_ok=True)


def ensure_repository(repository, verify_only=False):
    repository = Path(repository)
    if not repository.is_absolute():
        raise BootstrapError('Bootstrap repository must be an absolute local directory.')
    repository = repository.resolve()
    if repository.exists() and not repository.is_dir():
        raise BootstrapError('Bootstrap repository must be a directory.')
    pending = []
    for artifact in ARTIFACTS:
        destination = _destination(repository, artifact)
        if destination.exists():
            _read_pinned_file(destination, artifact)
        elif verify_only:
            raise BootstrapError(f'Pinned artifact is missing: {artifact.path}')
        else:
            pending.append((artifact, destination, _download(artifact)))
    # Every missing response validates before the first new path is published.
    for artifact, destination, payload in pending:
        _atomic_publish(destination, artifact, payload)
    for artifact in ARTIFACTS:
        _read_pinned_file(_destination(repository, artifact), artifact)
    return {'status': 'PASS', 'artifacts': len(ARTIFACTS), 'downloaded': len(pending),
            'cached': len(ARTIFACTS) - len(pending), 'verify_only': verify_only}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repository', required=True, type=Path)
    parser.add_argument('--verify-only', action='store_true')
    args = parser.parse_args(argv)
    try:
        result = ensure_repository(args.repository, args.verify_only)
    except BootstrapError as error:
        print(json.dumps({'status': 'FAIL', 'error': str(error)}))
        return 1
    except OSError:
        print(json.dumps({'status': 'FAIL', 'error': 'Bootstrap local I/O failed.'}))
        return 1
    print(json.dumps(result))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
