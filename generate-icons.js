// Script para generar iconos de la PWA
// Requiere: npm install canvas (o usar el generador HTML)

const fs = require('fs');
const path = require('path');

// Función para crear un icono SVG que luego convertiremos
function createIconSVG(size) {
    const center = size / 2;
    const radius = size * 0.35;
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>
  <circle cx="${center}" cy="${center}" r="${radius}" fill="white" stroke="#667eea" stroke-width="${size * 0.03}"/>
  <!-- Marcas de horas -->
  ${Array.from({length: 12}, (_, i) => {
    const angle = (i * Math.PI * 2 / 12) - Math.PI / 2;
    const startX = center + Math.cos(angle) * (radius * 0.75);
    const startY = center + Math.sin(angle) * (radius * 0.75);
    const endX = center + Math.cos(angle) * (radius * 0.9);
    const endY = center + Math.sin(angle) * (radius * 0.9);
    return `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="#333" stroke-width="${size * 0.015}"/>`;
  }).join('\n  ')}
  <!-- Manecilla de horas (3:00) -->
  <line x1="${center}" y1="${center}" 
        x2="${center + Math.cos((3 * Math.PI * 2 / 12) - Math.PI / 2) * radius * 0.5}" 
        y2="${center + Math.sin((3 * Math.PI * 2 / 12) - Math.PI / 2) * radius * 0.5}" 
        stroke="#333" stroke-width="${size * 0.02}" stroke-linecap="round"/>
  <!-- Manecilla de minutos (12:00) -->
  <line x1="${center}" y1="${center}" 
        x2="${center}" 
        y2="${center - radius * 0.7}" 
        stroke="#667eea" stroke-width="${size * 0.015}" stroke-linecap="round"/>
  <!-- Centro -->
  <circle cx="${center}" cy="${center}" r="${size * 0.03}" fill="#667eea"/>
</svg>`;
}

console.log('Para generar los iconos PNG, usa el archivo generate-icons.html en tu navegador.');
console.log('O instala canvas: npm install canvas');
console.log('');
console.log('Los iconos SVG se pueden generar, pero para PWA necesitas PNG.');

// Si tienen canvas instalado, generar PNGs
try {
    const { createCanvas } = require('canvas');
    
    function drawClock(ctx, size) {
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size * 0.35;

        // Fondo del reloj (círculo blanco)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Borde del reloj
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = size * 0.03;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Marcas de horas
        ctx.strokeStyle = '#333';
        ctx.lineWidth = size * 0.015;
        for (let i = 0; i < 12; i++) {
            const angle = (i * Math.PI * 2 / 12) - Math.PI / 2;
            const startX = centerX + Math.cos(angle) * (radius * 0.75);
            const startY = centerY + Math.sin(angle) * (radius * 0.75);
            const endX = centerX + Math.cos(angle) * (radius * 0.9);
            const endY = centerY + Math.sin(angle) * (radius * 0.9);
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }

        // Manecillas (mostrando las 3:00)
        ctx.strokeStyle = '#333';
        ctx.lineWidth = size * 0.02;
        ctx.lineCap = 'round';

        // Manecilla de horas (apunta a las 3)
        const hourAngle = (3 * Math.PI * 2 / 12) - Math.PI / 2;
        const hourLength = radius * 0.5;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(hourAngle) * hourLength,
            centerY + Math.sin(hourAngle) * hourLength
        );
        ctx.stroke();

        // Manecilla de minutos (apunta a las 12)
        const minuteAngle = -Math.PI / 2;
        const minuteLength = radius * 0.7;
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = size * 0.015;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(minuteAngle) * minuteLength,
            centerY + Math.sin(minuteAngle) * minuteLength
        );
        ctx.stroke();

        // Centro del reloj
        ctx.fillStyle = '#667eea';
        ctx.beginPath();
        ctx.arc(centerX, centerY, size * 0.03, 0, Math.PI * 2);
        ctx.fill();
    }

    function generateIcon(size) {
        const canvas = createCanvas(size, size);
        const ctx = canvas.getContext('2d');

        // Fondo con gradiente
        const gradient = ctx.createLinearGradient(0, 0, size, size);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        // Dibujar reloj
        drawClock(ctx, size);

        return canvas;
    }

    // Generar iconos
    [192, 512].forEach(size => {
        const canvas = generateIcon(size);
        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(`icon-${size}.png`, buffer);
        console.log(`✓ Generado icon-${size}.png`);
    });

    console.log('\n¡Iconos generados exitosamente!');
} catch (e) {
    console.log('Canvas no está instalado. Usa el método del navegador:');
    console.log('1. Abre generate-icons.html en tu navegador');
    console.log('2. Haz clic en "Generar y Descargar Ambos"');
    console.log('3. Los iconos se descargarán automáticamente');
}

