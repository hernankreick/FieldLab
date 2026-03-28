# 🧠 FieldLab: Biomechanics & Logic Engine
**Versión:** 1.0  
**Objetivo:** Estandarizar los cálculos científicos y umbrales de rendimiento para atletas de elite.

## 1. Control de Asimetría (LSI - Limb Symmetry Index)
Aplicable a: CMJ-U, DJ-U, COD y Test de 3 pasos (Aceleración).
* **Zona Óptima (Verde):** < 8% de diferencia. 
* **Zona de Alerta (Amarilla):** 8.1% - 15%. Requiere monitoreo y ejercicios correctivos unilaterales.
* **Zona de Riesgo (Roja):** > 15%. Riesgo elevado de lesión. **ACCION:** Alerta inmediata al PF y ajuste de carga.
* **Fórmula:** `((Pierna_Fuerte - Pierna_Débil) / Pierna_Fuerte) * 100`

## 2. Gestión de Carga (ACWR - Acute:Chronic Workload Ratio)
Control de fatiga acumulada para prevención de sobreuso.
* **Fórmula:** Carga Aguda (7 días) / Promedio Carga Crónica (28 días).
* **Sweet Spot (Seguro):** 0.8 a 1.3.
* **Danger Zone (Riesgo):** > 1.5. Indica aumento drástico del riesgo de lesión.

## 3. Dinámica de Salto (Batería de Bosco)
* **Altura de Salto (cm):** Usar Tiempo de Vuelo ($T_v$) -> $h = (9.81 * T_v^2) / 8$
* **Potencia Pico (Sayers):** $W = 60.7 * (h_{cm}) + 45.3 * (Masa_{kg}) - 2055$
* **RSI (Reactive Strength Index):** Altura de Salto (m) / Tiempo de Contacto (s).
* **IUE (Utilización Elástica):** $((CMJ - SJ) / SJ) * 100$. (Valor normal: 10-15%).

## 4. Visión Artificial & VBT (MediaPipe)
* **VBT:** Trackeo del centro de la barra en el eje vertical (Y). 
* **VMP:** Velocidad Media Propulsiva. Si cae > 20% respecto a la primera repetición, cortar la serie.
* **Movilidad (Goniometría):** Calcular ángulos de Tobillo (Dorsiflexión), Cadera y Rodilla en tiempo real.
* **Test 3 Pasos:** Medir asimetría de contacto en el apoyo inicial del sprint.

## 5. Escala de Wellness (Hooper)
* **Umbral Crítico:** Dolor (DOMS) > 7/10 o Sueño < 3/5. Marcar al jugador con "Precaución" antes de la sesión.
