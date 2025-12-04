#!/usr/bin/env python3
"""
Script para generar iconos de la PWA Reloj Digital Inteligente
Requiere: pip install Pillow
"""

try:
    from PIL import Image, ImageDraw, ImageFont
    import math
    import os
except ImportError:
    print("Pillow no está instalado. Instálalo con: pip install Pillow")
    print("\nO usa el método del navegador:")
    print("1. Abre generate-icons.html en tu navegador")
    print("2. Haz clic en 'Generar y Descargar Ambos'")
    exit(1)

def draw_clock(draw, size):
    """Dibuja un reloj en el canvas"""
    center_x = size / 2
    center_y = size / 2
    radius = size * 0.35
    
    # Fondo del reloj (círculo blanco)
    draw.ellipse(
        [center_x - radius, center_y - radius, 
         center_x + radius, center_y + radius],
        fill='white', outline='#667eea', width=int(size * 0.03)
    )
    
    # Marcas de horas
    for i in range(12):
        angle = (i * math.pi * 2 / 12) - math.pi / 2
        start_radius = radius * 0.75
        end_radius = radius * 0.9
        
        start_x = center_x + math.cos(angle) * start_radius
        start_y = center_y + math.sin(angle) * start_radius
        end_x = center_x + math.cos(angle) * end_radius
        end_y = center_y + math.sin(angle) * end_radius
        
        draw.line(
            [start_x, start_y, end_x, end_y],
            fill='#333333', width=int(size * 0.015)
        )
    
    # Manecilla de horas (apunta a las 3)
    hour_angle = (3 * math.pi * 2 / 12) - math.pi / 2
    hour_length = radius * 0.5
    hour_end_x = center_x + math.cos(hour_angle) * hour_length
    hour_end_y = center_y + math.sin(hour_angle) * hour_length
    draw.line(
        [center_x, center_y, hour_end_x, hour_end_y],
        fill='#333333', width=int(size * 0.02)
    )
    
    # Manecilla de minutos (apunta a las 12)
    minute_length = radius * 0.7
    minute_end_x = center_x
    minute_end_y = center_y - minute_length
    draw.line(
        [center_x, center_y, minute_end_x, minute_end_y],
        fill='#667eea', width=int(size * 0.015)
    )
    
    # Centro del reloj
    center_radius = size * 0.03
    draw.ellipse(
        [center_x - center_radius, center_y - center_radius,
         center_x + center_radius, center_y + center_radius],
        fill='#667eea'
    )

def create_gradient_background(size):
    """Crea un fondo con gradiente"""
    # Crear imagen base
    img = Image.new('RGB', (size, size), color='#667eea')
    draw = ImageDraw.Draw(img)
    
    # Dibujar gradiente (simulado con múltiples rectángulos)
    steps = 100
    for i in range(steps):
        y = int(size * i / steps)
        # Interpolar entre #667eea y #764ba2
        r1, g1, b1 = 0x66, 0x7e, 0xea
        r2, g2, b2 = 0x76, 0x4b, 0xa2
        
        ratio = i / steps
        r = int(r1 + (r2 - r1) * ratio)
        g = int(g1 + (g2 - g1) * ratio)
        b = int(b1 + (b2 - b1) * ratio)
        
        color = f'#{r:02x}{g:02x}{b:02x}'
        draw.rectangle([0, y, size, y + size // steps], fill=color)
    
    return img

def generate_icon(size):
    """Genera un icono del tamaño especificado"""
    # Crear imagen con fondo gradiente
    img = create_gradient_background(size)
    draw = ImageDraw.Draw(img)
    
    # Dibujar reloj
    draw_clock(draw, size)
    
    return img

def main():
    print("Generando iconos para la PWA...")
    
    sizes = [192, 512]
    
    for size in sizes:
        print(f"Generando icon-{size}.png...", end=" ")
        icon = generate_icon(size)
        icon.save(f'icon-{size}.png', 'PNG')
        print("OK")
    
    print("\n¡Iconos generados exitosamente!")
    print("Archivos creados:")
    for size in sizes:
        if os.path.exists(f'icon-{size}.png'):
            file_size = os.path.getsize(f'icon-{size}.png')
            print(f"  - icon-{size}.png ({file_size} bytes)")

if __name__ == '__main__':
    main()

