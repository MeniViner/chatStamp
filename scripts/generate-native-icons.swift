import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Mechanical scale/padding and alpha-only monochrome export of approved artwork.
// Android adaptive layers use 108dp; all meaningful art fits the central 66dp circle.
let root = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
let master = root.appendingPathComponent("store/play/icon-rollout-20261120/chatstamp-icon-transparent.png")
guard let source = CGImageSourceCreateWithURL(master as CFURL, nil),
      let original = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    fatalError("Approved transparent master is missing")
}
precondition(original.width == 512 && original.height == 512)
let space = CGColorSpace(name: CGColorSpace.sRGB)!
let info = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
func canvas(_ size: Int) -> CGContext {
    CGContext(data: nil, width: size, height: size, bitsPerComponent: 8,
        bytesPerRow: size * 4, space: space, bitmapInfo: info)!
}
let sample = canvas(512)
sample.draw(original, in: CGRect(x: 0, y: 0, width: 512, height: 512))
let pixels = sample.data!.assumingMemoryBound(to: UInt8.self)
var radius = 0.0
for y in 0..<512 {
    for x in 0..<512 where pixels[(y * 512 + x) * 4 + 3] >= 32 {
        radius = max(radius, hypot(Double(x) + 0.5 - 256, Double(y) + 0.5 - 256))
    }
}
precondition(radius > 0)
func render(safeRadius: Double, opaqueBackground: Bool, monochrome: Bool) -> CGImage {
    let result = canvas(1024)
    if opaqueBackground {
        result.setFillColor(CGColor(gray: 1, alpha: 1))
        result.fill(CGRect(x: 0, y: 0, width: 1024, height: 1024))
    }
    let width = 512 * safeRadius / radius
    result.interpolationQuality = .high
    result.draw(original, in: CGRect(x: (1024 - width) / 2,
        y: (1024 - width) / 2, width: width, height: width))
    if monochrome {
        let data = result.data!.assumingMemoryBound(to: UInt8.self)
        for i in stride(from: 0, to: 1024 * 1024 * 4, by: 4) {
            // Premultiplied white preserves the exact generated alpha silhouette.
            data[i] = data[i + 3]
            data[i + 1] = data[i + 3]
            data[i + 2] = data[i + 3]
        }
    }
    return result.makeImage()!
}
for (name, safeRadius, opaque, monochrome) in [
    ("icon.png", 1024.0 * 0.46, true, false),
    ("adaptive-icon.png", 1024.0 * 0.30, false, false),
    ("monochrome-icon.png", 1024.0 * 0.30, false, true)
] {
    let output = root.appendingPathComponent("assets/" + name)
    let writer = CGImageDestinationCreateWithURL(output as CFURL,
        UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(writer, render(safeRadius: safeRadius,
        opaqueBackground: opaque, monochrome: monochrome), nil)
    precondition(CGImageDestinationFinalize(writer))
    print("Generated assets/\(name), 1024x1024 sRGB; safe radius \(safeRadius)")
}
