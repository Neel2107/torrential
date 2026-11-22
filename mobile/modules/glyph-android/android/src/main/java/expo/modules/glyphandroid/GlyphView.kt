package expo.modules.glyphandroid

import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import androidx.core.graphics.PathParser
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.views.ExpoView

/** Draws a 24-unit icon's paths straight onto the hardware canvas, so an icon costs a recorded path rather than a bitmap drawn on the CPU and uploaded. */
class GlyphView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private var shapes: List<Path> = emptyList()
  private var filled = false
  private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    style = Paint.Style.STROKE
    strokeCap = Paint.Cap.ROUND
    strokeJoin = Paint.Join.ROUND
    strokeWidth = 2f
  }
  private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }

  init {
    setWillNotDraw(false)
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
  }

  fun setPaths(paths: List<String>) {
    shapes = paths.map { data -> parsed.getOrPut(data) { PathParser.createPathFromPathData(data) } }
    invalidate()
  }

  fun setTint(tint: Int) {
    stroke.color = tint
    fill.color = tint
    invalidate()
  }

  fun setWeight(weight: Float) {
    stroke.strokeWidth = weight
    invalidate()
  }

  fun setFilled(value: Boolean) {
    filled = value
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)
    val scale = minOf(width, height) / VIEWBOX
    if (scale <= 0f) return

    val save = canvas.save()
    canvas.translate((width - VIEWBOX * scale) / 2f, (height - VIEWBOX * scale) / 2f)
    canvas.scale(scale, scale)
    for (shape in shapes) {
      if (filled) canvas.drawPath(shape, fill)
      canvas.drawPath(shape, stroke)
    }
    canvas.restoreToCount(save)
  }

  companion object {
    private const val VIEWBOX = 24f
    private val parsed = HashMap<String, Path>()
  }
}
