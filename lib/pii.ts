export function filterSensitivePII(text: string): string {
  let out = text
  // Emails
  out = out.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[correo oculto]')
  // Phones
  out = out.replace(/\b(?:\+57\s?)?(?:3\d{2}|60[1-8]|[1-9]\d{1,2})[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[teléfono oculto]')
  // Cédula (6 a 10 dígitos consecutivos)
  out = out.replace(/\b\d{6,10}\b/g, '[identificador oculto]')
  // NIT (Colombia) simple
  out = out.replace(/\b\d{9}-\d\b/g, '[nit oculto]')
  return out
} 