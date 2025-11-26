const sharp = require('sharp');
const path = require('path');

async function trimImage(inputFile, outputFile) {
  const inputPath = path.join(__dirname, '../assets', inputFile);
  const outputPath = path.join(__dirname, '../assets', outputFile);
  
  try {
    await sharp(inputPath)
      .trim({ threshold: 10 })
      .toFile(outputPath);
    
    const metadata = await sharp(outputPath).metadata();
    console.log(`✅ ${inputFile} → ${outputFile}: ${metadata.width}x${metadata.height}`);
  } catch (err) {
    console.error(`❌ ${inputFile}: ${err.message}`);
  }
}

async function main() {
  // Recortar isotipo (cuadrado, centrado)
  await trimImage('grumo-isotipo.png', 'grumo-isotipo-trimmed.png');
  
  // Recortar logo negro (horizontal)
  await trimImage('grumo-logo-negro.png', 'grumo-logo-negro-trimmed.png');
  
  console.log('\n✅ Logos recortados!');
}

main();
