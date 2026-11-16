import argparse
import shutil
import struct
import subprocess
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile


from qa import ROOT, STEM


zips = ROOT / "fixtures"
assets = ROOT / "assets"
contact = b"BEGIN:VCARD\nVERSION:3.0\nFN:Synthetic contact\nEND:VCARD\n"
notes = b"Extra text file unrelated to the chat.\n"


def encode(name, *options):
    path = assets / name
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *options, str(path)],
        check=True,
    )
    return path


def image(name, color, codec):
    return encode(name, "-f", "lavfi", "-i", f"color=c={color}:s=320x240",
                  "-frames:v", "1", "-c:v", codec)


def video(name, color, embedded_date):
    return encode(name, "-f", "lavfi", "-i", f"color=c={color}:s=320x240:r=24:d=2",
                  "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                  "-metadata", f"creation_time={embedded_date}")


def export(suffix, transcript, files):
    path = zips / f"{STEM}-{suffix}.zip"
    with ZipFile(path, "w", ZIP_STORED) as archive:
        if transcript is not None:
            archive.writestr("_chat.txt", transcript.encode("utf-8"))
        for name, content in files.items():
            if isinstance(content, Path):
                archive.write(content, name)
            else:
                archive.writestr(name, content)
    print(f"{path.name} {path.stat().st_size} bytes")


def storage_probe(photo_old, video_old, photo_new, preview_png, video_new, sticker, voice):
    folder = ROOT / "probe-assets"
    folder.mkdir(parents=True, exist_ok=True)
    rows = [
        ("red", "image/jpeg", "2019-02-15T08:30:00Z", photo_old),
        ("green", "video/mp4", "2019-02-16T09:30:00Z", video_old),
        ("blue", "image/jpeg", "2020-03-16T13:15:00Z", photo_new),
        ("yellow", "image/png", "2020-03-16T13:16:00Z", preview_png),
        ("purple", "video/mp4", "2020-03-17T10:00:00Z", video_new),
        ("png-new", "image/png", "2020-03-20T10:00:00Z", image("png-new.png", "cyan", "png")),
        ("png-old", "image/png", "2019-02-20T10:00:00Z", image("png-old.png", "orange", "png")),
        ("webp-new", "image/webp", "2020-03-21T10:00:00Z", sticker),
        ("webp-old", "image/webp", "2019-02-21T10:00:00Z", image("webp-old.webp", "magenta", "libwebp")),
        ("voice", "audio/ogg", "2020-03-18T10:00:00Z", voice),
        ("audio", "audio/mp4", "2020-03-18T10:01:00Z",
         encode("audio.m4a", "-f", "lavfi", "-i", "sine=frequency=550:duration=1", "-c:a", "aac")),
        ("contact", "text/x-vcard", "2020-03-19T10:00:00Z", assets / "contact.vcf"),
        ("notes", "text/plain", "2020-03-19T10:01:00Z", assets / "notes.txt"),
    ]
    (assets / "contact.vcf").write_bytes(contact)
    (assets / "notes.txt").write_bytes(notes)
    manifest = ["\t".join(("id", "name", "mime", "expected_utc", "source_creation_utc"))]
    source_dates = {"green": "2022-07-08T09:10:11Z", "purple": "2018-07-08T09:10:11Z"}
    for key, mime, expected, source in rows:
        name = f"{STEM}-{key}{source.suffix.lower()}"
        shutil.copyfile(source, folder / name)
        manifest.append("\t".join((key, name, mime, expected, source_dates.get(key, ""))))
    (folder / "probe-fixtures.tsv").write_text("\n".join(manifest) + "\n", encoding="utf-8")
    (folder / "probe-run.txt").write_text(STEM + "\n", encoding="utf-8")
    print(f"Prepared {len(rows)} storage probe fixtures in {folder}")


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic chatStamp QA ZIPs using FFmpeg",
        epilog=f"Output: {zips}. Set CHATSTAMP_QA_RUN_ID to use a different run.",
    )
    parser.add_argument("--skip-large", action="store_true", help="Skip the 128 MiB ZIP")
    parser.add_argument("--probe", action="store_true", help="Also create storage probe assets and expectations")
    parser.add_argument("--gallery-five", action="store_true", help="Limit the mixed ZIP to the five Gallery regression files")
    args = parser.parse_args()
    zips.mkdir(parents=True, exist_ok=True)
    assets.mkdir(parents=True, exist_ok=True)

    photo_old = image("IMG-20190215-WA8811.jpg", "red", "mjpeg")
    photo_new = image("IMG-20200316-WA8813.jpg", "blue", "mjpeg")
    preview_png = image("IMG-20200316-WA8814.png", "yellow", "png")
    preview_sticker = image("STK-20200316-WA8815.webp", "white", "libwebp")
    unmatched = image("IMG-20210417-WA8899.jpg", "orange", "mjpeg")
    video_old = video("VID-20190216-WA8812.mp4", "lime", "2022-07-08T09:10:11Z")
    video_new = video("VID-20200317-WA8816.mp4", "purple", "2018-07-08T09:10:11Z")
    voice = encode("PTT-20200318-WA8817.opus", "-f", "lavfi",
                   "-i", "sine=frequency=440:duration=1", "-c:a", "libopus")

    transcript = "\n".join([
        f"15/02/2019, 10:30 - Dana: \u200e{photo_old.name} (file attached)",
        "The second line is a caption.",
        f"16/02/2019, 11:30 - Dana: {video_old.name} (file attached)",
        f"16/03/2020, 15:15 - Eli: {photo_new.name} (file attached)",
        f"16/03/2020, 15:16 - Eli: {preview_png.name} (file attached)",
        f"16/03/2020, 15:17 - Eli: {preview_sticker.name} (file attached)",
        f"17/03/2020, 12:00 - Eli: {video_new.name} (file attached)",
        f"18/03/2020, 12:00 - Eli: {voice.name} (file attached)",
        "19/03/2020, 12:00 - Dana: contact.vcf (file attached)",
        "20/03/2020, 12:00 - Dana: check out my vacation.jpg from last year",
    ])
    mixed_files = {
        f"photos/{photo_old.name}": photo_old,
        f"photos/{photo_new.name}": photo_new,
        preview_png.name: preview_png,
        preview_sticker.name: preview_sticker,
        f"unmatched/{unmatched.name}": unmatched,
        f"videos/{video_old.name}": video_old,
        f"videos/{video_new.name}": video_new,
        voice.name: voice,
        "other/contact.vcf": contact,
        "other/unsupported.bin": b"unsupported test entry\n",
        "notes.txt": notes,
    }
    if args.gallery_five:
        expected = {photo_old.name, photo_new.name, preview_png.name, video_old.name, video_new.name}
        mixed_files = {name: data for name, data in mixed_files.items() if name.split("/")[-1] in expected}
    export("mixed", transcript, mixed_files)
    export("text-only", "15/02/2019, 10:30 - Dana: Text-only import fixture.\n", {})
    export("no-transcript", None, {photo_old.name: photo_old})
    (zips / f"{STEM}-invalid.zip").write_bytes(b"Test data deliberately missing a ZIP header.\n")

    if args.probe:
        storage_probe(photo_old, video_old, photo_new, preview_png, video_new, preview_sticker, voice)

    if args.skip_large:
        return

    large = assets / "VID-20190218-WA8888.mp4"
    with video_old.open("rb") as source, large.open("wb") as target:
        shutil.copyfileobj(source, target)
        size = 128 * 1024 * 1024
        target.write(struct.pack(">I4s", size + 8, b"free"))
        target.truncate(target.tell() + size)
    export("large", f"18/02/2019, 11:30 - Dana: {large.name} (file attached)\n",
           {large.name: large})


if __name__ == "__main__":
    main()
