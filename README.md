# 🕒 Reloj Digital Inteligente - Progressive Web App (PWA)

Una aplicación de reloj digital avanzada, funcional y adaptativa con múltiples zonas horarias, alarmas programables y sincronización automática con servidores de tiempo.

## ✨ Características Principales

### 🕐 Múltiples Zonas Horarias Simultáneas
- ✅ Agregar, editar y eliminar ciudades/zonas horarias
- ✅ Visualización en tiempo real de cada zona horaria
- ✅ Uso de `Intl.DateTimeFormat` para formateo preciso
- ✅ Información contextual: fecha completa, día de la semana, mes, año
- ✅ Indicador de offset UTC para cada zona

### ⏰ Formato 12h / 24h Inteligente
- ✅ Detección automática según preferencias del sistema (`navigator.language` y `hourCycle`)
- ✅ Opción manual para forzar formato 12h o 24h
- ✅ Indicador AM/PM cuando aplica
- ✅ Segundos opcionales (activar/desactivar)

### 🌓 Modo Oscuro / Claro
- ✅ Detección automática según preferencia del sistema (`prefers-color-scheme`)
- ✅ Botón para alternar manualmente entre modos
- ✅ Guardado de preferencia en localStorage
- ✅ Transiciones suaves entre modos

### 🔔 Sistema de Alarmas Programables
- ✅ Crear alarmas con nombre personalizado
- ✅ Selección de zona horaria para cada alarma
- ✅ Opciones de repetición:
  - Una vez
  - Diariamente
  - Días laborables (lunes-viernes)
  - Fines de semana (sábado-domingo)
- ✅ Notificaciones del navegador usando Notification API
- ✅ Persistencia con IndexedDB (soporta múltiples alarmas y fechas futuras)

### 🌐 Sincronización con Servidor
- ✅ Sincronización automática con WorldTimeAPI
- ✅ Detección de desincronización
- ✅ Ajuste automático del reloj
- ✅ Indicador visual del estado de sincronización
- ✅ Funciona offline (muestra última hora conocida)

### 📱 PWA Completa
- ✅ **Service Worker** - Funciona sin conexión
- ✅ **Instalable** - Se puede instalar como app nativa
- ✅ **Responsive** - Adaptada para móviles, tablets y escritorio
- ✅ **Accesible** - Buen contraste y soporte para lectores de pantalla
- ✅ **Tipografía grande y legible**

## 🚀 Cómo usar

### Opción 1: Usar herramientas online

1. **Sube los archivos a StackBlitz o CodeSandbox:**
   - Ve a [StackBlitz](https://stackblitz.com/) o [CodeSandbox](https://codesandbox.io/)
   - Crea un nuevo proyecto HTML/CSS/JS
   - Sube todos los archivos de este proyecto

2. **Genera los iconos:**
   - Ve a [PWABuilder](https://www.pwabuilder.com/)
   - O usa [App Manifest Generator](https://app-manifest.firebaseapp.com/)
   - Genera iconos de 192x192 y 512x512 píxeles
   - Descarga y colócalos como `icon-192.png` e `icon-512.png`

3. **Valida tu PWA:**
   - Usa [web.dev/measure](https://web.dev/measure) para validar
   - O [Lighthouse](https://developers.google.com/web/tools/lighthouse) en Chrome DevTools

### Opción 2: Servidor local

1. **Instala un servidor HTTP simple:**
   ```bash
   # Con Python 3
   python -m http.server 8000
   
   # Con Node.js (http-server)
   npx http-server -p 8000
   ```

2. **Abre en el navegador:**
   - Ve a `http://localhost:8000`
   - Abre Chrome DevTools > Application > Service Workers
   - Verifica que el Service Worker esté registrado

### Opción 3: Publicar en GitHub Pages

1. **Prepara el repositorio:**
   ```bash
   # Inicializa git (si no lo has hecho)
   git init
   
   # Agrega todos los archivos
   git add .
   
   # Haz commit
   git commit -m "Initial commit: PWA Reloj Digital Inteligente"
   ```

2. **Crea el repositorio en GitHub:**
   - Ve a [GitHub](https://github.com) y crea un nuevo repositorio
   - No inicialices con README (ya tienes uno)
   - Copia la URL del repositorio

3. **Conecta y sube el código:**
   ```bash
   # Conecta con el repositorio remoto
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   
   # Sube el código
   git branch -M main
   git push -u origin main
   ```

4. **Habilita GitHub Pages:**
   - Ve a tu repositorio en GitHub
   - Click en **Settings** (Configuración)
   - En el menú lateral, ve a **Pages**
   - En **Source**, selecciona la rama `main` y la carpeta `/ (root)`
   - Click en **Save**

5. **Accede a tu PWA:**
   - Tu aplicación estará disponible en: `https://TU_USUARIO.github.io/TU_REPOSITORIO/`
   - GitHub Pages proporciona HTTPS automáticamente (requerido para PWAs)
   - La aplicación será instalable y funcionará offline

**Nota:** Si tu repositorio se llama `reloj-digital`, la URL será: `https://TU_USUARIO.github.io/reloj-digital/`

## 📱 Instalación como App

### En Chrome/Edge (Desktop):
1. Abre la aplicación en el navegador
2. Haz clic en el icono de instalación en la barra de direcciones
3. O ve a Menú > "Instalar Reloj Digital Inteligente"

### En Chrome (Android):
1. Abre la aplicación
2. Aparecerá un banner de instalación
3. Toca "Agregar a pantalla de inicio"

### En Safari (iOS):
1. Abre la aplicación
2. Toca el botón Compartir
3. Selecciona "Agregar a pantalla de inicio"

## 📁 Estructura de archivos

```
.
├── index.html          # HTML principal con estructura semántica
├── styles.css          # Estilos CSS responsivos con modo oscuro/claro
├── app.js             # Lógica JavaScript completa
├── manifest.json      # Manifest de PWA
├── sw.js             # Service Worker para funcionamiento offline
├── icon-192.png      # Icono 192x192 (generar)
├── icon-512.png      # Icono 512x512 (generar)
├── generate-icons.html  # Herramienta para generar iconos
└── README.md         # Este archivo
```

## 🎯 Funcionalidades Detalladas

### Gestión de Zonas Horarias
- Click en "➕ Agregar Zona Horaria" para agregar nuevas ciudades
- Edita el nombre o zona horaria haciendo click en ✏️
- Elimina zonas horarias con 🗑️
- Las zonas se guardan automáticamente en localStorage

### Configuración
- **Mostrar segundos**: Activa/desactiva la visualización de segundos
- **Formato de hora**: Elige entre automático, 12h o 24h
- **Sincronizar con servidor**: Botón manual para sincronizar con WorldTimeAPI

### Alarmas
- Crea alarmas con nombre personalizado
- Selecciona la hora y zona horaria
- Elige el patrón de repetición
- Las alarmas se guardan en IndexedDB
- Notificaciones del navegador cuando suena la alarma
- Las alarmas de "una vez" se desactivan automáticamente

### Indicadores de Estado
- 🟢 **Sincronizado**: El reloj está sincronizado con el servidor
- ⚠️ **Desincronizado**: Se detectó una diferencia >1 segundo
- 🔴 **Sin conexión**: No se puede conectar al servidor (funciona offline)

## 🎨 Personalización

### Cambiar colores:
Edita las variables CSS en `styles.css`:
```css
:root {
    --primary-color: #667eea;
    --secondary-color: #764ba2;
    /* ... más colores */
}
```

### Agregar más zonas horarias:
Edita la función `populateTimezoneSelects()` en `app.js` para agregar más ciudades a la lista.

## 🔧 Requisitos técnicos

- Navegador moderno con soporte para:
  - Service Workers
  - IndexedDB
  - Notification API
  - Intl.DateTimeFormat
  - localStorage
  - Manifest (PWA)
- Servidor HTTP (no funciona con `file://`)
- HTTPS para producción (GitHub Pages lo proporciona automáticamente)

## 📝 Notas importantes

1. **Los iconos son necesarios** - Debes generar `icon-192.png` e `icon-512.png`
2. **HTTPS requerido** - Las PWAs necesitan HTTPS (excepto localhost)
3. **Permisos de notificaciones** - Se solicitarán automáticamente al crear la primera alarma
4. **Service Worker** - Se registra automáticamente al cargar la página
5. **Sincronización** - Se sincroniza automáticamente cada minuto con WorldTimeAPI
6. **Funcionamiento offline** - La app funciona sin conexión mostrando la última hora conocida

## 🛠️ Herramientas recomendadas

- **StackBlitz**: https://stackblitz.com/
- **CodeSandbox**: https://codesandbox.io/
- **PWABuilder**: https://www.pwabuilder.com/
- **App Manifest Generator**: https://app-manifest.firebaseapp.com/
- **Lighthouse**: Para validar PWA
- **WorldTimeAPI**: https://worldtimeapi.org/ (API de sincronización)

## 🔌 APIs Utilizadas

- **WorldTimeAPI**: Para sincronización de tiempo
  - Endpoint: `https://worldtimeapi.org/api/ip`
  - Uso: Sincronización automática cada minuto

## 📄 Licencia

Este proyecto es de código abierto y está disponible para uso personal y educativo.

---

**Desarrollado como PWA avanzada con múltiples zonas horarias y alarmas programables** ✨
