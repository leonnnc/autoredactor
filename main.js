import pptxgen from "pptxgenjs";

window.onerror = function(message, source, lineno, colno, error) {
  alert("ERROR DETECTADO: " + message + " en linea " + lineno);
};
window.addEventListener("unhandledrejection", function(event) {
  alert("PROMESA RECHAZADA: " + event.reason);
});

// DOM Elements
const editor = document.getElementById("editor");
const slidePreview = document.getElementById("slide-preview");
const slideContent = document.getElementById("slide-content");
const btnPrev = document.getElementById("btn-prev");
const btnNext = document.getElementById("btn-next");
const slideIndicator = document.getElementById("slide-indicator");
const fontFamilySelect = document.getElementById("font-family");
const fontSizeInput = document.getElementById("font-size");
const fontSizeVal = document.getElementById("font-size-val");
const bgUpload = document.getElementById("bg-upload");
const bgPresets = document.getElementById("bg-presets");
const clearBgBtn = document.getElementById("clear-bg-btn");
const downloadBtn = document.getElementById("download-btn");

// Bible Search Elements
const bibleSearchInput = document.getElementById("bible-search-input");
const bibleSearchBtn = document.getElementById("bible-search-btn");
const bibleSearchResult = document.getElementById("bible-search-result");
const bibleInsertBtn = document.getElementById("bible-insert-btn");
const slideFormatSelect = document.getElementById("slide-format");

// Individual Slide Controls
const slideValignSelect = document.getElementById("slide-valign");
const slideOffsetInput = document.getElementById("slide-offset");
const slideOffsetVal = document.getElementById("slide-offset-val");

// App State
let state = {
  slides: [], // now an array of objects: { id, text, valign, offsetY }
  currentSlideIdx: 0,
  fontFamily: "'Inter', sans-serif",
  fontSize: 32,
  bgColor: "#1a1a2e",
  bgImage: null,
  layoutRatio: "16/9"
};

// --- LOGIC: Parsing ---

function parseTextToSlides(rawText) {
  if (!rawText.trim()) return [];
  const generatedSlides = [];
  
  const blocks = rawText.split(/\n\s*\n/);
  
  const verseRegexWithParen = /\(\s*(\d?\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s+(\d+:\d+(?:-\d+)?)\s+"([^"]+)"\s*\)/gi;
  const verseRegexNoParen = /^(\d?\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s+(\d+:\d+(?:-\d+)?)\s+"([^"]+)"/gi;

  blocks.forEach(block => {
    block = block.trim();
    if (!block) return;

    let isVerse = false;
    let formattedText = block;

    let match = verseRegexWithParen.exec(block);
    if (match) {
      isVerse = true;
      formattedText = `"${match[3]}"\n- ${match[1]} ${match[2]}`;
      verseRegexWithParen.lastIndex = 0;
    } else {
      match = verseRegexNoParen.exec(block);
      if (match) {
        isVerse = true;
        formattedText = `"${match[3]}"\n- ${match[1]} ${match[2]}`;
        verseRegexNoParen.lastIndex = 0;
      }
    }

    if (isVerse) {
      generatedSlides.push(formattedText);
    } else {
      const lines = block.split('\n');
      let currentChunk = [];
      
      lines.forEach(line => {
        if (line.length > 70) {
          const words = line.split(' ');
          let tempLine = "";
          words.forEach(w => {
            if ((tempLine + w).length > 70) {
              currentChunk.push(tempLine.trim());
              tempLine = w + " ";
              if (currentChunk.length >= 4) {
                generatedSlides.push(currentChunk.join('\n'));
                currentChunk = [];
              }
            } else {
              tempLine += w + " ";
            }
          });
          if (tempLine.trim()) currentChunk.push(tempLine.trim());
        } else {
          currentChunk.push(line);
        }

        if (currentChunk.length >= 4) {
          generatedSlides.push(currentChunk.join('\n'));
          currentChunk = [];
        }
      });

      if (currentChunk.length > 0) {
        generatedSlides.push(currentChunk.join('\n'));
      }
    }
  });

  return generatedSlides;
}

// --- LOGIC: UI Update ---

let previewObserver = null;

function applySlideRatio() {
  const ratioStr = state.layoutRatio || "16/9";
  const parts = ratioStr.split('/');
  const ratio = parseFloat(parts[0]) / parseFloat(parts[1]);
  
  const container = document.querySelector('.preview-container');
  if (!container) return;

  if (previewObserver) previewObserver.disconnect();
  
  previewObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
      const cw = entry.contentRect.width;
      const ch = entry.contentRect.height;
      let w = cw;
      let h = cw / ratio;
      
      if (h > ch) {
        h = ch;
        w = ch * ratio;
      }
      
      slidePreview.style.width = `${w}px`;
      slidePreview.style.height = `${h}px`;
      slidePreview.style.setProperty("width", `${w}px`, "important");
      slidePreview.style.setProperty("height", `${h}px`, "important");
    }
  });
  
  previewObserver.observe(container);
}

// Observar el contenedor ya no es estrictamente necesario para el cálculo
// pero lo dejamos vacío o lo limpiamos.
function updatePreview() {
  applySlideRatio();
  
  if (state.slides.length === 0) {
    slideContent.innerText = "El texto de la diapositiva aparecerá aquí...";
    slideIndicator.innerText = "Diapositiva 0 / 0";
    btnPrev.disabled = true;
    btnNext.disabled = true;
    slideContent.style.transform = `translateY(0px)`;
    slidePreview.style.alignItems = "center";
  } else {
    const currentSlide = state.slides[state.currentSlideIdx];
    slideContent.innerText = currentSlide.text;
    slideIndicator.innerText = `Diapositiva ${state.currentSlideIdx + 1} / ${state.slides.length}`;
    btnPrev.disabled = state.currentSlideIdx === 0;
    btnNext.disabled = state.currentSlideIdx === state.slides.length - 1;

    // Apply individual slide settings
    slidePreview.style.alignItems = currentSlide.valign || "center";
    slideContent.style.transform = `translateY(${currentSlide.offsetY || 0}px)`;

    // Update individual slide UI inputs
    if (slideValignSelect) slideValignSelect.value = currentSlide.valign || "center";
    if (slideOffsetInput) slideOffsetInput.value = currentSlide.offsetY || 0;
    if (slideOffsetVal) slideOffsetVal.innerText = `${currentSlide.offsetY || 0}px`;
  }

  // Global Styles
  slidePreview.style.fontFamily = state.fontFamily;
  slidePreview.style.fontSize = `${state.fontSize}px`;
  
  if (state.bgImage) {
    slidePreview.style.backgroundImage = `url(${state.bgImage})`;
    slidePreview.style.backgroundColor = "transparent";
  } else {
    slidePreview.style.backgroundImage = "none";
    slidePreview.style.backgroundColor = state.bgColor;
  }
}

// --- EVENT LISTENERS ---

editor.addEventListener("input", (e) => {
  const text = e.target.value;
  const newTexts = parseTextToSlides(text);
  
  // Maintain previous configuration by text matching
  const oldSlidesMap = new Map();
  state.slides.forEach(s => oldSlidesMap.set(s.text, s));

  state.slides = newTexts.map(t => {
    const old = oldSlidesMap.get(t);
    if (old) return old;
    return { text: t, valign: "center", offsetY: 0 };
  });

  if (state.currentSlideIdx >= state.slides.length) {
    state.currentSlideIdx = Math.max(0, state.slides.length - 1);
  }
  updatePreview();
});

btnPrev.addEventListener("click", () => {
  if (state.currentSlideIdx > 0) {
    state.currentSlideIdx--;
    updatePreview();
  }
});

btnNext.addEventListener("click", () => {
  if (state.currentSlideIdx < state.slides.length - 1) {
    state.currentSlideIdx++;
    updatePreview();
  }
});

let lastFetchedVerse = null;

bibleSearchBtn.addEventListener("click", async () => {
  const query = bibleSearchInput.value.trim();
  if (!query) {
    alert("Por favor, escribe un versículo en la caja de búsqueda (Ejemplo: jn 3:16).");
    return;
  }

  const refRegex = /^\s*(\d?\s*[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s*(\d+)\s*:\s*(\d+(?:\s*-\s*\d+)?)\s*$/i;
  const match = refRegex.exec(query);
  
  if (!match) {
    alert("Formato de cita no reconocido. Ejemplos válidos: jn 3:16, 1 jn 4:8, ap 21:1");
    return;
  }

  const book = match[1].trim();
  const chapter = match[2].trim();
  const verse = match[3].trim();

  bibleSearchBtn.disabled = true;
  bibleSearchBtn.innerHTML = `<span class="material-icons-round" style="font-size: 1.1rem;">hourglass_empty</span> Buscando...`;
  bibleSearchResult.style.display = "none";
  bibleInsertBtn.style.display = "none";

  try {
    const bookEncoded = encodeURIComponent(book.toLowerCase().replace(/\s+/g, ''));
    const url = `https://bible-api.deno.dev/api/read/rv1960/${bookEncoded}/${chapter}/${verse}`;
    
    const res = await fetch(url);
    if (!res.ok) throw new Error("No encontrado");
    
    const data = await res.json();
    let verseText = "";
    
    if (Array.isArray(data)) {
      verseText = data.map(v => v.verse).join(" ");
    } else if (data.verse) {
      verseText = data.verse;
    }

    if (verseText) {
      lastFetchedVerse = { book, chapter, verse, text: verseText };
      bibleSearchResult.innerText = verseText;
      bibleSearchResult.style.display = "block";
      bibleInsertBtn.style.display = "flex";
    } else {
      alert("No se encontró texto para ese versículo. Intenta con otra cita.");
    }
  } catch (err) {
    console.error(err);
    alert("Hubo un error al buscar el versículo. Asegúrate de que el libro exista (ej: gn, jn, ap, 1jn).");
  } finally {
    bibleSearchBtn.disabled = false;
    bibleSearchBtn.innerHTML = `<span class="material-icons-round" style="font-size: 1.1rem;">search</span> Buscar`;
  }
});

bibleInsertBtn.addEventListener("click", () => {
  if (!lastFetchedVerse) return;
  const formattedString = `\n( ${lastFetchedVerse.book} ${lastFetchedVerse.chapter}:${lastFetchedVerse.verse} "${lastFetchedVerse.text}" )\n\n`;
  
  const startPos = editor.selectionStart;
  const endPos = editor.selectionEnd;
  
  editor.value = editor.value.substring(0, startPos)
    + formattedString
    + editor.value.substring(endPos, editor.value.length);
  
  editor.dispatchEvent(new Event("input"));
  
  bibleSearchInput.value = "";
  bibleSearchResult.style.display = "none";
  bibleInsertBtn.style.display = "none";
  lastFetchedVerse = null;
  editor.focus();
});

slideFormatSelect.addEventListener("change", (e) => {
  state.layoutRatio = e.target.value;
  applySlideRatio();
});

// Individual Slide Listeners
slideValignSelect.addEventListener("change", (e) => {
  if (state.slides.length > 0) {
    state.slides[state.currentSlideIdx].valign = e.target.value;
    updatePreview();
  }
});

slideOffsetInput.addEventListener("input", (e) => {
  if (state.slides.length > 0) {
    state.slides[state.currentSlideIdx].offsetY = parseInt(e.target.value, 10);
    slideOffsetVal.innerText = `${e.target.value}px`;
    updatePreview(); // this will apply the transform
  }
});


// Global Settings Listeners
fontFamilySelect.addEventListener("change", (e) => {
  state.fontFamily = e.target.value;
  updatePreview();
});

fontSizeInput.addEventListener("input", (e) => {
  state.fontSize = e.target.value;
  fontSizeVal.innerText = `${state.fontSize}px`;
  updatePreview();
});

// Background Presets
bgPresets.addEventListener("click", (e) => {
  if (e.target.classList.contains("preset-btn")) {
    document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("active"));
    e.target.classList.add("active");
    
    state.bgImage = null;
    state.bgColor = e.target.dataset.bg;
    updatePreview();
  }
});

// Background Image Upload
bgUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      state.bgImage = event.target.result;
      document.querySelectorAll(".preset-btn").forEach(btn => btn.classList.remove("active"));
      updatePreview();
    };
    reader.readAsDataURL(file);
  }
});

clearBgBtn.addEventListener("click", () => {
  state.bgImage = null;
  bgUpload.value = "";
  document.querySelector(".preset-btn").click();
  updatePreview();
});

// --- PPTX EXPORT ---
const downloadFormat = document.getElementById("download-format");

downloadBtn.addEventListener("click", async () => {
  const format = downloadFormat ? downloadFormat.value : "pptx";
  
  if (format !== "pptx") {
    alert("¡Hola! Por ahora la aplicación está optimizada para generar presentaciones editables (.pptx). Para obtener un PDF o JPG con la mejor calidad, te recomiendo descargar el PowerPoint y guardarlo como PDF o Imagen desde allí. ¡Pronto añadiremos la exportación directa!");
    return;
  }

  if (state.slides.length === 0) {
    alert("No hay diapositivas para exportar. Por favor pega algo de texto.");
    return;
  }

  const pres = new pptxgen();
  
  if (state.layoutRatio === "16/9") {
    pres.layout = 'LAYOUT_16x9';
  } else if (state.layoutRatio === "4/3") {
    pres.layout = 'LAYOUT_4x3';
  } else if (state.layoutRatio === "1/1") {
    pres.defineLayout({ name: 'SQUARE', width: 10, height: 10 });
    pres.layout = 'SQUARE';
  }

  state.slides.forEach(slideObj => {
    const slide = pres.addSlide();
    
    if (state.bgImage) {
      slide.background = { data: state.bgImage }; 
    } else {
      slide.background = { color: state.bgColor.replace("#", "") };
    }

    slide.addShape(pres.ShapeType.rect, {
      x: 0, y: 0, w: '100%', h: '100%',
      fill: { color: '000000', transparency: 70 }
    });

    // Map CSS flex to PPTX valign
    let pptxValign = 'middle';
    if (slideObj.valign === 'flex-start') pptxValign = 'top';
    if (slideObj.valign === 'flex-end') pptxValign = 'bottom';

    // Calculate approx Y based on offset
    // 16x9 layout defaults to 10 width x 5.625 height in inches
    // Let's adjust Y as a percentage of height or absolute
    let baseY = 0;
    if (pptxValign === 'top') baseY = 0.5;
    else if (pptxValign === 'bottom') baseY = 4.5;
    else baseY = 2.8; // middle approx

    // rough px to inches conversion for offset (assume 72dpi -> 1px = ~0.0138 inches)
    const offsetInches = (slideObj.offsetY || 0) * 0.0138;

    slide.addText(slideObj.text, {
      x: 0.5, 
      y: (pptxValign === 'middle') ? '50%' : (baseY + offsetInches),
      w: '90%', 
      h: (pptxValign === 'middle') ? '90%' : 'auto',
      align: 'center',
      valign: pptxValign,
      fontSize: parseInt(state.fontSize),
      fontFace: state.fontFamily.replace(/'/g, '').split(',')[0],
      color: 'FFFFFF',
      breakLine: true,
      fit: 'shrink' // This allows the text to automatically shrink to fit bounds!
    });
  });

  try {
    await pres.writeFile({ fileName: 'Diapositivas_AutoRedactor.pptx' });
  } catch (err) {
    console.error("Error al exportar:", err);
    alert("Ocurrió un error al exportar la presentación.");
  }
});

// Init
updatePreview();
