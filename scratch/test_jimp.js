const { Jimp } = require('jimp');
const img = new Jimp({ width: 10, height: 10, color: 0xFF0000FF });
async function test() {
  try {
    const buf1 = await img.getBuffer('image/jpeg');
    const buf2 = await img.getBuffer('image/jpeg', { quality: 10 });
    console.log('Buf1 size:', buf1.length);
    console.log('Buf2 size:', buf2.length);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
test();
