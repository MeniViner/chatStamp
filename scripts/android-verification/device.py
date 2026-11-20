import argparse
import re
import sys
import time
import xml.etree.ElementTree as ET

from qa import DEVICE_ROOT, FIXTURES, PACKAGE, ROOT, STEM, WINDOW_PNG, WINDOW_XML, adb, downloads, row_ids


ACTIVITY = f"{PACKAGE}/com.menis10tec.chatstamp.MainActivity"


def screen(save_as=None):
    result = adb("shell", "uiautomator", "dump", WINDOW_XML)
    if "dumped to" not in result:
        raise RuntimeError(result)
    data = adb("shell", "cat", WINDOW_XML)
    if save_as:
        ROOT.mkdir(parents=True, exist_ok=True)
        (ROOT / f"{save_as}.xml").write_text(data, encoding="utf-8")
    root = ET.fromstring(data)
    return [
        node.attrib for node in root.iter("node")
        if node.attrib.get("text") or node.attrib.get("content-desc") or node.attrib.get("clickable") == "true"
    ]


def tap(node):
    x1, y1, x2, y2 = map(int, re.findall(r"\d+", node["bounds"]))
    adb("shell", "input", "tap", str((x1 + x2) // 2), str((y1 + y2) // 2))


def find(pattern, nodes):
    matching = [node for node in nodes if node.get("enabled") != "false" and any(
        re.fullmatch(pattern, node.get(field, ""), flags=re.IGNORECASE)
        for field in ("text", "content-desc", "resource-id")
    )]
    if not matching:
        raise LookupError(pattern)
    return next((node for node in matching if node.get("clickable") == "true"), matching[0])


def screenshot(name):
    ROOT.mkdir(parents=True, exist_ok=True)
    adb("shell", "screencap", "-p", WINDOW_PNG)
    try:
        adb("pull", WINDOW_PNG, str(ROOT / f"{name}.png"))
    finally:
        adb("shell", "rm", "-f", WINDOW_PNG)


def prepare_fixture(suffix):
    if suffix not in FIXTURES:
        raise ValueError(f"Choose one fixture from {', '.join(FIXTURES)}")
    name = f"{STEM}-{suffix}.zip"
    source = ROOT / "fixtures" / name
    if not source.is_file():
        raise FileNotFoundError(source)
    adb("shell", "mkdir", "-p", DEVICE_ROOT)
    adb("push", str(source), f"{DEVICE_ROOT}/{name}")
    adb("shell", "am", "broadcast", "-a", "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
        "-d", f"file:///storage/emulated/0/{DEVICE_ROOT.removeprefix('/sdcard/')}/{name}")
    for _ in range(20):
        ids = row_ids(downloads(name))
        if len(ids) == 1:
            return f"content://media/external/downloads/{ids[0]}"
        time.sleep(0.25)
    raise RuntimeError(f"Could not find one MediaStore Downloads row for {name}")


def main(action, *args):
    if action == "dump":
        for node in screen(*args):
            print(f"{node.get('text', '')!r} {node.get('content-desc', '')!r} "
                  f"{node.get('resource-id', '')} {node['bounds']} "
                  f"clickable={node.get('clickable')} enabled={node.get('enabled')} "
                  f"checked={node.get('checked')}")
    elif action == "tap":
        tap(find(args[0], screen()))
    elif action == "sequence":
        for pattern in args:
            tap(find(pattern, screen()))
            time.sleep(0.3)
    elif action == "shot":
        screenshot(args[0])
    elif action == "launch":
        if args and args[0] == "cold":
            adb("shell", "am", "force-stop", PACKAGE)
        print(adb("shell", "am", "start", "-W", "-n", ACTIVITY))
    elif action == "share":
        uri = args[0]
        mime = args[1] if len(args) > 1 else "application/zip"
        print(adb("shell", "am", "start", "-W", "-a", "android.intent.action.SEND",
                  "-t", mime, "--grant-read-uri-permission", "--eu",
                  "android.intent.extra.STREAM", uri, "-n", ACTIVITY))
    elif action == "prepare":
        print(prepare_fixture(args[0]))
    elif action == "cache":
        print(adb("shell", "run-as", PACKAGE, "du", "-ak", "cache/chatstamp", "cache/shared-zips",
                  "cache/DocumentPicker", check=False))
    else:
        raise ValueError(action)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description="Operate the isolated chatStamp QA app over ADB")
    parser.add_argument("action", choices=("dump", "tap", "sequence", "shot", "launch", "share", "prepare", "cache"))
    parser.add_argument("arguments", nargs="*")
    options = parser.parse_args()
    main(options.action, *options.arguments)
