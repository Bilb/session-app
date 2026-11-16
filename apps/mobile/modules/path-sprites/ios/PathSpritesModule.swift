import ExpoModulesCore
import QuartzCore
import UIKit

/// One layer of a request: see `PathSpriteLayer` in `packages/ui/src/pathSprites.ts`.
struct SpriteLayerRecord: Record {
  @Field var shape: String = "glow"
  @Field var color: UIColor = .white
  @Field var r: Double = 1
  @Field var borderWidth: Double = 0
  @Field var times: [Double] = []
  @Field var xs: [Double] = []
  @Field var ys: [Double] = []
  @Field var opacityTimes: [Double] = []
  @Field var opacityValues: [Double] = []
  @Field var opacitySteps: Bool = true
  @Field var scaleTimes: [Double] = []
  @Field var scaleValues: [Double] = []
}

/// A request on its trip: see `PathSprite` in `packages/ui/src/pathSprites.ts`.
struct SpriteRecord: Record {
  @Field var id: String = ""
  @Field var startAtMs: Double = 0
  @Field var endMs: Double = 0
  @Field var opacity: Double = 1
  @Field var layers: [SpriteLayerRecord] = []
}

public class PathSpritesModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PathSprites")

    View(PathSpritesView.self) {
      Prop("sprites") { (view: PathSpritesView, sprites: [SpriteRecord]) in
        view.show(sprites)
      }
    }
  }
}

/// Draws each request as layers and hands their whole trip to Core Animation once, so the render
/// server moves them and the app does nothing per frame. A request joins partway through its
/// trip when it was already under way: its animations begin in the past.
final class PathSpritesView: ExpoView {
  private var shown: [String: CALayer] = [:]

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
  }

  func show(_ sprites: [SpriteRecord]) {
    let ids = Set(sprites.map { $0.id })
    for (id, sprite) in shown where !ids.contains(id) {
      sprite.removeFromSuperlayer()
      shown[id] = nil
    }
    let nowMs = Date().timeIntervalSince1970 * 1000
    let now = CACurrentMediaTime()
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    for sprite in sprites where shown[sprite.id] == nil {
      let container = CALayer()
      container.opacity = Float(sprite.opacity)
      let begin = now - (nowMs - sprite.startAtMs) / 1000
      for record in sprite.layers {
        container.addSublayer(makeLayer(record, begin: begin))
      }
      layer.addSublayer(container)
      shown[sprite.id] = container
    }
    CATransaction.commit()
  }

  private func makeLayer(_ record: SpriteLayerRecord, begin: CFTimeInterval) -> CALayer {
    let r = CGFloat(record.r)
    let sprite: CALayer
    if record.shape == "glow" {
      // The request's colour fading out from a white heart, as the SVG gradient draws it.
      let glow = CAGradientLayer()
      glow.type = .radial
      glow.colors = [
        UIColor.white.cgColor, record.color.cgColor, record.color.withAlphaComponent(0).cgColor,
      ]
      glow.locations = [0, 0.18, 1]
      glow.startPoint = CGPoint(x: 0.5, y: 0.5)
      glow.endPoint = CGPoint(x: 1, y: 1)
      sprite = glow
    } else {
      sprite = CALayer()
      sprite.borderWidth = CGFloat(record.borderWidth)
      sprite.borderColor = record.color.cgColor
      sprite.cornerRadius = r
    }
    sprite.bounds = CGRect(x: 0, y: 0, width: r * 2, height: r * 2)
    sprite.contentsScale = UIScreen.main.scale
    sprite.position = CGPoint(x: record.xs.first ?? 0, y: record.ys.first ?? 0)
    sprite.opacity = 0

    if record.times.count >= 2 {
      let points = zip(record.xs, record.ys).map { NSValue(cgPoint: CGPoint(x: $0, y: $1)) }
      sprite.add(
        keyframes("position", times: record.times, values: points, begin: begin), forKey: "position")
    }
    var opacityTimes = record.opacityTimes
    var opacityValues = record.opacityValues
    if record.opacitySteps {
      // Held until the next: each step drawn as a run to just before the next one.
      var times: [Double] = []
      var values: [Double] = []
      for (i, at) in opacityTimes.enumerated() {
        let value = opacityValues[i]
        times.append(at)
        values.append(value)
        if i + 1 < opacityTimes.count {
          times.append(max(at, opacityTimes[i + 1] - 0.01))
          values.append(value)
        }
      }
      opacityTimes = times
      opacityValues = values
    }
    if opacityTimes.count >= 2 {
      sprite.add(
        keyframes(
          "opacity", times: opacityTimes, values: opacityValues.map { NSNumber(value: $0) },
          begin: begin),
        forKey: "opacity")
    } else if let only = opacityValues.first {
      sprite.opacity = Float(only)
    }
    if record.scaleTimes.count >= 2 {
      sprite.add(
        keyframes(
          "transform.scale", times: record.scaleTimes,
          values: record.scaleValues.map { NSNumber(value: $0) }, begin: begin),
        forKey: "scale")
    }
    return sprite
  }

  /// Straight runs between `values` at `times` (milliseconds into the trip), holding the first
  /// before and the last after.
  private func keyframes(
    _ keyPath: String, times: [Double], values: [Any], begin: CFTimeInterval
  ) -> CAKeyframeAnimation {
    let first = times.first ?? 0
    let span = max(0.001, (times.last ?? 0) - first)
    let animation = CAKeyframeAnimation(keyPath: keyPath)
    animation.values = values
    animation.keyTimes = times.map { NSNumber(value: ($0 - first) / span) }
    animation.calculationMode = .linear
    animation.beginTime = begin + first / 1000
    animation.duration = span / 1000
    animation.fillMode = .both
    animation.isRemovedOnCompletion = false
    return animation
  }
}
