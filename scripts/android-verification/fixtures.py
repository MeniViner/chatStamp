import argparse
import shutil
import struct
import subprocess
from pathlib import Path
from zipfile import ZIP_STORED, ZipFile


from qa import ROOT, STEM


zips = ROOT / "fixtures"
assets = ROOT / "assets"


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


def main():
    parser = argparse.ArgumentParser(
        description="Generate synthetic chatStamp QA ZIPs using FFmpeg",
        epilog=f"Output: {zips}. Set CHATSTAMP_QA_RUN_ID to use a different run.",
    )
    parser.add_argument("--skip-large", action="store_true", help="Skip the 128 MiB ZIP")
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

    export("mixed", "\n".join([
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
    ]), {
        f"photos/{photo_old.name}": photo_old,
        f"photos/{photo_new.name}": photo_new,
        preview_png.name: preview_png,
        preview_sticker.name: preview_sticker,
        f"unmatched/{unmatched.name}": unmatched,
        f"videos/{video_old.name}": video_old,
        f"videos/{video_new.name}": video_new,
        voice.name: voice,
        "other/contact.vcf": b"BEGIN:VCARD\nVERSION:3.0\nFN:Synthetic contact\nEND:VCARD\n",
        "other/unsupported.bin": b"unsupported test entry\n",
        "notes.txt": b"Extra text file unrelated to the chat.\n",
    })
    export("text-only", "15/02/2019, 10:30 - Dana: Text-only import fixture.\n", {})
    export("no-transcript", None, {photo_old.name: photo_old})
    (zips / f"{STEM}-invalid.zip").write_bytes(b"Test data deliberately missing a ZIP header.\n")

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
