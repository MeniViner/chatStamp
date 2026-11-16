import json
import re
import shlex

from qa import DEVICE_ROOT, FIXTURES, GALLERY_FOLDER, PACKAGE, ROOT, STEM, WINDOW_PNG, WINDOW_XML
from qa import adb, downloads, row_ids


def remove_download(name, relative_path=None):
    rows = downloads(name) if relative_path is None else downloads(name, relative_path)
    for row_id in row_ids(rows):
        adb("shell", "content", "delete", "--uri", f"content://media/external/downloads/{row_id}")


def remove_saved_media():
    evidence = ROOT / "media-evidence.json"
    if not evidence.is_file():
        return
    for item in json.loads(evidence.read_text(encoding="utf-8")):
        uri, name = item["uri"], item["file"]
        if not re.fullmatch(r"content://media/external/(images|video)/media/\d+", uri):
            raise ValueError(f"Unexpected evidence URI {uri}")
        where = shlex.quote(f"relative_path LIKE '{GALLERY_FOLDER}%'")
        row = adb("shell", f"content query --uri {uri} --projection _display_name:relative_path --where {where}")
        if f"_display_name={name}, " in row:
            adb("shell", "content", "delete", "--uri", uri)
            remaining = adb("shell", f"content query --uri {uri} --projection _display_name --where {where}")
            if "_display_name=" in remaining:
                raise RuntimeError(f"QA Gallery row remains: {uri}")

    gallery_path = f"/storage/emulated/0/{GALLERY_FOLDER.rstrip('/')}"
    directories = adb("shell", f"find {shlex.quote(gallery_path)} -depth -type d", check=False)
    for folder in directories.splitlines():
        if folder == gallery_path or folder.startswith(f"{gallery_path}/"):
            adb("shell", f"rmdir {shlex.quote(folder)}", check=False)


def main():
    remove_saved_media()
    for suffix in FIXTURES:
        name = f"{STEM}-{suffix}.zip"
        remove_download(name)
        adb("shell", "rm", "-f", f"{DEVICE_ROOT}/{name}")
    adb("shell", "rmdir", DEVICE_ROOT, check=False)
    remove_download(STEM, "Download/")
    adb("shell", "rm", "-f", WINDOW_XML, WINDOW_PNG)
    packages = adb("shell", "pm", "list", "packages", PACKAGE).splitlines()
    if f"package:{PACKAGE}" in packages:
        print(adb("uninstall", PACKAGE))
    if f"package:{PACKAGE}" in adb("shell", "pm", "list", "packages", PACKAGE).splitlines():
        raise RuntimeError(f"QA package is still installed: {PACKAGE}")
    if any(row_ids(downloads(f"{STEM}-{suffix}.zip")) for suffix in FIXTURES):
        raise RuntimeError("QA ZIP rows remain in Downloads")
    print(f"Cleaned QA package and Downloads fixtures for {STEM}")


if __name__ == "__main__":
    main()
