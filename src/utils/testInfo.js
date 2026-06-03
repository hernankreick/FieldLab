export const TEST_INFO = {
  cmj: {
    title: "CMJ — Counter Movement Jump",
    description: "Mide la potencia explosiva del tren inferior y la capacidad de reutilización elástica del ciclo estiramiento-acortamiento (SSC).",
    steps: [
      "Jugador parado, manos en caderas",
      "Flexión rápida de rodillas (~90°) seguida de salto máximo",
      "Registrar altura de salto en cm",
      "Realizar 3 intentos, tomar el mejor"
    ],
    reference: "🟢 ≥35cm (Rugby Pro M) · 🟡 28-34cm · 🔴 <28cm"
  },
  sj: {
    title: "SJ — Squat Jump",
    description: "Mide la fuerza explosiva pura sin componente elástico. Compararla con CMJ permite calcular la Eficiencia Elástica.",
    steps: [
      "Jugador en posición de squat estático (~90° rodilla), manos en caderas",
      "Mantener 2 segundos sin movimiento previo",
      "Salto máximo sin contramovimiento",
      "3 intentos, tomar el mejor"
    ],
    reference: "🟢 ≥30cm · 🟡 24-29cm · 🔴 <24cm"
  },
  dropJump: {
    title: "Drop Jump — RSI",
    description: "Mide el Reactive Strength Index (RSI): capacidad de producir fuerza en tiempos de contacto mínimos. Indica calidad del SSC reactivo.",
    steps: [
      "Caída desde cajón de 30-40cm",
      "Minimizar tiempo de contacto con el suelo",
      "Salto máximo inmediato al contacto",
      "RSI = Altura (m) / Tiempo de contacto (s)"
    ],
    reference: "🟢 RSI ≥1.8 (élite) · 🟡 1.2-1.7 · 🔴 <1.2"
  },
  sprint10: {
    title: "Sprint 10m — Aceleración",
    description: "Evalúa la capacidad de aceleración en la fase inicial del sprint. Determinante en Rugby y Hockey para primeros pasos defensivos y ofensivos.",
    steps: [
      "Salida desde posición estática",
      "Cronómetro manual o célula fotoeléctrica",
      "2-3 intentos con 3 min de recuperación",
      "Registrar el mejor tiempo"
    ],
    reference: "🟢 <1.70s · 🟡 1.70-1.85s · 🔴 >1.85s (Rugby Pro M)"
  },
  sprint30: {
    title: "Sprint 30m — Top Speed",
    description: "Evalúa la velocidad máxima alcanzada. El tramo 20-30m representa la fase de velocidad máxima real.",
    steps: [
      "Salida estática, misma metodología que 10m",
      "Medir tiempo total a los 30m",
      "Derivar velocidad: 30 / tiempo × 3.6 (km/h)",
      "3 min de recuperación entre intentos"
    ],
    reference: "🟢 <3.90s · 🟡 3.90-4.20s · 🔴 >4.20s (Rugby Pro M)"
  },
  yoyo: {
    title: "Yo-Yo IR1 — Resistencia Intermitente",
    description: "Test de campo que estima la capacidad aeróbica máxima (VO₂máx) y la VAM mediante shuttles progresivos con recuperación activa.",
    steps: [
      "Shuttles de 20m ida y vuelta al ritmo del beep",
      "10s de recuperación activa entre series",
      "El test termina cuando el jugador no alcanza la línea 2 veces",
      "Registrar el nivel y shuttle final"
    ],
    reference: "🟢 VAM ≥16 km/h · 🟡 13-15.9 · 🔴 <13 (Rugby Pro M)"
  },
  navette: {
    title: "Course Navette — Léger",
    description: "Test incremental de 20m con beep. Estima VO₂máx a partir del palier alcanzado. Muy utilizado en fútbol y hockey.",
    steps: [
      "Shuttles de 20m al ritmo del beep",
      "Velocidad aumenta cada minuto (palier)",
      "El test termina cuando no se alcanza la línea al beep",
      "Registrar palier y repetición final"
    ],
    reference: "🟢 VO₂máx ≥55 ml/kg/min · 🟡 45-54 · 🔴 <45"
  },
  unca: {
    title: "UNCa Test — Velocidad Funcional Aeróbica",
    description: "Test de campo argentino que determina la VFA (Velocidad Funcional Aeróbica). Base para la prescripción de cargas aeróbicas en fútbol y rugby.",
    steps: [
      "Calentamiento estándar 10 min",
      "4 series de 800m a ritmo progresivo",
      "Registrar FC al final de cada serie",
      "VFA = velocidad de la serie donde FC supera el umbral"
    ],
    reference: "🟢 VFA ≥14 km/h · 🟡 11-13.9 · 🔴 <11"
  },
  sprintCurvo: {
    title: "Sprint Curvo — Velocidad en Curva",
    description: "Evalúa la capacidad de mantener velocidad en trayectoria curva. Detecta asimetrías Der/Izq que predicen riesgo biomecánico en cambios de dirección.",
    steps: [
      "Distancia estándar: 20m en arco",
      "Ejecutar giro derecho e izquierdo por separado",
      "3 min de recuperación entre intentos",
      "Asimetría = |Der - Izq| / Izq × 100"
    ],
    reference: "🟢 Asimetría <3% · 🟡 3-5% · 🔴 >5%"
  }
};
