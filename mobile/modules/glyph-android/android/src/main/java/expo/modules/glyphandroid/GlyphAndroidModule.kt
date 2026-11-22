package expo.modules.glyphandroid

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GlyphAndroidModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GlyphAndroid")

    View(GlyphView::class) {
      Prop("paths") { view: GlyphView, paths: List<String> -> view.setPaths(paths) }
      Prop("tint") { view: GlyphView, tint: Int -> view.setTint(tint) }
      Prop("weight") { view: GlyphView, weight: Float -> view.setWeight(weight) }
      Prop("filled") { view: GlyphView, filled: Boolean -> view.setFilled(filled) }
    }
  }
}
