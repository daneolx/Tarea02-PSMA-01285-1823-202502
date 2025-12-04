#!/bin/bash
echo "Abriendo generador de iconos en el navegador..."
echo ""
echo "Una vez que se abra la página:"
echo "1. Haz clic en 'Generar y Descargar Ambos'"
echo "2. Los iconos se descargarán automáticamente"
echo "3. Mueve icon-192.png e icon-512.png a la carpeta del proyecto"
echo ""

# Intentar abrir con el navegador predeterminado
if command -v xdg-open &> /dev/null; then
    xdg-open generate-icons.html
elif command -v open &> /dev/null; then
    open generate-icons.html
else
    echo "Por favor abre generate-icons.html manualmente en tu navegador"
fi

