const { Jimp } = require('jimp');
const path = require('path');
const fs = require('fs');

async function run() {
  try {
    console.log('Generating SEO assets...');

    // 1. Load square logo
    const squareLogo = await Jimp.read('assets/images/logo.png');
    console.log('Loaded square logo:', squareLogo.width, 'x', squareLogo.height);

    // 2. Generate favicon.png (32x32)
    const favicon = squareLogo.clone();
    favicon.resize({ w: 32, h: 32 });
    await favicon.write('favicon.png');
    console.log('Generated favicon.png (32x32)');

    // Copy to favicon.ico
    fs.copyFileSync('favicon.png', 'favicon.ico');
    console.log('Copied favicon.png to favicon.ico');

    // 3. Generate apple-touch-icon.png (180x180)
    const appleTouchIcon = squareLogo.clone();
    appleTouchIcon.resize({ w: 180, h: 180 });
    await appleTouchIcon.write('apple-touch-icon.png');
    console.log('Generated apple-touch-icon.png (180x180)');

    // 4. Generate og-image.jpg (1200x630)
    // Create opaque black background
    const bg = new Jimp({ width: 1200, height: 630, color: 0x000000FF });
    
    // Load rectangular logo
    const rectLogo = await Jimp.read('assets/images/epictoyz-logo.png');
    console.log('Loaded rectangular logo:', rectLogo.width, 'x', rectLogo.height);

    // Resize rectangular logo to fit nicely in 1200x630 (e.g. 1000x500)
    rectLogo.resize({ w: 1000, h: 500 });
    
    // Calculate center coordinates
    const x = Math.round((1200 - 1000) / 2);
    const y = Math.round((630 - 500) / 2);
    
    // Composite logo onto background
    bg.composite(rectLogo, x, y);
    
    // Write as JPG
    await bg.write('og-image.jpg');
    console.log('Generated og-image.jpg (1200x630)');
    
    console.log('All SEO assets generated successfully!');
  } catch (err) {
    console.error('Error generating assets:', err.message || err);
    if (err.stack) console.error(err.stack);
  }
}

run();
