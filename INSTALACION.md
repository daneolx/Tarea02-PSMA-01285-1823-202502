# 📱 Cómo Instalar la PWA en iPhone y Android

## 🍎 Instalación en iPhone (iOS)

### Método 1: Desde Safari (Recomendado)

1. **Abre Safari** (no funciona en Chrome u otros navegadores en iOS)
2. **Navega a tu aplicación**: `https://daneolx.github.io/Tarea02-PSMA-01285-1823-202502/`
3. **Toca el botón Compartir** (el icono de cuadrado con flecha hacia arriba) en la barra inferior
4. **Desplázate hacia abajo** en el menú de compartir
5. **Toca "Agregar a pantalla de inicio"** o "Añadir a pantalla de inicio"
6. **Personaliza el nombre** si lo deseas (por defecto será "Reloj Digital")
7. **Toca "Agregar"** en la esquina superior derecha
8. **¡Listo!** La aplicación aparecerá en tu pantalla de inicio con un icono

### Método 2: Desde el banner de instalación (si aparece)

Algunas versiones de iOS muestran un banner automático. Si aparece:
- Toca "Instalar" o "Agregar"
- Sigue las instrucciones en pantalla

### Características en iOS:
- ✅ Se abre en modo pantalla completa (sin barra del navegador)
- ✅ Funciona offline después de la primera carga
- ✅ Aparece como una app independiente
- ✅ Puedes cerrarla con el gesto de deslizar hacia arriba

---

## 🤖 Instalación en Android

### Método 1: Banner de instalación automático (Chrome/Edge)

1. **Abre Chrome o Edge** en tu dispositivo Android
2. **Navega a tu aplicación**: `https://daneolx.github.io/Tarea02-PSMA-01285-1823-202502/`
3. **Espera unos segundos** - Chrome mostrará un banner en la parte inferior que dice:
   - "Agregar Reloj Digital a la pantalla de inicio" o
   - "Instalar aplicación"
4. **Toca "Agregar"** o "Instalar" en el banner
5. **Confirma la instalación** en el diálogo que aparece
6. **¡Listo!** La aplicación aparecerá en tu pantalla de inicio y en el cajón de aplicaciones

### Método 2: Menú del navegador

Si el banner no aparece automáticamente:

1. **Abre Chrome o Edge** en Android
2. **Navega a tu aplicación**
3. **Toca el menú** (tres puntos en la esquina superior derecha)
4. **Busca "Agregar a pantalla de inicio"** o "Instalar aplicación"
5. **Toca la opción**
6. **Confirma** en el diálogo
7. **¡Listo!**

### Método 3: Desde Chrome (menú de instalación)

1. Abre Chrome
2. Ve a tu aplicación
3. Toca el menú (⋮)
4. Selecciona **"Instalar aplicación"** o **"Agregar a pantalla de inicio"**
5. Confirma

### Características en Android:
- ✅ Se instala como una app nativa
- ✅ Aparece en el cajón de aplicaciones
- ✅ Puedes crear acceso directo en la pantalla de inicio
- ✅ Funciona offline completamente
- ✅ Notificaciones push funcionan
- ✅ Se actualiza automáticamente cuando hay cambios

---

## 🔧 Requisitos para la Instalación

### iOS (iPhone/iPad):
- ✅ iOS 11.3 o superior
- ✅ Safari (no funciona en otros navegadores)
- ✅ Conexión HTTPS (GitHub Pages lo proporciona automáticamente)

### Android:
- ✅ Android 5.0 (Lollipop) o superior
- ✅ Chrome, Edge, o navegador compatible con PWAs
- ✅ Conexión HTTPS

---

## 🐛 Solución de Problemas

### Si no aparece el banner de instalación en Android:

1. **Verifica que estés usando HTTPS** (no HTTP)
2. **Asegúrate de tener el manifest.json** correctamente configurado
3. **Limpia la caché del navegador**:
   - Chrome: Configuración → Privacidad → Borrar datos de navegación
4. **Revisa que el Service Worker esté registrado**:
   - Abre Chrome DevTools (F12)
   - Ve a Application → Service Workers
   - Debe aparecer tu service worker como "activo"

### Si no funciona en iOS:

1. **Usa Safari** (no Chrome u otros navegadores)
2. **Verifica que tengas iOS 11.3+**
3. **Asegúrate de tener los meta tags de Apple** en el HTML (ya están incluidos)
4. **Limpia la caché de Safari**:
   - Configuración → Safari → Borrar historial y datos del sitio web

---

## 📝 Notas Importantes

1. **Primera carga**: La primera vez que abras la app instalada, necesitarás conexión a internet para cargar todos los recursos
2. **Actualizaciones**: La app se actualizará automáticamente cuando detecte cambios en el servidor
3. **Offline**: Después de la primera carga, la app funcionará completamente offline
4. **Notificaciones**: Las alarmas funcionarán incluso cuando la app esté cerrada (si el navegador lo permite)

---

## 🎯 Verificar que la Instalación Funcionó

### En iOS:
- La app aparece en la pantalla de inicio con un icono
- Al abrirla, no muestra la barra de direcciones de Safari
- Funciona en modo pantalla completa

### En Android:
- La app aparece en el cajón de aplicaciones
- Puedes crear acceso directo en la pantalla de inicio
- Al abrirla, se comporta como una app nativa
- Aparece en la lista de aplicaciones instaladas

---

## 🔗 Enlaces Útiles

- **Tu aplicación**: https://daneolx.github.io/Tarea02-PSMA-01285-1823-202502/
- **Validar PWA**: https://web.dev/measure
- **Lighthouse**: Herramienta de Chrome DevTools para validar PWAs

---

**¡Disfruta de tu Reloj Digital Inteligente instalado como app nativa!** 🎉

