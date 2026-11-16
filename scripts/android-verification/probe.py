import argparse
import csv
import json
import os
import re
import shlex
import subprocess
from datetime import datetime
from pathlib import Path
from zipfile import ZipFile

from qa import ROOT, STEM, WINDOW_PNG, WINDOW_XML, adb, adb_executable


PACKAGE = "com.menis.chatstamp.qa.probe"
TEST_PACKAGE = f"{PACKAGE}.test"
RUNNER = "androidx.test.runner.AndroidJUnitRunner"
OUTPUTS = Path(__file__).resolve().parent / "probe" / "build" / "outputs" / "apk"
ASSETS = ROOT / "probe-assets"
HOST = ROOT / "probe-host"
DEVICE = ROOT / "probe-device"
BROAD = re.compile(r"android\.permission\.((?:MANAGE|WRITE|READ)_EXTERNAL_STORAGE"
                   r"|READ_MEDIA_(IMAGES|VIDEO|AUDIO|VISUAL_USER_SELECTED))\b")


def capture(*command):
    result = subprocess.run(command, capture_output=True, check=True)
    return result.stdout.decode("utf-8", "replace")


def aapt_executable():
    sdk = Path(os.environ.get("ANDROID_HOME") or os.environ["ANDROID_SDK_ROOT"])
    name = "aapt.exe" if os.name == "nt" else "aapt"
    installed = [tool for tool in (sdk / "build-tools").glob(f"*/{name}")
                 if re.fullmatch(r"\d+\.\d+\.\d+", tool.parent.name)]
    return str(max(installed, key=lambda tool: tuple(map(int, tool.parent.name.split(".")))))


def verify_apks():
    tool = aapt_executable()
    apks = []
    output = []
    for folder, identity in ((OUTPUTS / "debug", PACKAGE), (OUTPUTS / "androidTest" / "debug", TEST_PACKAGE)):
        metadata = json.loads((folder / "output-metadata.json").read_text(encoding="utf-8"))
        if metadata["applicationId"] != identity or len(metadata["elements"]) != 1:
            raise RuntimeError(f"Expected one APK for {identity}")
        apk = folder / metadata["elements"][0]["outputFile"]
        badging = capture(tool, "dump", "badging", str(apk))
        permissions = capture(tool, "dump", "permissions", str(apk))
        manifest = capture(tool, "dump", "xmltree", str(apk), "AndroidManifest.xml")
        if f"package: name='{identity}'" not in badging or BROAD.search(permissions):
            raise RuntimeError(f"Unexpected APK identity or permissions in {apk}")
        if "sdkVersion:'30'" not in badging or "targetSdkVersion:'36'" not in badging:
            raise RuntimeError(f"Expected min SDK 30 and target SDK 36 in {apk.name}")
        if identity == TEST_PACKAGE:
            if f'android:targetPackage(0x01010021)="{PACKAGE}"' not in manifest or RUNNER not in manifest:
                raise RuntimeError("Test APK does not target the probe package through AndroidJUnitRunner")
            with ZipFile(apk) as archive:
                if archive.read("assets/probe-run.txt").decode("utf-8").strip() != STEM:
                    raise RuntimeError("Build the probe APKs with -PchatStampProbeRun for this fixture run")
        apks.append(apk)
        output.extend((str(apk), badging, permissions, manifest))
    ROOT.mkdir(parents=True, exist_ok=True)
    (ROOT / "probe-apks.txt").write_text("\n".join(output), encoding="utf-8")
    print(f"Checked {PACKAGE} and {TEST_PACKAGE}, SDK levels, runner and storage permissions")
    return apks


def fixtures():
    with (ASSETS / "probe-fixtures.tsv").open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream, delimiter="\t"))
    for row in rows:
        if not re.fullmatch(STEM + r"-[a-z0-9-]+\.[a-z0-9]+", row["name"]):
            raise ValueError(f"Invalid fixture name {row['name']!r}")
    return rows


def inspect_media(path):
    facts = json.loads(capture(
        "ffprobe", "-v", "error", "-show_entries", "format_tags=creation_time:stream=codec_name,codec_type",
        "-of", "json", str(path),
    ))
    if not facts.get("streams"):
        raise RuntimeError(f"No decodable stream found in {path}")
    subprocess.run(["ffmpeg", "-v", "error", "-xerror", "-i", str(path), "-f", "null", "-"], check=True)
    return facts


def check_creation(tags, expected):
    raw = tags.get("format", {}).get("tags", {}).get("creation_time")
    if not raw:
        raise RuntimeError("ffprobe did not find an MP4 creation_time")
    actual_time = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    expected_time = datetime.fromisoformat(expected.replace("Z", "+00:00"))
    if abs(actual_time - expected_time).total_seconds() > 2:
        raise RuntimeError(f"FFprobe read {raw}; expected {expected}")
    return raw


def verify_host():
    summaries = []
    for fixture in fixtures():
        name, mime = fixture["name"], fixture["mime"]
        if not mime.startswith(("audio/", "image/", "video/")):
            continue
        original = inspect_media(ASSETS / name)
        evidence = {"fixture": name, "streams": original["streams"]}
        if mime.startswith("video/"):
            evidence["original_creation_utc"] = check_creation(original, fixture["source_creation_utc"])
            evidence["rewritten_creation_utc"] = check_creation(inspect_media(HOST / name), fixture["expected_utc"])
        summaries.append(evidence)
    (HOST / "ffprobe.json").write_text(json.dumps(summaries, indent=2), encoding="utf-8")
    print(f"Decoded {len(summaries)} fixture assets and verified both rewritten MP4 dates with FFprobe")


def installed(identity):
    return adb("shell", "pm", "path", identity, check=False).startswith("package:")


def instrument(test, **arguments):
    flags = ["-e", "class", f"{PACKAGE}.{test}", "-e", "probeRun", STEM]
    for key, value in arguments.items():
        flags.extend(("-e", key, value))
    output = adb("shell", "am", "instrument", "-w", "-r", *flags, f"{TEST_PACKAGE}/{RUNNER}")
    (DEVICE / f"{test}.txt").write_text(output + "\n", encoding="utf-8")
    print(output)
    return "OK (1 test)" in output and "INSTRUMENTATION_CODE: -1" in output


def run(allow_saf, layout):
    app, test = verify_apks()
    if installed(PACKAGE):
        prior = adb("shell", "run-as", PACKAGE, "sh", "-c", shlex.quote("if [ -d files ]; then ls -1 files; fi"))
        if any(line.startswith("chatstamp-qa-") for line in prior.splitlines()):
            raise RuntimeError("Collect and clean up the previous probe run before reinstalling the probe")
    for identity in (TEST_PACKAGE, PACKAGE):
        if installed(identity):
            if adb("uninstall", identity) != "Success":
                raise RuntimeError(f"Could not uninstall {identity}")
    for apk in (app, test):
        if "Success" not in adb("install", "-t", str(apk)):
            raise RuntimeError(f"Could not install {apk.name}")
    DEVICE.mkdir(parents=True, exist_ok=True)
    (DEVICE / "device.txt").write_text("\n".join([
        adb("shell", "getprop", "ro.product.manufacturer"), adb("shell", "getprop", "ro.product.model"),
        adb("shell", "getprop", "ro.build.version.sdk"), adb("shell", "getprop", "persist.sys.timezone"),
        adb("shell", "dumpsys", "package", PACKAGE),
        adb("shell", "cmd", "appops", "get", PACKAGE, "MANAGE_EXTERNAL_STORAGE", check=False),
    ]), encoding="utf-8")
    if allow_saf:
        print(f"If the picker opens, create and select Documents/{STEM}-saf within two minutes.", flush=True)
    if not instrument("ProbeStorageTest", allowSaf=str(allow_saf).lower(), layout=layout):
        raise RuntimeError("Storage assertions failed. Run collect and read the device evidence before cleanup.")


def collect():
    DEVICE.mkdir(parents=True, exist_ok=True)
    records = adb("shell", "run-as", PACKAGE, "cat", f"files/{STEM}/events.jsonl")
    (DEVICE / "events.jsonl").write_text(records + "\n", encoding="utf-8")
    events = [json.loads(line) for line in records.splitlines()]
    videos = {row["id"]: row for row in fixtures() if row["mime"] == "video/mp4"}
    evidence = []
    for signal in (event for event in events if event["event"] == "video"):
        fixture = videos[signal["id"]]
        name = f"reopened-{fixture['name']}"
        result = subprocess.run([adb_executable(), "exec-out", "run-as", PACKAGE, "cat", f"files/{STEM}/{name}"],
                                capture_output=True, check=True)
        destination = DEVICE / name
        destination.write_bytes(result.stdout)
        date = check_creation(inspect_media(destination), fixture["expected_utc"])
        evidence.append({"fixture": fixture["name"], "creation_utc": date})
    (DEVICE / "ffprobe.json").write_text(json.dumps(evidence, indent=2), encoding="utf-8")
    if {item["fixture"] for item in evidence} != {row["name"] for row in videos.values()}:
        raise RuntimeError("Saved evidence is missing a reopened MP4")
    print(f"Captured {len(events)} Android events and validated both reopened MP4s with FFprobe")


def cleanup():
    DEVICE.mkdir(parents=True, exist_ok=True)
    if not instrument("ProbeCleanupTest"):
        raise RuntimeError("Probe cleanup assertions failed. Leave the probe installed to retry as the owner.")
    events = adb("shell", "run-as", PACKAGE, "cat", f"files/{STEM}/events.jsonl")
    (DEVICE / "cleanup-events.jsonl").write_text(events + "\n", encoding="utf-8")
    folders = [
        f"{root}/chatStamp/{STEM}{suffix}"
        for root, suffixes in (
            ("Pictures", ("", "-png-check", "-webp-check")), ("DCIM", ("", "-png-check", "-webp-check")),
            ("Movies", ("-videos",)), ("Music", ("",)), ("Documents", ("",)), ("Download", ("",)),
        )
        for suffix in suffixes
    ]
    folders.append(f"Documents/{STEM}-saf")
    cleanup_log = []
    for folder in folders:
        path = shlex.quote(f"/sdcard/{folder}")
        adb("shell", f"if [ -d {path} ]; then rmdir {path}; fi")
        adb("shell", f"test ! -e {path}")
        cleanup_log.append(f"Missing after cleanup: /sdcard/{folder}")
    adb("shell", "rm", "-f", WINDOW_XML, WINDOW_PNG)
    for path in (WINDOW_XML, WINDOW_PNG):
        adb("shell", "test", "!", "-e", path)
    for identity in (TEST_PACKAGE, PACKAGE):
        if adb("uninstall", identity) != "Success" or installed(identity):
            raise RuntimeError(f"{identity} still installed")
        cleanup_log.append(f"Uninstalled: {identity}")
    (DEVICE / "cleanup.txt").write_text("\n".join(cleanup_log) + "\n", encoding="utf-8")
    print(f"Removed probe exports, empty run folders, and both probe APKs for {STEM}")


def main():
    parser = argparse.ArgumentParser(description="Build evidence for the isolated chatStamp storage probe")
    parser.add_argument("action", choices=("verify-apks", "verify-host", "run", "collect", "cleanup"))
    parser.add_argument("--allow-saf", action="store_true", help="Let the run open the system folder picker if needed")
    parser.add_argument("--layout", choices=("auto", "dcim", "split"), default="auto",
                        help="Select a Gallery destination for a fresh diagnostic run")
    args = parser.parse_args()
    if args.action in ("run", "collect", "cleanup"):
        adb("get-state")
    if args.action == "run":
        run(args.allow_saf, args.layout)
        return
    actions = {"verify-apks": verify_apks, "verify-host": verify_host, "collect": collect, "cleanup": cleanup}
    actions[args.action]()


if __name__ == "__main__":
    main()
