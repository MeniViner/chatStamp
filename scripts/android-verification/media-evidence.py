import datetime as dt
import json
import re
import shlex
import struct
import subprocess
from pathlib import Path

from qa import GALLERY_FOLDER, ROOT, adb


EXPECTED_LOCAL = {
    "IMG-20190215-WA8811.jpg": "2019-02-15T10:30:00+02:00",
    "VID-20190216-WA8812.mp4": "2019-02-16T11:30:00+02:00",
    "IMG-20200316-WA8813.jpg": "2020-03-16T15:15:00+02:00",
    "IMG-20200316-WA8814.png": "2020-03-16T15:16:00+02:00",
    "VID-20200317-WA8816.mp4": "2020-03-17T12:00:00+02:00",
}


def as_utc(seconds):
    return dt.datetime.fromtimestamp(seconds, dt.timezone.utc).isoformat()


def exif_dates(path: Path):
    data = path.read_bytes()
    marker = data.find(b"Exif\0\0")
    if marker < 0:
        return {}
    tiff = data[marker + 6:]
    prefix = "<" if tiff[:2] == b"II" else ">"
    tags = {
        0x0132: "DateTime", 0x9003: "DateTimeOriginal", 0x9004: "DateTimeDigitized",
        0x9010: "OffsetTime", 0x9011: "OffsetTimeOriginal", 0x9012: "OffsetTimeDigitized",
    }

    def entries(offset):
        count = struct.unpack_from(prefix + "H", tiff, offset)[0]
        for index in range(count):
            start = offset + 2 + index * 12
            yield start, struct.unpack_from(prefix + "HHII", tiff, start)

    values = {}
    first_ifd = struct.unpack_from(prefix + "I", tiff, 4)[0]
    backlog = list(entries(first_ifd))
    for offset, (tag, value_type, count, value) in backlog:
        if tag == 0x8769:
            backlog.extend(entries(value))
        if tag in tags and value_type == 2:
            start = offset + 8 if count <= 4 else value
            values[tags[tag]] = tiff[start:start + count].rstrip(b"\x00").decode("ascii")
    return values


def probe_video(path):
    result = subprocess.run([
        "ffprobe", "-v", "error", "-show_entries", "format_tags=creation_time",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], check=True, capture_output=True, text=True)
    return result.stdout.strip()


def query(collection):
    where = shlex.quote(f"relative_path LIKE '{GALLERY_FOLDER}%'")
    uri = f"content://media/external/{collection}/media"
    projection = "_id:_display_name:relative_path:datetaken:date_modified:date_added"
    return adb("shell", f"content query --uri {uri} --projection {projection} --where {where}")


def main():
    output = ROOT / "saved-files"
    output.mkdir(exist_ok=True)
    saved = []
    for collection in ("images", "video"):
        rows = query(collection)
        print(rows)
        for line in rows.splitlines():
            fields = dict(re.findall(r"(\w+)=([^,]+)", line))
            name = fields.get("_display_name", "")
            if name not in EXPECTED_LOCAL:
                continue
            location = f"/storage/emulated/0/{fields['relative_path']}{name}"
            path = output / name
            adb("pull", location, str(path))
            expected = dt.datetime.fromisoformat(EXPECTED_LOCAL[name]).timestamp()
            fstat = int(adb("shell", f"stat -c %Y {shlex.quote(location)}"))
            taken = fields["datetaken"]
            taken_seconds = int(taken) / 1000 if taken != "NULL" and int(taken) > 0 else None
            modified = int(fields["date_modified"])
            saved.append({
                "file": name,
                "uri": f"content://media/external/{collection}/media/{fields['_id']}",
                "expected_utc": as_utc(expected),
                "filesystem_utc": as_utc(fstat),
                "date_taken_utc": as_utc(taken_seconds) if taken_seconds is not None else None,
                "date_modified_utc": as_utc(modified),
                "date_added_utc": as_utc(int(fields["date_added"])),
                "matches_taken": taken_seconds is not None and abs(taken_seconds - expected) <= 2,
                "matches_modified": abs(modified - expected) <= 2,
                "internal_date": probe_video(path) if path.suffix == ".mp4" else exif_dates(path),
            })
    evidence = json.dumps(saved, indent=2)
    (ROOT / "media-evidence.json").write_text(evidence + "\n", encoding="utf-8")
    print(evidence)


if __name__ == "__main__":
    main()
