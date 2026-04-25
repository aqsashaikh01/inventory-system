const QRCode = require('qrcode');

const generateQRDataURL = async (sku, appUrl) => {
  const scanUrl = `${appUrl}/scan/${sku}`;
  const dataUrl = await QRCode.toDataURL(scanUrl, {
    width: 300,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' }
  });
  return { scanUrl, dataUrl };
};

module.exports = { generateQRDataURL };