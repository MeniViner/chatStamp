"""Pinned CI transport acceptance; all network and artifact bytes are controlled.

The immutable vendor pins are checked separately. Repository behavior uses small
synthetic bodies with independent SHA256 pins, so these tests require neither
network access nor checked-in Maven binaries.
"""

from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest import mock
import urllib.error


SPEC = importlib.util.spec_from_file_location(
    'chatstamp_ci_bootstrap', Path(__file__).with_name('ci-bootstrap.py'))
bootstrap = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = bootstrap
SPEC.loader.exec_module(bootstrap)

PINNED_ARTIFACTS = (
    ('com/google/code/gson/gson/2.9.1/gson-2.9.1.pom', 8208,
     'e5966323d7142570b37a4be979e21bc2dae848107e4dc416d8f44d9aa3f02903'),
    ('com/google/code/gson/gson/2.9.1/gson-2.9.1.jar', 265030,
     '378534e339e6e6d50b1736fb3abb76f1c15d1be3f4c13cec6d536412e23da603'),
    ('com/google/code/gson/gson-parent/2.9.1/gson-parent-2.9.1.pom', 4488,
     '7ca0845e73685618de3e46bd3434d03a4a373d520fab93a680318ad6c8cb2a79'),
    ('org/sonatype/oss/oss-parent/9/oss-parent-9.pom', 6569,
     'fb40265f982548212ff82e362e59732b2187ec6f0d80182885c14ef1f982827a'),
)


class NoNetworkTest(unittest.TestCase):
    def setUp(self):
        network = mock.patch.object(bootstrap.urllib.request, 'build_opener',
                                    side_effect=AssertionError('Real network is forbidden in unit tests.'))
        network.start()
        self.addCleanup(network.stop)


class FixedBootstrapPolicyTest(NoNetworkTest):
    def test_only_the_four_authentic_exact_version_artifacts_are_pinned(self):
        self.assertEqual(tuple(bootstrap.ARTIFACTS), PINNED_ARTIFACTS)
        self.assertTrue(all(not Path(path).is_absolute() and '..' not in Path(path).parts
                            for path, _, _ in PINNED_ARTIFACTS))

    def test_official_hosts_only_and_finite_request_attempts(self):
        self.assertEqual(bootstrap.REPOSITORIES,
                         ('https://repo.maven.apache.org/maven2/', 'https://repo1.maven.org/maven2/'))
        self.assertEqual(bootstrap.ALLOWED_URLS,
                         {host + path for host in bootstrap.REPOSITORIES
                          for path, _, _ in PINNED_ARTIFACTS})
        self.assertGreater(bootstrap.REQUEST_TIMEOUT_SECONDS, 0)
        self.assertLessEqual(bootstrap.REQUEST_TIMEOUT_SECONDS, 15)
        self.assertGreater(bootstrap.MAX_ATTEMPTS_PER_REPOSITORY, 0)
        self.assertLessEqual(bootstrap.MAX_ATTEMPTS_PER_REPOSITORY, 3)
        self.assertEqual(bootstrap.MAX_DOWNLOAD_BYTES, 265030)

    def test_arbitrary_url_scheme_host_version_and_path_are_rejected_before_transport(self):
        for url in ('file:///tmp/not-an-artifact', 'https://example.invalid/gson.jar',
                    bootstrap.REPOSITORIES[0] + 'com/google/code/gson/gson/2.9.2/gson-2.9.2.jar',
                    bootstrap.REPOSITORIES[0] + '../private',
                    bootstrap.REPOSITORIES[0] + PINNED_ARTIFACTS[0][0] + '?redirect=elsewhere'):
            with self.subTest(url=url), self.assertRaises(bootstrap.BootstrapError):
                bootstrap.fetch_bytes(url, bootstrap.REQUEST_TIMEOUT_SECONDS)

    def test_redirect_cannot_expand_the_transport_allowlist(self):
        with self.assertRaises(bootstrap.TransportError):
            bootstrap.NoRedirect().redirect_request(
                None, None, 302, 'Found', {}, 'https://example.invalid/replacement.jar')

    def response(self, chunks):
        response = mock.MagicMock()
        response.__enter__.return_value = response
        response.read1.side_effect = chunks
        opener = mock.Mock()
        opener.open.return_value = response
        return response, opener

    def test_allowed_request_has_timeout_and_bounded_single_reads(self):
        response, opener = self.response([b'body', b''])
        url = bootstrap.REPOSITORIES[0] + PINNED_ARTIFACTS[0][0]
        with mock.patch.object(bootstrap.urllib.request, 'build_opener', return_value=opener) as build:
            self.assertEqual(bootstrap.fetch_bytes(url, 15), b'body')
        self.assertIsInstance(build.call_args.args[0], bootstrap.NoRedirect)
        self.assertEqual(opener.open.call_args.args[0].full_url, url)
        self.assertEqual(opener.open.call_args.kwargs, {'timeout': 15})
        self.assertTrue(all(0 < call.args[0] <= 64 * 1024 for call in response.read1.call_args_list))

    def test_trickling_response_exceeding_total_deadline_fails(self):
        response, opener = self.response([b'partial'])
        url = bootstrap.REPOSITORIES[0] + PINNED_ARTIFACTS[0][0]
        with mock.patch.object(bootstrap.urllib.request, 'build_opener', return_value=opener), \
                mock.patch.object(bootstrap.time, 'monotonic', side_effect=[0, 0, 16]):
            with self.assertRaises(bootstrap.TransportError):
                bootstrap.fetch_bytes(url, 15)
        self.assertEqual(response.read1.call_count, 1)

    def test_oversized_response_is_not_returned_for_hashing_or_publication(self):
        limit = bootstrap.MAX_DOWNLOAD_BYTES
        chunks = [b'x' * (64 * 1024)] * (limit // (64 * 1024))
        chunks.append(b'x' * (limit % (64 * 1024) + 1))
        _, opener = self.response(chunks)
        url = bootstrap.REPOSITORIES[0] + PINNED_ARTIFACTS[0][0]
        with mock.patch.object(bootstrap.urllib.request, 'build_opener', return_value=opener):
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.fetch_bytes(url, 15)

    def test_transport_error_does_not_echo_untrusted_response_text(self):
        opener = mock.Mock()
        opener.open.side_effect = urllib.error.URLError('UNTRUSTED_RESPONSE_BODY')
        url = bootstrap.REPOSITORIES[0] + PINNED_ARTIFACTS[0][0]
        with mock.patch.object(bootstrap.urllib.request, 'build_opener', return_value=opener):
            with self.assertRaises(bootstrap.TransportError) as caught:
                bootstrap.fetch_bytes(url, 15)
        self.assertNotIn('UNTRUSTED_RESPONSE_BODY', str(caught.exception))


class BootstrapRepositoryTest(NoNetworkTest):
    def setUp(self):
        super().setUp()
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.repository = self.root / 'repository'
        self.repository.mkdir()
        self.payloads = {path: ('controlled artifact: ' + path).encode('ascii')
                         for path, _, _ in PINNED_ARTIFACTS}
        self.artifacts = tuple(bootstrap.Artifact(path, len(body), hashlib.sha256(body).hexdigest())
                               for path, body in self.payloads.items())
        pins = mock.patch.object(bootstrap, 'ARTIFACTS', self.artifacts)
        pins.start()
        self.addCleanup(pins.stop)

    def write_cache(self, artifacts=None):
        for artifact in self.artifacts if artifacts is None else artifacts:
            destination = self.repository / artifact.path
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(self.payloads[artifact.path])

    def valid_payload(self, url, timeout):
        self.assertEqual(timeout, bootstrap.REQUEST_TIMEOUT_SECONDS)
        self.assertIn(url, bootstrap.ALLOWED_URLS)
        return next(body for path, body in self.payloads.items() if url.endswith('/' + path))

    def assert_no_publication(self):
        self.assertEqual(list(self.repository.rglob('*')), [])

    def test_all_missing_bodies_validate_before_first_atomic_publication(self):
        replace = bootstrap.os.replace

        def checked_replace(source, destination):
            self.assertEqual(fetch.call_count, len(self.artifacts))
            path = Path(destination).relative_to(self.repository).as_posix()
            self.assertEqual(Path(source).read_bytes(), self.payloads[path])
            self.assertFalse(Path(destination).exists())
            replace(source, destination)

        with mock.patch.object(bootstrap, 'fetch_bytes', side_effect=self.valid_payload) as fetch, \
                mock.patch.object(bootstrap.os, 'replace', side_effect=checked_replace) as publish:
            result = bootstrap.ensure_repository(self.repository)
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual((result['downloaded'], result['cached']), (4, 0))
        self.assertEqual(publish.call_count, 4)
        self.assertEqual(list(self.repository.rglob('.chatstamp-bootstrap-*')), [])
        for artifact in self.artifacts:
            self.assertEqual((self.repository / artifact.path).read_bytes(), self.payloads[artifact.path])

    def test_existing_digest_valid_cache_is_read_and_reused_without_fetching(self):
        self.write_cache()
        with mock.patch.object(bootstrap, 'fetch_bytes', side_effect=AssertionError('Cache must be used.')) as fetch:
            result = bootstrap.ensure_repository(self.repository)
        self.assertEqual((result['status'], result['cached'], result['downloaded']), ('PASS', 4, 0))
        fetch.assert_not_called()

    def test_verify_only_validates_all_existing_pins_without_network(self):
        self.write_cache()
        output = io.StringIO()
        with mock.patch.object(bootstrap, 'fetch_bytes') as fetch, redirect_stdout(output):
            status = bootstrap.main(['--repository', str(self.repository), '--verify-only'])
        self.assertEqual(status, 0)
        self.assertEqual(json.loads(output.getvalue()),
                         {'status': 'PASS', 'artifacts': 4, 'downloaded': 0,
                          'cached': 4, 'verify_only': True})
        fetch.assert_not_called()

    def test_verify_only_missing_cache_fails_without_fetching_or_creating_files(self):
        with mock.patch.object(bootstrap, 'fetch_bytes') as fetch:
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_repository(self.repository, verify_only=True)
        fetch.assert_not_called()
        self.assert_no_publication()

    def test_same_size_corrupt_existing_cache_fails_without_repair_or_network(self):
        self.write_cache()
        artifact = self.artifacts[0]
        original = self.payloads[artifact.path]
        corrupt = bytes([original[0] ^ 1]) + original[1:]
        (self.repository / artifact.path).write_bytes(corrupt)
        with mock.patch.object(bootstrap, 'fetch_bytes') as fetch:
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_repository(self.repository)
        fetch.assert_not_called()
        self.assertEqual((self.repository / artifact.path).read_bytes(), corrupt)

    def test_verify_only_rejects_corrupt_cache_instead_of_trusting_file_presence(self):
        self.write_cache()
        (self.repository / self.artifacts[-1].path).write_bytes(b'truncated')
        output = io.StringIO()
        with mock.patch.object(bootstrap, 'fetch_bytes') as fetch, redirect_stdout(output):
            status = bootstrap.main(['--repository', str(self.repository), '--verify-only'])
        self.assertEqual(status, 1)
        self.assertEqual(json.loads(output.getvalue())['status'], 'FAIL')
        fetch.assert_not_called()

    def test_same_size_tampered_download_is_never_published_or_mirror_retried(self):
        body = self.payloads[self.artifacts[0].path]
        with mock.patch.object(bootstrap, 'fetch_bytes', return_value=bytes([body[0] ^ 1]) + body[1:]) as fetch:
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_repository(self.repository)
        self.assertEqual(fetch.call_count, 1)
        self.assert_no_publication()

    def test_wrong_length_download_is_rejected_even_before_digest_could_match(self):
        body = self.payloads[self.artifacts[0].path]
        for invalid in (body[:-1], body + b'extra'):
            with self.subTest(size=len(invalid)), \
                    mock.patch.object(bootstrap, 'fetch_bytes', return_value=invalid):
                with self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.ensure_repository(self.repository)
            self.assert_no_publication()

    def test_tampered_last_download_cannot_publish_previously_valid_pending_bodies(self):
        def last_invalid(url, timeout):
            body = self.valid_payload(url, timeout)
            return body + b'corrupt' if url.endswith('/' + self.artifacts[-1].path) else body

        with mock.patch.object(bootstrap, 'fetch_bytes', side_effect=last_invalid) as fetch:
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_repository(self.repository)
        self.assertEqual(fetch.call_count, 4)
        self.assert_no_publication()

    def test_complete_transport_failure_is_bounded_and_cli_returns_failure(self):
        output = io.StringIO()
        with mock.patch.object(bootstrap, 'fetch_bytes', side_effect=bootstrap.TransportError('unavailable')) as fetch, \
                redirect_stdout(output):
            status = bootstrap.main(['--repository', str(self.repository)])
        self.assertEqual(status, 1)
        self.assertEqual(json.loads(output.getvalue())['status'], 'FAIL')
        self.assertEqual(fetch.call_count, len(bootstrap.REPOSITORIES) * bootstrap.MAX_ATTEMPTS_PER_REPOSITORY)
        self.assertTrue(all(call.args[1] == bootstrap.REQUEST_TIMEOUT_SECONDS for call in fetch.call_args_list))
        self.assertEqual([call.args[0] for call in fetch.call_args_list],
                         [host + self.artifacts[0].path for host in bootstrap.REPOSITORIES
                          for _ in range(bootstrap.MAX_ATTEMPTS_PER_REPOSITORY)])
        self.assert_no_publication()

    def test_primary_transport_failure_accepts_only_digest_valid_official_fallback(self):
        def fallback(url, timeout):
            if url.startswith(bootstrap.REPOSITORIES[0]):
                raise urllib.error.URLError('primary unavailable')
            return self.valid_payload(url, timeout)

        with mock.patch.object(bootstrap, 'fetch_bytes', side_effect=fallback) as fetch:
            result = bootstrap.ensure_repository(self.repository)
        self.assertEqual((result['status'], result['downloaded']), ('PASS', 4))
        self.assertEqual([call.args[0] for call in fetch.call_args_list],
                         [url for artifact in self.artifacts
                          for url in ([bootstrap.REPOSITORIES[0] + artifact.path]
                                      * bootstrap.MAX_ATTEMPTS_PER_REPOSITORY
                                      + [bootstrap.REPOSITORIES[1] + artifact.path])])

    def test_fallback_bytes_still_require_the_pin_and_cannot_start_publication(self):
        def invalid_fallback(url, timeout):
            if url.startswith(bootstrap.REPOSITORIES[0]):
                raise TimeoutError('primary unavailable')
            body = self.valid_payload(url, timeout)
            return bytes([body[0] ^ 1]) + body[1:]

        with mock.patch.object(bootstrap, 'fetch_bytes', side_effect=invalid_fallback) as fetch:
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_repository(self.repository)
        self.assertEqual(fetch.call_count, bootstrap.MAX_ATTEMPTS_PER_REPOSITORY + 1)
        self.assert_no_publication()

    def test_repository_paths_cannot_escape_through_leaf_or_parent_symlinks(self):
        outside = self.root / 'outside'
        outside.mkdir()
        untouched = outside / 'untouched'
        untouched.write_bytes(b'not a bootstrap artifact')
        artifact = self.artifacts[0]
        destination = self.repository / artifact.path
        destination.parent.mkdir(parents=True)
        destination.symlink_to(untouched)
        with mock.patch.object(bootstrap, 'fetch_bytes') as fetch:
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_repository(self.repository)
            destination.unlink()
            (self.repository / 'org').symlink_to(outside, target_is_directory=True)
            self.write_cache(self.artifacts[:3])
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_repository(self.repository)
        fetch.assert_not_called()
        self.assertEqual(untouched.read_bytes(), b'not a bootstrap artifact')
        self.assertEqual(list(outside.iterdir()), [untouched])

    def test_relative_or_file_repository_is_rejected_before_transport(self):
        not_directory = self.root / 'file'
        not_directory.write_text('unchanged')
        for path in (Path('relative-cache'), not_directory):
            with self.subTest(path=str(path)), mock.patch.object(bootstrap, 'fetch_bytes') as fetch:
                with self.assertRaises(bootstrap.BootstrapError):
                    bootstrap.ensure_repository(path)
                fetch.assert_not_called()
        self.assertEqual(not_directory.read_text(), 'unchanged')

    def test_failed_atomic_replace_removes_temporary_body_and_returns_failure(self):
        with mock.patch.object(bootstrap, 'fetch_bytes', side_effect=self.valid_payload), \
                mock.patch.object(bootstrap.os, 'replace', side_effect=OSError('disk unavailable')):
            with self.assertRaises(bootstrap.BootstrapError):
                bootstrap.ensure_repository(self.repository)
        self.assertEqual(list(self.repository.rglob('.chatstamp-bootstrap-*')), [])
        self.assertFalse(any(path.is_file() for path in self.repository.rglob('*')))

    def test_partial_valid_cache_and_unrelated_files_are_preserved(self):
        self.write_cache(self.artifacts[:1])
        unrelated = self.repository / 'unrelated-note'
        unrelated.write_bytes(b'keep')
        with mock.patch.object(bootstrap, 'fetch_bytes', side_effect=self.valid_payload) as fetch:
            result = bootstrap.ensure_repository(self.repository)
        self.assertEqual((result['cached'], result['downloaded']), (1, 3))
        self.assertEqual(fetch.call_count, 3)
        self.assertEqual(unrelated.read_bytes(), b'keep')
        self.assertEqual((self.repository / self.artifacts[0].path).read_bytes(),
                         self.payloads[self.artifacts[0].path])


if __name__ == '__main__':
    unittest.main()
