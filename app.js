// ============================================
// RELOJ DIGITAL INTELIGENTE - PWA AVANZADA
// ============================================

// Configuración y estado
const CONFIG = {
    STORAGE_KEY: 'clockConfig',
    TIMEZONES_KEY: 'savedTimezones',
    ALARMS_DB: 'alarmsDB',
    ALARMS_STORE: 'alarms',
    SYNC_API: 'https://worldtimeapi.org/api/timezone/',
    UPDATE_INTERVAL: 1000, // 1 segundo
    SYNC_INTERVAL: 60000, // 1 minuto
};

let appState = {
    timezones: [],
    alarms: [],
    showSeconds: true,
    hourFormat: 'auto',
    theme: 'auto',
    lastSync: null,
    isSynced: true,
    timeOffset: 0, // Diferencia con el servidor en ms
    notificationsEnabled: true,
    alarmSound: 'default',
    vibrationEnabled: true,
    dndMode: 'off',
    currentView: 'cards', // cards, map, compare
    loadedTimezones: new Set(), // Para lazy loading
    activeAlarmInterval: null, // Intervalo de la alarma sonando
    activeAlarmOscillators: [], // Osciladores activos para detenerlos
    currentActiveAlarm: null, // Alarma que está sonando actualmente
    isStoppingAlarm: false // Bandera para prevenir creación de nuevos osciladores durante detención
};

// Inicialización
document.addEventListener('DOMContentLoaded', async () => {
    // Iniciar reloj inmediatamente para que los segundos avancen
    startClock();

    initializeApp(); // No esperar a que termine
    setupEventListeners();
    
    // Solicitar permisos de notificaciones (sin bloquear)
    requestNotificationPermission();
    
    setupServiceWorker();
    // startClock ya fue llamado arriba
    loadAlarms().then(() => checkAlarms());
    
    // Verificar carga de Leaflet después de un momento
    setTimeout(() => {
        if (typeof L === 'undefined') {
            console.warn('Leaflet no está disponible. El mapa no funcionará.');
        }
    }, 2000);
});

// Función para solicitar permisos de notificaciones
async function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('Permisos de notificaciones concedidos');
            } else {
                console.log('Permisos de notificaciones denegados');
            }
        } catch (error) {
            console.error('Error al solicitar permisos:', error);
        }
    }
}

// ============================================
// GESTIÓN DE AUDIO (Unlock AudioContext)
// ============================================
let globalAudioContext = null;

function initAudioContext(forceResume = true) {
    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // NO reanudar automáticamente si se está deteniendo la alarma
    if (appState.isStoppingAlarm) {
        console.log('⏸️ Deteniendo alarma - no se reanudará AudioContext');
        return globalAudioContext;
    }
    
    // Intentar reanudar si está suspendido (común en navegadores modernos)
    // PERO solo si forceResume es true (para evitar reanudar durante detención)
    if (forceResume && globalAudioContext.state === 'suspended') {
        globalAudioContext.resume().then(() => {
            console.log('AudioContext reanudado por interacción de usuario');
        }).catch(e => {
            console.log('Error al reanudar AudioContext:', e.message);
        });
    }
    
    return globalAudioContext;
}

// Desbloquear audio en cualquier interacción (pero no durante detención de alarma)
document.addEventListener('click', () => {
    if (!appState.isStoppingAlarm) {
        initAudioContext();
    }
}, { once: false });
document.addEventListener('touchstart', () => {
    if (!appState.isStoppingAlarm) {
        initAudioContext();
    }
}, { once: false });
document.addEventListener('keydown', () => {
    if (!appState.isStoppingAlarm) {
        initAudioContext();
    }
}, { once: false });

// El event listener para detener alarma se configura en setupEventListeners()

// ============================================
// INICIALIZACIÓN
// ============================================

async function initializeApp() {
    // Cargar configuración guardada
    loadConfig();
    
    // Aplicar tema
    applyTheme();
    
    // Detectar formato de hora del sistema
    if (appState.hourFormat === 'auto') {
        appState.hourFormat = detectSystemHourFormatValue();
    }
    
    // Cargar zonas horarias guardadas o agregar la local por defecto
    loadTimezones();
    
    // Sincronizar con servidor (sin await para no bloquear)
    syncWithServer();
    
    // Llenar selectores de zonas horarias
    populateTimezoneSelects();
    
    
    // Inicializar vista guardada después de cargar zonas horarias
    setTimeout(() => {
        if (appState.currentView && appState.currentView !== 'cards') {
            switchView(appState.currentView);
        }
    }, 100);
}

function loadConfig() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
    if (saved) {
        const config = JSON.parse(saved);
        appState.showSeconds = config.showSeconds !== undefined ? config.showSeconds : true;
        appState.hourFormat = config.hourFormat || 'auto';
        appState.theme = config.theme || 'auto';
    }
    
    // Aplicar configuración a la UI
    document.getElementById('showSeconds').checked = appState.showSeconds;
    document.getElementById('hourFormat').value = appState.hourFormat;
}

function detectSystemHourFormatValue() {
    // Detectar formato del sistema usando Intl
    const testDate = new Date();
    const formatter = new Intl.DateTimeFormat(navigator.language, {
        hour: 'numeric',
        hour12: undefined
    });
    const parts = formatter.formatToParts(testDate);
    const hour12 = parts.some(part => part.type === 'dayPeriod');
    return hour12 ? '12' : '24';
}

function applyTheme() {
    if (appState.theme === 'auto') {
        // Detectar preferencia del sistema
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
        document.documentElement.setAttribute('data-theme', appState.theme);
    }
    
    // Actualizar icono
    const themeIcon = document.getElementById('themeIcon');
    const currentTheme = document.documentElement.getAttribute('data-theme');
    themeIcon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
}

function loadTimezones() {
    const saved = localStorage.getItem(CONFIG.TIMEZONES_KEY);
    if (saved) {
        appState.timezones = JSON.parse(saved);
    } else {
        // Agregar zona horaria local por defecto
        const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const cityName = getCityNameFromTimezone(localTimezone);
        appState.timezones = [{
            id: generateId(),
            name: cityName,
            timezone: localTimezone
        }];
        saveTimezones();
    }
    renderTimezones();
}

function populateTimezoneSelects() {
    const timezoneSelect = document.getElementById('timezoneSelect');
    const alarmTimezoneSelect = document.getElementById('alarmTimezoneSelect');
    
    const commonTimezones = [
        { name: 'Ciudad de México', tz: 'America/Mexico_City' },
        { name: 'Nueva York', tz: 'America/New_York' },
        { name: 'Los Ángeles', tz: 'America/Los_Angeles' },
        { name: 'Londres', tz: 'Europe/London' },
        { name: 'París', tz: 'Europe/Paris' },
        { name: 'Madrid', tz: 'Europe/Madrid' },
        { name: 'Tokio', tz: 'Asia/Tokio' },
        { name: 'Shanghai', tz: 'Asia/Shanghai' },
        { name: 'Dubái', tz: 'Asia/Dubai' },
        { name: 'Sídney', tz: 'Australia/Sydney' },
        { name: 'Buenos Aires', tz: 'America/Argentina/Buenos_Aires' },
        { name: 'São Paulo', tz: 'America/Sao_Paulo' },
    ];
    
    [timezoneSelect, alarmTimezoneSelect].forEach(select => {
        select.innerHTML = '';
        commonTimezones.forEach(({ name, tz }) => {
            const option = document.createElement('option');
            option.value = tz;
            option.textContent = `${name} (${tz})`;
            select.appendChild(option);
        });
    });
}

// ============================================
// RENDERIZADO DE ZONAS HORARIAS
// ============================================

function renderTimezones() {
    const container = document.getElementById('timezonesContainer');
    container.innerHTML = '';
    
    appState.timezones.forEach(timezone => {
        const card = createTimezoneCard(timezone);
        container.appendChild(card);
    });
}

function createTimezoneCard(timezone) {
    const card = document.createElement('div');
    card.className = 'timezone-card';
    card.dataset.timezoneId = timezone.id;
    
    const now = new Date();
    const time = formatTimeForTimezone(now, timezone.timezone);
    const date = formatDateShortForTimezone(now, timezone.timezone);
    const offset = getTimezoneOffset(timezone.timezone);
    
    card.innerHTML = `
        <div class="timezone-header">
            <div class="timezone-name">${timezone.name}</div>
            <div class="timezone-actions">
                <button class="btn-small edit-timezone" data-id="${timezone.id}" title="Editar">✏️</button>
                <button class="btn-small delete-timezone" data-id="${timezone.id}" title="Eliminar">🗑️</button>
            </div>
        </div>
        <div class="clock-container">
            <div class="digital-clock-modern">
                <div class="digital-clock-inner">
                    <div class="time-display-modern" data-timezone="${timezone.timezone}">
                        ${(() => {
                            // Obtener hora completa con segundos siempre para asegurar que existan
                            const timeWithSeconds = now.toLocaleString('en-US', {
                                timeZone: timezone.timezone,
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: false
                            });
                            const timeParts = time.split(' ');
                            const timeOnly = timeParts[0];
                            const amPm = timeParts[1] || '';
                            const [hours, minutes] = timeOnly.split(':');
                            // Obtener segundos del string completo
                            const secondsParts = timeWithSeconds.split(':');
                            const seconds = secondsParts.length >= 3 ? secondsParts[2] : '00';
                            return `
                                <span class="time-hours">${hours}</span>
                                <span class="time-separator">:</span>
                                <span class="time-minutes">${minutes}</span>
                                <span class="time-separator" style="${appState.showSeconds ? '' : 'display:none;'}">:</span>
                                <span class="time-seconds" style="${appState.showSeconds ? '' : 'display:none;'}">${seconds}</span>
                                ${amPm ? `<span class="time-ampm">${amPm}</span>` : ''}
                            `;
                        })()}
                    </div>
                    <div class="date-display-modern">${date}</div>
                    <div class="timezone-offset-modern">${offset}</div>
                </div>
            </div>
        </div>
    `;
    
    // Event listeners para editar/eliminar
    card.querySelector('.edit-timezone').addEventListener('click', () => editTimezone(timezone.id));
    card.querySelector('.delete-timezone').addEventListener('click', () => deleteTimezone(timezone.id));
    
    return card;
}

function formatTimeForTimezone(date, timezone) {
    let use12Hour = false;
    if (appState.hourFormat === '12') {
        use12Hour = true;
    } else if (appState.hourFormat === 'auto') {
        use12Hour = detectSystemHourFormatValue() === '12';
    }
    
    const options = {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: appState.showSeconds ? '2-digit' : undefined,
        hour12: use12Hour,
    };
    
    // Formatear y obtener las partes
    const formatter = new Intl.DateTimeFormat(navigator.language, options);
    const parts = formatter.formatToParts(date);
    
    // Construir el string manualmente, asegurándonos de incluir AM/PM solo una vez
    let timeString = '';
    let amPmValue = null;
    
    parts.forEach(part => {
        if (part.type === 'dayPeriod') {
            // Guardar el valor de AM/PM pero no agregarlo todavía
            amPmValue = part.value;
        } else if (part.type === 'hour' || part.type === 'minute' || part.type === 'second' || part.type === 'literal') {
            timeString += part.value;
        }
    });
    
    // Agregar AM/PM al final si existe y es formato 12h
    if (use12Hour && amPmValue) {
        timeString += ` ${amPmValue}`;
    }
    
    return timeString.trim();
}


function formatDateForTimezone(date, timezone) {
    const options = {
        timeZone: timezone,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    
    return new Intl.DateTimeFormat(navigator.language, options).format(date);
}

function formatDateShortForTimezone(date, timezone) {
    // Formato: Lun dd/mm/yyyy
    const weekdayOptions = {
        timeZone: timezone,
        weekday: 'short'
    };
    
    const dateOptions = {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    };
    
    // Obtener día de la semana abreviado
    const weekdayFormatter = new Intl.DateTimeFormat('es-ES', weekdayOptions);
    const weekday = weekdayFormatter.format(date);
    
    // Obtener fecha en formato dd/mm/yyyy
    const dateFormatter = new Intl.DateTimeFormat('es-ES', dateOptions);
    const parts = dateFormatter.formatToParts(date);
    
    let day = '';
    let month = '';
    let year = '';
    
    parts.forEach(part => {
        if (part.type === 'day') day = part.value;
        if (part.type === 'month') month = part.value;
        if (part.type === 'year') year = part.value;
    });
    
    return `${weekday} ${day}/${month}/${year}`;
}

function getTimezoneOffset(timezone) {
    const now = new Date();
    const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tz = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
    const offset = (tz - utc) / (1000 * 60 * 60);
    
    const sign = offset >= 0 ? '+' : '';
    return `UTC${sign}${offset.toFixed(1)}`;
}

function getCityNameFromTimezone(timezone) {
    const parts = timezone.split('/');
    return parts[parts.length - 1].replace(/_/g, ' ');
}


// ============================================
// ACTUALIZACIÓN DEL RELOJ
// ============================================

// Actualización del reloj usando setInterval para funcionar en segundo plano
let clockInterval = null;
let alarmInterval = null;
let syncInterval = null;

function startClock() {
    // Actualizar inmediatamente
    updateAllClocks();
    
    // Limpiar intervalos anteriores si existen
    if (clockInterval) clearInterval(clockInterval);
    if (alarmInterval) clearInterval(alarmInterval);
    if (syncInterval) clearInterval(syncInterval);
    
    // Actualizar reloj cada segundo (funciona incluso en segundo plano)
    // Usar función nombrada para mejor debugging
    let updateCount = 0;
    function updateClock() {
        updateCount++;
        // Log cada 10 segundos para no saturar la consola
        if (updateCount % 10 === 0) {
            console.log('Reloj actualizado', updateCount, 'veces');
        }
        updateAllClocks();
    }
    
    // Iniciar intervalo para actualizar el reloj cada segundo
    clockInterval = setInterval(updateClock, CONFIG.UPDATE_INTERVAL);
    
    // Verificar que el intervalo se inició correctamente
    if (!clockInterval) {
        console.error('Error: No se pudo iniciar el intervalo del reloj');
        // Reintentar después de un momento
        setTimeout(() => startClock(), 1000);
        return;
    }
    
    console.log('Intervalo iniciado. ID:', clockInterval);
    
    // Actualizar alarmas cada segundo
    alarmInterval = setInterval(() => {
        checkAlarms();
    }, CONFIG.UPDATE_INTERVAL);
    
    // Sincronizar periódicamente con servidor
    syncInterval = setInterval(async () => {
        await syncWithServer();
    }, CONFIG.SYNC_INTERVAL);
    
    // Mantener la app activa cuando está visible
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Cuando la app vuelve a ser visible, actualizar inmediatamente
            updateAllClocks();
            checkAlarms();
        }
    });
    
    // También actualizar cuando la ventana recibe foco
    window.addEventListener('focus', () => {
        updateAllClocks();
    });
    
    console.log('Reloj iniciado - Actualizando cada', CONFIG.UPDATE_INTERVAL, 'ms');
}

function updateAllClocks() {
    // Crear nueva fecha en cada llamada para asegurar que sea actual
    // IMPORTANTE: Crear nueva instancia de Date en cada llamada
    const now = new Date();
    if (appState.timeOffset !== 0) {
        now.setTime(now.getTime() + appState.timeOffset);
    }
    
    // Actualizar relojes digitales
    document.querySelectorAll('.time-display').forEach(display => {
        const timezone = display.dataset.timezone;
        display.textContent = formatTimeForTimezone(now, timezone);
    });
    
    // Actualizar fechas
    document.querySelectorAll('.date-display').forEach(display => {
        const card = display.closest('.timezone-card');
        const timezoneId = card.dataset.timezoneId;
        const timezone = appState.timezones.find(tz => tz.id === timezoneId);
        if (timezone) {
            display.textContent = formatDateForTimezone(now, timezone.timezone);
        }
    });
    
    // Actualizar relojes digitales modernos
    document.querySelectorAll('.time-display-modern').forEach(display => {
        const timezone = display.dataset.timezone;
        
        // IMPORTANTE: Crear una NUEVA fecha en cada iteración del bucle
        // para asegurar que los segundos sean actuales
        const currentTime = new Date();
        if (appState.timeOffset !== 0) {
            currentTime.setTime(currentTime.getTime() + appState.timeOffset);
        }
        
        // Obtener elementos del DOM primero
        const hoursEl = display.querySelector('.time-hours');
        const minutesEl = display.querySelector('.time-minutes');
        const amPmEl = display.querySelector('.time-ampm');
        const separatorEls = display.querySelectorAll('.time-separator');
        
        // Obtener hora actual en la zona horaria
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const parts = formatter.formatToParts(currentTime);
        let hours = 0, minutes = 0;
        
        parts.forEach(part => {
            if (part.type === 'hour') hours = parseInt(part.value, 10);
            if (part.type === 'minute') minutes = parseInt(part.value, 10);
        });
        
        // Validar horas y minutos
        hours = isNaN(hours) ? 0 : Math.max(0, Math.min(23, hours));
        minutes = isNaN(minutes) ? 0 : Math.max(0, Math.min(59, minutes));
        
        // IMPORTANTE: Los segundos son los mismos en todas las zonas horarias
        // Obtener directamente de la fecha actual creada en esta iteración
        let seconds = currentTime.getSeconds();
        if (isNaN(seconds) || seconds < 0 || seconds > 59) {
            seconds = 0;
        }
        
        // Formatear según el formato de hora configurado
        let use12Hour = false;
        if (appState.hourFormat === '12') {
            use12Hour = true;
        } else if (appState.hourFormat === 'auto') {
            use12Hour = detectSystemHourFormatValue() === '12';
        }
        
        let displayHours = hours;
        let amPm = '';
        
        if (use12Hour) {
            displayHours = hours % 12 || 12;
            amPm = hours >= 12 ? 'PM' : 'AM';
        }
        
        // Actualizar horas
        if (hoursEl) {
            hoursEl.textContent = String(displayHours).padStart(2, '0');
        }
        
        // Actualizar minutos
        if (minutesEl) {
            minutesEl.textContent = String(minutes).padStart(2, '0');
        }
        
        // Buscar o crear elemento de segundos
        let finalSecondsEl = display.querySelector('.time-seconds');
        
        // Si no existe y debería existir, crearlo
        if (!finalSecondsEl && appState.showSeconds) {
            const minutesElForInsert = display.querySelector('.time-minutes');
            if (minutesElForInsert) {
                // Crear separador si no existe
                let sep2 = separatorEls[1];
                if (!sep2) {
                    sep2 = document.createElement('span');
                    sep2.className = 'time-separator';
                    sep2.textContent = ':';
                    minutesElForInsert.parentNode.insertBefore(sep2, minutesElForInsert.nextSibling);
                }
                // Crear elemento de segundos
                finalSecondsEl = document.createElement('span');
                finalSecondsEl.className = 'time-seconds';
                finalSecondsEl.style.display = 'inline-block';
                if (sep2.nextSibling) {
                    sep2.parentNode.insertBefore(finalSecondsEl, sep2.nextSibling);
                } else {
                    sep2.parentNode.appendChild(finalSecondsEl);
                }
            }
        }
        
        // ACTUALIZAR SEGUNDOS
        if (finalSecondsEl && appState.showSeconds) {
            const secondsText = String(seconds).padStart(2, '0');
            finalSecondsEl.textContent = secondsText;
            
            // Asegurar visibilidad
            finalSecondsEl.style.display = 'inline-block';
            if (separatorEls[1]) {
                separatorEls[1].style.display = 'inline-block';
            }
        } else if (finalSecondsEl && !appState.showSeconds) {
            finalSecondsEl.style.display = 'none';
            if (separatorEls[1]) {
                separatorEls[1].style.display = 'none';
            }
        }
        
        // Actualizar AM/PM
        if (amPmEl) {
            if (use12Hour && amPm) {
                amPmEl.textContent = amPm;
                amPmEl.style.display = 'inline-block';
            } else {
                amPmEl.style.display = 'none';
            }
        }
    });
    
    // Actualizar fechas en relojes modernos
    document.querySelectorAll('.date-display-modern').forEach(display => {
        const card = display.closest('.timezone-card');
        const timezoneId = card.dataset.timezoneId;
        const timezone = appState.timezones.find(tz => tz.id === timezoneId);
        if (timezone) {
            display.textContent = formatDateShortForTimezone(now, timezone.timezone);
        }
    });
    
    // Actualizar offsets en relojes modernos
    document.querySelectorAll('.timezone-offset-modern').forEach(display => {
        const card = display.closest('.timezone-card');
        const timezoneId = card.dataset.timezoneId;
        const timezone = appState.timezones.find(tz => tz.id === timezoneId);
        if (timezone) {
            display.textContent = getTimezoneOffset(timezone.timezone);
        }
    });
}

// ============================================
// SINCRONIZACIÓN CON SERVIDOR
// ============================================

async function syncWithServer() {
    try {
        // Usar AbortController para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 segundos timeout

        const response = await fetch('https://worldtimeapi.org/api/ip', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        const serverTime = new Date(data.datetime);
        const localTime = new Date();
        
        appState.timeOffset = serverTime.getTime() - localTime.getTime();
        appState.lastSync = new Date();
        appState.isSynced = true;
        
        updateSyncStatus('🟢 Sincronizado', 'synced');
        
        // Detectar desincronización significativa (>1 segundo)
        if (Math.abs(appState.timeOffset) > 1000) {
            updateSyncStatus('⚠️ Desincronizado - ajustando...', 'syncing');
        }
    } catch (error) {
        console.error('Error al sincronizar:', error);
        appState.isSynced = false;
        updateSyncStatus('🔴 Sin conexión', 'error');
    }
}

function updateSyncStatus(message, status) {
    const indicator = document.getElementById('statusIndicator');
    indicator.textContent = message;
    indicator.className = `status-indicator ${status}`;
}

// ============================================
// GESTIÓN DE ZONAS HORARIAS
// ============================================

function setupEventListeners() {
    // Toggle configuración
    const settingsToggle = document.getElementById('settingsToggle');
    if (settingsToggle) {
        settingsToggle.addEventListener('click', () => {
            const panel = document.getElementById('settingsPanel');
            if (panel) panel.classList.toggle('hidden');
        });
    }
    
    // Toggle tema
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Configuración
    const showSeconds = document.getElementById('showSeconds');
    if (showSeconds) {
        showSeconds.addEventListener('change', (e) => {
            appState.showSeconds = e.target.checked;
            saveConfig();
            updateAllClocks();
        });
    }
    
    const hourFormat = document.getElementById('hourFormat');
    if (hourFormat) {
        hourFormat.addEventListener('change', (e) => {
            appState.hourFormat = e.target.value;
            if (appState.hourFormat === 'auto') {
                appState.hourFormat = detectSystemHourFormatValue();
            }
            saveConfig();
            updateAllClocks();
        });
    }
    
    // Configuración de notificaciones
    const enableNotifications = document.getElementById('enableNotifications');
    if (enableNotifications) {
        enableNotifications.addEventListener('change', (e) => {
            appState.notificationsEnabled = e.target.checked;
            saveConfig();
        });
    }
    
    const alarmSound = document.getElementById('alarmSound');
    if (alarmSound) {
        alarmSound.addEventListener('change', (e) => {
            appState.alarmSound = e.target.value;
            saveConfig();
        });
    }
    
    const enableVibration = document.getElementById('enableVibration');
    if (enableVibration) {
        enableVibration.addEventListener('change', (e) => {
            appState.vibrationEnabled = e.target.checked;
            saveConfig();
        });
    }
    
    const dndMode = document.getElementById('dndMode');
    if (dndMode) {
        dndMode.addEventListener('change', (e) => {
            appState.dndMode = e.target.value;
            saveConfig();
        });
    }
    
    // Vistas de visualización
    const cardViewBtn = document.getElementById('cardViewBtn');
    if (cardViewBtn) {
        cardViewBtn.addEventListener('click', () => switchView('cards'));
    }
    
    const mapViewBtn = document.getElementById('mapViewBtn');
    if (mapViewBtn) {
        mapViewBtn.addEventListener('click', () => switchView('map'));
    }
    
    const compareViewBtn = document.getElementById('compareViewBtn');
    if (compareViewBtn) {
        compareViewBtn.addEventListener('click', () => switchView('compare'));
    }
    
    const syncTimeBtn = document.getElementById('syncTimeBtn');
    if (syncTimeBtn) {
        syncTimeBtn.addEventListener('click', syncWithServer);
    }
    
    // Agregar zona horaria
    const addTimezoneBtn = document.getElementById('addTimezoneBtn');
    if (addTimezoneBtn) {
        addTimezoneBtn.addEventListener('click', () => {
            const timezoneModal = document.getElementById('timezoneModal');
            if (timezoneModal) timezoneModal.classList.remove('hidden');
            const cityNameInput = document.getElementById('cityNameInput');
            if (cityNameInput) cityNameInput.value = '';
            const timezoneSelect = document.getElementById('timezoneSelect');
            if (timezoneSelect) timezoneSelect.value = '';
        });
    }
    
    // Guardar zona horaria
    const saveTimezoneBtn = document.getElementById('saveTimezoneBtn');
    if (saveTimezoneBtn) {
        saveTimezoneBtn.addEventListener('click', saveTimezone);
    }
    
    const cancelTimezoneBtn = document.getElementById('cancelTimezoneBtn');
    if (cancelTimezoneBtn) {
        cancelTimezoneBtn.addEventListener('click', () => {
            const timezoneModal = document.getElementById('timezoneModal');
            if (timezoneModal) timezoneModal.classList.add('hidden');
        });
    }
    
    // Alarmas
    const addAlarmBtn = document.getElementById('addAlarmBtn');
    if (addAlarmBtn) {
        addAlarmBtn.addEventListener('click', () => {
            const alarmModal = document.getElementById('alarmModal');
            if (alarmModal) alarmModal.classList.remove('hidden');
            populateAlarmTimezoneSelect();
        });
    }
    
    const saveAlarmBtn = document.getElementById('saveAlarmBtn');
    if (saveAlarmBtn) {
        saveAlarmBtn.addEventListener('click', saveAlarm);
    }
    
    const cancelAlarmBtn = document.getElementById('cancelAlarmBtn');
    if (cancelAlarmBtn) {
        cancelAlarmBtn.addEventListener('click', () => {
            const alarmModal = document.getElementById('alarmModal');
            if (alarmModal) alarmModal.classList.add('hidden');
        });
    }
    
    // Créditos (verificar que los elementos existan)
    const creditsBtn = document.getElementById('creditsBtn');
    if (creditsBtn) {
        creditsBtn.addEventListener('click', () => {
            const creditsModal = document.getElementById('creditsModal');
            if (creditsModal) {
                creditsModal.classList.remove('hidden');
            }
        });
    }
    
    const closeCreditsBtn = document.getElementById('closeCreditsBtn');
    if (closeCreditsBtn) {
        closeCreditsBtn.addEventListener('click', () => {
            const creditsModal = document.getElementById('creditsModal');
            if (creditsModal) {
                creditsModal.classList.add('hidden');
            }
        });
    }
    
    // Cerrar modal al hacer clic fuera
    const creditsModal = document.getElementById('creditsModal');
    if (creditsModal) {
        creditsModal.addEventListener('click', (e) => {
            if (e.target.id === 'creditsModal') {
                creditsModal.classList.add('hidden');
            }
        });
    }
    
    // Desbloquear audio en la primera interacción del usuario
    ['click', 'touchstart', 'keydown'].forEach(event => {
        document.body.addEventListener(event, unlockAudio, { once: true });
    });
    
    // Función wrapper para asegurar que stopAlarm se ejecute
    const handleStopAlarm = (e) => {
        // Verificar que el click fue en el botón o en sus hijos
        const target = e.target;
        const stopAlarmBtn = document.getElementById('stopAlarmBtn');
        
        if (!stopAlarmBtn) {
            console.error('❌ Botón stopAlarmBtn no encontrado');
            return;
        }
        
        // Verificar que el click fue en el botón o dentro de él
        if (target !== stopAlarmBtn && !stopAlarmBtn.contains(target)) {
            return; // No fue click en el botón
        }
        
        e.preventDefault();
        e.stopPropagation();
        console.log('🖱️ Evento detectado en botón "Apagar Alarma" - llamando stopAlarm()');
        console.log('🔍 Estado actual:', {
            currentActiveAlarm: appState.currentActiveAlarm,
            activeAlarmInterval: appState.activeAlarmInterval,
            oscillatorsCount: appState.activeAlarmOscillators.length
        });
        
        // Verificar que realmente hay una alarma activa
        if (appState.currentActiveAlarm || appState.activeAlarmInterval || appState.activeAlarmOscillators.length > 0) {
            console.log('✅ Hay alarma activa - deteniendo...');
            stopAlarm();
        } else {
            console.log('⚠️ No hay alarma activa para detener');
        }
    };
    
    // Usar delegación de eventos a nivel de documento para asegurar que siempre funcione
    // IMPORTANTE: Usar una función con nombre para poder removerla si es necesario
    const documentClickHandler = (e) => {
        const target = e.target;
        const stopAlarmBtn = document.getElementById('stopAlarmBtn');
        
        if (!stopAlarmBtn) return;
        
        // Verificar si el click fue en el botón o en sus hijos
        if (target === stopAlarmBtn || stopAlarmBtn.contains(target)) {
            console.log('🎯 Click detectado en documento - verificando si es en botón...');
            handleStopAlarm(e);
        }
    };
    
    document.addEventListener('click', documentClickHandler, true); // capture phase
    
    document.addEventListener('touchstart', (e) => {
        const target = e.target;
        const stopAlarmBtn = document.getElementById('stopAlarmBtn');
        if (stopAlarmBtn && (target === stopAlarmBtn || stopAlarmBtn.contains(target))) {
            console.log('👆 Touch detectado en botón');
            e.preventDefault();
            handleStopAlarm(e);
        }
    }, { passive: false });
    
    // También agregar directamente al botón como respaldo
    const stopAlarmBtn = document.getElementById('stopAlarmBtn');
    if (stopAlarmBtn) {
        console.log('✅ Botón stopAlarmBtn encontrado en el DOM');
        
        // Agregar onclick directamente como atributo (más confiable)
        stopAlarmBtn.onclick = handleStopAlarm;
        
        // También agregar event listeners normales
        stopAlarmBtn.addEventListener('click', handleStopAlarm);
        stopAlarmBtn.addEventListener('mousedown', handleStopAlarm);
        
        // Asegurar que el botón sea clickeable y visible
        stopAlarmBtn.style.pointerEvents = 'auto';
        stopAlarmBtn.style.cursor = 'pointer';
        stopAlarmBtn.style.display = 'flex';
        stopAlarmBtn.style.opacity = '1';
        stopAlarmBtn.style.visibility = 'visible';
        stopAlarmBtn.style.zIndex = '10000';
        stopAlarmBtn.setAttribute('tabindex', '0');
        
        // Agregar soporte para teclado
        stopAlarmBtn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleStopAlarm(e);
            }
        });
        
        // Listener de prueba para verificar que el botón recibe eventos
        stopAlarmBtn.addEventListener('mouseenter', () => {
            console.log('🖱️ Mouse sobre botón "Apagar Alarma"');
        });
        
        stopAlarmBtn.addEventListener('mouseleave', () => {
            console.log('🖱️ Mouse salió del botón "Apagar Alarma"');
        });
        
        // Agregar listener para cualquier interacción
        stopAlarmBtn.addEventListener('pointerenter', () => {
            console.log('👆 Pointer sobre botón "Apagar Alarma"');
        });
        
        // Verificar que el botón es clickeable
        console.log('✅ Event listeners del botón "Apagar Alarma" configurados correctamente');
        console.log('🔍 Verificación del botón:', {
            exists: !!stopAlarmBtn,
            onclick: typeof stopAlarmBtn.onclick,
            hasListeners: stopAlarmBtn.onclick !== null,
            computedStyle: window.getComputedStyle(stopAlarmBtn).display,
            zIndex: window.getComputedStyle(stopAlarmBtn).zIndex
        });
    } else {
        console.error('❌ No se encontró el botón stopAlarmBtn en el DOM');
    }
    
    // Hacer la función accesible globalmente para debugging
    window.stopAlarmManually = stopAlarm;
}

function toggleTheme() {
    if (appState.theme === 'auto') {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        appState.theme = currentTheme === 'dark' ? 'light' : 'dark';
    } else {
        appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
    }
    
    saveConfig();
    applyTheme();
}

function saveTimezone() {
    const name = document.getElementById('cityNameInput').value.trim();
    const timezone = document.getElementById('timezoneSelect').value;
    
    if (!name || !timezone) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    appState.timezones.push({
        id: generateId(),
        name: name,
        timezone: timezone
    });
    
    saveTimezones();
    renderTimezones();
    document.getElementById('timezoneModal').classList.add('hidden');
}

function editTimezone(id) {
    const timezone = appState.timezones.find(tz => tz.id === id);
    if (!timezone) return;
    
    document.getElementById('cityNameInput').value = timezone.name;
    document.getElementById('timezoneSelect').value = timezone.timezone;
    document.getElementById('timezoneModal').classList.remove('hidden');
    
    // Cambiar el botón de guardar para editar
    const saveBtn = document.getElementById('saveTimezoneBtn');
    saveBtn.textContent = 'Actualizar';
    saveBtn.onclick = () => {
        timezone.name = document.getElementById('cityNameInput').value.trim();
        timezone.timezone = document.getElementById('timezoneSelect').value;
        saveTimezones();
        renderTimezones();
        document.getElementById('timezoneModal').classList.add('hidden');
        saveBtn.textContent = 'Guardar';
        saveBtn.onclick = saveTimezone;
    };
}

function deleteTimezone(id) {
    if (confirm('¿Estás seguro de eliminar esta zona horaria?')) {
        appState.timezones = appState.timezones.filter(tz => tz.id !== id);
        saveTimezones();
        renderTimezones();
    }
}

function saveTimezones() {
    localStorage.setItem(CONFIG.TIMEZONES_KEY, JSON.stringify(appState.timezones));
}

function saveConfig() {
    localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
        showSeconds: appState.showSeconds,
        hourFormat: appState.hourFormat,
        theme: appState.theme,
        notificationsEnabled: appState.notificationsEnabled,
        alarmSound: appState.alarmSound,
        vibrationEnabled: appState.vibrationEnabled,
        dndMode: appState.dndMode,
        currentView: appState.currentView
    }));
}

// ============================================
// SISTEMA DE ALARMAS CON INDEXEDDB
// ============================================

let db = null;

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(CONFIG.ALARMS_DB, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(CONFIG.ALARMS_STORE)) {
                const store = db.createObjectStore(CONFIG.ALARMS_STORE, { keyPath: 'id' });
                store.createIndex('time', 'time', { unique: false });
            }
        };
    });
}

async function loadAlarms() {
    try {
        if (!db) await initDB();
        
        const transaction = db.transaction([CONFIG.ALARMS_STORE], 'readonly');
        const store = transaction.objectStore(CONFIG.ALARMS_STORE);
        const request = store.getAll();
        
        request.onsuccess = () => {
            appState.alarms = request.result || [];
            renderAlarms();
        };
    } catch (error) {
        console.error('Error al cargar alarmas:', error);
    }
}

function saveAlarm() {
    const name = document.getElementById('alarmNameInput').value.trim();
    const time = document.getElementById('alarmTimeInput').value;
    const timezone = document.getElementById('alarmTimezoneSelect').value;
    const repeat = document.getElementById('alarmRepeatSelect').value;
    
    if (!name || !time) {
        alert('Por favor completa todos los campos');
        return;
    }
    
    const alarm = {
        id: generateId(),
        name: name,
        time: time,
        timezone: timezone,
        repeat: repeat,
        enabled: true,
        createdAt: new Date().toISOString()
    };
    
    (async () => {
        try {
            if (!db) await initDB();
            
            const transaction = db.transaction([CONFIG.ALARMS_STORE], 'readwrite');
            const store = transaction.objectStore(CONFIG.ALARMS_STORE);
            
            store.add(alarm).onsuccess = () => {
                appState.alarms.push(alarm);
                renderAlarms();
                document.getElementById('alarmModal').classList.add('hidden');
                
                // Limpiar formulario
                document.getElementById('alarmNameInput').value = '';
                document.getElementById('alarmTimeInput').value = '';
            };
        } catch (error) {
            console.error('Error al guardar alarma:', error);
            alert('Error al guardar la alarma');
        }
    })();
}

async function deleteAlarm(id) {
    try {
        if (!db) await initDB();
        
        const transaction = db.transaction([CONFIG.ALARMS_STORE], 'readwrite');
        const store = transaction.objectStore(CONFIG.ALARMS_STORE);
        
        return new Promise((resolve, reject) => {
            const request = store.delete(id);
            request.onsuccess = () => {
                appState.alarms = appState.alarms.filter(alarm => alarm.id !== id);
                renderAlarms();
                resolve();
            };
            request.onerror = () => reject(request.error);
        });
    } catch (error) {
        console.error('Error al eliminar alarma:', error);
    }
}

// Función helper para verificar si la hora de la alarma ya pasó hoy
function hasAlarmTimePassedToday(alarm) {
    const now = new Date();
    if (appState.timeOffset !== 0) {
        now.setTime(now.getTime() + appState.timeOffset);
    }
    
    // Obtener hora actual en la zona horaria de la alarma
    const options = { 
        timeZone: alarm.timezone, 
        hour12: false, 
        hour: 'numeric', 
        minute: 'numeric' 
    };
    
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);
    const nowH = parseInt(parts.find(p => p.type === 'hour').value);
    const nowM = parseInt(parts.find(p => p.type === 'minute').value);
    
    // Obtener hora de la alarma
    const [alarmH, alarmM] = alarm.time.split(':').map(Number);
    
    // Comparar: si la hora actual es mayor que la hora de la alarma, ya pasó
    const nowMinutes = nowH * 60 + nowM;
    const alarmMinutes = alarmH * 60 + alarmM;
    
    return nowMinutes > alarmMinutes;
}

function renderAlarms() {
    const container = document.getElementById('alarmsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    const now = new Date();
    if (appState.timeOffset !== 0) {
        now.setTime(now.getTime() + appState.timeOffset);
    }
    
    // Filtrar alarmas: solo mostrar las que están habilitadas Y cuya hora aún no ha pasado hoy
    const activeAlarms = appState.alarms.filter(alarm => {
        // 1. Mostrar solo alarmas habilitadas
        if (alarm.enabled === false) {
            return false;
        }
        
        // 2. Para alarmas de tipo "once" que ya se ejecutaron, no mostrar
        if (alarm.repeat === 'once' && alarm.lastTriggered) {
            return false;
        }
        
        // 3. Si la hora de la alarma ya pasó hoy, no mostrar
        if (hasAlarmTimePassedToday(alarm)) {
            // Para alarmas repetitivas, la hora ya pasó hoy pero sonará mañana
            // Para alarmas de una vez, si ya pasó la hora y no se ejecutó, tampoco mostrar
            if (alarm.repeat === 'once') {
                return false; // Alarma de una vez que ya pasó y no se ejecutó
            }
            // Para alarmas repetitivas (daily, weekdays, weekends), no mostrar si ya pasó hoy
            // Se mostrarán de nuevo mañana cuando la hora aún no haya pasado
            return false;
        }
        
        return true;
    });
    
    if (activeAlarms.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary);">No hay alarmas configuradas</p>';
        return;
    }
    
    activeAlarms.forEach(alarm => {
        const item = document.createElement('div');
        item.className = 'alarm-item';
        
        item.innerHTML = `
            <div class="alarm-info">
                <div class="alarm-name">${alarm.name}</div>
                <div class="alarm-time">${alarm.time} (${getCityNameFromTimezone(alarm.timezone)}) - ${getRepeatLabel(alarm.repeat)}</div>
            </div>
            <div class="alarm-actions">
                <button class="btn-danger delete-alarm" data-id="${alarm.id}">Eliminar</button>
            </div>
        `;
        
        const deleteBtn = item.querySelector('.delete-alarm');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('¿Eliminar esta alarma?')) {
                    deleteAlarm(alarm.id);
                }
            });
        }
        
        container.appendChild(item);
    });
    
    const hiddenCount = appState.alarms.length - activeAlarms.length;
    console.log(`📋 Mostrando ${activeAlarms.length} de ${appState.alarms.length} alarmas (${hiddenCount} ocultas: deshabilitadas o ya pasaron)`);
}

function getRepeatLabel(repeat) {
    const labels = {
        once: 'Una vez',
        daily: 'Diariamente',
        weekdays: 'Días laborables',
        weekends: 'Fines de semana'
    };
    return labels[repeat] || repeat;
}

function populateAlarmTimezoneSelect() {
    const select = document.getElementById('alarmTimezoneSelect');
    select.innerHTML = '';
    
    appState.timezones.forEach(timezone => {
        const option = document.createElement('option');
        option.value = timezone.timezone;
        option.textContent = `${timezone.name} (${timezone.timezone})`;
        select.appendChild(option);
    });
}

function checkAlarms() {
    const now = new Date();
    if (appState.timeOffset !== 0) {
        now.setTime(now.getTime() + appState.timeOffset);
    }
    
    appState.alarms.forEach(alarm => {
        if (!alarm.enabled) return;
        
        // Verificar si la alarma debe sonar AHORA (dentro del minuto actual)
        // Convertir 'now' a la zona horaria de la alarma para obtener H y M locales
        const options = { 
            timeZone: alarm.timezone, 
            hour12: false, 
            hour: 'numeric', 
            minute: 'numeric' 
        };
        
        // Usar Intl para obtener hora correcta en esa zona
        const formatter = new Intl.DateTimeFormat('en-US', options);
        const parts = formatter.formatToParts(now);
        const nowH = parseInt(parts.find(p => p.type === 'hour').value);
        const nowM = parseInt(parts.find(p => p.type === 'minute').value);
        
        const [alarmH, alarmM] = alarm.time.split(':').map(Number);
        
        // Comparar hora y minuto
        if (nowH === alarmH && nowM === alarmM) {
            console.log(`⏰ Coincidencia de alarma: ${alarm.name} a las ${nowH}:${nowM}`);
            
            // Verificar si ya se disparó en este minuto (para evitar múltiples disparos)
            const lastTriggeredDate = alarm.lastTriggered ? new Date(alarm.lastTriggered) : null;
            
            // Si se disparó hace menos de 60 segundos, ignorar
            if (lastTriggeredDate && (now.getTime() - lastTriggeredDate.getTime() < 60000)) {
                console.log('⏸️ Alarma ya disparada en este minuto - ignorando');
                return;
            }
            
            // Verificar días de repetición
            const dayIndex = new Date(now.toLocaleString('en-US', { timeZone: alarm.timezone })).getDay(); // 0-6
            
            let shouldTrigger = false;
            if (alarm.repeat === 'daily') shouldTrigger = true;
            else if (alarm.repeat === 'once') shouldTrigger = true;
            else if (alarm.repeat === 'weekdays' && dayIndex >= 1 && dayIndex <= 5) shouldTrigger = true;
            else if (alarm.repeat === 'weekends' && (dayIndex === 0 || dayIndex === 6)) shouldTrigger = true;
            
            console.log(`📅 Día de la semana: ${dayIndex}, Repetición: ${alarm.repeat}, Debe disparar: ${shouldTrigger}`);
            
            if (shouldTrigger) {
                console.log(`🚀 Disparando alarma: ${alarm.name}`);
                triggerAlarm(alarm);
            } else {
                console.log(`⏭️ Alarma ${alarm.name} no debe dispararse hoy (día ${dayIndex}, repetición: ${alarm.repeat})`);
            }
        }
    });
}

// La función getNextAlarmTime ya no es necesaria con la nueva lógica robusta
// pero la mantenemos por si se quiere usar para mostrar "Próxima alarma en..."
function getNextAlarmTime(alarm, now) {
    // ... implementación anterior ...
    return null; 
}

// ============================================
// NOTIFICACIONES INTELIGENTES
// ============================================

function isDNDActive() {
    if (appState.dndMode === 'off') return false;
    
    const now = new Date();
    const hour = now.getHours();
    
    if (appState.dndMode === 'night') {
        return hour >= 22 || hour < 7;
    }
    
    return false;
}

// Función para desbloquear audio (usar la función initAudioContext unificada)
function unlockAudio() {
    const ctx = initAudioContext();
    if (ctx && ctx.state === 'suspended') {
        ctx.resume().then(() => {
            console.log('AudioContext activado por usuario');
        }).catch(e => console.error('Error activando audio:', e));
    }
}

function playAlarmSound(soundType, loop = false) {
    if (soundType === 'none') return;
    
    // NO crear nuevos osciladores si se está deteniendo la alarma
    if (appState.isStoppingAlarm) {
        console.log('⏸️ Deteniendo alarma - no se creará nuevo oscilador');
        return;
    }
    
    // Asegurar que el contexto existe
    const ctx = initAudioContext();
    
    if (!ctx) {
        console.error('No se pudo crear AudioContext');
        return;
    }
    
    // Intentar reanudar si está suspendido (pero no si se está deteniendo)
    if (ctx.state === 'suspended' && !appState.isStoppingAlarm) {
        ctx.resume().catch(e => {
            console.log('Error al reanudar AudioContext en playAlarmSound:', e.message);
        });
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Guardar referencia tanto del oscilador como del gainNode para poder detenerlos
    const audioNode = { oscillator, gainNode, context: ctx, stopTime: null };
    appState.activeAlarmOscillators.push(audioNode);
    
    // NO eliminar automáticamente del array cuando termine - queremos poder detenerlo manualmente
    // Solo limpiar si realmente terminó y no fue detenido manualmente
    // NO eliminar automáticamente del array - mantenerlo para poder detenerlo manualmente
    oscillator.onended = () => {
        audioNode.ended = true;
        // NO eliminar del array - stopAlarm() se encargará de limpiarlo
    };
    
    const now = ctx.currentTime;

    // Configurar según el tipo de sonido
    switch(soundType) {
        case 'bell':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(800, now);
            oscillator.frequency.exponentialRampToValueAtTime(100, now + 1.5);
            gainNode.gain.setValueAtTime(0.5, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5);
            oscillator.start(now);
            if (!loop) {
                audioNode.autoStopTime = now + 1.5;
                oscillator.stop(now + 1.5);
            }
            break;
        case 'chime':
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, now); // C5
            gainNode.gain.setValueAtTime(0.5, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
            oscillator.start(now);
            if (!loop) {
                audioNode.autoStopTime = now + 1.0;
                oscillator.stop(now + 1.0);
            }
            break;
        case 'beep':
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(1000, now);
            gainNode.gain.setValueAtTime(0.3, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            oscillator.start(now);
            if (!loop) {
                audioNode.autoStopTime = now + 0.5;
                oscillator.stop(now + 0.5);
            }
            break;
        default:
            // Sonido predeterminado (tipo alarma digital)
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(880, now); // A5
            
            gainNode.gain.setValueAtTime(0.5, now);
            gainNode.gain.setValueAtTime(0, now + 0.1);
            gainNode.gain.setValueAtTime(0.5, now + 0.2);
            gainNode.gain.setValueAtTime(0, now + 0.3);
            gainNode.gain.setValueAtTime(0.5, now + 0.4);
            gainNode.gain.setValueAtTime(0, now + 0.5);
            
            oscillator.start(now);
            if (!loop) {
                audioNode.autoStopTime = now + 0.6;
                oscillator.stop(now + 0.6);
            }
    }
    
    // Guardar referencia del tiempo de inicio para poder cancelar programaciones
    audioNode.startTime = now;
}

function startAlarmLoop(soundType) {
    console.log('🔊 startAlarmLoop llamado con sonido:', soundType);
    
    // Detener cualquier loop anterior PRIMERO
    if (appState.activeAlarmInterval) {
        clearInterval(appState.activeAlarmInterval);
        appState.activeAlarmInterval = null;
        console.log('✅ Loop anterior detenido');
    }
    
    // Limpiar osciladores anteriores
    appState.activeAlarmOscillators.forEach(audioNode => {
        try {
            const osc = audioNode.oscillator;
            const gain = audioNode.gainNode;
            if (osc) {
                try { osc.stop(); } catch (e) {}
                try { osc.disconnect(); } catch (e) {}
            }
            if (gain) {
                try { gain.disconnect(); } catch (e) {}
            }
        } catch (e) {}
    });
    appState.activeAlarmOscillators = [];
    
    // Reproducir inmediatamente
    playAlarmSound(soundType);
    
    // Configurar intervalo para repetir (cada 2 segundos es un buen ritmo para alarma)
    // Esto crea el efecto de "sonido constante" repitiendo el patrón
    appState.activeAlarmInterval = setInterval(() => {
        // Verificar que el intervalo aún esté activo Y que no se esté deteniendo
        if (appState.activeAlarmInterval && !appState.isStoppingAlarm) {
            playAlarmSound(soundType);
            if (appState.vibrationEnabled) {
                vibrateDevice([200, 100, 200, 100, 200]);
            }
        }
    }, 2000);
    
    console.log('✅ Loop de alarma iniciado, intervalo ID:', appState.activeAlarmInterval);
}

async function stopAlarm() {
    console.log('🛑 stopAlarm() llamado');
    console.log('🔍 Estado antes de detener:', {
        activeAlarmInterval: appState.activeAlarmInterval,
        oscillatorsCount: appState.activeAlarmOscillators.length,
        currentActiveAlarm: appState.currentActiveAlarm?.name,
        isStoppingAlarm: appState.isStoppingAlarm
    });
    
    // PRIMERO: Activar bandera para prevenir creación de nuevos osciladores
    appState.isStoppingAlarm = true;
    
    // SEGUNDO: Limpiar intervalo de repetición para evitar que se creen más osciladores
    if (appState.activeAlarmInterval) {
        clearInterval(appState.activeAlarmInterval);
        appState.activeAlarmInterval = null;
        console.log('✅ Intervalo de alarma detenido');
    }
    
    // TERCERO: Obtener el contexto de audio actual (sin forzar reanudación)
    const ctx = globalAudioContext || initAudioContext(false);
    const now = ctx ? ctx.currentTime : 0;
    
    if (!ctx) {
        console.warn('⚠️ No hay AudioContext disponible');
        // Aún así, limpiar todo lo demás
        appState.activeAlarmOscillators = [];
        appState.currentActiveAlarm = null;
        appState.isStoppingAlarm = false;
        return;
    }
    
    // TERCERO: Detener todos los osciladores activos de forma agresiva
    let stoppedCount = 0;
    const oscillatorsToStop = [...appState.activeAlarmOscillators]; // Copia para evitar problemas durante la iteración
    
    console.log(`🔍 Intentando detener ${oscillatorsToStop.length} osciladores activos`);
    
    oscillatorsToStop.forEach((audioNode, index) => {
        try {
            const osc = audioNode.oscillator || audioNode;
            const gain = audioNode.gainNode;
            
            if (!osc) {
                console.log(`⚠️ Oscilador ${index} no válido`);
                return;
            }
            
            // Marcar como detenido manualmente para evitar que onended lo elimine
            audioNode.manuallyStopped = true;
            
            // PRIMERO: Reducir el volumen a 0 inmediatamente (más efectivo que detener)
            if (gain && gain.gain) {
                try {
                    // Cancelar TODAS las programaciones futuras
                    gain.gain.cancelScheduledValues(now);
                    // Establecer volumen a 0 INMEDIATAMENTE
                    gain.gain.setValueAtTime(0, now);
                    // Asegurar que permanezca en 0
                    gain.gain.linearRampToValueAtTime(0, now + 0.001);
                    console.log(`✅ Volumen reducido a 0 para oscilador ${index}`);
                } catch (e) {
                    console.log(`Error al reducir volumen: ${e.message}`);
                    // Intentar método alternativo
                    try {
                        gain.gain.value = 0;
                    } catch (e2) {
                        console.log(`Error al establecer volumen directamente: ${e2.message}`);
                    }
                }
            }
            
            // SEGUNDO: Detener el oscilador inmediatamente - intentar múltiples métodos
            try {
                // Cancelar cualquier programación futura de detención automática
                if (audioNode.autoStopTime && audioNode.autoStopTime > now) {
                    try {
                        // Intentar cancelar la programación de stop
                        // Nota: No hay forma directa de cancelar oscillator.stop(), pero podemos desconectar
                        console.log(`⚠️ Oscilador ${index} tiene stop programado en ${audioNode.autoStopTime}, desconectando...`);
                    } catch (e) {}
                }
                
                // Intentar detener con tiempo actual primero
                if (typeof osc.stop === 'function') {
                    try {
                        // Verificar el estado antes de detener
                        const oscState = osc.state;
                        if (oscState === 'running' || oscState === 'started') {
                            osc.stop(now);
                            stoppedCount++;
                            console.log(`✅ Oscilador ${index} detenido con tiempo (estado: ${oscState})`);
                        } else {
                            // Ya está detenido o en otro estado
                            console.log(`ℹ️ Oscilador ${index} ya estaba en estado: ${oscState}`);
                            stoppedCount++;
                        }
                    } catch (stopError) {
                        // Si falla, intentar sin tiempo
                        try {
                            osc.stop();
                            stoppedCount++;
                            console.log(`✅ Oscilador ${index} detenido sin tiempo`);
                        } catch (stopError2) {
                            // Si aún falla, verificar el estado
                            const oscState = osc.state;
                            console.log(`⚠️ Oscilador ${index} estado: ${oscState}, error: ${stopError2.message}`);
                            // Intentar una última vez con diferentes métodos
                            if (oscState !== 'finished' && oscState !== 'closed') {
                                try {
                                    // Forzar detención desconectando primero
                                    if (osc.disconnect) osc.disconnect();
                                    stoppedCount++;
                                    console.log(`✅ Oscilador ${index} desconectado forzadamente`);
                                } catch (finalError) {
                                    console.log(`❌ No se pudo detener oscilador ${index} completamente: ${finalError.message}`);
                                }
                            } else {
                                stoppedCount++; // Ya estaba detenido
                            }
                        }
                    }
                } else {
                    console.log(`⚠️ Oscilador ${index} no tiene método stop()`);
                    // Intentar desconectar de todas formas
                    if (osc.disconnect) {
                        osc.disconnect();
                        stoppedCount++;
                    }
                }
            } catch (e) {
                console.log(`❌ Error al intentar detener oscilador ${index}: ${e.message}`);
            }
            
            // TERCERO: Desconectar todos los nodos
            try {
                if (osc.disconnect) {
                    osc.disconnect();
                }
                if (gain && gain.disconnect) {
                    gain.disconnect();
                }
                console.log(`✅ Nodos desconectados para oscilador ${index}`);
            } catch (e) {
                console.log(`Error al desconectar: ${e.message}`);
            }
        } catch (e) {
            console.error(`❌ Error crítico al detener nodo ${index}:`, e);
        }
    });
    
    console.log(`✅ ${stoppedCount} de ${oscillatorsToStop.length} osciladores detenidos`);
    
    // Limpiar el array de osciladores completamente
    appState.activeAlarmOscillators = [];
    
    // CUARTO: Detener vibración si está activa
    if ('vibrate' in navigator) {
        navigator.vibrate(0);
        console.log('✅ Vibración detenida');
    }
    
    // QUINTO: Suspender el AudioContext para detener TODO el audio inmediatamente
    // Este es el método más efectivo - detiene todo el audio del contexto
    if (ctx) {
        try {
            // Suspender INMEDIATAMENTE sin importar el estado
            // Esto detiene TODOS los nodos de audio activos
            if (ctx.state === 'running') {
                try {
                    await ctx.suspend();
                    console.log('✅ AudioContext suspendido - TODO el audio detenido inmediatamente');
                } catch (suspendError) {
                    console.log('⚠️ Error al suspender AudioContext:', suspendError.message);
                    // Intentar método alternativo: desconectar todos los nodos
                    try {
                        if (ctx.destination) {
                            // Desconectar todos los nodos conectados al destino
                            ctx.destination.disconnect();
                        }
                    } catch (disconnectError) {
                        console.log('⚠️ Error al desconectar destino:', disconnectError.message);
                    }
                }
            } else if (ctx.state === 'suspended') {
                console.log('✅ AudioContext ya estaba suspendido');
            } else {
                console.log('AudioContext estado:', ctx.state);
            }
            
            // NO reanudar automáticamente - dejar que se reanude cuando sea necesario
            // El usuario puede interactuar para reanudarlo si es necesario
        } catch (e) {
            console.error('❌ Error crítico al suspender AudioContext:', e);
        }
    } else {
        console.warn('⚠️ No hay AudioContext para suspender');
    }
    
    // QUINTO: Eliminar la alarma SOLO si es de tipo "once" (una vez)
    // Las alarmas repetitivas deben permanecer activas para futuras ejecuciones
    if (appState.currentActiveAlarm) {
        const alarm = appState.currentActiveAlarm;
        const alarmId = alarm.id;
        
        // Solo eliminar si es una alarma de una sola vez
        if (alarm.repeat === 'once') {
            console.log('🗑️ Eliminando alarma de una vez:', alarm.name);
            try {
                await deleteAlarm(alarmId);
                console.log('✅ Alarma eliminada correctamente');
            } catch (error) {
                console.error('❌ Error al eliminar la alarma:', error);
            }
        } else {
            console.log('ℹ️ Alarma repetitiva mantenida:', alarm.name, '- tipo:', alarm.repeat);
            // Para alarmas repetitivas, solo deshabilitar temporalmente o mantener activa
            // La alarma seguirá sonando en su próxima hora programada
        }
        
        // Limpiar referencia
        appState.currentActiveAlarm = null;
    }
    
    // SEXTO: Desactivar animación de pulso en el botón
    const stopAlarmBtn = document.getElementById('stopAlarmBtn');
    if (stopAlarmBtn) {
        stopAlarmBtn.classList.remove('active');
    }
    
    // SÉPTIMO: Desactivar bandera después de un delay más largo para asegurar que todo está limpio
    // Esto previene que se reanude el AudioContext accidentalmente
    setTimeout(() => {
        appState.isStoppingAlarm = false;
        console.log('✅ Bandera de detención desactivada - alarma completamente detenida');
        
        // Reanudar AudioContext solo si está suspendido y no hay alarma activa
        if (ctx && ctx.state === 'suspended' && !appState.currentActiveAlarm) {
            ctx.resume().then(() => {
                console.log('✅ AudioContext reanudado para futuras reproducciones');
            }).catch(e => {
                console.log('Error al reanudar AudioContext:', e.message);
            });
        }
    }, 1000); // Aumentar a 1 segundo para asegurar que todo está limpio
    
    console.log('✅ Alarma completamente detenida');
}

function vibrateDevice(pattern = [200, 100, 200]) {
    if (appState.vibrationEnabled && 'vibrate' in navigator) {
        navigator.vibrate(pattern);
    }
}

async function triggerAlarm(alarm) {
    console.log('🔔 triggerAlarm llamado para:', alarm.name);
    
    // Verificar modo No Molestar
    if (isDNDActive()) {
        console.log('Modo No Molestar activo - alarma silenciada');
        return;
    }

    // Guardar referencia de la alarma activa
    appState.currentActiveAlarm = alarm;

    // Marcar como disparada AHORA
    alarm.lastTriggered = new Date().toISOString();
    
    // Activar animación de pulso en el botón cuando hay alarma activa
    const stopAlarmBtn = document.getElementById('stopAlarmBtn');
    if (stopAlarmBtn) {
        stopAlarmBtn.classList.add('active');
        // Asegurar que el botón sea visible y clickeable
        stopAlarmBtn.style.display = 'flex';
        stopAlarmBtn.style.opacity = '1';
        stopAlarmBtn.style.visibility = 'visible';
        stopAlarmBtn.style.pointerEvents = 'auto';
        stopAlarmBtn.style.zIndex = '99999'; // Aumentar z-index al máximo para asegurar que esté por encima
        stopAlarmBtn.style.position = 'fixed'; // Asegurar posición fija
        stopAlarmBtn.style.bottom = '30px';
        stopAlarmBtn.style.right = '30px';
        stopAlarmBtn.style.cursor = 'pointer';
        stopAlarmBtn.style.userSelect = 'none'; // Prevenir selección de texto
        
        // Remover cualquier clase que pueda ocultar el botón
        stopAlarmBtn.classList.remove('hidden');
        
        // Forzar reflow para asegurar que los estilos se apliquen
        stopAlarmBtn.offsetHeight;
        
        // Verificar que el botón tiene los event listeners
        const hasOnclick = stopAlarmBtn.onclick !== null;
        const rect = stopAlarmBtn.getBoundingClientRect();
        
        console.log('✅ Animación de pulso activada en botón "Apagar Alarma"');
        console.log('🔍 Botón configurado:', {
            display: stopAlarmBtn.style.display,
            opacity: stopAlarmBtn.style.opacity,
            zIndex: stopAlarmBtn.style.zIndex,
            pointerEvents: stopAlarmBtn.style.pointerEvents,
            visible: stopAlarmBtn.offsetParent !== null,
            hasOnclick: hasOnclick,
            position: {
                top: rect.top,
                left: rect.left,
                bottom: rect.bottom,
                right: rect.right,
                width: rect.width,
                height: rect.height
            },
            isVisible: rect.width > 0 && rect.height > 0
        });
        
        // Agregar un test visual: cambiar temporalmente el color para confirmar visibilidad
        const originalBg = stopAlarmBtn.style.background;
        stopAlarmBtn.style.background = 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)';
        setTimeout(() => {
            stopAlarmBtn.style.background = originalBg || 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
        }, 500);
        
        // Forzar focus en el botón para asegurar que sea accesible
        try {
            stopAlarmBtn.focus();
        } catch (e) {
            console.log('No se pudo hacer focus en el botón:', e.message);
        }
    } else {
        console.error('❌ No se encontró el botón stopAlarmBtn al activar alarma');
    }
    
    // Reproducir sonido CONSTANTE (loop) - SIEMPRE si está configurado
    if (appState.alarmSound !== 'none') {
        console.log('Reproduciendo sonido de alarma:', appState.alarmSound);
        startAlarmLoop(appState.alarmSound);
    }
    
    // Vibración inicial - SIEMPRE si está habilitada
    if (appState.vibrationEnabled) {
        vibrateDevice([200, 100, 200, 100, 200]);
    }
    
    // Notificaciones del navegador (solo si están habilitadas)
    if (appState.notificationsEnabled) {
        // Solicitar permiso para notificaciones si es necesario
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                console.log('Permiso de notificaciones denegado');
            }
        }
        
        // Intentar usar Service Worker para notificación
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            console.log('Enviando notificación vía Service Worker');
            navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title: `⏰ ${alarm.name}`,
                body: `Es hora de: ${alarm.name}`,
                tag: `alarm-${alarm.id}`,
                icon: './icon-192.png'
            });
        } else {
            console.log('Service Worker no controlado, usando notificación local');
        }

        // Fallback a notificación normal
        if (Notification.permission === 'granted') {
            try {
                const notification = new Notification(`⏰ ${alarm.name}`, {
                    body: `Es hora de: ${alarm.name}`,
                    icon: './icon-192.png',
                    badge: './icon-192.png',
                    tag: `alarm-${alarm.id}`,
                    requireInteraction: true,
                    vibrate: appState.vibrationEnabled ? [200, 100, 200, 100, 200] : undefined,
                    silent: appState.alarmSound === 'none',
                    timestamp: Date.now()
                });
                
                notification.onclick = () => {
                    window.focus();
                    notification.close();
                };
                
                setTimeout(() => {
                    notification.close();
                }, 10000);
                
                console.log('Notificación local disparada');
            } catch (error) {
                console.error('Error al mostrar notificación local:', error);
            }
        } else {
            console.log('Permiso de notificaciones no concedido:', Notification.permission);
        }
    } else {
        console.log('Notificaciones deshabilitadas - solo modal y sonido');
    }
    
    // Si es una alarma de una sola vez, deshabilitarla (pero NO eliminarla todavía)
    // Se eliminará cuando el usuario presione el botón "Apagar Alarma"
    if (alarm.repeat === 'once') {
        alarm.enabled = false;
        console.log('ℹ️ Alarma de una vez deshabilitada (se eliminará al detener)');
    }

    // Guardar cambios (lastTriggered y posible cambio de enabled)
    if (db) {
        const transaction = db.transaction([CONFIG.ALARMS_STORE], 'readwrite');
        const store = transaction.objectStore(CONFIG.ALARMS_STORE);
        store.put(alarm).onsuccess = () => {
            console.log('✅ Alarma actualizada en la base de datos');
        };
    }
    renderAlarms();
}

// ============================================
// SERVICE WORKER
// ============================================

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('Service Worker registrado:', registration.scope);
            })
            .catch(error => {
                console.log('Error al registrar Service Worker:', error);
            });
    }
}

// ============================================
// UTILIDADES
// ============================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ============================================
// VISUALIZACIONES AVANZADAS
// ============================================

function switchView(view) {
    appState.currentView = view;
    saveConfig();
    
    // Actualizar botones activos
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    
    // Ocultar todas las vistas
    document.getElementById('timezonesContainer').classList.add('hidden');
    document.getElementById('mapView').classList.add('hidden');
    document.getElementById('compareView').classList.add('hidden');
    
    // Mostrar vista seleccionada
    switch(view) {
        case 'cards':
            document.getElementById('cardViewBtn').classList.add('active');
            document.getElementById('timezonesContainer').classList.remove('hidden');
            break;
        case 'map':
            document.getElementById('mapViewBtn').classList.add('active');
            document.getElementById('mapView').classList.remove('hidden');
            renderMapView();
            break;
        case 'compare':
            document.getElementById('compareViewBtn').classList.add('active');
            document.getElementById('compareView').classList.remove('hidden');
            renderCompareView();
            break;
    }
}

// Coordenadas en grados (longitud, latitud) convertidas a coordenadas SVG (360x180)
const TIMEZONE_COORDINATES = {
    'America/Mexico_City': { lon: -99.13, lat: 19.43, name: 'Ciudad de México' },
    'America/New_York': { lon: -74.01, lat: 40.71, name: 'Nueva York' },
    'America/Los_Angeles': { lon: -118.24, lat: 34.05, name: 'Los Ángeles' },
    'America/Chicago': { lon: -87.63, lat: 41.88, name: 'Chicago' },
    'America/Denver': { lon: -104.99, lat: 39.74, name: 'Denver' },
    'America/Argentina/Buenos_Aires': { lon: -58.38, lat: -34.60, name: 'Buenos Aires' },
    'America/Sao_Paulo': { lon: -46.63, lat: -23.55, name: 'São Paulo' },
    'America/Lima': { lon: -77.04, lat: -12.05, name: 'Lima' },
    'Europe/London': { lon: -0.13, lat: 51.51, name: 'Londres' },
    'Europe/Paris': { lon: 2.35, lat: 48.86, name: 'París' },
    'Europe/Madrid': { lon: -3.70, lat: 40.42, name: 'Madrid' },
    'Europe/Berlin': { lon: 13.41, lat: 52.52, name: 'Berlín' },
    'Europe/Rome': { lon: 12.50, lat: 41.90, name: 'Roma' },
    'Europe/Moscow': { lon: 37.62, lat: 55.75, name: 'Moscú' },
    'Asia/Tokyo': { lon: 139.69, lat: 35.69, name: 'Tokio' },
    'Asia/Shanghai': { lon: 121.47, lat: 31.23, name: 'Shanghai' },
    'Asia/Dubai': { lon: 55.27, lat: 25.20, name: 'Dubái' },
    'Asia/Delhi': { lon: 77.21, lat: 28.61, name: 'Delhi' },
    'Asia/Hong_Kong': { lon: 114.16, lat: 22.28, name: 'Hong Kong' },
    'Asia/Singapore': { lon: 103.85, lat: 1.30, name: 'Singapur' },
    'Australia/Sydney': { lon: 151.21, lat: -33.87, name: 'Sídney' },
    'Australia/Melbourne': { lon: 144.96, lat: -37.81, name: 'Melbourne' },
    'Pacific/Auckland': { lon: 174.76, lat: -36.85, name: 'Auckland' },
};

function lonLatToSVG(lon, lat) {
    // Convertir a coordenadas SVG (1000x500) con proyección simplificada
    // Ajustar para mejor visualización en el mapa
    const x = ((lon + 180) / 360) * 1000;
    // Convertir latitud con ajuste para proyección
    const y = ((90 - lat) / 180) * 500;
    return { x, y };
}

function getTimezoneCoordinates(timezone) {
    // Buscar coordenadas exactas
    if (TIMEZONE_COORDINATES[timezone]) {
        const coords = TIMEZONE_COORDINATES[timezone];
        const svgCoords = lonLatToSVG(coords.lon, coords.lat);
        return { ...svgCoords, name: coords.name };
    }
    
    // Buscar por coincidencia parcial
    for (const [tz, coords] of Object.entries(TIMEZONE_COORDINATES)) {
        const tzPart = tz.split('/').pop();
        const searchPart = timezone.split('/').pop();
        if (timezone.includes(tzPart) || tz.includes(searchPart)) {
            const svgCoords = lonLatToSVG(coords.lon, coords.lat);
            return { ...svgCoords, name: coords.name };
        }
    }
    
    // Coordenadas por defecto (centro del océano Pacífico)
    return { x: 180, y: 90, name: timezone.split('/').pop().replace(/_/g, ' ') };
}

let mapInstance = null;

function renderMapView() {
    const container = document.getElementById('mapContainer');
    container.innerHTML = '';
    
    if (appState.timezones.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">No hay zonas horarias configuradas</p>';
        return;
    }
    
    // Verificar que Leaflet esté cargado
    if (typeof L === 'undefined') {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Cargando biblioteca de mapas... Por favor espera.</p>';
        // Reintentar después de un momento
        setTimeout(() => {
            if (typeof L !== 'undefined') {
                renderMapView();
            } else {
                container.innerHTML = '<p style="color: var(--danger); text-align: center; padding: 40px;">Error: No se pudo cargar la biblioteca de mapas. Por favor recarga la página.</p>';
            }
        }, 1000);
        return;
    }
    
    // Crear contenedor para el mapa
    const mapDiv = document.createElement('div');
    mapDiv.id = 'leafletMap';
    mapDiv.style.width = '100%';
    mapDiv.style.height = '500px';
    mapDiv.style.borderRadius = '10px';
    mapDiv.style.overflow = 'hidden';
    mapDiv.style.position = 'relative';
    container.appendChild(mapDiv);
    
    // Pequeño delay para asegurar que el DOM esté listo
    setTimeout(() => {
        try {
            // Destruir mapa anterior si existe
            if (mapInstance) {
                mapInstance.remove();
                mapInstance = null;
            }
            
            // Inicializar mapa Leaflet
            mapInstance = L.map('leafletMap', {
                zoomControl: true,
                attributionControl: true,
                scrollWheelZoom: true,
                doubleClickZoom: true,
                boxZoom: true,
                keyboard: true,
                dragging: true,
            });
            
            // Agregar capa de OpenStreetMap
            const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
            const tileUrl = isDarkMode 
                ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
            
            const attribution = isDarkMode
                ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
            
            L.tileLayer(tileUrl, {
                attribution: attribution,
                maxZoom: 19,
            }).addTo(mapInstance);
            
            // Observar cambios de tema para actualizar el mapa
            const themeObserver = new MutationObserver(() => {
                const currentTheme = document.documentElement.getAttribute('data-theme');
                if (mapInstance) {
                    mapInstance.eachLayer(layer => {
                        if (layer instanceof L.TileLayer) {
                            if (currentTheme === 'dark') {
                                layer.setUrl('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
                                layer.options.attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
                            } else {
                                layer.setUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
                                layer.options.attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
                            }
                        }
                    });
                }
            });
            
            themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
            
            const now = new Date();
    if (appState.timeOffset !== 0) {
        now.setTime(now.getTime() + appState.timeOffset);
    }
    
    // Agregar marcadores para cada zona horaria
    const markers = [];
    const bounds = [];
    
    appState.timezones.forEach((timezone) => {
        const time = formatTimeForTimezone(now, timezone.timezone);
        const offset = getTimezoneOffset(timezone.timezone);
        
        // Obtener coordenadas lat/lon directamente
        let lat, lon, cityName;
        if (TIMEZONE_COORDINATES[timezone.timezone]) {
            lat = TIMEZONE_COORDINATES[timezone.timezone].lat;
            lon = TIMEZONE_COORDINATES[timezone.timezone].lon;
            cityName = TIMEZONE_COORDINATES[timezone.timezone].name;
        } else {
            // Buscar por coincidencia parcial
            let found = false;
            for (const [tz, coords] of Object.entries(TIMEZONE_COORDINATES)) {
                const tzPart = tz.split('/').pop();
                const searchPart = timezone.timezone.split('/').pop();
                if (timezone.timezone.includes(tzPart) || tz.includes(searchPart)) {
                    lat = coords.lat;
                    lon = coords.lon;
                    cityName = coords.name;
                    found = true;
                    break;
                }
            }
            // Coordenadas por defecto (centro del océano Pacífico)
            if (!found) {
                lat = 0;
                lon = -180;
                cityName = timezone.name;
            }
        }
        
        // Crear icono personalizado
        const customIcon = L.divIcon({
            className: 'custom-marker',
            html: `
                <div class="leaflet-marker-pin">
                    <div class="marker-pulse"></div>
                    <div class="marker-circle"></div>
                </div>
            `,
            iconSize: [20, 30],
            iconAnchor: [10, 30],
            popupAnchor: [0, -30],
        });
        
        // Crear marcador
        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(mapInstance);
        
        // Agregar popup con información
        const popupContent = `
            <div class="map-popup">
                <div class="popup-city">${timezone.name}</div>
                <div class="popup-time">${time}</div>
                <div class="popup-offset">${offset}</div>
            </div>
        `;
        marker.bindPopup(popupContent, {
            className: 'custom-popup',
            closeButton: true,
            maxWidth: 200,
        });
        
        // Hacer clic en marcador para centrar el mapa
        marker.on('click', () => {
            mapInstance.setView([lat, lon], Math.max(mapInstance.getZoom(), 5));
        });
        
        markers.push(marker);
        bounds.push([lat, lon]);
    });
    
            // Ajustar vista para mostrar todos los marcadores
            if (bounds.length > 0) {
                const group = new L.featureGroup(markers);
                mapInstance.fitBounds(group.getBounds().pad(0.2));
            } else {
                // Vista por defecto (centro del mundo)
                mapInstance.setView([20, 0], 2);
            }
            
            // Agregar leyenda
            const legend = document.createElement('div');
            legend.className = 'map-legend';
            legend.innerHTML = `
                <div class="legend-title">Zonas Horarias</div>
                <div class="legend-items">
                    ${appState.timezones.map(tz => {
                        const time = formatTimeForTimezone(now, tz.timezone);
                        return `
                            <div class="legend-item" data-timezone-id="${tz.id}">
                                <span class="legend-marker"></span>
                                <span class="legend-name">${tz.name}</span>
                                <span class="legend-time">${time}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
            container.appendChild(legend);
            
        } catch (error) {
            console.error('Error al inicializar el mapa:', error);
            container.innerHTML = `<p style="color: var(--danger); text-align: center; padding: 40px;">Error al cargar el mapa: ${error.message}</p>`;
        }
    }, 100);
}

// Las funciones showMapTooltip y hideMapTooltip ya no son necesarias
// Leaflet maneja los popups automáticamente

function renderCompareView() {
    const container = document.getElementById('compareContainer');
    container.innerHTML = '';
    
    if (appState.timezones.length < 2) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 40px;">Necesitas al menos 2 zonas horarias para comparar</p>';
        return;
    }
    
    const now = new Date();
    if (appState.timeOffset !== 0) {
        now.setTime(now.getTime() + appState.timeOffset);
    }
    
    // Crear tabla de comparación
    const table = document.createElement('table');
    table.className = 'compare-table';
    
    // Encabezado
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th>Ciudad</th>
            <th>Hora</th>
            <th>Fecha</th>
            <th>UTC Offset</th>
            <th>Diferencia</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Cuerpo
    const tbody = document.createElement('tbody');
    const baseTimezone = appState.timezones[0];
    const baseTime = new Date(now.toLocaleString('en-US', { timeZone: baseTimezone.timezone }));
    
    appState.timezones.forEach((timezone, index) => {
        const time = formatTimeForTimezone(now, timezone.timezone);
        const date = formatDateForTimezone(now, timezone.timezone);
        const offset = getTimezoneOffset(timezone.timezone);
        
        // Calcular diferencia con la primera zona
        const tzTime = new Date(now.toLocaleString('en-US', { timeZone: timezone.timezone }));
        const diffMs = tzTime - baseTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        const diffText = index === 0 ? '-' : `${diffHours >= 0 ? '+' : ''}${diffHours.toFixed(1)}h`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${timezone.name}</strong></td>
            <td>${time}</td>
            <td>${date}</td>
            <td>${offset}</td>
            <td>${diffText}</td>
        `;
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);
    container.appendChild(table);
}

// ============================================
// LAZY LOADING Y MEJORAS DE RENDIMIENTO
// ============================================

function lazyLoadTimezone(timezoneId) {
    if (appState.loadedTimezones.has(timezoneId)) {
        return;
    }
    
    // Marcar como cargado
    appState.loadedTimezones.add(timezoneId);
    
    // Usar requestIdleCallback si está disponible para mejor rendimiento
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            updateTimezoneCard(timezoneId);
        });
    } else {
        setTimeout(() => {
            updateTimezoneCard(timezoneId);
        }, 0);
    }
}

function updateTimezoneCard(timezoneId) {
    const card = document.querySelector(`[data-timezone-id="${timezoneId}"]`);
    if (!card) return;
    
    const timezone = appState.timezones.find(tz => tz.id === timezoneId);
    if (!timezone) return;
    
    // Actualizar solo si es visible (Intersection Observer)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const now = new Date();
                if (appState.timeOffset !== 0) {
                    now.setTime(now.getTime() + appState.timeOffset);
                }
                
                const timeDisplay = card.querySelector('.time-display');
                const dateDisplay = card.querySelector('.date-display');
                
                if (timeDisplay) {
                    timeDisplay.textContent = formatTimeForTimezone(now, timezone.timezone);
                }
                if (dateDisplay) {
                    dateDisplay.textContent = formatDateForTimezone(now, timezone.timezone);
                }
            }
        });
    }, { threshold: 0.1 });
    
    observer.observe(card);
}

// Solicitar permiso de notificaciones al cargar
if ('Notification' in window && Notification.permission === 'default') {
    // No solicitamos inmediatamente, lo haremos cuando se cree una alarma
}

