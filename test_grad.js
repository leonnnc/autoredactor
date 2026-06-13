import pptxgen from "pptxgenjs";

const pres = new pptxgen();
const slide = pres.addSlide();

// Gradient via shape
slide.addShape(pres.ShapeType.rect, {
  x: 0, y: 0, w: '100%', h: '100%',
  fill: { type: 'gradient', color: 'FF0000', alpha: 100, color2: '0000FF', alpha2: 100, angle: 90 }
});

pres.writeFile({ fileName: 'test_grad.pptx' })
  .then(() => console.log('OK'))
  .catch(e => console.error(e));
