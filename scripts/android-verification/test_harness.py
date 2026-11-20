import contextlib
import copy
import importlib.util
import io
import json
import os
import shlex
import struct
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from zipfile import ZipFile

import fixtures
import qa


def module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    result = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(result)
    return result


media = module("media_evidence", "media-evidence.py")
cleanup = module("cleanup_device", "cleanup-device.py")


def valid_readback():
    return [
        {
            "file": name,
            "uri": f"content://media/external/{'video' if name.endswith('.mp4') else 'images'}/media/{index}",
            "relative_path": qa.GALLERY_FOLDER,
            "matches_taken": True,
            "matches_modified": True,
            "internal_date": date,
        }
        for index, (name, date) in enumerate(media.EXPECTED_LOCAL.items(), 1)
    ]


class GalleryAssertionsTest(unittest.TestCase):
    def setUp(self):
        self.saved = valid_readback()
        self.inventory = [
            {"_id": item["uri"].rsplit("/", 1)[-1], "_display_name": item["file"], "relative_path": item["relative_path"]}
            for item in self.saved
        ]

    def test_accepts_correct_five_timestamps(self):
        media.assert_gallery_five(self.saved, self.inventory)

    def test_rejects_an_extra_sibling_folder(self):
        duplicate = dict(self.inventory[0], relative_path=qa.GALLERY_FOLDER.rstrip("/") + " (2)/")
        with self.assertRaises(ValueError):
            media.assert_gallery_five(self.saved, self.inventory + [duplicate])

    def test_rejects_an_extra_renamed_file(self):
        with self.assertRaises(ValueError):
            media.assert_gallery_five(self.saved, self.inventory + [dict(self.inventory[0], _display_name="extra.jpg")])

    def test_rejects_the_wrong_destination(self):
        wrong = copy.deepcopy(self.inventory)
        wrong[0]["relative_path"] = qa.GALLERY_FOLDER.replace("Pictures/", "Movies/")
        with self.assertRaises(ValueError):
            media.assert_gallery_five(self.saved, wrong)

    def test_rejects_import_time_indexing(self):
        self.saved[1]["matches_taken"] = False
        with self.assertRaises(ValueError):
            media.assert_gallery_five(self.saved, self.inventory)

    def test_rejects_the_original_wrong_video_creation_date(self):
        self.saved[1]["internal_date"] = "2022-07-08T09:10:11Z"
        with self.assertRaises(ValueError):
            media.assert_gallery_five(self.saved, self.inventory)

    def test_duplicate_comparison_preserves_ids_paths_and_names(self):
        media.assert_same_rows(list(reversed(self.saved)), self.saved)
        for field, replacement in (("uri", "content://media/external/images/media/100"),
                                   ("relative_path", qa.GALLERY_FOLDER + "localized/"),
                                   ("file", "another.jpg")):
            with self.subTest(field=field):
                changed = copy.deepcopy(self.saved)
                changed[0][field] = replacement
                with self.assertRaises(ValueError):
                    media.assert_same_rows(changed, self.saved)

    def test_inventory_query_uses_owner_and_run_identity_across_roots(self):
        with patch.object(media, "adb", return_value="") as adb:
            media.query("images")
        command = shlex.split(adb.call_args.args[1])[-1]
        self.assertIn(f"owner_package_name = '{qa.PACKAGE}'", command)
        self.assertIn(qa.CHAT_SEGMENTS["mixed"], command)
        self.assertNotIn(qa.GALLERY_FOLDER, command)


class NamespaceSafetyTest(unittest.TestCase):
    def test_accepts_only_this_run_output_folders(self):
        self.assertTrue(qa.is_run_output_path(qa.GALLERY_FOLDER))
        self.assertTrue(qa.is_run_output_path(f"Documents/chatStamp/{qa.CHAT_SEGMENTS['undated']}/"))
        for path in ("Pictures/personal/", qa.GALLERY_FOLDER + "../other/", qa.GALLERY_FOLDER + "/extra/",
                     "/" + qa.GALLERY_FOLDER, qa.GALLERY_FOLDER.replace("chatStamp", "other"),
                     qa.GALLERY_FOLDER.replace(qa.CHAT_SEGMENTS["mixed"], qa.CHAT_SEGMENTS["mixed"] + "-other")):
            with self.subTest(path=path):
                self.assertFalse(qa.is_run_output_path(path))

    def test_rejects_unsafe_evidence_uri_name_or_path(self):
        original = valid_readback()[0]
        cleanup.validate_saved_item(original)
        for field, value in (("uri", "content://other.provider/files/1"), ("file", "../personal.jpg"),
                             ("relative_path", "Pictures/personal/")):
            with self.subTest(field=field):
                with self.assertRaises(ValueError):
                    cleanup.validate_saved_item(dict(original, **{field: value}))

    def test_validates_all_records_before_any_device_action(self):
        with tempfile.TemporaryDirectory() as temporary:
            evidence = Path(temporary) / "readback.json"
            evidence.write_text(json.dumps([valid_readback()[0], dict(valid_readback()[1], relative_path="Pictures/personal/")]))
            with patch.object(cleanup, "adb") as adb, self.assertRaises(ValueError):
                cleanup.remove_saved_media([evidence])
            adb.assert_not_called()

    def test_refuses_a_row_owned_by_a_different_package(self):
        with tempfile.TemporaryDirectory() as temporary:
            evidence = Path(temporary) / "readback.json"
            evidence.write_text(json.dumps([valid_readback()[0]]))
            row = f"Row: 0 _display_name=fixture.jpg, relative_path={qa.GALLERY_FOLDER}, owner_package_name={qa.PACKAGE}.other"
            with patch.object(cleanup, "adb", return_value=row) as adb, self.assertRaises(RuntimeError):
                cleanup.remove_saved_media([evidence])
            self.assertEqual(adb.call_count, 1)

    def test_work_root_is_the_absolute_run_directory(self):
        with tempfile.TemporaryDirectory() as temporary:
            environment = dict(os.environ, CHATSTAMP_QA_WORK_ROOT=temporary)
            output = subprocess.check_output([sys.executable, "-c", "import qa; print(qa.ROOT)"],
                                             cwd=Path(__file__).parent, env=environment, text=True)
            self.assertEqual(output.strip(), temporary)
            environment["CHATSTAMP_QA_WORK_ROOT"] = "relative-work"
            result = subprocess.run([sys.executable, "-c", "import qa"], cwd=Path(__file__).parent,
                                    env=environment, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("absolute directory", result.stderr)


class UndatedFixtureTest(unittest.TestCase):
    def test_undated_document_has_no_message_reference_filename_date_or_zip_date(self):
        with tempfile.TemporaryDirectory() as temporary, patch.object(fixtures, "zips", Path(temporary)):
            with contextlib.redirect_stdout(io.StringIO()):
                path = fixtures.export_undated()
            with ZipFile(path) as archive:
                entry = archive.getinfo("undated.vcf")
                self.assertEqual(entry.date_time, (1980, 0, 0, 0, 0, 0))
                self.assertEqual(entry.extra, b"")
                self.assertNotIn(b"undated.vcf", archive.read("_chat.txt"))
                self.assertEqual(archive.read(entry), fixtures.contact)
            self.assertEqual(struct.unpack_from("<HH", path.read_bytes(), entry.header_offset + 10), (0, 0))


class WebpFixtureTest(unittest.TestCase):
    def test_keeps_the_ffmpeg_path_when_available(self):
        with patch.object(fixtures, "encode", return_value=Path("sticker.webp")) as encode, patch.object(fixtures.shutil, "which") as which:
            self.assertEqual(fixtures.image("sticker.webp", "white", "libwebp"), Path("sticker.webp"))
            self.assertEqual(encode.call_args.args[-1], "libwebp")
            which.assert_not_called()

    def fallback(self, directory, fail_conversion=False):
        destination = directory / "sticker.webp"
        temporary_sources = []

        def encode(name, *options):
            path = directory / name
            if options[-1] == "libwebp":
                path.write_bytes(b"incomplete FFmpeg output")
                raise subprocess.CalledProcessError(1, "ffmpeg")
            path.write_bytes(b"PNG fixture")
            temporary_sources.append(path)
            return path

        def convert(command, **options):
            self.assertTrue(options["check"])
            self.assertEqual(Path(command[2]).read_bytes(), b"PNG fixture")
            destination.write_bytes(b"partial WebP" if fail_conversion else b"RIFF WebP fixture")
            if fail_conversion:
                raise subprocess.CalledProcessError(1, "cwebp")

        with patch.object(fixtures, "assets", directory), patch.object(fixtures, "encode", side_effect=encode), \
                patch.object(fixtures.shutil, "which", return_value="/example/cwebp"), \
                patch.object(fixtures.subprocess, "run", side_effect=convert), contextlib.redirect_stdout(io.StringIO()):
            if fail_conversion:
                with self.assertRaises(subprocess.CalledProcessError):
                    fixtures.image(destination.name, "white", "libwebp")
            else:
                self.assertEqual(fixtures.image(destination.name, "white", "libwebp"), destination)
        self.assertEqual(len(temporary_sources), 1)
        self.assertFalse(temporary_sources[0].parent.exists())
        return destination

    def test_cwebp_fallback_cleans_the_temporary_png_on_success(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = self.fallback(Path(temporary))
            self.assertEqual(destination.read_bytes(), b"RIFF WebP fixture")

    def test_cwebp_failure_removes_the_temporary_png_and_partial_output(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination = self.fallback(Path(temporary), fail_conversion=True)
            self.assertFalse(destination.exists())

    def test_missing_encoders_fail_instead_of_omitting_webp(self):
        with patch.object(fixtures, "encode", side_effect=subprocess.CalledProcessError(1, "ffmpeg")), \
                patch.object(fixtures.shutil, "which", return_value=None), tempfile.TemporaryDirectory() as temporary, \
                patch.object(fixtures, "assets", Path(temporary)):
            with self.assertRaisesRegex(RuntimeError, "libwebp encoder or the cwebp"):
                fixtures.image("sticker.webp", "white", "libwebp")


if __name__ == "__main__":
    unittest.main()
