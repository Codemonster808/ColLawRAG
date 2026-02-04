# Sistema de Tiers - Contenido UI

Este directorio contiene todos los textos, mensajes y contenido para el sistema de tiers (freemium) de ColLawRAG.

## Archivos

- **`ui-texts.json`**: Archivo principal con todos los textos de UI en formato JSON

## Estructura del contenido

### 1. Definición de Tiers

Dos planes disponibles:

#### Plan Gratuito (Free)
- 10 consultas diarias
- 100 consultas mensuales
- 500 tokens por consulta
- 5 chunks de contexto
- Acceso a códigos, leyes y procedimientos
- Sin acceso a jurisprudencia ni validación de vigencia

#### Plan Premium
- 100 consultas diarias
- 2,000 consultas mensuales
- 2,000 tokens por consulta
- 15 chunks de contexto
- Acceso completo: códigos, leyes, procedimientos, jurisprudencia, validación de vigencia
- Exportación a PDF
- Soporte prioritario
- Actualizaciones semanales

### 2. Mensajes de UI

#### Mensajes de Upgrade
- **Título**: "✨ Desbloquea todo el potencial de ColLawRAG"
- **CTA principal**: "Actualizar a Premium"
- **8 beneficios** destacados con íconos
- **Precio**: $29,000 COP/mes
- **Garantía**: 7 días

#### Mensajes de Límite Alcanzado

**Límite diario:**
- Título: "⏰ Límite diario alcanzado"
- Mensaje personalizado con límite alcanzado
- Hora de reinicio
- CTA para actualizar

**Límite mensual:**
- Título: "📊 Límite mensual alcanzado"
- Mensaje personalizado
- Fecha de reinicio
- CTA para actualizar

**Función bloqueada:**
- Título: "🔒 Función Premium"
- Mensajes específicos por función:
  - Validación de vigencia
  - Jurisprudencia
  - Exportación a PDF
  - Búsqueda avanzada

### 3. Comparación de Planes

Tabla comparativa organizada en 4 categorías:

#### Consultas
- Consultas diarias (10 vs 100)
- Consultas mensuales (100 vs 2,000)
- Tokens por consulta (500 vs 2,000)
- Chunks de contexto (5 vs 15)

#### Contenido Legal
- Códigos y Leyes (ambos ✅)
- Procedimientos (ambos ✅)
- Jurisprudencia (Premium ✅)
- Validación vigencia (Premium ✅)

#### Funcionalidades
- Exportación PDF (Premium ✅)
- Búsqueda (Básica vs Completa)
- Historial (7 días vs Ilimitado)
- Soporte (48h vs 4h prioritario)

#### Actualizaciones
- Normativa (Mensual vs Semanal)
- Alertas (Premium ✅)
- Nuevas funcionalidades (Acceso tardío vs anticipado)

### 4. Badges y Notificaciones

#### Badges
- **Gratis**: Color gris, "Plan gratuito con funcionalidades básicas"
- **Premium**: Color dorado, "Acceso completo a todas las funcionalidades"

#### Notificaciones
- **Actualización exitosa**: "🎉 ¡Bienvenido a Premium!"
- **Advertencia de cancelación**: Detalla lo que se perderá
- **Prueba gratuita**: 7 días sin tarjeta de crédito

### 5. Casos de Uso

#### Plan Gratuito - Ideal para:
- 📚 Estudiantes de derecho
- 🔍 Consultas esporádicas
- 💡 Conocer el sistema
- 📖 Investigación básica

#### Plan Premium - Perfecto para:
- 👨‍⚖️ Abogados en ejercicio
- 🏢 Firmas de abogados
- 🏛️ Funcionarios públicos
- 📊 Consultores legales
- 🎓 Investigadores
- ⚖️ Procuradores y judicantes

### 6. FAQ

6 preguntas frecuentes cubriendo:
- Cambio de plan
- Reinicio de límites
- Qué pasa al alcanzar límite
- Descuentos para estudiantes
- Uso profesional
- Actualización de información

### 7. Testimonios

3 testimonios con:
- Nombre y rol
- Texto del testimonio
- Calificación (5 estrellas)

## Uso en el Frontend

### Importar textos

```typescript
import tierTexts from '@/data/tiers/ui-texts.json'

// Obtener límites del plan
const freeLimits = tierTexts.tiers.free.limits
const premiumLimits = tierTexts.tiers.premium.limits

// Obtener mensajes de upgrade
const upgradeMessage = tierTexts.messages.upgrade

// Obtener comparación de planes
const comparison = tierTexts.messages.comparison
```

### Ejemplo: Mostrar mensaje de límite alcanzado

```typescript
function showLimitReachedMessage(limitType: 'daily' | 'monthly', limit: number, resetTime: string) {
  const message = tierTexts.messages.limit_reached[limitType]
  
  return (
    <div>
      <h2>{message.title}</h2>
      <p>{message.message.replace('{limit}', limit.toString())}</p>
      <p>{message.wait_message.replace('{reset_time}', resetTime)}</p>
      <button>{message.cta}</button>
    </div>
  )
}
```

### Ejemplo: Tabla comparativa

```typescript
function ComparisonTable() {
  const { features, pricing } = tierTexts.messages.comparison
  
  return (
    <div>
      <h1>{tierTexts.messages.comparison.title}</h1>
      <p>{tierTexts.messages.comparison.subtitle}</p>
      
      {features.map(category => (
        <div key={category.category}>
          <h2>{category.category}</h2>
          <table>
            {category.items.map(item => (
              <tr key={item.feature} className={item.highlight ? 'highlighted' : ''}>
                <td>{item.feature}</td>
                <td>{item.free}</td>
                <td>{item.premium}</td>
              </tr>
            ))}
          </table>
        </div>
      ))}
      
      <div>
        <div>
          <h3>Gratis</h3>
          <p>{pricing.free.price}</p>
          <button>{pricing.free.cta}</button>
        </div>
        <div>
          <h3>Premium</h3>
          <p>{pricing.premium.price} / {pricing.premium.period}</p>
          <p>{pricing.premium.annual_discount}</p>
          <button>{pricing.premium.cta}</button>
        </div>
      </div>
    </div>
  )
}
```

### Ejemplo: Badge de tier

```typescript
function TierBadge({ tier }: { tier: 'free' | 'premium' }) {
  const badge = tierTexts.messages.badge[tier]
  
  return (
    <span 
      className={`badge badge-${badge.color}`}
      title={badge.description}
    >
      {tierTexts.tiers[tier].icon} {badge.text}
    </span>
  )
}
```

## Integración con el Backend

### Verificar límites

```typescript
import { tiers } from '@/data/tiers/ui-texts.json'

function checkUserLimit(user: User, limitType: 'queries_per_day' | 'queries_per_month') {
  const userTier = user.tier // 'free' or 'premium'
  const limit = tiers[userTier].limits[limitType]
  const used = user.usage[limitType]
  
  return {
    limit,
    used,
    remaining: limit - used,
    exceeded: used >= limit
  }
}
```

### Verificar acceso a funcionalidades

```typescript
function canAccessFeature(user: User, feature: keyof typeof tiers.free.limits) {
  const userTier = user.tier
  return tiers[userTier].limits[feature]
}

// Ejemplos:
canAccessFeature(user, 'access_to_jurisprudence') // false para free, true para premium
canAccessFeature(user, 'access_to_vigencia') // false para free, true para premium
canAccessFeature(user, 'export_to_pdf') // false para free, true para premium
```

## Personalización

Los textos pueden personalizarse según necesidad:

1. **Precios**: Actualizar en `messages.comparison.pricing` y `messages.upgrade.price_info`
2. **Límites**: Modificar en `tiers.free.limits` y `tiers.premium.limits`
3. **Beneficios**: Editar el array `messages.upgrade.benefits`
4. **FAQ**: Añadir/modificar preguntas en el array `faq`
5. **Testimonios**: Actualizar o añadir en el array `testimonials`

## Variables dinámicas

Los siguientes placeholders se deben reemplazar dinámicamente:

- `{limit}` - Límite del plan (ej. "10", "100")
- `{used}` - Cantidad usada
- `{reset_time}` - Hora de reinicio (ej. "00:00")
- `{reset_date}` - Fecha de reinicio (ej. "15 de marzo")
- `{end_date}` - Fecha de finalización de suscripción
- `{period}` - Período (ej. "diarias", "mensuales")

## Estilos recomendados

### Colores de badge

```css
.badge-gray {
  background-color: #9ca3af;
  color: white;
}

.badge-gold {
  background-color: #fbbf24;
  color: #78350f;
}
```

### Elementos destacados (highlight)

```css
.highlighted {
  background-color: #fef3c7;
  font-weight: bold;
}
```

## Notas importantes

1. **Coherencia**: Mantener los límites sincronizados entre este archivo y la configuración del backend
2. **Localización**: Actualmente solo en español (Colombia), preparado para i18n futuro
3. **Accesibilidad**: Usar íconos con aria-labels apropiados
4. **Responsive**: Diseñar tablas comparativas responsive-first
5. **Testing**: Verificar todos los flujos de upgrade/downgrade antes de producción

## Roadmap futuro

- [ ] Versión en inglés (i18n)
- [ ] Plan empresarial (Enterprise)
- [ ] Descuentos por volumen
- [ ] Plan estudiantil oficial
- [ ] Integración con pasarelas de pago (Stripe, PayU, Wompi)
- [ ] Sistema de referidos
- [ ] Programa de afiliados

---

**Versión:** 1.0  
**Fecha de creación:** 2026-02-04  
**Última actualización:** 2026-02-04
