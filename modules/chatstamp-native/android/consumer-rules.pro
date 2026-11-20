# SupportedZipInputStream rejects Zstandard during entry initialization.
# Only the unused base implementation references this optional, unshipped codec.
-dontwarn com.github.luben.zstd.ZstdInputStream
