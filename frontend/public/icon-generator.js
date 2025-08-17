// Generar iconos PNG usando Canvas
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function createIcon(size, filename) {
    canvas.width = size;
    canvas.height = size;
    
    // Crear gradiente
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#ec4899');
    gradient.addColorStop(1, '#3b82f6');
    
    // Fondo con esquinas redondeadas
    ctx.fillStyle = gradient;
    ctx.roundRect(0, 0, size, size, size * 0.25);
    ctx.fill();
    
    // Emoji corazón
    ctx.font = `${size * 0.5}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'white';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = size * 0.02;
    ctx.fillText('💕', size/2, size/2);
    
    // Descargar
    canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
    });
}

// Generar iconos
createIcon(192, 'icon-192x192.png');
createIcon(512, 'icon-512x512.png');