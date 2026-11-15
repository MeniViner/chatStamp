import os
import re
import shlex
import subprocess
from pathlib import Path


RUN_ID = os.environ.get("CHATSTAMP_QA_RUN_ID", "fixture")
if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", RUN_ID):
    raise ValueError("CHATSTAMP_QA_RUN_ID must contain 1–40 lowercase letters, digits, or hyphens")

ROOT = Path(__file__).resolve().parents[2] / "dist" / "android-verification" / RUN_ID
STEM = f"chatstamp-qa-{RUN_ID}"
PACKAGE = os.environ.get("CHATSTAMP_QA_PACKAGE", "com.menis.chatstamp.qa")
if PACKAGE not in ("com.menis.chatstamp.qa", "com.menis.chatstamp.qa.probe"):
    raise ValueError("Choose the dedicated QA or storage probe package")

DOWNLOAD_FOLDER = f"Download/{STEM}/"
DEVICE_ROOT = f"/sdcard/{DOWNLOAD_FOLDER.rstrip('/')}"
WINDOW_XML = f"/data/local/tmp/{STEM}-window.xml"
WINDOW_PNG = f"/data/local/tmp/{STEM}-screen.png"
FIXTURES = ("mixed", "text-only", "no-transcript", "invalid", "large")
MEDIA_ROOT = os.environ.get("CHATSTAMP_QA_MEDIA_ROOT", "Pictures")
if MEDIA_ROOT not in ("Pictures", "DCIM", "Movies"):
    raise ValueError("CHATSTAMP_QA_MEDIA_ROOT must be Pictures, DCIM, or Movies")
GALLERY_FOLDER = f"{MEDIA_ROOT}/chatStamp/{STEM}-mixed/"


def adb(*args, check=True):
    sdk = os.environ.get("ANDROID_HOME") or os.environ.get("ANDROID_SDK_ROOT")
    name = "adb.exe" if os.name == "nt" else "adb"
    sdk_adb = Path(sdk) / "platform-tools" / name if sdk else None
    default_adb = str(sdk_adb) if sdk_adb and sdk_adb.is_file() else "adb"
    executable = os.environ.get("CHATSTAMP_QA_ADB", default_adb)
    result = subprocess.run([executable, *args], capture_output=True)
    if check and result.returncode:
        raise RuntimeError((result.stdout + result.stderr).decode("utf-8", "replace"))
    return result.stdout.decode("utf-8", "replace").strip()


def downloads(name, relative_path=DOWNLOAD_FOLDER):
    where = shlex.quote(f"relative_path = '{relative_path}' AND _display_name = '{name}'")
    return adb("shell", "content query --uri content://media/external/downloads "
               f"--projection _id --where {where}")


def row_ids(rows):
    return re.findall(r"_id=(\d+)", rows)
