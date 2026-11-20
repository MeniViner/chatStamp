#!/usr/bin/env swift
import AppKit
import CoreText
import CryptoKit
import Foundation
import ImageIO

struct Box: Decodable {
  let x: Double, y: Double, width: Double, height: Double
  var rect: CGRect { CGRect(x: x, y: y, width: width, height: height) }
  var values: [Double] { [x, y, width, height] }
}
struct Palette: Decodable {
  let background: String, leftField: String, ink: String, muted: String, accent: String, gold: String, frame: String
}
struct Poster: Decodable { let id: String, palette: String, angle: Double, kicker: String, headline: String, body: String }
struct PosterLayout: Decodable {
  let icon: Box, brand: Box, kicker: Box, headline: Box, phone: Box, body: Box, footer: Box
  let headlineMax: Double, headlineMin: Double, bodyMax: Double, bodyMin: Double, frameBorder: Double
  let arrow: [Double]
}
struct Feature: Decodable {
  let size: [Int], palette: String, filename: String, icon: Box, brand: Box, illustration: Box
  let headlineBox: Box, bodyBox: Box, labelBox: Box, headline: String, body: String, illustrationLabel: String
  let headlineMax: Double, headlineMin: Double, bodyMax: Double, bodyMin: Double
}
struct Layout: Decodable {
  let posterSize: [Int], jpegQuality: Double, targetImageBytes: Int, hardSetBytes: Int
  let fonts: [String: String], posterLayout: PosterLayout, palettes: [String: Palette], posters: [Poster]
  let posterFooter: String, feature: Feature
}
struct RenderError: Error, CustomStringConvertible { let description: String; init(_ text: String) { description = text } }

func require(_ condition: Bool, _ message: String) throws {
  if !condition { throw RenderError(message) }
}
func digest(_ data: Data) -> String { SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined() }
func loadImage(_ url: URL) throws -> CGImage {
  guard let source = CGImageSourceCreateWithURL(url as CFURL, nil), let image = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
    throw RenderError("Unreadable image: \(url.path)")
  }
  return image
}
func rgb(_ hex: String, alpha: CGFloat = 1) -> NSColor {
  let value = UInt32(hex, radix: 16)!
  return NSColor(srgbRed: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255,
    blue: CGFloat(value & 255) / 255, alpha: alpha)
}

final class Painter {
  let width: Int, height: Int, context: CGContext
  init(width: Int, height: Int) throws {
    self.width = width; self.height = height
    guard let space = CGColorSpace(name: CGColorSpace.sRGB), let ctx = CGContext(data: nil, width: width, height: height,
      bitsPerComponent: 8, bytesPerRow: width * 4, space: space, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
      throw RenderError("Could not create an opaque sRGB canvas.")
    }
    context = ctx; context.interpolationQuality = .high
    context.setShouldAntialias(true)
  }
  func rect(_ box: Box) -> CGRect {
    CGRect(x: box.x, y: Double(height) - box.y - box.height, width: box.width, height: box.height)
  }
  func fill(_ color: String) {
    context.setFillColor(rgb(color).cgColor); context.fill(CGRect(x: 0, y: 0, width: width, height: height))
  }
  func field(_ palette: Palette, feature: Bool = false) {
    context.setFillColor(rgb(palette.leftField).cgColor)
    let box = feature ? CGRect(x: -110, y: -110, width: 622, height: 760)
      : CGRect(x: -100, y: 128, width: 696, height: 1206)
    context.addPath(CGPath(roundedRect: box, cornerWidth: 100, cornerHeight: 100, transform: nil)); context.fillPath()
    context.setStrokeColor(rgb(palette.gold, alpha: 0.27).cgColor); context.setLineWidth(1)
    context.move(to: CGPoint(x: feature ? 510 : 610, y: feature ? 40 : 210))
    context.addLine(to: CGPoint(x: feature ? 510 : 610, y: feature ? 452 : 1020)); context.strokePath()
  }
  func contained(_ image: CGImage, in box: Box, noUpscale: Bool = true) {
    var scale = min(box.width / Double(image.width), box.height / Double(image.height))
    if noUpscale { scale = min(1, scale) }
    let w = Double(image.width) * scale, h = Double(image.height) * scale
    let actual = Box(x: box.x + (box.width - w) / 2, y: box.y + (box.height - h) / 2, width: w, height: h)
    context.draw(image, in: rect(actual))
  }
  func font(_ kind: String, _ size: CGFloat) throws -> NSFont {
    let names = kind == "headline" ? ["Karantina-Bold"] : ["Heebo-Regular", "Heebo", "ArialHebrew", "Arial"]
    for name in names { if let font = NSFont(name: name, size: size) { return font } }
    throw RenderError("Required \(kind) font is not registered.")
  }
  func attributes(kind: String, size: CGFloat, color: String, rtl: Bool) throws -> [NSAttributedString.Key: Any] {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .right
    paragraph.baseWritingDirection = rtl ? .rightToLeft : .leftToRight
    paragraph.lineBreakMode = .byWordWrapping
    paragraph.lineSpacing = kind == "headline" ? 0 : size * 0.11
    return [.font: try font(kind, size), .foregroundColor: rgb(color), .paragraphStyle: paragraph]
  }
  @discardableResult func text(_ text: String, in box: Box, kind: String, color: String,
    maximum: Double, minimum: Double, rtl: Bool = true) throws -> Double {
    var chosen: CGFloat?
    var size = CGFloat(maximum)
    while size >= CGFloat(minimum) {
      let attributes = try attributes(kind: kind, size: size, color: color, rtl: rtl)
      let explicitLinesFit = kind != "headline" || text.components(separatedBy: "\n").allSatisfy {
        ($0 as NSString).size(withAttributes: attributes).width <= box.width + 0.1
      }
      let measured = (text as NSString).boundingRect(with: CGSize(width: box.width, height: 10_000),
        options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes)
      if explicitLinesFit && measured.width <= box.width + 0.1 && measured.height <= box.height + 0.1 { chosen = size; break }
      size -= 1
    }
    guard let resolved = chosen else { throw RenderError("Text overflows its editable box: \(text)") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(cgContext: context, flipped: false)
    (text as NSString).draw(with: rect(box), options: [.usesLineFragmentOrigin, .usesFontLeading],
      attributes: try attributes(kind: kind, size: resolved, color: color, rtl: rtl))
    NSGraphicsContext.restoreGraphicsState()
    return Double(resolved)
  }
  func arrow(_ positions: [Double], color: String) {
    let from = CGPoint(x: positions[0], y: Double(height) - positions[1])
    let to = CGPoint(x: positions[2], y: Double(height) - positions[3])
    context.setStrokeColor(rgb(color).cgColor); context.setLineWidth(3); context.setLineCap(.round)
    context.move(to: from); context.addLine(to: to); context.strokePath()
    let angle = atan2(to.y - from.y, to.x - from.x), length: CGFloat = 28
    for delta in [-0.5, 0.5] {
      context.move(to: to)
      context.addLine(to: CGPoint(x: to.x - length * cos(angle + delta), y: to.y - length * sin(angle + delta)))
    }
    context.strokePath()
  }
  func phone(_ image: CGImage, slot: Box, degrees: Double, border: Double, color: String) throws -> [String: Any] {
    let aspect = Double(image.height) / Double(image.width), angle = degrees * .pi / 180
    let c = abs(cos(angle)), s = abs(sin(angle)), inset = 2 * border * (c + s)
    let w = min((slot.width - inset) / (c + aspect * s), (slot.height - inset) / (s + aspect * c))
    let h = w * aspect, outerW = w + border * 2, outerH = h + border * 2
    let rotatedW = outerW * c + outerH * s, rotatedH = outerW * s + outerH * c
    try require(w > 0 && rotatedW <= slot.width + 0.1 && rotatedH <= slot.height + 0.1, "Capture cannot fit completely in its slot.")
    let cx = slot.x + slot.width / 2, cy = slot.y + slot.height / 2
    let bounds = Box(x: cx - rotatedW / 2, y: cy - rotatedH / 2, width: rotatedW, height: rotatedH)
    try require(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= Double(width)
      && bounds.y + bounds.height <= Double(height), "Rotated capture would leave the canvas.")
    context.saveGState(); context.translateBy(x: cx, y: Double(height) - cy); context.rotate(by: angle)
    context.setShadow(offset: CGSize(width: 0, height: -18), blur: 28, color: rgb("061A13", alpha: 0.25).cgColor)
    context.setFillColor(rgb(color).cgColor)
    let frame = CGRect(x: -outerW / 2, y: -outerH / 2, width: outerW, height: outerH)
    context.addPath(CGPath(roundedRect: frame, cornerWidth: 36, cornerHeight: 36, transform: nil)); context.fillPath()
    context.setShadow(offset: .zero, blur: 0, color: nil)
    // Draw the complete source rectangle. No rounded clip, crop, retouch or UI overlay is applied.
    context.draw(image, in: CGRect(x: -w / 2, y: -h / 2, width: w, height: h))
    context.restoreGState()
    return ["captureBounds": bounds.values, "innerSize": [w, h], "angleDegrees": degrees,
      "transform": "uniform contain + rotation only; complete source pixels; no crop or UI overlay"]
  }
  func jpeg(quality: Double) throws -> Data {
    guard let image = context.makeImage(), let data = NSBitmapImageRep(cgImage: image).representation(using: .jpeg,
      properties: [.compressionFactor: quality]) else { throw RenderError("JPEG encoding failed.") }
    return data
  }
}

func fileBytes(_ folder: URL) throws -> Int {
  guard FileManager.default.fileExists(atPath: folder.path) else { return 0 }
  guard let entries = FileManager.default.enumerator(at: folder, includingPropertiesForKeys: [.isRegularFileKey, .fileSizeKey]) else { return 0 }
  var total = 0
  for case let file as URL in entries {
    let values = try file.resourceValues(forKeys: [.isRegularFileKey, .fileSizeKey])
    if values.isRegularFile == true { total += values.fileSize ?? 0 }
  }
  return total
}

func main() throws {
  let arguments = Array(CommandLine.arguments.dropFirst())
  var flags: [String: String] = [:], index = 0
  var checkOnly = false
  while index < arguments.count {
    let flag = arguments[index]
    if flag == "--check" { checkOnly = true; index += 1; continue }
    try require(["--config", "--captures", "--illustration", "--icon", "--output"].contains(flag)
      && index + 1 < arguments.count && flags[flag] == nil, "Unknown/duplicate or incomplete renderer argument: \(flag)")
    flags[flag] = arguments[index + 1]; index += 2
  }
  func path(_ name: String) throws -> URL {
    guard let value = flags[name], value.hasPrefix("/") else { throw RenderError("Supply an absolute local path for \(name).") }
    return URL(fileURLWithPath: value)
  }
  let configURL = try path("--config"), captures = try path("--captures"), illustrationURL = try path("--illustration")
  let iconURL = try path("--icon"), output = try path("--output")
  let layout = try JSONDecoder().decode(Layout.self, from: Data(contentsOf: configURL))
  try require(layout.posterSize == [1080, 1920] && layout.feature.size == [1024, 500], "Keep the agreed Play export sizes.")
  try require(layout.hardSetBytes <= 10_000_000 && layout.hardSetBytes > 0 && layout.jpegQuality > 0 && layout.jpegQuality <= 1,
    "Invalid size ceiling or JPEG quality.")
  try require(layout.posters.map(\.id) == ["01-import", "02-selection", "03-saving", "04-results", "05-transcript", "06-settings"],
    "Supply exactly the six agreed actual captures.")
  for fontFile in layout.fonts.values {
    let url = configURL.deletingLastPathComponent().appendingPathComponent("fonts").appendingPathComponent(fontFile)
    var error: Unmanaged<CFError>?
    if !CTFontManagerRegisterFontsForURL(url as CFURL, .process, &error) {
      throw RenderError("Could not register \(fontFile): \(String(describing: error?.takeRetainedValue()))")
    }
  }
  let icon = try loadImage(iconURL), illustration = try loadImage(illustrationURL)
  var inputs: [String: CGImage] = [:]
  for poster in layout.posters {
    let url = captures.appendingPathComponent(poster.id + ".png"), image = try loadImage(url)
    try require(image.width >= 320 && image.height > image.width, "Capture must be a real complete portrait image: \(url.path)")
    try require(layout.palettes[poster.palette] != nil, "Unknown palette: \(poster.palette)")
    inputs[poster.id] = image
  }
  if checkOnly {
    print("PASS: six source captures, icon, bitmap illustration, fonts, dimensions and config are available. No image rendered.")
    return
  }
  var files: [(String, Data)] = [], records: [[String: Any]] = []
  for poster in layout.posters {
    let palette = layout.palettes[poster.palette]!, drawing = try Painter(width: layout.posterSize[0], height: layout.posterSize[1])
    drawing.fill(palette.background); drawing.field(palette)
    let p = layout.posterLayout
    drawing.contained(icon, in: p.icon)
    try drawing.text("chatStamp", in: p.brand, kind: "body", color: palette.ink, maximum: 43, minimum: 36, rtl: false)
    try drawing.text(poster.kicker, in: p.kicker, kind: "body", color: palette.muted, maximum: 26, minimum: 23)
    let headlineSize = try drawing.text(poster.headline, in: p.headline, kind: "headline", color: palette.ink,
      maximum: p.headlineMax, minimum: p.headlineMin)
    let capture = inputs[poster.id]!
    let geometry = try drawing.phone(capture, slot: p.phone, degrees: poster.angle, border: p.frameBorder, color: palette.frame)
    let bodySize = try drawing.text(poster.body, in: p.body, kind: "body", color: palette.muted,
      maximum: p.bodyMax, minimum: p.bodyMin)
    drawing.arrow(p.arrow, color: palette.gold)
    try drawing.text(layout.posterFooter, in: p.footer, kind: "body", color: palette.muted, maximum: 24, minimum: 22)
    let data = try drawing.jpeg(quality: layout.jpegQuality), name = poster.id + "-he.jpg"
    files.append((name, data))
    let captureURL = captures.appendingPathComponent(poster.id + ".png")
    records.append(["file": name, "size": layout.posterSize, "bytes": data.count, "sha256": digest(data),
      "captureFile": captureURL.lastPathComponent, "captureSha256": digest(try Data(contentsOf: captureURL)),
      "captureSize": [capture.width, capture.height], "geometry": geometry, "headline": poster.headline,
      "supportCopy": poster.body, "headlinePointSize": headlineSize, "bodyPointSize": bodySize, "palette": poster.palette])
  }
  let f = layout.feature
  guard let featurePalette = layout.palettes[f.palette] else { throw RenderError("Unknown feature palette.") }
  let graphic = try Painter(width: f.size[0], height: f.size[1])
  graphic.fill(featurePalette.background); graphic.field(featurePalette, feature: true)
  graphic.contained(illustration, in: f.illustration)
  graphic.contained(icon, in: f.icon)
  try graphic.text("chatStamp", in: f.brand, kind: "body", color: featurePalette.ink, maximum: 38, minimum: 32, rtl: false)
  try graphic.text(f.headline, in: f.headlineBox, kind: "headline", color: featurePalette.ink, maximum: f.headlineMax, minimum: f.headlineMin)
  try graphic.text(f.body, in: f.bodyBox, kind: "body", color: featurePalette.muted, maximum: f.bodyMax, minimum: f.bodyMin)
  try graphic.text(f.illustrationLabel, in: f.labelBox, kind: "body", color: featurePalette.muted, maximum: 17, minimum: 15)
  let featureData = try graphic.jpeg(quality: layout.jpegQuality)
  files.append((f.filename, featureData))
  records.append(["file": f.filename, "size": f.size, "bytes": featureData.count, "sha256": digest(featureData),
    "illustrationSha256": digest(try Data(contentsOf: illustrationURL)), "illustrationSize": [illustration.width, illustration.height],
    "illustrationLabel": f.illustrationLabel, "noUiGeneration": true])
  let imageBytes = files.reduce(0) { $0 + $1.1.count }
  try require(imageBytes <= layout.targetImageBytes, "Images exceed the target budget. Lower jpegQuality; do not change capture content.")
  let metadata = try JSONSerialization.data(withJSONObject: ["renderer": "Native AppKit/CoreGraphics/CoreText; opaque sRGB JPEG",
    "files": records, "imageBytes": imageBytes, "inputPolicy": "Only supplied full actual captures; decorative captions outside UI"], options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
  files.append(("render-manifest.json", metadata))
  let currentBytes = try fileBytes(output), newBytes = files.reduce(0) { $0 + $1.1.count }
  // Conservative: even the old/new overlap during replacement must fit under the complete-set cap.
  try require(currentBytes + newBytes < layout.hardSetBytes, "Existing full output set plus these renders reaches the hard10MB ceiling. Remove only superseded owned renders first.")
  try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
  for (name, data) in files { try data.write(to: output.appendingPathComponent(name), options: .atomic) }
  print("Rendered six1080x1920 posters + one1024x500 feature; image bytes \(imageBytes); complete set bytes \(try fileBytes(output)).")
  print("Root must inspect every image, Hebrew, complete UI, proportions and disclosure before any upload.")
}
do { try main() } catch { fputs("Render refused: \(error)\n", stderr); exit(1) }
