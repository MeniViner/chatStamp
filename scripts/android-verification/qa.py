import os
import re
import shlex
import subprocess
from pathlib import Path


RUN_ID = os.environ.get("CHATSTAMP_QA_RUN_ID", "fixture")
if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", RUN_ID):
    raise ValueError("CHATSTAMP_QA_RUN_ID must contain 1–40 lowercase letters, digits, or hyphens")

if os.environ.get("CHATSTAMP_QA_WORK_ROOT"):
    ROOT = Path(os.environ["CHATSTAMP_QA_WORK_ROOT"]).expanduser()
    if not ROOT.is_absolute():
        raise ValueError("CHATSTAMP_QA_WORK_ROOT must be the absolute directory for this run's working files")
else:
    ROOT = Path(__file__).resolve().parents[2] / "dist" / "android-verification" / RUN_ID
STEM = f"chatstamp-qa-{RUN_ID}"
PACKAGE = os.environ.get("CHATSTAMP_QA_PACKAGE", "com.menis10tec.chatstamp.qa")
if PACKAGE not in ("com.menis10tec.chatstamp.qa", "com.menis10tec.chatstamp.qa.probe"):
    raise ValueError("Choose the dedicated QA or storage probe package")

DOWNLOAD_FOLDER = f"Download/{STEM}/"
DEVICE_ROOT = f"/sdcard/{DOWNLOAD_FOLDER.rstrip('/')}"
WINDOW_XML = f"/data/local/tmp/{STEM}-window.xml"
WINDOW_PNG = f"/data/local/tmp/{STEM}-screen.png"
FIXTURES = ("mixed", "text-only", "no-transcript", "invalid", "large", "undated")
MEDIA_ROOT = os.environ.get("CHATSTAMP_QA_MEDIA_ROOT", "Pictures")
if MEDIA_ROOT not in ("Pictures", "DCIM", "Movies"):
    raise ValueError("CHATSTAMP_QA_MEDIA_ROOT must be Pictures, DCIM, or Movies")
CHAT_SEGMENTS = {suffix: f"{STEM}-{suffix}"[:54] for suffix in FIXTURES}
GALLERY_FOLDER = f"{MEDIA_ROOT}/chatStamp/{CHAT_SEGMENTS['mixed']}/"


def is_run_output_path(relative_path):
    if not isinstance(relative_path, str) or "\\" in relative_path:
        return False
    parts = relative_path.rstrip("/").split("/")
    return (
        len(parts) >= 3
        and parts[0] in ("Pictures", "DCIM", "Movies", "Music", "Documents", "Download")
        and parts[1] == "chatStamp"
        and parts[2] in set(CHAT_SEGMENTS.values())
        and all(part and part not in (".", "..") for part in parts)
    )


def adb_executable():
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    name = "adb.exe" if os.name == "nt" else "adb"
    sdk_adb = Path(sdk) / "platform-tools" / name if sdk else None
    default_adb = str(sdk_adb) if sdk_adb and sdk_adb.is_file() else "adb"
    return os.environ.get("CHATSTAMP_QA_ADB", default_adb)


def adb(*args, check=True):
    result = subprocess.run([adb_executable(), *args], capture_output=True)
    if check and result.returncode:
        raise RuntimeError((result.stdout + result.stderr).decode("utf-8", "replace"))
    return result.stdout.decode("utf-8", "replace").strip()


def downloads(name, relative_path=DOWNLOAD_FOLDER):
    where = shlex.quote(f"relative_path = '{relative_path}' AND _display_name = '{name}'")
    return adb("shell", "content query --uri content://media/external/downloads "
               f"--projection _id --where {where}")


def row_ids(rows):
    return re.findall(r"_id=(\d+)", rows)
