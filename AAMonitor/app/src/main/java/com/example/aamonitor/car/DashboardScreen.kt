package com.example.aamonitor.car

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.lifecycle.lifecycleScope
import com.example.aamonitor.obd.ObdData
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class DashboardScreen(
    carContext: CarContext,
    private val obdData: StateFlow<ObdData>
) : Screen(carContext) {

    private val renderer = SurfaceRenderer(carContext)

    init {
        // Collect live OBD data and push to the surface renderer
        lifecycleScope.launch {
            obdData.collect { data ->
                renderer.updateData(data)
            }
        }
    }

    override fun onGetTemplate(): Template {
        // NavigationTemplate + Action.PAN enables the surface rendering path
        return NavigationTemplate.Builder()
            .setMapActionStrip(
                ActionStrip.Builder()
                    .addAction(Action.PAN)
                    .build()
            )
            .build()
    }
}
