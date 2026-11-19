"""Independent host acceptance checks for the read-only release verifier."""

import importlib.util
import io
import json
from pathlib import Path
import struct
import sys
import tempfile
import unittest
from unittest import mock
import xml.etree.ElementTree as ET
import zipfile


SPEC = importlib.util.spec_from_file_location('chatstamp_release_verifier', Path(__file__).with_name('verify-release.py'))
release = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = release
SPEC.loader.exec_module(release)


def codes(result):
    return {value['code'] for value in result['issues']}


def manifest():
    """Acceptance fixture, independent of the generated Gradle manifest."""
    return ET.fromstring('''<manifest xmlns:android="http://schemas.android.com/apk/res/android"
        package="com.menis.chatstamp" android:versionName="0.2.0" android:versionCode="3">
      <uses-sdk android:minSdkVersion="30" android:targetSdkVersion="36" />
      <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
      <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC" />
      <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
      <permission android:name="com.menis.chatstamp.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION"
          android:protectionLevel="signature" />
      <uses-permission android:name="com.menis.chatstamp.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" />
      <application android:debuggable="false" android:allowBackup="false"
          android:fullBackupContent="false" android:dataExtractionRules="@xml/chatstamp_data_extraction_rules">
        <service android:name="com.chatstamp.nativebridge.SaveForegroundService"
            android:foregroundServiceType="dataSync" android:exported="false" />
      </application>
    </manifest>''')


def check_manifest(root, **kwargs):
    return release.inspect_manifest(ET.tostring(root), **kwargs)


def backup_xml():
    root = ET.Element('data-extraction-rules')
    for section in ('cloud-backup', 'device-transfer'):
        node = ET.SubElement(root, section)
        for domain in sorted(release.BACKUP_DOMAINS):
            ET.SubElement(node, 'exclude', domain=domain, path='.')
    return root


def elf(bits=64, machine=None, segments=None, *, endian='<'):
    """Construct explicit ELF headers/program tables without compiler dependencies."""
    if segments is None:
        segments = [dict(kind=1, flags=6, offset=0, address=0, size=512, memory=512, align=16384)]
    machine = machine if machine is not None else 183 if bits == 64 else 40
    header_size, entry_size = (64, 56) if bits == 64 else (52, 32)
    ident = b'\x7fELF' + bytes((2 if bits == 64 else 1, 1 if endian == '<' else 2, 1)) + bytes(9)
    header = struct.pack(endian + ('HHIQQQIHHHHHH' if bits == 64 else 'HHIIIIIHHHHHH'),
                         3, machine, 1, 0, header_size, 0, 0,
                         header_size, entry_size, len(segments), 0, 0, 0)
    table = bytearray()
    for item in segments:
        values = (item['kind'], item['flags'], item['offset'], item['address'], item['address'],
                  item['size'], item['memory'], item['align']) if bits == 64 else (
                      item['kind'], item['offset'], item['address'], item['address'],
                      item['size'], item['memory'], item['flags'], item['align'])
        table.extend(struct.pack(endian + ('IIQQQQQQ' if bits == 64 else 'IIIIIIII'), *values))
    length = max([512, len(ident + header + table), *(item['offset'] + item['size'] for item in segments)])
    return ident + header + table + bytes(length - len(ident + header + table))


def check_elf(data, abi=None):
    return release.inspect_elf(io.BytesIO(data), len(data), abi)


def varint(value):
    output = bytearray()
    while value >= 128:
        output.append((value & 127) | 128)
        value >>= 7
    output.append(value)
    return bytes(output)


def field(number, data):
    return varint(number * 8 + 2) + varint(len(data)) + data


def aapt_node(element):
    body = field(3, element.tag.encode())
    for key, value in element.attrib.items():
        body += field(4, field(2, key.encode()) + field(3, value.encode()))
    for child in element:
        body += field(5, aapt_node(child))
    return field(1, body)


class ManifestAcceptanceTest(unittest.TestCase):
    def test_exact_identity_permissions_backup_and_datasync_service_pass(self):
        result = check_manifest(manifest())
        self.assertEqual(result['status'], 'PASS', result)
        self.assertEqual(result['platform_permissions'], sorted(release.PLATFORM_PERMISSIONS))
        self.assertEqual(result['own_signature_permission'], 'com.menis.chatstamp.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION')

    def test_androidx_signature_permission_is_optional_and_never_a_platform_capability(self):
        root = manifest()
        for node in list(root):
            if (node.get(release.ANDROID + 'name') or '').endswith('DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'):
                root.remove(node)
        result = check_manifest(root)
        self.assertEqual(result['status'], 'PASS')
        self.assertIsNone(result['own_signature_permission'])

    def test_identity_rejects_each_drift(self):
        cases = [('package', 'com.other.app'), ('versionName', '0.1.1'), ('versionCode', '2'),
                 ('minSdkVersion', '29'), ('targetSdkVersion', '35')]
        for name, value in cases:
            with self.subTest(name=name):
                root = manifest()
                parent = root.find('uses-sdk') if name.endswith('SdkVersion') else root
                parent.set(name if name == 'package' else release.ANDROID + name, value)
                self.assertIn('MANIFEST_IDENTITY', codes(check_manifest(root)))

    def test_expected_package_and_version_are_configurable(self):
        root = manifest()
        xml = ET.tostring(root).replace(b'com.menis.chatstamp', b'com.menis.chatstamp.qa').replace(b'0.2.0', b'0.3.1')
        self.assertEqual(release.inspect_manifest(xml, release.Expected(package='com.menis.chatstamp.qa', version='0.3.1'))['status'], 'PASS')

    def test_debuggable_true_or_unresolved_is_rejected(self):
        for value in ('true', '0xffffffff', '@bool/debuggable'):
            with self.subTest(value=value):
                root = manifest()
                root.find('application').set(release.ANDROID + 'debuggable', value)
                self.assertIn('DEBUGGABLE', codes(check_manifest(root)))

    def test_absent_debuggable_defaults_false_and_numeric_false_is_supported(self):
        root = manifest()
        del root.find('application').attrib[release.ANDROID + 'debuggable']
        root.find('./application/service').set(release.ANDROID + 'foregroundServiceType', '0x1')
        root.find('./application/service').set(release.ANDROID + 'exported', '0x0')
        self.assertEqual(check_manifest(root)['status'], 'PASS')

    def test_broad_network_audio_ads_permissions_are_all_rejected(self):
        for name in ('INTERNET', 'ACCESS_NETWORK_STATE', 'READ_EXTERNAL_STORAGE', 'WRITE_EXTERNAL_STORAGE',
                     'MANAGE_EXTERNAL_STORAGE', 'READ_MEDIA_IMAGES', 'READ_MEDIA_VIDEO', 'READ_MEDIA_AUDIO',
                     'RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS', 'SYSTEM_ALERT_WINDOW', 'VIBRATE',
                     'com.google.android.gms.permission.AD_ID', 'com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE'):
            with self.subTest(permission=name):
                root = manifest()
                name = name if '.' in name else 'android.permission.' + name
                ET.SubElement(root, 'uses-permission', {release.ANDROID + 'name': name})
                self.assertIn('PERMISSION_FORBIDDEN', codes(check_manifest(root)))

    def test_uses_permission_sdk23_is_not_a_bypass(self):
        root = manifest()
        ET.SubElement(root, 'uses-permission-sdk-23', {release.ANDROID + 'name': 'android.permission.RECORD_AUDIO'})
        self.assertIn('PERMISSION_FORBIDDEN', codes(check_manifest(root)))

    def test_required_permissions_cannot_be_missing_or_capped_below_target(self):
        for name in release.PLATFORM_PERMISSIONS:
            with self.subTest(permission=name):
                root = manifest()
                node = next(node for node in root.findall('uses-permission') if node.get(release.ANDROID + 'name') == name)
                node.set(release.ANDROID + 'maxSdkVersion', '35')
                self.assertIn('PERMISSION_LIMITED', codes(check_manifest(root)))
                root.remove(node)
                self.assertIn('PERMISSION_MISSING', codes(check_manifest(root)))

    def test_androidx_permission_must_be_defined_with_signature_protection(self):
        for value in ('normal', 'dangerous', 'signature|privileged'):
            with self.subTest(protection=value):
                root = manifest()
                root.find('permission').set(release.ANDROID + 'protectionLevel', value)
                self.assertIn('RECEIVER_PERMISSION_PROTECTION', codes(check_manifest(root)))
        root.remove(root.find('permission'))
        self.assertIn('RECEIVER_PERMISSION_PROTECTION', codes(check_manifest(root)))

    def test_foreign_permission_definition_is_rejected(self):
        root = manifest()
        ET.SubElement(root, 'permission', {release.ANDROID + 'name': 'com.other.PRIVATE', release.ANDROID + 'protectionLevel': 'signature'})
        self.assertIn('PERMISSION_DEFINITION', codes(check_manifest(root)))

    def test_backup_must_be_explicitly_disabled_and_reference_rules(self):
        for name in ('allowBackup', 'fullBackupContent'):
            for value in (None, 'true', '@bool/backup_enabled'):
                with self.subTest(name=name, value=value):
                    root = manifest()
                    app = root.find('application')
                    if value is None:
                        del app.attrib[release.ANDROID + name]
                    else:
                        app.set(release.ANDROID + name, value)
                    self.assertIn('BACKUP_ENABLED', codes(check_manifest(root)))
        root = manifest()
        del root.find('application').attrib[release.ANDROID + 'dataExtractionRules']
        self.assertIn('BACKUP_RULE_REFERENCE', codes(check_manifest(root)))

    def test_service_requires_datasync_only_unexported(self):
        for value in ('mediaPlayback', 'dataSync|mediaPlayback', '0x3', ''):
            with self.subTest(value=value):
                root = manifest()
                root.find('./application/service').set(release.ANDROID + 'foregroundServiceType', value)
                self.assertIn('SAVE_SERVICE_TYPE', codes(check_manifest(root)))
        root = manifest()
        root.find('./application/service').set(release.ANDROID + 'exported', 'true')
        self.assertIn('SAVE_SERVICE_EXPORTED', codes(check_manifest(root)))

    def test_dynamic_module_permission_cannot_escape_scan(self):
        feature = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-permission android:name="android.permission.INTERNET"/></manifest>'
        self.assertIn('PERMISSION_FORBIDDEN', codes(check_manifest(manifest(), additional_xml=[feature])))

    def test_unexpected_foreground_service_is_rejected(self):
        root = manifest()
        ET.SubElement(root.find('application'), 'service', {
            release.ANDROID + 'name': 'com.other.AudioService',
            release.ANDROID + 'foregroundServiceType': 'mediaPlayback',
            release.ANDROID + 'exported': 'false',
        })
        self.assertIn('FOREGROUND_SERVICE_FORBIDDEN', codes(check_manifest(root)))

    def test_malformed_manifest_never_passes(self):
        for value in ('<manifest', '<not-manifest/>'):
            self.assertEqual(release.inspect_manifest(value)['status'], 'FAIL')


class PortraitFeatureAcceptanceTest(unittest.TestCase):
    def future_manifest(self, required='false', include_feature=True):
        root = manifest()
        root.set(release.ANDROID + 'versionCode', '12')
        ET.SubElement(root.find('application'), 'activity', {
            release.ANDROID + 'name': '.MainActivity', release.ANDROID + 'screenOrientation': 'portrait',
        })
        if include_feature:
            attributes = {release.ANDROID + 'name': 'android.hardware.screen.portrait'}
            if required is not None:
                attributes[release.ANDROID + 'required'] = required
            ET.SubElement(root, 'uses-feature', attributes)
        return root

    def check(self, root, **kwargs):
        return check_manifest(root, expected=release.Expected(code=12), **kwargs)

    def test_code12_optional_portrait_and_unchanged_activity_pass(self):
        self.assertEqual(self.check(self.future_manifest())['status'], 'PASS')

    def test_code12_rejects_missing_explicit_portrait_override(self):
        self.assertIn('PORTRAIT_FEATURE_COUNT', codes(self.check(self.future_manifest(include_feature=False))))

    def test_code12_rejects_default_required_true_or_unresolved_portrait(self):
        for required in (None, 'true', '@bool/optional'):
            with self.subTest(required=required):
                self.assertIn('PORTRAIT_FEATURE_REQUIRED', codes(self.check(self.future_manifest(required))))

    def test_code12_rejects_duplicate_portrait_even_if_both_are_optional(self):
        root = self.future_manifest()
        ET.SubElement(root, 'uses-feature', {
            release.ANDROID + 'name': 'android.hardware.screen.portrait', release.ANDROID + 'required': 'false',
        })
        self.assertIn('PORTRAIT_FEATURE_COUNT', codes(self.check(root)))

    def test_dynamic_feature_cannot_reintroduce_required_portrait(self):
        extra = '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><uses-feature android:name="android.hardware.screen.portrait" android:required="true"/></manifest>'
        result = self.check(self.future_manifest(), additional_xml=[extra])
        self.assertIn('PORTRAIT_FEATURE_REQUIRED', codes(result))

    def test_code12_main_activity_stays_portrait(self):
        for orientation in (None, 'landscape', 'sensorPortrait', 'unspecified'):
            with self.subTest(orientation=orientation):
                root = self.future_manifest()
                activity = root.find('./application/activity')
                if orientation is None:
                    del activity.attrib[release.ANDROID + 'screenOrientation']
                else:
                    activity.set(release.ANDROID + 'screenOrientation', orientation)
                self.assertIn('MAIN_ACTIVITY_ORIENTATION', codes(self.check(root)))

    def test_code12_cannot_drop_the_main_activity_to_evade_orientation_check(self):
        root = self.future_manifest()
        root.find('application').remove(root.find('./application/activity'))
        self.assertIn('MAIN_ACTIVITY_ORIENTATION', codes(self.check(root)))

    def test_compiled_numeric_false_and_portrait_enum_are_supported(self):
        root = self.future_manifest('0x0')
        root.find('./application/activity').set(release.ANDROID + 'screenOrientation', '0x1')
        self.assertEqual(self.check(root)['status'], 'PASS')

    def test_historical_code11_keeps_its_original_policy(self):
        root = self.future_manifest('true')
        root.set(release.ANDROID + 'versionCode', '11')
        self.assertEqual(check_manifest(root, expected=release.Expected(code=11))['status'], 'PASS')

    def test_optional_portrait_does_not_relax_existing_permission_policy(self):
        root = self.future_manifest()
        ET.SubElement(root, 'uses-permission', {release.ANDROID + 'name': 'android.permission.INTERNET'})
        self.assertIn('PERMISSION_FORBIDDEN', codes(self.check(root)))

    def test_qa_activity_namespace_remains_valid_with_qa_application_id(self):
        root = self.future_manifest()
        root.set('package', 'com.menis.chatstamp.qa')
        for node in root:
            name = node.get(release.ANDROID + 'name')
            if name and name.endswith('.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'):
                node.set(release.ANDROID + 'name', 'com.menis.chatstamp.qa.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION')
        root.find('./application/activity').set(release.ANDROID + 'name', 'com.menis.chatstamp.MainActivity')
        self.assertEqual(check_manifest(root, expected=release.Expected(package='com.menis.chatstamp.qa', code=12))['status'], 'PASS')


class BackupResourceTest(unittest.TestCase):
    def test_all_nine_domains_are_excluded_for_both_transfers(self):
        result = release.inspect_backup_rules(backup_xml())
        self.assertEqual(result['status'], 'PASS')
        self.assertEqual(len(result['excluded_domains']['cloud-backup']), 9)
        self.assertEqual(len(result['excluded_domains']['device-transfer']), 9)

    def test_missing_domain_narrow_path_or_missing_section_fails(self):
        for change in ('missing', 'narrow', 'section'):
            with self.subTest(change=change):
                root = backup_xml()
                section = root.find('device-transfer')
                if change == 'missing':
                    section.remove(section[0])
                elif change == 'narrow':
                    section[0].set('path', 'cache')
                else:
                    root.remove(section)
                self.assertEqual(release.inspect_backup_rules(root)['status'], 'FAIL')

    def test_include_and_duplicate_transfer_sections_fail(self):
        root = backup_xml()
        ET.SubElement(root.find('cloud-backup'), 'include', domain='file', path='important')
        self.assertIn('BACKUP_INCLUDE', codes(release.inspect_backup_rules(root)))
        ET.SubElement(root, 'device-transfer')
        self.assertIn('BACKUP_SECTION', codes(release.inspect_backup_rules(root)))

    def test_proto_backup_xml_decodes_attributes_and_nested_sections(self):
        decoded = release.decode_aapt_xml(aapt_node(backup_xml()))
        self.assertEqual(release.inspect_backup_rules(decoded)['status'], 'PASS')
        self.assertEqual(decoded.find('device-transfer/exclude').attrib['path'], '.')

    def test_truncated_or_duplicate_proto_attributes_fail_closed(self):
        data = aapt_node(backup_xml())
        for invalid in (data[:-1], b'\x00', b'\x0a\x80', b'\x0f\x00'):
            with self.subTest(data=invalid[:10]), self.assertRaises(ValueError):
                release.decode_aapt_xml(invalid)
        attribute = field(2, b'name') + field(3, b'value')
        duplicate = field(1, field(3, b'element') + field(4, attribute) + field(4, attribute))
        with self.assertRaises(ValueError):
            release.decode_aapt_xml(duplicate)

    def test_bundle_backup_scans_every_qualified_resource(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.aab'
            bad = backup_xml()
            bad.remove(bad.find('device-transfer'))
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('base/res/xml/chatstamp_data_extraction_rules.xml', aapt_node(backup_xml()))
                archive.writestr('base/res/xml-v36/chatstamp_data_extraction_rules.xml', aapt_node(bad))
            runner = mock.Mock()
            runner.run.return_value = ({'status': 'PASS'}, '0x7f150000 - xml/chatstamp_data_extraction_rules\n'
                                      '\t(default) - [FILE] res/xml/chatstamp_data_extraction_rules.xml\n'
                                      '\tsdk_version: 36 - [FILE] res/xml-v36/chatstamp_data_extraction_rules.xml\n')
            result = release.backup_resource_aab(artifact, 'base', '@xml/chatstamp_data_extraction_rules', runner, 'java', 'bundletool.jar')
            self.assertEqual(len(result['resources']), 2)
            self.assertEqual(result['status'], 'FAIL')

    def test_bundle_backup_uses_resource_table_paths_after_shrinking(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.aab'
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('base/res/a.xml', aapt_node(backup_xml()))
            runner = mock.Mock()
            runner.run.return_value = ({'status': 'PASS'}, '0x7f150000 - xml/chatstamp_data_extraction_rules\n'
                                      '\t(default) - [FILE] res/a.xml\n')
            result = release.backup_resource_aab(artifact, 'base', '@0x7f150000', runner, 'java', 'bundletool.jar')
            self.assertEqual(result['status'], 'PASS', result)
            self.assertEqual(result['resources'][0]['path'], 'base/res/a.xml')

    def test_bundle_backup_does_not_accept_missing_or_unreadable_configurations(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.aab'
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('base/res/a.xml', aapt_node(backup_xml()))
            for output in ('0x7f150000 - xml/chatstamp_data_extraction_rules\n',
                           '0x7f150000 - xml/chatstamp_data_extraction_rules\n(default) - [FILE] res/missing.xml\n'):
                with self.subTest(output=output):
                    runner = mock.Mock()
                    runner.run.return_value = ({'status': 'PASS'}, output)
                    result = release.backup_resource_aab(artifact, 'base', '@0x7f150000', runner, 'java', 'bundletool.jar')
                    self.assertEqual(result['status'], 'FAIL')

    def test_apk_backup_decodes_all_resource_configurations(self):
        bad = backup_xml()
        bad.find('cloud-backup').remove(bad.find('cloud-backup')[0])
        outputs = {
            'apk-resource-names': 'resource 0x7f150000 xml/chatstamp_data_extraction_rules\n',
            'apk-xml-configs': 'default\nv36\n',
            'apk-backup-path-0': 'res/a.xml\n',
            'apk-backup-path-1': 'res/b.xml\n',
            'apk-backup-xml-0': ET.tostring(backup_xml(), encoding='unicode'),
            'apk-backup-xml-1': ET.tostring(bad, encoding='unicode'),
        }
        runner = mock.Mock()
        runner.run.side_effect = lambda name, _args: ({'status': 'PASS'}, outputs[name])
        result = release.backup_resource_apk(Path('input.apk'), '@ref/0x7f150000', release.Expected(), runner, 'apkanalyzer', 'aapt2')
        self.assertEqual(len(result['resources']), 2)
        self.assertEqual(result['status'], 'FAIL')


class ElfAcceptanceTest(unittest.TestCase):
    def test_64bit_and_32bit_aligned_shared_objects_pass(self):
        for bits, machine, architecture in ((64, 183, 'aarch64'), (64, 62, 'x86_64'), (32, 40, 'arm'), (32, 3, 'x86')):
            with self.subTest(bits=bits, machine=machine):
                abi = {(183, 64): 'arm64-v8a', (62, 64): 'x86_64', (40, 32): 'armeabi-v7a', (3, 32): 'x86'}[(machine, bits)]
                result = check_elf(elf(bits, machine), abi)
                self.assertEqual(result['status'], 'PASS', result)
                self.assertEqual((result['bits'], result['architecture']), (bits, architecture))
                expected_status = 'PASS' if bits == 64 else 'NOT_APPLICABLE'
                self.assertEqual(result['load_alignment_status'], expected_status)

    def test_every_load_is_checked_not_only_the_first(self):
        good = dict(kind=1, flags=5, offset=0, address=0, size=256, memory=256, align=16384)
        bad = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=512, align=4096)
        result = check_elf(elf(segments=[good, bad]))
        self.assertEqual(result['load_alignments'], [16384, 4096])
        self.assertIn('ELF_LOAD_ALIGNMENT', codes(result))

    def test_low_zero_and_non_power_of_two_alignment_fail(self):
        for align in (0, 1, 4096, 8192, 24576):
            with self.subTest(align=align):
                segment = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=512, align=align)
                self.assertTrue({'ELF_LOAD_ALIGNMENT', 'ELF_SEGMENT_ALIGNMENT'} & codes(check_elf(elf(segments=[segment]))))

    def test_larger_power_of_two_alignment_is_accepted(self):
        segment = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=512, align=65536)
        self.assertEqual(check_elf(elf(segments=[segment]))['status'], 'PASS')

    def test_misaligned_file_and_virtual_addresses_fail(self):
        segment = dict(kind=1, flags=6, offset=0, address=4096, size=512, memory=512, align=16384)
        self.assertIn('ELF_LOAD_CONGRUENCE', codes(check_elf(elf(segments=[segment]))))

    def test_malformed_magic_truncated_headers_and_program_table_fail(self):
        valid = elf()
        for data in (b'', b'not ELF' + bytes(505), valid[:20], valid[:80]):
            with self.subTest(length=len(data)):
                self.assertIn('ELF_MALFORMED', codes(check_elf(data)))

    def test_impossible_segment_bounds_and_no_load_fail(self):
        for segment in (
            dict(kind=1, flags=6, offset=0, address=0, size=512, memory=511, align=16384),
            dict(kind=4, flags=0, offset=0, address=0, size=512, memory=512, align=16384),
        ):
            with self.subTest(segment=segment):
                self.assertIn('ELF_MALFORMED', codes(check_elf(elf(segments=[segment]))))
        data = bytearray(elf())
        struct.pack_into('<Q', data, 64 + 32, len(data) + 1)
        struct.pack_into('<Q', data, 64 + 40, len(data) + 1)
        self.assertIn('ELF_MALFORMED', codes(check_elf(bytes(data))))

    def test_virtual_address_overflow_is_malformed(self):
        segment = dict(kind=1, flags=6, offset=0, address=(1 << 64) - 16384,
                       size=512, memory=32768, align=16384)
        self.assertIn('ELF_MALFORMED', codes(check_elf(elf(segments=[segment]))))

    def test_big_endian_android_library_is_rejected(self):
        self.assertIn('ELF_ANDROID_ENDIAN', codes(check_elf(elf(endian='>'))))

    def test_relro_with_unaligned_end_and_writable_tail_is_distinct_failure(self):
        load = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=32768, align=16384)
        relro = dict(kind=0x6474e552, flags=4, offset=0, address=0, size=256, memory=4096, align=1)
        result = check_elf(elf(segments=[load, relro]))
        self.assertEqual(result['load_alignment_status'], 'PASS')
        self.assertEqual(result['relro_status'], 'FAIL')
        self.assertIn('ELF_RELRO_ALIGNMENT', codes(result))

    def test_relro_aligned_end_or_no_following_writable_data_passes(self):
        for end, load_end in ((16384, 32768), (4096, 4096)):
            with self.subTest(end=end, load_end=load_end):
                load = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=load_end, align=16384)
                relro = dict(kind=0x6474e552, flags=4, offset=0, address=0, size=256, memory=end, align=1)
                self.assertEqual(check_elf(elf(segments=[load, relro]))['status'], 'PASS')

    def test_artifact_inventory_includes_32bit_and_nonstandard_locations(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.apk'
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('lib/arm64-v8a/valid.so', elf())
                bad32 = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=512, align=4096)
                archive.writestr('lib/armeabi-v7a/bad32.so', elf(32, segments=[bad32]))
                archive.writestr('assets/extra.so', b'broken')
            result = release.inspect_native_libraries(artifact)
            self.assertEqual(result['library_count'], 3)
            self.assertEqual({row['path'] for row in result['libraries']},
                             {'lib/arm64-v8a/valid.so', 'lib/armeabi-v7a/bad32.so', 'assets/extra.so'})
            self.assertEqual(result['status'], 'FAIL')
            self.assertTrue(result['all_libraries_scanned'])
            self.assertEqual(result['architectures']['arm/32'], 1)
            record = next(row for row in result['libraries'] if row['abi'] == 'armeabi-v7a')
            self.assertEqual(record['load_alignments'], [4096])
            self.assertEqual(record['page_size_16k_applicability'], 'NOT_APPLICABLE')
            self.assertEqual(record['load_alignment_status'], 'NOT_APPLICABLE')
            self.assertEqual(record['status'], 'PASS')

    def test_abi_identity_mismatch_and_no_libraries_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.aab'
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('base/lib/x86_64/wrong.so', elf())
            result = release.inspect_native_libraries(artifact)
            self.assertIn('ELF_ABI_MISMATCH', codes(result['libraries'][0]))
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('base/dex/classes.dex', b'fixture')
            self.assertIn('NO_NATIVE_LIBRARIES', codes(release.inspect_native_libraries(artifact)))

    def test_invalid_archive_reports_incomplete_inventory(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'broken.apk'
            artifact.write_bytes(b'not a ZIP')
            result = release.inspect_native_libraries(artifact)
            self.assertEqual(result['status'], 'FAIL')
            self.assertFalse(result['all_libraries_scanned'])

    def test_genuine_matching_32bit_4kb_load_and_relro_are_not_applicable(self):
        for machine, abi in ((40, 'armeabi-v7a'), (3, 'x86')):
            with self.subTest(abi=abi):
                load = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=32768, align=4096)
                relro = dict(kind=0x6474e552, flags=4, offset=0, address=0, size=256, memory=4096, align=1)
                result = check_elf(elf(32, machine, [load, relro]), abi)
                self.assertEqual(result['status'], 'PASS', result)
                self.assertEqual(result['load_alignments'], [4096])
                self.assertEqual(result['page_size_16k_applicability'], 'NOT_APPLICABLE')
                self.assertEqual(result['load_alignment_status'], 'NOT_APPLICABLE')
                self.assertEqual(result['relro_status'], 'NOT_APPLICABLE')
                self.assertTrue(result['relro'][0]['raw_16k_boundary_risk'])
                self.assertFalse(result['relro'][0]['concern'])

    def test_32bit_exemption_cannot_hide_machine_class_or_abi_mismatch(self):
        load = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=512, align=4096)
        cases = ((32, 40, 'arm64-v8a'), (32, 62, 'x86'), (32, 3, 'armeabi-v7a'), (64, 40, 'armeabi-v7a'), (32, 40, None))
        for bits, machine, abi in cases:
            with self.subTest(bits=bits, machine=machine, abi=abi):
                result = check_elf(elf(bits, machine, [load]), abi)
                self.assertEqual(result['status'], 'FAIL', result)
                self.assertEqual(result['page_size_16k_applicability'], 'REQUIRED')
                self.assertNotEqual(result['load_alignment_status'], 'NOT_APPLICABLE')
                self.assertTrue({'ELF_ABI_MISMATCH', 'ELF_ABI_REQUIRED', 'ELF_IDENTITY'} & codes(result))

    def test_malformed_32bit_segment_alignment_or_congruence_remains_blocking(self):
        for align, address in ((24576, 0), (4096, 1)):
            with self.subTest(align=align, address=address):
                load = dict(kind=1, flags=6, offset=0, address=address, size=512, memory=512, align=align)
                result = check_elf(elf(32, 40, [load]), 'armeabi-v7a')
                self.assertEqual(result['status'], 'FAIL')
                self.assertEqual(result['load_alignment_status'], 'FAIL')

    def test_four_abi_inventory_retains_all_72_records_with_32bit_raw_4kb_values(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.aab'
            with zipfile.ZipFile(artifact, 'w') as archive:
                for abi, (machine, bits) in release.ABI_IDENTITIES.items():
                    load = dict(kind=1, flags=6, offset=0, address=0, size=512, memory=512,
                                align=4096 if bits == 32 else 16384)
                    for index in range(18):
                        archive.writestr(f'base/lib/{abi}/library-{index}.so', elf(bits, machine, [load]))
            result = release.inspect_native_libraries(artifact)
            self.assertEqual(result['status'], 'PASS', result['issues'])
            self.assertEqual(result['library_count'], 72)
            self.assertEqual(result['architectures'], {'aarch64/64': 18, 'arm/32': 18, 'x86/32': 18, 'x86_64/64': 18})
            self.assertEqual(result['page_size_16k_applicability'], {'REQUIRED': 36, 'NOT_APPLICABLE': 36})
            self.assertTrue(all(row['load_alignment_status'] == 'NOT_APPLICABLE' for row in result['libraries'] if row['bits'] == 32))


class BundleSignatureAndReportTest(unittest.TestCase):
    def test_bundle_requires_exact_16kb_config(self):
        for alignment in ('PAGE_ALIGNMENT_4K', None, 'PAGE_ALIGNMENT_64K'):
            with self.subTest(alignment=alignment):
                text = json.dumps({'optimizations': {'uncompressNativeLibraries': {'alignment': alignment, 'enabled': True}}})
                self.assertEqual(release.inspect_bundle_config(text)['status'], 'FAIL')
        text = json.dumps({'optimizations': {'uncompressNativeLibraries': {'alignment': 'PAGE_ALIGNMENT_16K', 'enabled': True}}})
        self.assertEqual(release.inspect_bundle_config(text)['status'], 'PASS')
        self.assertEqual(release.inspect_bundle_config('malformed')['status'], 'FAIL')
        self.assertEqual(release.inspect_bundle_config('{}')['status'], 'FAIL')

    def test_signed_payload_coverage_accepts_folded_names_and_rejects_unsigned_payload(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.aab'
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\r\n\r\nName: base/manifest/Android\r\n Manifest.xml\r\nSHA-256-Digest: fixture\r\n\r\n')
                archive.writestr('META-INF/UPLOAD.SF', 'signature metadata')
                archive.writestr('META-INF/UPLOAD.RSA', b'fixture')
                archive.writestr('base/manifest/AndroidManifest.xml', b'fixture')
            self.assertEqual(release.inspect_jar_coverage(artifact)['status'], 'PASS')
            with zipfile.ZipFile(artifact, 'a') as archive:
                archive.writestr('base/dex/unsigned.dex', b'not covered')
            result = release.inspect_jar_coverage(artifact)
            self.assertIn('JAR_UNSIGNED_PAYLOAD', codes(result))
            self.assertEqual(result['issues'][0]['message'], 'base/dex/unsigned.dex')

    def test_signature_verification_failure_cannot_pass_from_matching_certificate(self):
        public = 'a' * 64
        runner = mock.Mock()
        runner.run.return_value = ({'status': 'FAIL', 'exit_code': 1}, f'Signer #1 certificate SHA-256 digest: {public}\n')
        result = release.signature_check(Path('fixture.apk'), 'apk', public, runner, {'apksigner': 'apksigner'})
        self.assertIn('SIGNATURE_INVALID', codes(result))

    def test_signer_must_exactly_match_supplied_public_certificate(self):
        public = 'a' * 64
        for signer in ('b' * 64, public + '\nSigner #2 certificate SHA-256 digest: ' + 'b' * 64):
            with self.subTest(signer=signer):
                runner = mock.Mock()
                runner.run.return_value = ({'status': 'PASS', 'exit_code': 0}, f'Signer #1 certificate SHA-256 digest: {signer}\n')
                result = release.signature_check(Path('fixture.apk'), 'apk', public, runner, {'apksigner': 'apksigner'})
                self.assertIn('SIGNATURE_CERTIFICATE', codes(result))

    def test_aab_signature_requires_cryptographic_verification_complete_coverage_and_public_cert(self):
        public = 'ab' * 32
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.aab'
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('META-INF/MANIFEST.MF', 'Manifest-Version: 1.0\n\nName: base/payload\nSHA-256-Digest: fixture\n\n')
                archive.writestr('base/payload', b'fixture')
            runner = mock.Mock()
            runner.run.side_effect = [({'status': 'PASS'}, 'jar verified.\n'),
                                      ({'status': 'PASS'}, 'SHA256: ' + ':'.join(['AB'] * 32))]
            result = release.signature_check(artifact, 'aab', public, runner, {'jarsigner': 'jarsigner', 'keytool': 'keytool'})
            self.assertEqual(result['status'], 'PASS', result)
            self.assertEqual(result['certificate_sha256'], [public])
            for call in runner.run.call_args_list:
                self.assertNotIn('-keystore', call.args[1])
                self.assertNotIn('-storepass', call.args[1])
            with zipfile.ZipFile(artifact, 'a') as archive:
                archive.writestr('base/unsigned', b'unsigned')
            runner.run.side_effect = [({'status': 'PASS'}, 'jar verified.\n'),
                                      ({'status': 'PASS'}, 'SHA256: ' + ':'.join(['AB'] * 32))]
            self.assertIn('SIGNATURE_INVALID', codes(release.signature_check(artifact, 'aab', public, runner,
                                                                           {'jarsigner': 'jarsigner', 'keytool': 'keytool'})))

    def test_failed_manifest_command_does_not_pass_even_if_stdout_contains_valid_xml(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.apk'
            artifact.write_bytes(b'fixture')
            runner = mock.Mock()
            runner.run.side_effect = lambda name, _args: ({'status': 'FAIL' if name == 'apk-manifest' else 'PASS'},
                                                        ET.tostring(manifest(), encoding='unicode') if name == 'apk-manifest' else '')
            tools = {'apkanalyzer': 'apkanalyzer', 'aapt2': 'aapt2', 'zipalign': 'zipalign'}
            with mock.patch.object(release, 'backup_resource_apk', return_value=release.checked([])), \
                    mock.patch.object(release, 'inspect_native_libraries', return_value=release.checked([])), \
                    mock.patch.object(release, 'signature_check', return_value=release.checked([])):
                result = release.verify_artifact(artifact, 'apk', release.Expected(), runner, tools, 'a' * 64)
            self.assertEqual(result['status'], 'FAIL')
            self.assertIn('MANIFEST_COMMAND', codes(result['checks']['manifest']))

    def test_failed_bundle_config_command_does_not_pass_from_valid_stdout(self):
        with tempfile.TemporaryDirectory() as directory:
            artifact = Path(directory) / 'input.aab'
            with zipfile.ZipFile(artifact, 'w') as archive:
                archive.writestr('base/manifest/AndroidManifest.xml', b'fixture')
            runner = mock.Mock()
            def run(name, _args):
                if name == 'aab-config':
                    return {'status': 'FAIL'}, json.dumps({'optimizations': {'uncompressNativeLibraries': {'alignment': 'PAGE_ALIGNMENT_16K'}}})
                return {'status': 'PASS'}, ET.tostring(manifest(), encoding='unicode') if name == 'aab-manifest-base' else ''
            runner.run.side_effect = run
            with mock.patch.object(release, 'backup_resource_aab', return_value=release.checked([])), \
                    mock.patch.object(release, 'inspect_native_libraries', return_value=release.checked([])), \
                    mock.patch.object(release, 'signature_check', return_value=release.checked([])):
                result = release.verify_artifact(artifact, 'aab', release.Expected(), runner, {'java': 'java', 'bundletool': 'bundletool.jar'}, 'a' * 64)
            self.assertEqual(result['status'], 'FAIL')
            self.assertIn('BUNDLE_CONFIG_COMMAND', codes(result['checks']['bundle_config']))

    def test_runner_writes_raw_output_only_in_work_directory_and_strips_echoed_jvm_options(self):
        with tempfile.TemporaryDirectory() as directory, mock.patch.dict('os.environ', {'JAVA_TOOL_OPTIONS': '-Dprivate=value'}):
            runner = release.Runner(directory)
            self.assertNotIn('JAVA_TOOL_OPTIONS', runner.env)
            command, output = runner.run('host check', [sys.executable, '-c', 'import sys; print("result"); print("failure", file=sys.stderr); sys.exit(7)'])
            self.assertEqual(command['status'], 'FAIL')
            self.assertEqual(command['exit_code'], 7)
            self.assertEqual(output, 'result\n')
            self.assertEqual(Path(command['stderr_log']).read_text(), 'failure\n')
            self.assertEqual(Path(command['stdout_log']).parent, Path(directory).resolve())

    def test_missing_external_tool_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            command, _ = release.Runner(directory).run('missing', [Path(directory) / 'missing-tool'])
            self.assertEqual(command['status'], 'FAIL')
            self.assertIsNone(command['exit_code'])

    def test_compact_report_enforces_whole_existing_evidence_set_limit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            work, evidence = root / 'work', root / 'evidence'
            work.mkdir()
            evidence.mkdir()
            (evidence / 'other.json').write_bytes(bytes(990))
            with mock.patch.object(release, 'EVIDENCE_LIMIT', 1000), self.assertRaisesRegex(ValueError, 'complete containing evidence set'):
                release.write_report(evidence / 'new.json', {'status': 'PASS', 'data': 'longer than ten bytes'}, work)
            self.assertFalse((evidence / 'new.json').exists())
            self.assertEqual(list(evidence.glob('*.tmp')), [])

    def test_report_replaces_atomically_without_leaving_temporary_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'evidence/report.json'
            release.write_report(path, {'status': 'FAIL'}, root / 'work')
            release.write_report(path, {'status': 'PASS'}, root / 'work')
            self.assertEqual(json.loads(path.read_text())['status'], 'PASS')
            self.assertEqual(list(path.parent.glob('*.tmp')), [])

    def test_evidence_limit_includes_temporary_atomic_replacement(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'evidence/report.json'
            path.parent.mkdir()
            path.write_bytes(bytes(700))
            (path.parent / 'other.json').write_bytes(bytes(100))
            with mock.patch.object(release, 'EVIDENCE_LIMIT', 1000), self.assertRaises(ValueError):
                release.write_report(path, {'data': 'x' * 300}, root / 'work')
            self.assertEqual(path.stat().st_size, 700)
            self.assertEqual(list(path.parent.glob('*.tmp')), [])


if __name__ == '__main__':
    unittest.main()
