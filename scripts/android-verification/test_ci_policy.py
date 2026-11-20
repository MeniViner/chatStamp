"""CI adapter acceptance: missing/skipped results and unsafe merged inputs fail closed."""
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET

SPEC = importlib.util.spec_from_file_location('chatstamp_ci_policy', Path(__file__).with_name('ci-policy.py'))
ci = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = ci
SPEC.loader.exec_module(ci)


class CiPolicyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.junit = self.root / 'junit'
        self.junit.mkdir()

    def report(self, tests=1, skipped=0, cases='<testcase name="actual"/>'):
        (self.junit / 'TEST-native.xml').write_text(f'<testsuite tests="{tests}" skipped="{skipped}" failures="0" errors="0">{cases}</testsuite>')

    def test_missing_reports_do_not_pass(self):
        with self.assertRaisesRegex(ValueError, 'missing'):
            ci.inspect_junit(self.junit)

    def test_all_skipped_is_not_an_executed_suite(self):
        self.report(skipped=1, cases='<testcase name="skipped"><skipped/></testcase>')
        with self.assertRaisesRegex(ValueError, 'actually executed'):
            ci.inspect_junit(self.junit)

    def test_empty_suite_cannot_pass(self):
        self.report(tests=0, cases='')
        with self.assertRaisesRegex(ValueError, 'actually executed'):
            ci.inspect_junit(self.junit)

    def test_fabricated_count_without_cases_fails(self):
        self.report(tests=2)
        with self.assertRaisesRegex(ValueError, 'Inconsistent'):
            ci.inspect_junit(self.junit)

    def test_case_failure_is_not_hidden_by_zero_summary_attributes(self):
        self.report(cases='<testcase name="failed"><failure>native assertion</failure></testcase>')
        with self.assertRaisesRegex(ValueError, 'failed'):
            ci.inspect_junit(self.junit)

    def test_real_executed_cases_are_counted(self):
        self.report(tests=2, skipped=1, cases='<testcase name="actual"/><testcase name="skip"><skipped/></testcase>')
        self.assertEqual(ci.inspect_junit(self.junit)['executed'], 1)

    def inputs(self):
        self.report()
        self.manifest = self.root / 'AndroidManifest.xml'
        self.manifest.write_text('''<manifest xmlns:android="http://schemas.android.com/apk/res/android"
          package="com.menis10tec.chatstamp" android:versionName="0.2.2" android:versionCode="16">
          <uses-sdk android:minSdkVersion="30" android:targetSdkVersion="36"/>
          <uses-feature android:name="android.hardware.screen.portrait" android:required="false"/>
          <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
          <uses-permission android:name="android.permission.FOREGROUND_SERVICE_DATA_SYNC"/>
          <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
          <application android:allowBackup="false" android:fullBackupContent="false"
            android:dataExtractionRules="@xml/chatstamp_data_extraction_rules">
            <activity android:name="com.menis10tec.chatstamp.MainActivity" android:screenOrientation="portrait"/>
            <service android:name="com.chatstamp.nativebridge.SaveForegroundService" android:exported="false" android:foregroundServiceType="dataSync"/>
          </application></manifest>''')
        return Path(__file__).resolve().parents[2] / 'modules/chatstamp-native/android/src/main/res/xml/chatstamp_data_extraction_rules.xml'

    def test_merged_release_policy_is_enforced_without_an_apk_or_signing_key(self):
        rules = self.inputs()
        expected = ci.release.Expected()
        self.assertEqual(ci.inspect_inputs(self.manifest, rules, self.junit, expected)['status'], 'PASS')
        root = ET.parse(self.manifest).getroot()
        ET.SubElement(root, 'uses-permission', {ci.release.ANDROID + 'name': 'android.permission.INTERNET'})
        ET.ElementTree(root).write(self.manifest)
        with self.assertRaisesRegex(ValueError, 'PERMISSION_FORBIDDEN'):
            ci.inspect_inputs(self.manifest, rules, self.junit, expected)

    def test_different_backup_reference_cannot_borrow_the_checked_rules(self):
        rules = self.inputs()
        root = ET.parse(self.manifest).getroot()
        root.find('application').set(ci.release.ANDROID + 'dataExtractionRules', '@xml/other_rules')
        ET.ElementTree(root).write(self.manifest)
        with self.assertRaisesRegex(ValueError, 'checked backup'):
            ci.inspect_inputs(self.manifest, rules, self.junit, ci.release.Expected())

    def sources(self, package='com.menis10tec.chatstamp'):
        (self.root / 'package.json').write_text(json.dumps({'version': '0.2.2'}))
        (self.root / 'package-lock.json').write_text(json.dumps({'packages': {'': {'version': '0.2.2'}}}))
        (self.root / 'app.config.ts').write_text(
            "export default { version: '0.2.2', android: { package: '" + package + "', versionCode: 16 } };\n")
        native = self.root / 'modules/chatstamp-native/android/build.gradle'
        native.parent.mkdir(parents=True, exist_ok=True)
        native.write_text('android { defaultConfig { versionCode 16\n versionName "0.2.2" } }\n')

    def test_current_ci_source_identity_is_the_new_owner_package_and_code16(self):
        self.sources()
        expected = ci.source_expected(self.root)
        self.assertEqual((expected.package, expected.version, expected.code), ('com.menis10tec.chatstamp', '0.2.2', 16))
        self.assertEqual((expected.min_sdk, expected.target_sdk), (30, 36))

    def test_old_package_is_rejected_by_current_ci_even_with_consistent_versions(self):
        self.sources('com.menis.chatstamp')
        with self.assertRaisesRegex(ValueError, 'Production package identity'):
            ci.source_expected(self.root)

    def test_old_merged_manifest_cannot_pass_current_new_identity_ci(self):
        self.sources()
        expected = ci.source_expected(self.root)
        rules = self.inputs()
        root = ET.parse(self.manifest).getroot()
        root.set('package', 'com.menis.chatstamp')
        root.find('./application/activity').set(ci.release.ANDROID + 'name', 'com.menis.chatstamp.MainActivity')
        ET.ElementTree(root).write(self.manifest)
        with self.assertRaisesRegex(ValueError, 'MANIFEST_IDENTITY'):
            ci.inspect_inputs(self.manifest, rules, self.junit, expected)


if __name__ == '__main__':
    unittest.main()
