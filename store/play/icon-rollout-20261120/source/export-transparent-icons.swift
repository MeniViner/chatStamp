import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Mechanical resize and alpha validation only; creative extraction uses image_gen.
let args = Array(CommandLine.arguments.dropFirst())
precondition(!args.isEmpty && args.count % 2 == 0, "input/output pairs required")
for index in stride(from: 0, to: args.count, by: 2) {
  let source = CGImageSourceCreateWithURL(URL(fileURLWithPath: args[index]) as CFURL, nil)!
  let input = CGImageSourceCreateImageAtIndex(source, 0, nil)!
  precondition(input.width == input.height, "square master required; no crop")
  let space = CGColorSpace(name: CGColorSpace.sRGB)!
  let info = CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue
  let context = CGContext(data: nil, width: 512, height: 512, bitsPerComponent: 8,
    bytesPerRow: 2048, space: space, bitmapInfo: info)!
  context.clear(CGRect(x: 0, y: 0, width: 512, height: 512))
  context.interpolationQuality = .high
  context.draw(input, in: CGRect(x: 0, y: 0, width: 512, height: 512))
  let final = context.makeImage()!
  let outputURL = URL(fileURLWithPath: args[index + 1])
  let destination = CGImageDestinationCreateWithURL(outputURL as CFURL, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(destination, final, nil)
  precondition(CGImageDestinationFinalize(destination), "PNG export failed")
  let size = try Data(contentsOf: outputURL).count
  precondition(size <= 1_024_000, "Play icon exceeds byte limit")
  let pixels = context.data!.assumingMemoryBound(to: UInt8.self)
  var zero = 0, opaque = 0, partial = 0
  var histogram = Array(repeating: 0, count: 256)
  for pixel in 0..<(512 * 512) {
    let alpha = pixels[pixel * 4 + 3]
    histogram[Int(alpha)] += 1
    if alpha == 0 { zero += 1 } else if alpha == 255 { opaque += 1 } else { partial += 1 }
  }
  let corners = [0, 511, 511 * 512, 512 * 512 - 1].map { Int(pixels[$0 * 4 + 3]) }
  print("\(outputURL.lastPathComponent): 512x512 sRGB \(final.bitsPerPixel)-bit, \(size) bytes; transparent=\(zero), opaque=\(opaque), partial=\(partial), corners=\(corners)")
  print("Alpha distribution: " + histogram.enumerated().filter { $0.element > 500 }.map { "\($0.offset):\($0.element)" }.joined(separator: ", "))
  // The generator uses near-opaque alpha253 for most subject pixels; preserve it.
  // At most alpha1 at a corner is visually negligible; do not flatten the artwork.
  precondition(corners.allSatisfy { $0 <= 1 } && zero > 10000 && histogram[250...255].reduce(0, +) > 10000,
    "transparent background and near-opaque subject required")
  // Disposable light/dark previews are intentionally outside the deliverable set.
  for (name, component) in [("light", CGFloat(0.97)), ("dark", CGFloat(0.10))] {
    let preview = CGContext(data: nil, width: 512, height: 512, bitsPerComponent: 8,
      bytesPerRow: 2048, space: space, bitmapInfo: info)!
    preview.setFillColor(CGColor(gray: component, alpha: 1))
    preview.fill(CGRect(x: 0, y: 0, width: 512, height: 512))
    preview.draw(final, in: CGRect(x: 0, y: 0, width: 512, height: 512))
    let previewURL = URL(fileURLWithPath: "/tmp/\(outputURL.deletingPathExtension().lastPathComponent)-\(name).png")
    let writer = CGImageDestinationCreateWithURL(previewURL as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(writer, preview.makeImage()!, nil)
    precondition(CGImageDestinationFinalize(writer))
  }
}
