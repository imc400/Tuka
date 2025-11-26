const sharp = require('sharp');
const path = require('path');

async function trimImage() {
  const inputPath = path.join(__dirname, '../assets/grumo-isotipo-logo-negro.png');
  const outputPath = path.join(__dirname, '../assets/grumo-header-logo.png');
  
  try {
    // Leer imagen y recortar espacios transparentes/blancos
    await sharp(inputPath)
      .trim({
        threshold: 10
      })
      .toFile(outputPath);
    
    // Obtener dimensiones del resultado
    const metadata = await sharp(outputPath).metadata();
    console.log(`✅ Imagen recortada: ${metadata.width}x${metadata.height}`);
    console.log(`   Guardada en: ${outputPath}`);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

trimImage();
