package com.menis.chatstamp.qa.probe

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Environment
import android.os.Process
import android.util.Log
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Test
import java.io.File
import java.io.InputStream
import java.security.MessageDigest
import java.time.Instant
import java.time.ZoneId

internal const val PROBE_PACKAGE = "com.menis.chatstamp.qa.probe"
internal const val PROBE_TAG = "ChatStampProbe"

internal fun json(vararg fields: Pair<String, Any?>): JSONObject = JSONObject().apply {
    for ((key, value) in fields) put(key, value ?: JSONObject.NULL)
}

@Suppress("DEPRECATION")
internal fun checkProbeIdentity(context: Context): JSONObject {
    val broadPermissions = listOf(
        "MANAGE_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "READ_EXTERNAL_STORAGE",
        "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO", "READ_MEDIA_AUDIO", "READ_MEDIA_VISUAL_USER_SELECTED",
    ).map { "android.permission.$it" }
    val requested = context.packageManager.getPackageInfo(
        context.packageName, PackageManager.GET_PERMISSIONS,
    ).requestedPermissions.orEmpty().sorted()
    val granted = broadPermissions.filter { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
    val isManager = Environment.isExternalStorageManager()
    val isLegacy = Environment.isExternalStorageLegacy()
    val facts = json(
        "device" to "${Build.MANUFACTURER} ${Build.MODEL}",
        "sdk" to Build.VERSION.SDK_INT,
        "zone" to ZoneId.systemDefault().id,
        "package" to context.packageName,
        "package_uid" to context.applicationInfo.uid,
        "process_uid" to Process.myUid(),
        "target_sdk" to context.applicationInfo.targetSdkVersion,
        "requested" to JSONArray(requested),
        "broad_grants" to JSONArray(granted),
        "all_files_access" to isManager,
        "legacy_storage" to isLegacy,
    )
    Log.i(PROBE_TAG, "identity $facts")
    check(context.packageName == PROBE_PACKAGE && context.applicationInfo.uid == Process.myUid())
    check(context.applicationInfo.targetSdkVersion == 36)
    check(requested.none { it in broadPermissions } && granted.isEmpty() && !isManager && !isLegacy)
    return facts
}

class ProbeIdentityTest {
    @Test
    fun runsUnderScopedStorageAsProbeApp() {
        checkProbeIdentity(InstrumentationRegistry.getInstrumentation().targetContext)
    }
}

internal data class Fixture(
    val id: String,
    val name: String,
    val mime: String,
    val expected: Instant,
    val original: Instant?,
) {
    val image get() = mime.startsWith("image/")
    val video get() = mime.startsWith("video/")
    val audio get() = mime.startsWith("audio/")
    val mayUseMtime get() = mime == "image/png" || mime == "image/webp"
}

internal class ProbeRun {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    val context: Context = instrumentation.targetContext
    private val assets = instrumentation.context.assets
    val stem = assets.open("probe-run.txt").bufferedReader().use { it.readText().trim() }
    val fixtures = assets.open("probe-fixtures.tsv").bufferedReader().useLines { lines ->
        lines.drop(1).map { line ->
            val (id, name, mime, expected, original) = line.split('\t')
            require(name.startsWith("$stem-") && name.matches(Regex("[a-z0-9-]+\\.[a-z0-9]+")))
            Fixture(id, name, mime, Instant.parse(expected), original.takeIf(String::isNotEmpty)?.let(Instant::parse))
        }.associateBy(Fixture::id)
    }
    val directory: File = File(context.filesDir, stem)
    private val events = File(directory, "events.jsonl")

    init {
        require(stem.matches(Regex("chatstamp-qa-[a-z0-9][a-z0-9-]{0,39}")))
        check(stem == InstrumentationRegistry.getArguments().getString("probeRun")) {
            "Pass -e probeRun $stem and install the matching test APK"
        }
        check(directory.isDirectory || directory.mkdirs())
    }

    fun begin() {
        check(!events.exists()) { "Use a fresh run ID after collecting and cleaning the previous run" }
        record("identity", "state" to checkProbeIdentity(context))
    }

    fun open(fixture: Fixture): InputStream = assets.open(fixture.name)

    fun record(event: String, vararg fields: Pair<String, Any?>) {
        val line = json("event" to event, *fields).toString()
        events.appendText("$line\n")
        Log.i(PROBE_TAG, line)
    }
}

internal fun InputStream.sha256(): String {
    val digest = MessageDigest.getInstance("SHA-256")
    val buffer = ByteArray(64 * 1024)
    while (true) {
        val count = read(buffer)
        if (count == -1) break
        digest.update(buffer, 0, count)
    }
    return digest.digest().joinToString("") { "%02x".format(it) }
}
