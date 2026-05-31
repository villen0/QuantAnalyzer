package com.example.aamonitor.car

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import androidx.car.app.AppManager
import androidx.car.app.CarContext
import androidx.car.app.SurfaceCallback
import androidx.car.app.SurfaceContainer
import com.example.aamonitor.obd.ConnectionState
import com.example.aamonitor.obd.ObdData

class SurfaceRenderer(private val carContext: CarContext) : SurfaceCallback {

    @Volatile private var surfaceContainer: SurfaceContainer? = null
    @Volatile private var visibleArea: Rect = Rect()
    @Volatile private var currentData: ObdData = ObdData()
    private val renderLock = Any()

    // Pre-allocated paint objects — never create inside draw calls
    private val bgPaint = Paint().apply {
        color = Color.BLACK
        style = Paint.Style.FILL
    }
    private val trackPaint = Paint().apply {
        color = Color.DKGRAY
        style = Paint.Style.STROKE
        strokeWidth = 0f  // set per gauge
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
    }
    private val arcPaint = Paint().apply {
        style = Paint.Style.STROKE
        strokeWidth = 0f
        isAntiAlias = true
        strokeCap = Paint.Cap.ROUND
    }
    private val labelPaint = Paint().apply {
        color = Color.LTGRAY
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
    }
    private val valuePaint = Paint().apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
        isAntiAlias = true
    }
    private val unitPaint = Paint().apply {
        color = Color.GRAY
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
    }
    private val overlayPaint = Paint().apply {
        color = 0xCC000000.toInt()
        style = Paint.Style.FILL
    }
    private val overlayTextPaint = Paint().apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
        isFakeBoldText = true
    }
    private val overlaySubPaint = Paint().apply {
        color = Color.LTGRAY
        textAlign = Paint.Align.CENTER
        isAntiAlias = true
    }

    private val ovalBuf = RectF()

    override fun onSurfaceAvailable(surfaceContainer: SurfaceContainer) {
        this.surfaceContainer = surfaceContainer
        carContext.getCarService(AppManager::class.java).setSurfaceCallback(this)
        renderFrame()
    }

    override fun onSurfaceDestroyed(surfaceContainer: SurfaceContainer) {
        this.surfaceContainer = null
    }

    override fun onVisibleAreaChanged(visibleArea: Rect) {
        this.visibleArea = visibleArea
        renderFrame()
    }

    override fun onStableAreaChanged(stableArea: Rect) {
        renderFrame()
    }

    fun updateData(data: ObdData) {
        currentData = data
        renderFrame()
    }

    private fun renderFrame() {
        synchronized(renderLock) {
            val container = surfaceContainer ?: return
            val surface = container.surface ?: return
            if (!surface.isValid) return
            val canvas = surface.lockCanvas(null) ?: return
            try {
                drawFrame(canvas, container.width, container.height)
            } finally {
                surface.unlockCanvasAndPost(canvas)
            }
        }
    }

    private fun drawFrame(canvas: Canvas, width: Int, height: Int) {
        val w = width.toFloat()
        val h = height.toFloat()

        canvas.drawRect(0f, 0f, w, h, bgPaint)

        // Use visible area for gauge layout to avoid host UI chrome overlap
        val area = if (visibleArea.isEmpty) Rect(0, 0, width, height) else visibleArea
        val aw = area.width().toFloat()
        val ah = area.height().toFloat()
        val ox = area.left.toFloat()
        val oy = area.top.toFloat()

        val cellW = aw / 2f
        val cellH = ah / 2f

        val data = currentData

        val gauges = listOf(
            GaugeSpec("RPM",     data.rpm,          0f, 8000f, Color.rgb(255, 59, 48),   "rpm"),
            GaugeSpec("SPEED",   data.speedKph,     0f, 220f,  Color.rgb(52, 199, 89),   "km/h"),
            GaugeSpec("COOLANT", data.coolantTempC, -40f, 215f, Color.rgb(255, 204, 0),  "°C"),
            GaugeSpec("THROTTLE",data.throttlePct,  0f, 100f,  Color.rgb(50, 173, 230),  "%")
        )

        gauges.forEachIndexed { index, spec ->
            val col = index % 2
            val row = index / 2
            val cx = ox + cellW * col + cellW / 2f
            val cy = oy + cellH * row + cellH / 2f
            val radius = minOf(cellW, cellH) * 0.38f
            drawGauge(canvas, cx, cy, radius, spec)
        }

        // Show connection overlay when not live
        if (data.connectionState != ConnectionState.CONNECTED) {
            drawStatusOverlay(canvas, w, h, data)
        }
    }

    private fun drawGauge(canvas: Canvas, cx: Float, cy: Float, radius: Float, spec: GaugeSpec) {
        val strokeW = radius * 0.13f
        val sweepTotal = 270f
        val startAngle = 135f
        val fraction = ((spec.value - spec.min) / (spec.max - spec.min)).coerceIn(0f, 1f)
        val sweepAngle = sweepTotal * fraction

        ovalBuf.set(cx - radius, cy - radius, cx + radius, cy + radius)

        // Background track
        trackPaint.strokeWidth = strokeW
        canvas.drawArc(ovalBuf, startAngle, sweepTotal, false, trackPaint)

        // Value arc
        arcPaint.color = spec.color
        arcPaint.strokeWidth = strokeW
        canvas.drawArc(ovalBuf, startAngle, sweepAngle, false, arcPaint)

        // Gauge name
        labelPaint.textSize = radius * 0.22f
        canvas.drawText(spec.label, cx, cy - radius * 0.28f, labelPaint)

        // Numeric value
        val display = when (spec.unit) {
            "%" -> "%.1f".format(spec.value)
            else -> "%.0f".format(spec.value)
        }
        valuePaint.textSize = radius * 0.42f
        canvas.drawText(display, cx, cy + radius * 0.18f, valuePaint)

        // Unit
        unitPaint.textSize = radius * 0.19f
        canvas.drawText(spec.unit, cx, cy + radius * 0.42f, unitPaint)
    }

    private fun drawStatusOverlay(canvas: Canvas, w: Float, h: Float, data: ObdData) {
        canvas.drawRect(0f, 0f, w, h, overlayPaint)

        val (title, subtitle) = when (data.connectionState) {
            ConnectionState.CONNECTING -> Pair("Connecting…", "Searching for ELM327 adapter")
            ConnectionState.DISCONNECTED -> Pair("Disconnected", "Open AA Monitor on your phone to connect")
            ConnectionState.ERROR -> Pair("Connection Error", data.errorMessage ?: "Retrying…")
            ConnectionState.CONNECTED -> return
        }

        val titleSize = h * 0.055f
        overlayTextPaint.textSize = titleSize
        canvas.drawText(title, w / 2f, h / 2f - titleSize * 0.6f, overlayTextPaint)

        overlaySubPaint.textSize = titleSize * 0.55f
        canvas.drawText(subtitle, w / 2f, h / 2f + titleSize * 0.6f, overlaySubPaint)
    }

    private data class GaugeSpec(
        val label: String,
        val value: Float,
        val min: Float,
        val max: Float,
        val color: Int,
        val unit: String
    )
}
