const { Jimp } = require('jimp');

async function run() {
  try {
    const img1 = await Jimp.read('assets/images/logo.png');
    console.log('logo.png:', img1.width, 'x', img1.height);
    
    const img2 = await Jimp.read('assets/images/epictoyz-logo.png');
    console.log('epictoyz-logo.png:', img2.width, 'x', img2.height);
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
