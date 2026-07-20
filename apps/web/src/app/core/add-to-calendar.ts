/**
 * "Añadir a mi calendario" con detección de dispositivo. Cero configuración, cero token,
 * cero URL para pegar — un solo tap.
 *
 * El backend entrega el MISMO .ics para todos los dispositivos; lo único que cambia es cómo
 * lo abrimos:
 *  - iOS / Android: navegar a la URL hace que el SO lance la app de calendario nativa con el
 *    evento listo para guardar.
 *  - Escritorio: un <a download> abre el .ics en la app de calendario del sistema (Apple
 *    Calendar / Outlook) o lo descarga.
 */

export type DeviceKind = 'ios' | 'android' | 'desktop';

/** Detecta el tipo de dispositivo a partir del user-agent. */
export function detectDevice(ua: string = navigator.userAgent): DeviceKind {
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

/** Abre/descarga el .ics según el dispositivo. `icsUrl` viene de ApiService.calendarIcsUrl. */
export function addToCalendar(icsUrl: string, device: DeviceKind = detectDevice()): void {
  if (device === 'ios' || device === 'android') {
    // Navegar directo: el móvil intercepta el text/calendar y abre la app nativa.
    window.location.href = icsUrl;
    return;
  }
  // Escritorio: forzamos la descarga/apertura con un ancla temporal.
  const a = document.createElement('a');
  a.href = icsUrl;
  a.download = ''; // el nombre real lo pone el Content-Disposition del servidor
  document.body.appendChild(a);
  a.click();
  a.remove();
}
