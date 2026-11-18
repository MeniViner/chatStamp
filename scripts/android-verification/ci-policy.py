"""Check a fresh merged release manifest and executed JVM results; never sign or install."""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

SPEC = importlib.util.spec_from_file_location('chatstamp_ci_release_policy', Path(__file__).with_name('verify-release.py'))
release = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = release
SPEC.loader.exec_module(release)


def source_expected(root):
    package = json.loads((root / 'package.json').read_text())
    lock = json.loads((root / 'package-lock.json').read_text())
    config = (root / 'app.config.ts').read_text()
    native = (root / 'modules/chatstamp-native/android/build.gradle').read_text()

    def one(pattern, text):
        matches = re.findall(pattern, text)
        if len(matches) != 1:
            raise ValueError(f'Expected exactly one literal source value for {pattern}')
        return matches[0]

    version = package['version']
    code = int(one(r'\bversionCode:\s*(\d+)', config))
    if one(r"\bpackage:\s*'([^']+)'", config) != 'com.menis.chatstamp':
        raise ValueError('Production package identity changed')
    if one(r"\bversion:\s*'([^']+)'", config) != version or lock['packages']['']['version'] != version:
        raise ValueError('Expo, package and lockfile versions differ')
    if int(one(r'\bversionCode\s+(\d+)', native)) != code or one(r'\bversionName\s+"([^"]+)"', native) != version:
        raise ValueError('Native and application versions differ')
    return release.Expected(version=version, code=code)


def inspect_junit(directory):
    files = sorted(Path(directory).glob('TEST-*.xml'))
    if not files:
        raise ValueError('JVM test reports are missing')
    total = skipped = 0
    for path in files:
        root = ET.parse(path).getroot()
        cases = root.findall('testcase')
        count = int(root.attrib['tests'])
        omitted = int(root.get('skipped', '0'))
        if count < 0 or omitted < 0 or omitted > count or count != len(cases):
            raise ValueError(f'Inconsistent JVM test counts: {path.name}')
        if int(root.get('failures', '0')) or int(root.get('errors', '0')) or any(case.find('failure') is not None or case.find('error') is not None for case in cases):
            raise ValueError(f'JVM tests failed: {path.name}')
        if omitted != sum(case.find('skipped') is not None for case in cases):
            raise ValueError(f'Inconsistent skipped JVM cases: {path.name}')
        total += count
        skipped += omitted
    if total - skipped <= 0:
        raise ValueError('No JVM tests actually executed')
    return {'status': 'PASS', 'report_files': len(files), 'total': total, 'skipped': skipped, 'executed': total - skipped}


def inspect_inputs(manifest, rules, junit, expected):
    manifest_result = release.inspect_manifest(Path(manifest).read_bytes(), expected)
    if manifest_result['status'] != 'PASS':
        raise ValueError(json.dumps(manifest_result['issues']))
    if manifest_result['backup']['dataExtractionRules'] != '@xml/chatstamp_data_extraction_rules':
        raise ValueError('Merged manifest must reference the checked backup-exclusion resource')
    backup_result = release.inspect_backup_rules(Path(rules).read_bytes())
    if backup_result['status'] != 'PASS':
        raise ValueError(json.dumps(backup_result['issues']))
    return {'status': 'PASS', 'manifest': manifest_result, 'backup_rules': backup_result, 'jvm': inspect_junit(junit),
            'scope': 'Merged release manifest, durable backup exclusions and executed JVM reports; no signature, AAB, ELF or device claim.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--junit-dir', type=Path, required=True)
    args = parser.parse_args()
    rules = args.root / 'modules/chatstamp-native/android/src/main/res/xml/chatstamp_data_extraction_rules.xml'
    try:
        print(json.dumps(inspect_inputs(args.manifest, rules, args.junit_dir, source_expected(args.root)), indent=2))
    except (ValueError, OSError, KeyError, ET.ParseError) as error:
        print(json.dumps({'status': 'FAIL', 'reason': str(error)}))
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
