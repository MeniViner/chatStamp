#!/usr/bin/env python3
"""Read-only AAB/APK release checks. No signing key or password is accepted.

Full verifier output stays in --work-dir. --report is a compact JSON result;
when it is outside that working directory, its whole containing evidence set
must stay below 10,000,000 bytes. The tool never builds, signs, or installs apps.
"""

import argparse
import collections
import dataclasses
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import struct
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile


ANDROID = '{http://schemas.android.com/apk/res/android}'
PAGE_SIZE = 16 * 1024
EVIDENCE_LIMIT = 10_000_000
MAX_XML_BYTES = 2 * 1024 * 1024
CURRENT_PACKAGE = 'com.menis10tec.chatstamp'
CURRENT_VERSION_CODE = 16
PORTRAIT_OPTIONAL_FROM_CODE = 12
PORTRAIT_FEATURE = 'android.hardware.screen.portrait'
PLATFORM_PERMISSIONS = {
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    'android.permission.POST_NOTIFICATIONS',
}
ABI_IDENTITIES = {'arm64-v8a': (183, 64), 'armeabi-v7a': (40, 32), 'x86': (3, 32), 'x86_64': (62, 64)}
BACKUP_DOMAINS = {
    'root', 'file', 'database', 'sharedpref', 'external',
    'device_root', 'device_file', 'device_database', 'device_sharedpref',
}
SOURCES = {
    'page_sizes': 'https://developer.android.com/guide/practices/page-sizes',
    'backup': 'https://developer.android.com/identity/data/autobackup',
    'aapt_xml_schema': 'https://android.googlesource.com/platform/frameworks/base/+/refs/heads/main/tools/aapt2/Resources.proto',
    'bundletool_resource_output': 'https://github.com/google/bundletool/blob/1.18.3/src/main/java/com/android/tools/build/bundletool/commands/DumpManagerUtils.java',
    'alignment_applicability': 'https://android.googlesource.com/platform/system/extras/+/refs/heads/main/tools/check_elf_alignment.sh',
    'feature_filtering': 'https://developer.android.com/guide/topics/manifest/uses-feature-element',
    'activity_orientation': 'https://developer.android.com/guide/topics/manifest/activity-element',
}


@dataclasses.dataclass(frozen=True)
class Expected:
    package: str = CURRENT_PACKAGE
    version: str = '0.2.2'
    code: int = CURRENT_VERSION_CODE
    min_sdk: int = 30
    target_sdk: int = 36


def issue(code, message):
    return {'code': code, 'message': message}


def checked(issues, **values):
    return {'status': 'FAIL' if issues else 'PASS', **values, 'issues': issues}


def number(value):
    if value is None:
        return None
    try:
        return int(value, 16) if value.lower().startswith('0x') else int(value)
    except (ValueError, AttributeError):
        return None


def is_false(value):
    return value is not None and (value.lower() == 'false' or number(value) == 0)


def inspect_manifest(xml, expected=Expected(), additional_xml=()):
    issues = []
    try:
        root = ET.fromstring(xml)
        roots = [root, *(ET.fromstring(value) for value in additional_xml)]
    except ET.ParseError as error:
        return checked([issue('MANIFEST_XML', str(error))])
    if root.tag != 'manifest':
        return checked([issue('MANIFEST_XML', 'Expected a manifest root element')])
    package = root.get('package')
    sdk = root.find('uses-sdk')
    application = root.find('application')
    identity = {
        'package': package,
        'version_name': root.get(ANDROID + 'versionName'),
        'version_code': number(root.get(ANDROID + 'versionCode')),
        'min_sdk': number(sdk.get(ANDROID + 'minSdkVersion')) if sdk is not None else None,
        'target_sdk': number(sdk.get(ANDROID + 'targetSdkVersion')) if sdk is not None else None,
    }
    required_identity = {
        'package': expected.package, 'version_name': expected.version,
        'version_code': expected.code, 'min_sdk': expected.min_sdk, 'target_sdk': expected.target_sdk,
    }
    for key, value in required_identity.items():
        if identity[key] != value:
            issues.append(issue('MANIFEST_IDENTITY', f'{key}: expected {value!r}, observed {identity[key]!r}'))

    features = [{'name': node.get(ANDROID + 'name'), 'required': node.get(ANDROID + 'required')}
                for document in roots for node in document.findall('uses-feature')]
    activities = [{'name': node.get(ANDROID + 'name'), 'screen_orientation': node.get(ANDROID + 'screenOrientation')}
                  for document in roots for node in document.findall('./application/activity')]
    if expected.code >= PORTRAIT_OPTIONAL_FROM_CODE:
        # Portrait activity orientation implies a Play filter unless explicitly optional.
        # Keep older immutable artifacts independently checkable under their original policy.
        portrait = [feature for feature in features if feature['name'] == PORTRAIT_FEATURE]
        if len(portrait) != 1:
            issues.append(issue('PORTRAIT_FEATURE_COUNT', 'Code 12+ requires exactly one explicit optional portrait feature'))
        if any(not is_false(feature['required']) for feature in portrait):
            issues.append(issue('PORTRAIT_FEATURE_REQUIRED', 'Portrait must explicitly set android:required=false'))
        expected_main = expected.package.removesuffix('.qa') + '.MainActivity'

        def activity_class(activity):
            name = activity['name'] or ''
            if name.startswith('.'):
                return (package or '') + name
            return (package or '') + '.' + name if '.' not in name else name

        main = [activity for activity in activities if activity_class(activity) == expected_main]
        if len(main) != 1 or (main[0]['screen_orientation'] != 'portrait' and number(main[0]['screen_orientation']) != 1):
            issues.append(issue('MAIN_ACTIVITY_ORIENTATION', 'Code 12+ must retain exactly one portrait MainActivity'))

    own = expected.package + '.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION'
    uses = [node for document in roots for node in document
            if node.tag in ('uses-permission', 'uses-permission-sdk-23')]
    permissions = {node.get(ANDROID + 'name', '') for node in uses}
    external = permissions - {own}
    for name in sorted(PLATFORM_PERMISSIONS - external):
        issues.append(issue('PERMISSION_MISSING', name))
    for name in sorted(external - PLATFORM_PERMISSIONS):
        issues.append(issue('PERMISSION_FORBIDDEN', name or 'Unnamed permission'))
    for node in uses:
        maximum = node.get(ANDROID + 'maxSdkVersion')
        if node.get(ANDROID + 'name') in PLATFORM_PERMISSIONS and maximum is not None:
            if number(maximum) is None or number(maximum) < expected.target_sdk:
                issues.append(issue('PERMISSION_LIMITED', ET.tostring(node, encoding='unicode')))
    definitions = [node for document in roots for node in document.findall('permission')]
    own_definitions = [node for node in definitions if node.get(ANDROID + 'name') == own]
    for node in definitions:
        if node.get(ANDROID + 'name') != own:
            issues.append(issue('PERMISSION_DEFINITION', node.get(ANDROID + 'name', 'Unnamed permission')))
    if own in permissions or own_definitions:
        if not own_definitions or any(node.get(ANDROID + 'protectionLevel') != 'signature'
                                      and number(node.get(ANDROID + 'protectionLevel')) != 2
                                      for node in own_definitions):
            issues.append(issue('RECEIVER_PERMISSION_PROTECTION', 'The app-owned AndroidX permission must have signature protection'))
    backup = {}
    services = []
    if application is None:
        issues.append(issue('APPLICATION_MISSING', 'Manifest contains no application'))
    else:
        debuggable = application.get(ANDROID + 'debuggable')
        if debuggable is not None and not is_false(debuggable):
            issues.append(issue('DEBUGGABLE', f'android:debuggable={debuggable!r}'))
        backup = {key: application.get(ANDROID + key)
                  for key in ('allowBackup', 'fullBackupContent', 'dataExtractionRules')}
        for key in ('allowBackup', 'fullBackupContent'):
            if not is_false(backup[key]):
                issues.append(issue('BACKUP_ENABLED', f'android:{key} must explicitly be false'))
        if not backup['dataExtractionRules'] or not backup['dataExtractionRules'].startswith('@'):
            issues.append(issue('BACKUP_RULE_REFERENCE', 'An explicit dataExtractionRules resource is required'))
        for document in roots:
            for service in document.findall('./application/service'):
                services.append({
                    'name': service.get(ANDROID + 'name'),
                    'foreground_type': service.get(ANDROID + 'foregroundServiceType'),
                    'exported': service.get(ANDROID + 'exported'),
                })
        save_services = [service for service in services
                         if service['name'] == 'com.chatstamp.nativebridge.SaveForegroundService']
        for service in services:
            if service['foreground_type'] and service['name'] != 'com.chatstamp.nativebridge.SaveForegroundService':
                issues.append(issue('FOREGROUND_SERVICE_FORBIDDEN', f"Unexpected foreground service {service['name']!r}"))
        if len(save_services) != 1:
            issues.append(issue('SAVE_SERVICE', 'Exactly one SaveForegroundService is required'))
        else:
            service = save_services[0]
            if service['foreground_type'] != 'dataSync' and number(service['foreground_type']) != 1:
                issues.append(issue('SAVE_SERVICE_TYPE', 'SaveForegroundService must use dataSync only'))
            if not is_false(service['exported']):
                issues.append(issue('SAVE_SERVICE_EXPORTED', 'SaveForegroundService must explicitly be unexported'))
    return checked(issues, **identity, debuggable=application.get(ANDROID + 'debuggable', 'false') if application is not None else None,
                   platform_permissions=sorted(external),
                   own_signature_permission=own if own in permissions or own_definitions else None,
                   own_permission_reason='AndroidX signature receiver isolation; not an external/platform capability',
                   backup=backup, services=services, features=features, activities=activities)


def inspect_backup_rules(xml):
    try:
        root = ET.fromstring(xml) if isinstance(xml, (str, bytes)) else xml
    except ET.ParseError as error:
        return checked([issue('BACKUP_XML', str(error))])
    issues, sections = [], {}
    if root.tag != 'data-extraction-rules':
        issues.append(issue('BACKUP_XML', 'Expected data-extraction-rules root'))
    for name in ('cloud-backup', 'device-transfer'):
        matches = root.findall(name)
        if len(matches) != 1:
            issues.append(issue('BACKUP_SECTION', f'Exactly one {name} section is required'))
            continue
        excludes = {node.get('domain') for node in matches[0].findall('exclude')
                    if node.get('path') in ('.', './')}
        sections[name] = sorted(excludes)
        missing = BACKUP_DOMAINS - excludes
        if missing:
            issues.append(issue('BACKUP_EXCLUSIONS', f'{name} does not exclude: {", ".join(sorted(missing))}'))
        if matches[0].find('include') is not None:
            issues.append(issue('BACKUP_INCLUDE', f'{name} must not opt data into backup'))
    return checked(issues, excluded_domains=sections)


def _proto_fields(data):
    offset = 0

    def varint():
        nonlocal offset
        value = 0
        for shift in range(0, 70, 7):
            if offset >= len(data):
                raise ValueError('Truncated protobuf varint')
            byte = data[offset]
            offset += 1
            value |= (byte & 127) << shift
            if byte < 128:
                return value
        raise ValueError('Oversized protobuf varint')

    while offset < len(data):
        tag = varint()
        field, wire = tag >> 3, tag & 7
        if field == 0:
            raise ValueError('Invalid protobuf field')
        if wire == 0:
            value = varint()
        elif wire in (1, 2, 5):
            length = varint() if wire == 2 else 8 if wire == 1 else 4
            end = offset + length
            if end > len(data):
                raise ValueError('Truncated protobuf value')
            value, offset = data[offset:end], end
        else:
            raise ValueError('Unsupported protobuf wire type')
        yield field, wire, value


def decode_aapt_xml(data, depth=0):
    """Decode only the public AAPT XmlNode/XmlElement/XmlAttribute wire fields."""
    if depth > 64 or len(data) > MAX_XML_BYTES:
        raise ValueError('AAPT XML exceeds verification limits')
    elements = [value for field, wire, value in _proto_fields(data) if field == 1 and wire == 2]
    if not elements:
        return None
    if len(elements) != 1:
        raise ValueError('Ambiguous AAPT XML element')
    fields = list(_proto_fields(elements[0]))
    name = next((value.decode('utf-8') for field, wire, value in fields if field == 3 and wire == 2), '')
    if not name:
        raise ValueError('AAPT XML element has no name')
    element = ET.Element(name)
    for field, wire, value in fields:
        if wire != 2:
            continue
        if field == 4:
            attribute = {key: item.decode('utf-8') for key, kind, item in _proto_fields(value)
                         if kind == 2 and key in (1, 2, 3)}
            key = attribute.get(2, '')
            if attribute.get(1):
                key = '{' + attribute[1] + '}' + key
            if not key or key in element.attrib:
                raise ValueError('Invalid or duplicate AAPT XML attribute')
            element.set(key, attribute.get(3, ''))
        elif field == 5:
            child = decode_aapt_xml(value, depth + 1)
            if child is not None:
                element.append(child)
    return element


def inspect_elf(stream, file_size, abi=None):
    issues = []

    def read_at(offset, size):
        if offset < 0 or size < 0 or offset + size > file_size:
            raise ValueError('ELF structure lies outside the file')
        stream.seek(offset)
        value = stream.read(size)
        if len(value) != size:
            raise ValueError('Truncated ELF structure')
        return value

    try:
        ident = read_at(0, 16)
        if ident[:4] != b'\x7fELF' or ident[4] not in (1, 2) or ident[5] not in (1, 2) or ident[6] != 1:
            raise ValueError('Invalid ELF identification')
        bits = 32 if ident[4] == 1 else 64
        endian = '<' if ident[5] == 1 else '>'
        header_size = 52 if bits == 32 else 64
        header_format = 'HHIIIIIHHHHHH' if bits == 32 else 'HHIQQQIHHHHHH'
        header = struct.unpack(endian + header_format, read_at(16, header_size - 16))
        elf_type, machine, version = header[:3]
        ph_offset, eh_size, ph_entry_size, ph_count = header[4], header[7], header[8], header[9]
        expected_entry_size = 32 if bits == 32 else 56
        if elf_type not in (2, 3) or version != 1 or eh_size != header_size:
            raise ValueError('Invalid ELF header')
        if ph_count == 0 or ph_count == 0xffff or ph_entry_size != expected_entry_size or ph_offset < header_size:
            raise ValueError('Invalid or unsupported ELF program-header table')
        table = read_at(ph_offset, ph_count * ph_entry_size)
        segments = []
        for index in range(ph_count):
            values = struct.unpack_from(endian + ('IIIIIIII' if bits == 32 else 'IIQQQQQQ'), table, index * ph_entry_size)
            if bits == 32:
                kind, offset, address, _physical, size, memory, flags, align = values
            else:
                kind, flags, offset, address, _physical, size, memory, align = values
            if size > memory or offset + size > file_size or address + memory > (1 << bits):
                raise ValueError(f'Invalid segment bounds at program header {index}')
            segments.append({'index': index, 'kind': kind, 'offset': offset, 'address': address,
                             'size': size, 'memory': memory, 'flags': flags, 'align': align})
        loads = [segment for segment in segments if segment['kind'] == 1]
        if not loads:
            raise ValueError('Shared object contains no LOAD segment')
        identity = (machine, bits)
        if identity not in ABI_IDENTITIES.values():
            issues.append(issue('ELF_IDENTITY', 'ELF class/machine is not a supported Android ABI identity'))
        expected_abi = ABI_IDENTITIES.get(abi)
        if expected_abi is not None and identity != expected_abi:
            issues.append(issue('ELF_ABI_MISMATCH', f'ELF class/machine does not match {abi}'))
        if bits == 32 and expected_abi is None:
            issues.append(issue('ELF_ABI_REQUIRED', '32-bit policy exemption requires a matching declared Android ABI'))
        valid_32bit = bits == 32 and expected_abi == identity
        applicability = 'NOT_APPLICABLE' if valid_32bit else 'REQUIRED'
        for segment in loads:
            align = segment['align']
            if align > 1 and align & (align - 1):
                issues.append(issue('ELF_SEGMENT_ALIGNMENT', f"LOAD[{segment['index']}] p_align={align} is not a power of two"))
            elif not valid_32bit and align < PAGE_SIZE:
                issues.append(issue('ELF_LOAD_ALIGNMENT', f"LOAD[{segment['index']}] p_align={align}; requires a power of two >=16384"))
            if align > 1 and segment['offset'] % align != segment['address'] % align:
                issues.append(issue('ELF_LOAD_CONGRUENCE', f"LOAD[{segment['index']}] file/virtual addresses are not congruent at p_align={align}"))
        relro = []
        for segment in (item for item in segments if item['kind'] == 0x6474e552):
            end = segment['address'] + segment['memory']
            following = [load['index'] for load in loads if load['flags'] & 2
                         and load['address'] <= max(segment['address'], end - 1)
                         < load['address'] + load['memory'] and load['address'] + load['memory'] > end]
            raw_boundary_risk = end % PAGE_SIZE != 0 and bool(following)
            concern = not valid_32bit and raw_boundary_risk
            relro.append({'end': end, 'end_mod_16k': end % PAGE_SIZE,
                          'following_writable_loads': following, 'raw_16k_boundary_risk': raw_boundary_risk,
                          'concern': concern})
            if concern:
                issues.append(issue('ELF_RELRO_ALIGNMENT', f'RELRO ends at {end:#x} before writable data in LOAD {following}'))
        if endian != '<':
            issues.append(issue('ELF_ANDROID_ENDIAN', 'Android release ABIs require little-endian ELF'))
        architecture = {3: 'x86', 40: 'arm', 62: 'x86_64', 183: 'aarch64', 243: 'riscv'}.get(machine, f'unknown-{machine}')
        return checked(issues, bits=bits, architecture=architecture, machine=machine,
                       endian='little' if endian == '<' else 'big', load_alignments=[item['align'] for item in loads],
                       page_size_16k_applicability=applicability,
                       applicability_reason='Genuine matching 32-bit Android ABI; outside the 64-bit 16KiB requirement' if valid_32bit
                       else '16KiB is required; only a genuine matching 32-bit Android ABI is exempt',
                       load_alignment_status='FAIL' if any(item['code'].startswith(('ELF_LOAD_', 'ELF_SEGMENT_', 'ELF_ABI_', 'ELF_IDENTITY')) for item in issues)
                       else 'NOT_APPLICABLE' if valid_32bit else 'PASS',
                       relro_status='FAIL' if any(item['concern'] for item in relro)
                       else 'NOT_APPLICABLE' if valid_32bit else 'PASS', relro=relro)
    except (ValueError, struct.error, OSError, zipfile.BadZipFile) as error:
        return checked([issue('ELF_MALFORMED', str(error))])


def inspect_native_libraries(artifact):
    libraries, issues, inventory_complete = [], [], False
    try:
        with zipfile.ZipFile(artifact) as archive:
            names = [entry.filename for entry in archive.infolist()]
            if len(names) != len(set(names)):
                issues.append(issue('ZIP_DUPLICATE_ENTRIES', 'Artifact contains duplicate ZIP names'))
            for entry in archive.infolist():
                if entry.is_dir() or not entry.filename.endswith('.so'):
                    continue
                parts = PurePosixPath(entry.filename).parts
                abi = next((parts[index + 1] for index, part in enumerate(parts[:-2]) if part == 'lib'), None)
                try:
                    with archive.open(entry) as stream:
                        result = inspect_elf(stream, entry.file_size, abi)
                except (OSError, RuntimeError, NotImplementedError, zipfile.BadZipFile) as error:
                    result = checked([issue('ELF_UNREADABLE', str(error))])
                result.update(path=entry.filename, abi=abi, bytes=entry.file_size)
                libraries.append(result)
            inventory_complete = True
            if not libraries:
                issues.append(issue('NO_NATIVE_LIBRARIES', 'chatStamp must contain its React Native/native libraries'))
    except (OSError, zipfile.BadZipFile, RuntimeError) as error:
        issues.append(issue('ARTIFACT_ZIP', str(error)))
    for library in libraries:
        if library['status'] != 'PASS':
            issues.append(issue('NATIVE_LIBRARY_FAILED', library['path']))
    return checked(issues, libraries=libraries, library_count=len(libraries),
                   architectures=dict(collections.Counter(f"{item.get('architecture', 'malformed')}/{item.get('bits', '?')}" for item in libraries)),
                   page_size_16k_applicability=dict(collections.Counter(item.get('page_size_16k_applicability', 'UNREADABLE') for item in libraries)),
                   all_libraries_scanned=inventory_complete,
                   alignment_policy='Every shipped .so and every LOAD is inventoried; matching genuine 32-bit ABIs are NOT_APPLICABLE, never certified as 16KiB-compatible',
                   relro_note='64-bit RELRO-end checks include the no-trailing-writable-data exception; matching 32-bit ABIs retain raw values as NOT_APPLICABLE')


def inspect_bundle_config(text):
    try:
        value = json.loads(text)
        native = value['optimizations']['uncompressNativeLibraries']
        alignment = native.get('alignment')
        return checked([] if alignment == 'PAGE_ALIGNMENT_16K' else [issue('BUNDLE_PAGE_ALIGNMENT', f'Observed {alignment!r}')],
                       native_alignment=alignment, uncompress_native_libraries=native.get('enabled'))
    except (ValueError, KeyError, TypeError) as error:
        return checked([issue('BUNDLE_CONFIG', str(error))])


def inspect_jar_coverage(artifact):
    try:
        with zipfile.ZipFile(artifact) as archive:
            entry = archive.getinfo('META-INF/MANIFEST.MF')
            if entry.file_size > 8 * 1024 * 1024:
                raise ValueError('JAR signing manifest exceeds verification limit')
            text = archive.read(entry).decode('utf-8').replace('\r\n', '\n')
            sections = {}
            for section in text.split('\n\n'):
                unfolded = []
                for line in section.splitlines():
                    if line.startswith(' ') and unfolded:
                        unfolded[-1] += line[1:]
                    else:
                        unfolded.append(line)
                values = dict(line.split(': ', 1) for line in unfolded if ': ' in line)
                if 'Name' in values:
                    sections[values['Name']] = values
            payloads = [entry.filename for entry in archive.infolist() if not entry.is_dir()
                        and not re.fullmatch(r'META-INF/(?:MANIFEST\.MF|[^/]+\.(?:SF|RSA|DSA|EC)|SIG-[^/]+)', entry.filename, re.I)]
            missing = [name for name in payloads if not any(key.endswith('-Digest') for key in sections.get(name, {}))]
            return checked([issue('JAR_UNSIGNED_PAYLOAD', name) for name in missing], payload_count=len(payloads))
    except (OSError, KeyError, ValueError, zipfile.BadZipFile) as error:
        return checked([issue('JAR_SIGNING_MANIFEST', str(error))])


class Runner:
    def __init__(self, directory, jdk_home=None):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.env = dict(os.environ)
        for name in ('JAVA_TOOL_OPTIONS', '_JAVA_OPTIONS', 'JDK_JAVA_OPTIONS'):
            self.env.pop(name, None)
        self.env.update(LC_ALL='C', LANG='C')
        if jdk_home:
            self.env['JAVA_HOME'] = str(jdk_home)

    def run(self, name, arguments):
        label = re.sub(r'[^A-Za-z0-9_.-]', '-', name)
        output = self.directory / f'{label}.stdout.txt'
        errors = self.directory / f'{label}.stderr.txt'
        try:
            result = subprocess.run([str(arg) for arg in arguments], capture_output=True, text=True,
                                    errors='replace', env=self.env, timeout=300)
            stdout, stderr, code = result.stdout, result.stderr, result.returncode
        except (OSError, subprocess.TimeoutExpired) as error:
            stdout, stderr, code = '', str(error), None
        output.write_text(stdout, encoding='utf-8')
        errors.write_text(stderr, encoding='utf-8')
        return {'status': 'PASS' if code == 0 else 'FAIL', 'exit_code': code,
                'stdout_log': str(output), 'stderr_log': str(errors)}, stdout


def _build_tools(sdk):
    candidates = [path for path in (sdk / 'build-tools').glob('*') if path.is_dir()]
    return max(candidates, key=lambda path: tuple(int(value) for value in re.findall(r'\d+', path.name))) if candidates else sdk / 'build-tools' / '36.0.0'


def _resource_id(reference):
    match = re.fullmatch(r'@(?:ref/)?(0x[0-9a-fA-F]+)', reference or '')
    return match.group(1).lower() if match else None


def backup_resource_aab(artifact, module, reference, runner, java, bundletool):
    name_match = re.fullmatch(r'@(?:[^:]+:)?xml/([A-Za-z0-9_]+)', reference or '')
    name = name_match.group(1) if name_match else None
    resource = 'xml/' + name if name else _resource_id(reference)
    if resource is None:
        return checked([issue('BACKUP_RESOURCE', f'Unresolvable backup resource {reference!r}')])
    command, output = runner.run('aab-backup-resource-map', [java, '-jar', bundletool, 'dump', 'resources',
                                                           f'--bundle={artifact}', f'--resource={resource}', '--values'])
    if command['status'] != 'PASS':
        return checked([issue('BACKUP_RESOURCE', 'bundletool could not resolve the backup resource')], command=command)
    if name is None:
        match = re.search(r'\bxml/([A-Za-z0-9_]+)', output)
        name = match.group(1) if match else None
    if name is None:
        return checked([issue('BACKUP_RESOURCE', 'Backup XML resource name was not resolved')])
    # Resolve every configuration through the resource table rather than relying
    # on source filenames, which AGP resource shrinking may shorten in releases.
    paths = sorted(set(re.findall(r'\[FILE\]\s+(res/[^\s]+)', output, re.I)))
    if not paths or any('..' in PurePosixPath(path).parts for path in paths):
        return checked([issue('BACKUP_RESOURCE', 'Backup resource has no valid file configurations')], command=command)
    checks = []
    try:
        with zipfile.ZipFile(artifact) as archive:
            entries = [archive.getinfo(module + '/' + path) for path in paths]
            for entry in entries:
                if entry.file_size > MAX_XML_BYTES:
                    raise ValueError('Backup XML exceeds verification limit')
                data = archive.read(entry)
                xml = ET.fromstring(data) if data.lstrip().startswith(b'<') else decode_aapt_xml(data)
                if xml is None:
                    raise ValueError('Backup XML contains no element')
                checks.append({'path': entry.filename, **inspect_backup_rules(xml)})
        if not checks:
            raise ValueError('Referenced backup XML was not found in the bundle')
    except (ValueError, KeyError, OSError, ET.ParseError, zipfile.BadZipFile) as error:
        return checked([issue('BACKUP_RESOURCE', str(error))], resources=checks)
    return checked([] if all(item['status'] == 'PASS' for item in checks) else [issue('BACKUP_EXCLUSIONS', 'Backup resource policy failed')], resources=checks)


def backup_resource_apk(artifact, reference, expected, runner, apkanalyzer, aapt2):
    command, mapping = runner.run('apk-resource-names', [aapt2, 'dump', 'resources', '--no-values', artifact])
    resource = _resource_id(reference)
    if command['status'] != 'PASS':
        return checked([issue('BACKUP_RESOURCE', 'aapt2 could not inspect the resource table')], command=command)
    named = re.fullmatch(r'@(?:[^:]+:)?xml/([A-Za-z0-9_]+)', reference or '')
    match = re.search(r'\bresource\s+' + re.escape(resource or 'NO_ID') + r'\s+xml/([A-Za-z0-9_]+)\b', mapping, re.I)
    name = named.group(1) if named else match.group(1) if match else None
    if not name:
        return checked([issue('BACKUP_RESOURCE', 'The manifest backup resource was not mapped to an XML name')])
    command, configs = runner.run('apk-xml-configs', [apkanalyzer, 'resources', 'configs', '--type', 'xml',
                                                    '--package', expected.package, artifact])
    if command['status'] != 'PASS':
        return checked([issue('BACKUP_RESOURCE', 'apkanalyzer could not list XML configurations')], command=command)
    configurations = sorted(set(['default', *configs.splitlines()]))
    paths = set()
    for index, configuration in enumerate(configurations):
        command, value = runner.run(f'apk-backup-path-{index}', [apkanalyzer, 'resources', 'value', '--type', 'xml',
                                    '--name', name, '--config', configuration.strip(), '--package', expected.package, artifact])
        if command['status'] == 'PASS' and re.fullmatch(r'res/[^\s]+\.xml', value.strip()):
            paths.add(value.strip())
    checks = []
    for index, path in enumerate(sorted(paths)):
        command, xml = runner.run(f'apk-backup-xml-{index}', [apkanalyzer, 'resources', 'xml', '--file', path, artifact])
        checks.append({'path': path, **inspect_backup_rules(xml)} if command['status'] == 'PASS'
                      else checked([issue('BACKUP_RESOURCE', f'Could not decode {path}')], path=path))
    return checked([] if checks and all(item['status'] == 'PASS' for item in checks)
                   else [issue('BACKUP_EXCLUSIONS', 'Referenced backup XML was missing or failed policy')], resources=checks)


def signature_check(artifact, kind, expected_certificate, runner, tools):
    if kind == 'aab':
        verification, output = runner.run('aab-jarsigner', [tools['jarsigner'], '-J-Duser.language=en', '-J-Duser.country=US',
                                                          '-verify', '-verbose', '-certs', artifact])
        certificates, text = runner.run('aab-public-certificates', [tools['keytool'], '-J-Duser.language=en',
                                         '-J-Duser.country=US', '-printcert', '-jarfile', artifact])
        fingerprints = re.findall(r'SHA256:\s*([0-9A-Fa-f:]{64,})', text)
        coverage = inspect_jar_coverage(artifact)
        valid = verification['status'] == 'PASS' and certificates['status'] == 'PASS' and 'jar verified.' in output.lower()
        valid = valid and coverage['status'] == 'PASS' and 'unsigned entries' not in output.lower()
    else:
        verification, output = runner.run('apk-apksigner', [tools['apksigner'], 'verify', '--verbose', '--print-certs', artifact])
        fingerprints = re.findall(r'Signer #\d+ certificate SHA-256 digest:\s*([0-9A-Fa-f]{64})', output)
        certificates, coverage = None, None
        valid = verification['status'] == 'PASS' and bool(fingerprints)
    fingerprints = sorted({value.replace(':', '').lower() for value in fingerprints})
    issues = []
    if not valid:
        issues.append(issue('SIGNATURE_INVALID', f'{kind.upper()} signature/coverage verification failed'))
    if fingerprints != [expected_certificate.lower().replace(':', '')]:
        issues.append(issue('SIGNATURE_CERTIFICATE', 'Signer certificate does not exactly match the supplied public upload-certificate SHA256'))
    return checked(issues, certificate_sha256=fingerprints, verification=verification,
                   certificate_readback=certificates, signed_payload_coverage=coverage,
                   note='Self-signed Android upload certificates do not need public-CA trust; cryptographic signature and complete payload coverage are verified')


def verify_artifact(artifact, kind, expected, runner, tools, certificate):
    artifact = Path(artifact).resolve()
    if not artifact.is_file():
        return checked([issue('ARTIFACT_MISSING', str(artifact))], path=str(artifact), kind=kind)
    checks = {}
    if kind == 'aab':
        checks['bundletool_validate'], _ = runner.run('aab-validate', [tools['java'], '-jar', tools['bundletool'], 'validate', f'--bundle={artifact}'])
        config_command, config = runner.run('aab-config', [tools['java'], '-jar', tools['bundletool'], 'dump', 'config', f'--bundle={artifact}'])
        checks['bundle_config'] = inspect_bundle_config(config)
        checks['bundle_config']['command'] = config_command
        if config_command['status'] != 'PASS':
            checks['bundle_config']['issues'].append(issue('BUNDLE_CONFIG_COMMAND', 'bundletool config command failed'))
            checks['bundle_config']['status'] = 'FAIL'
        manifests = []
        try:
            with zipfile.ZipFile(artifact) as archive:
                modules = sorted({match.group(1) for name in archive.namelist()
                                  if (match := re.fullmatch(r'([A-Za-z0-9_.-]+)/manifest/AndroidManifest\.xml', name))})
            for module in modules:
                command, xml = runner.run(f'aab-manifest-{module}', [tools['java'], '-jar', tools['bundletool'], 'dump', 'manifest',
                                                    f'--bundle={artifact}', f'--module={module}'])
                if command['status'] != 'PASS':
                    raise ValueError(f'Could not decode manifest for module {module}')
                manifests.append((module, xml))
            base = next(xml for module, xml in manifests if module == 'base')
            checks['manifest'] = inspect_manifest(base, expected, [xml for module, xml in manifests if module != 'base'])
            checks['backup_rules'] = backup_resource_aab(artifact, 'base', checks['manifest'].get('backup', {}).get('dataExtractionRules'),
                                                        runner, tools['java'], tools['bundletool'])
        except (OSError, ValueError, StopIteration, zipfile.BadZipFile) as error:
            checks['manifest'] = checked([issue('MANIFEST_READ', str(error))])
    else:
        command, xml = runner.run('apk-manifest', [tools['apkanalyzer'], 'manifest', 'print', artifact])
        checks['manifest'] = inspect_manifest(xml, expected)
        checks['manifest']['command'] = command
        if command['status'] != 'PASS':
            checks['manifest']['issues'].append(issue('MANIFEST_COMMAND', 'apkanalyzer manifest command failed'))
            checks['manifest']['status'] = 'FAIL'
        checks['backup_rules'] = backup_resource_apk(artifact, checks['manifest'].get('backup', {}).get('dataExtractionRules'),
                                                    expected, runner, tools['apkanalyzer'], tools['aapt2'])
        checks['zipalign'], _ = runner.run('apk-zipalign', [tools['zipalign'], '-c', '-P', '16', '-v', '4', artifact])
    checks['native_libraries'] = inspect_native_libraries(artifact)
    checks['signature'] = signature_check(artifact, kind, certificate, runner, tools)
    with artifact.open('rb') as stream:
        digest = hashlib.file_digest(stream, 'sha256').hexdigest() if hasattr(hashlib, 'file_digest') else _hash(stream)
    issues = [issue('CHECK_FAILED', name) for name, result in checks.items() if result['status'] != 'PASS']
    return checked(issues, kind=kind, path=str(artifact), sha256=digest, bytes=artifact.stat().st_size, checks=checks)


def _hash(stream):
    digest = hashlib.sha256()
    for block in iter(lambda: stream.read(1024 * 1024), b''):
        digest.update(block)
    return digest.hexdigest()


def write_report(path, report, work_directory):
    payload = json.dumps(report, indent=2, ensure_ascii=False) + '\n'
    path, work_directory = Path(path).resolve(), Path(work_directory).resolve()
    if not path.is_relative_to(work_directory):
        total = sum(entry.stat().st_size for entry in path.parent.rglob('*') if entry.is_file()) if path.parent.exists() else 0
        # Account for both the old report and its atomic replacement while the
        # sibling temporary file exists; the evidence ceiling also applies then.
        if total + len(payload.encode('utf-8')) > EVIDENCE_LIMIT:
            raise ValueError('The complete containing evidence set would exceed 10,000,000 bytes')
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + '.tmp')
    try:
        temporary.write_text(payload, encoding='utf-8')
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--aab', type=Path)
    parser.add_argument('--apk', type=Path)
    parser.add_argument('--bundletool', type=Path)
    parser.add_argument('--sdk-root', type=Path, default=Path(os.environ.get('ANDROID_HOME') or os.environ.get('ANDROID_SDK_ROOT') or '/missing-android-sdk'))
    parser.add_argument('--jdk-home', type=Path, default=Path(os.environ['JAVA_HOME']) if os.environ.get('JAVA_HOME') else None)
    for tool in ('java', 'jarsigner', 'keytool', 'apkanalyzer', 'aapt2', 'apksigner', 'zipalign'):
        parser.add_argument('--' + tool, type=Path)
    parser.add_argument('--expected-package', default=Expected.package)
    parser.add_argument('--expected-version', default=Expected.version)
    parser.add_argument('--expected-code', type=int, default=Expected.code)
    parser.add_argument('--expected-cert-sha256', required=True, help='Public certificate SHA256 only; never a keystore or password')
    parser.add_argument('--work-dir', type=Path)
    parser.add_argument('--report', type=Path)
    args = parser.parse_args(argv)
    if not args.aab and not args.apk:
        parser.error('Supply --aab and/or --apk')
    if args.aab and not args.bundletool:
        parser.error('--bundletool is required for an AAB')
    certificate = args.expected_cert_sha256.replace(':', '').lower()
    if not re.fullmatch(r'[0-9a-f]{64}', certificate):
        parser.error('--expected-cert-sha256 must be a public 32-byte SHA256 fingerprint')
    directory = args.work_dir or Path(tempfile.mkdtemp(prefix='chatstamp-release-verification-'))
    runner = Runner(directory, args.jdk_home)
    sdk, jdk = args.sdk_root.resolve(), args.jdk_home.resolve() if args.jdk_home else None
    build_tools = _build_tools(sdk)
    tools = {'bundletool': args.bundletool}
    for name in ('java', 'jarsigner', 'keytool'):
        tools[name] = getattr(args, name) or (jdk / 'bin' / name if jdk else shutil.which(name) or name)
    tools['apkanalyzer'] = args.apkanalyzer or sdk / 'cmdline-tools/latest/bin/apkanalyzer'
    for name in ('aapt2', 'apksigner', 'zipalign'):
        tools[name] = getattr(args, name) or build_tools / name
    expected = Expected(package=args.expected_package, version=args.expected_version, code=args.expected_code)
    artifacts = [verify_artifact(path, kind, expected, runner, tools, certificate)
                 for kind, path in (('aab', args.aab), ('apk', args.apk)) if path]
    report = {
        'status': 'PASS' if all(artifact['status'] == 'PASS' for artifact in artifacts) else 'FAIL',
        'checked_at_utc': dt.datetime.now(dt.timezone.utc).isoformat(),
        'expected': dataclasses.asdict(expected), 'expected_certificate_sha256': certificate,
        'sources': SOURCES, 'work_directory': str(runner.directory), 'artifacts': artifacts,
        'scope': 'Artifact checks only; minified app/device/Gallery acceptance must be recorded separately',
    }
    target = args.report or runner.directory / 'report.json'
    write_report(target, report, runner.directory)
    print(json.dumps({'status': report['status'], 'report': str(target.resolve()),
                      'artifacts': [{'kind': value['kind'], 'status': value['status'], 'sha256': value.get('sha256'),
                                     'failed_checks': [item['message'] for item in value['issues']]} for value in artifacts]}, indent=2))
    return 0 if report['status'] == 'PASS' else 1


if __name__ == '__main__':
    raise SystemExit(main())
