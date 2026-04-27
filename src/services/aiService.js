let pdfjsLib = null;
async function getPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import('pdfjs-dist');
    const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.js?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  return pdfjsLib;
}

export const extractTextFromFile = async (file) => {
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('El archivo es demasiado grande (máx. 10 MB). Comprime el PDF e inténtalo de nuevo.');
  }
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('El PDF tardó demasiado en procesarse. Prueba con otro archivo.')), 30000),
    );
    const extract = async () => {
      const pdfjs = await getPdfjs();
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument(arrayBuffer).promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item) => item.str).join(' ') + '\n';
      }
      return text;
    };
    return await Promise.race([extract(), timeout]);
  } else {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
};
