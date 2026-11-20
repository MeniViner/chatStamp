import json
import re
import threading
import time

from device import find, screen, tap
from qa import PACKAGE, ROOT, STEM, adb


pid = adb("shell", "pidof", PACKAGE)
samples = []
start = time.monotonic()
stop = threading.Event()


def sample_memory():
    while not stop.is_set():
        status = adb("shell", "run-as", PACKAGE, "cat", f"/proc/{pid}/status", check=False)
        rss = re.search(r"^VmRSS:\s+(\d+)", status, flags=re.MULTILINE)
        if rss:
            samples.append([round(time.monotonic() - start, 3), int(rss.group(1))])
        stop.wait(0.1)


file = find(re.escape(f"{STEM}-large.zip"), screen())
thread = threading.Thread(target=sample_memory)
thread.start()
try:
    time.sleep(0.45)
    tapped_at = round(time.monotonic() - start, 3)
    tap(file)
    ready = False
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        try:
            visible = screen("large-selection")
        except (RuntimeError, ValueError):
            continue
        if any(node.get("text") == "VID-20190218-WA8888.mp4" for node in visible):
            ready = True
            break
        if any(node.get("text") in ("Something went wrong", "Choose another file") for node in visible):
            break
finally:
    stop.set()
    thread.join()

evidence = {
    "pid_before": pid,
    "pid_after": adb("shell", "pidof", PACKAGE, check=False),
    "selected_video_visible": ready,
    "seconds_from_tap_to_ui_check": round(time.monotonic() - start - tapped_at, 3),
    "rss_before_tap_kib": max((rss for when, rss in samples if when <= tapped_at), default=None),
    "rss_max_sampled_kib": max((rss for when, rss in samples), default=None),
    "rss_last_sample_kib": samples[-1][1] if samples else None,
    "rss_samples": len(samples),
    "time_and_rss_kib": samples,
}
(ROOT / "large-memory.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
print(json.dumps({key: value for key, value in evidence.items() if key != "time_and_rss_kib"}, indent=2))
if not ready:
    raise SystemExit(1)
