import argparse
import json
import re
import shlex
from pathlib import Path

from qa import DEVICE_ROOT, FIXTURES, GALLERY_FOLDER, PACKAGE, ROOT, STEM, WINDOW_PNG, WINDOW_XML
from qa import adb, downloads, is_run_output_path, row_ids


def remove_download(name, relative_path=None):
    rows = downloads(name) if relative_path is None else downloads(name, relative_path)
    for row_id in row_ids(rows):
        adb("shell", "content", "delete", "--uri", f"content://media/external/downloads/{row_id}")


def validate_saved_item(item):
    uri, name = item["uri"], item["file"]
    relative_path = item.get("relative_path", GALLERY_FOLDER)
    if not re.fullmatch(r"content://media/(?:external|external_primary)/(?:(?:images|video|audio)/media|file|downloads)/\d+", uri):
        raise ValueError(f"Unexpected evidence URI {uri}")
    if not is_run_output_path(relative_path):
        raise ValueError(f"Evidence path is outside this QA run: {relative_path}")
    if not isinstance(name, str) or not name or "/" in name or "\\" in name or name in (".", ".."):
        raise ValueError("Evidence name must be one filename")
    return uri, name, relative_path


def remove_saved_media(evidence_paths):
    records = []
    for evidence in evidence_paths:
        if evidence.is_file():
            records.extend(json.loads(evidence.read_text(encoding="utf-8")))
    # Validate every record before attempting any deletion.
    verified = [validate_saved_item(item) for item in records]
    folders = set()
    for uri, name, relative_path in verified:
        sql_path, sql_name = relative_path.replace("'", "''"), name.replace("'", "''")
        where = shlex.quote(f"relative_path = '{sql_path}' AND _display_name = '{sql_name}'")
        row = adb("shell", f"content query --uri {uri} --projection _display_name:relative_path:owner_package_name --where {where}")
        if "_display_name=" in row:
            if not re.search(r"(?:^|, )owner_package_name=" + re.escape(PACKAGE) + r"(?:,|$)", row, re.MULTILINE):
                raise RuntimeError(f"Refusing to delete a saved row not owned by {PACKAGE}: {uri}")
            adb("shell", "content", "delete", "--uri", uri)
            remaining = adb("shell", f"content query --uri {uri} --projection _display_name --where {where}")
            if "_display_name=" in remaining:
                raise RuntimeError(f"QA saved row remains: {uri}")
        folders.add("/".join(relative_path.split("/")[:3]) + "/")

    for relative_path in folders:
        gallery_path = f"/storage/emulated/0/{relative_path.rstrip('/')}"
        directories = adb("shell", f"find {shlex.quote(gallery_path)} -depth -type d", check=False)
        for folder in directories.splitlines():
            if folder == gallery_path or folder.startswith(f"{gallery_path}/"):
                adb("shell", f"rmdir {shlex.quote(folder)}", check=False)


def main():
    parser = argparse.ArgumentParser(description="Remove only this run's synthetic QA files and package")
    parser.add_argument("--evidence", action="append", type=Path,
                        help="Additional saved-file readback JSON, for example the undated document")
    args = parser.parse_args()
    remove_saved_media([ROOT / "media-evidence.json", *(args.evidence or [])])
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
