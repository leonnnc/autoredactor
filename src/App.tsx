import { useState, useEffect, useRef } from 'react';
import { SermonInputPanel } from './components/SermonInputPanel';
import { SlidePreview } from './components/SlidePreview';
import { EditorPanel } from './components/EditorPanel';
import type { Slide, SlideStyle, ViewportMode, BibleData } from './types';
import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import pptxgen from 'pptxgenjs';
import JSZip from 'jszip';
import { Monitor, Tablet, Smartphone, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

const KNOWN_VERSIONS = ['rvr1960', 'nvi', 'tla', 'ntv', 'lbla', 'dhh', 'nbla', 'rv1960', 'dhh94i', 'dhhs94'];

const DEFAULT_GLOBAL_STYLE: SlideStyle = {
  fontSize: 64,
  lineHeight: 1.4,
  color: '#ffffff',
  fontFamily: "'Playfair Display', serif",
  textAlign: 'center',
  verticalAlign: 'center',
  horizontalAlign: 'center',
  textShadow: true,
  textShadowColor: 'rgba(0, 0, 0, 0.75)',
  textShadowBlur: 6,
  backgroundType: 'gradient',
  backgroundColor: '#1e1b4b',
  backgroundGradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%)',
  backgroundImage: '',
  overlayOpacity: 0.4,
  overlayColor: '#000000',
  paddingX: 24,
  paddingY: 8,
  bold: false,
  italic: false,
  uppercase: false,
  
  // Reference
  refColor: '#fde047', // Gold
  refFontSize: 32,
  refItalic: true,
  refPosition: 'bottom',
};

const DEFAULT_SLIDES: Slide[] = [
  {
    id: 'slide-1',
    text: 'Nueva Diapositiva',
    reference: '',
    isVerse: false,
  }
];

const splitCustomTextByVerses = (text: string, start: number, end: number): string[] => {
  const results: string[] = [];
  const currentText = text.trim();
  
  const splitIndices: { verse: number; index: number }[] = [];
  let lastSearchIndex = 0;

  for (let v = start; v <= end; v++) {
    const searchSub = currentText.substring(lastSearchIndex);
    // Allow punctuation or spaces before the number, and punctuation/spaces/end of line after it
    const regex = new RegExp(`(?:^|[\\s.,;()\\u00a0\\[\\]"'])(${v})(?:[\\s.,;()\\u00a0\\[\\]"']|$)`, 'm');
    const match = searchSub.match(regex);
    
    if (match && match.index !== undefined) {
      const matchedNumOffset = match.index + match[0].indexOf(String(v));
      const absoluteIndex = lastSearchIndex + matchedNumOffset;
      
      splitIndices.push({ verse: v, index: absoluteIndex });
      lastSearchIndex = absoluteIndex + String(v).length;
    }
  }

  if (splitIndices.length > 0) {
    splitIndices.sort((a, b) => a.index - b.index);

    for (let i = 0; i < splitIndices.length; i++) {
      const current = splitIndices[i];
      const next = splitIndices[i + 1];
      
      const textStart = current.index;
      const textEnd = next ? next.index : currentText.length;
      
      let verseText = currentText.substring(textStart, textEnd).trim();
      verseText = verseText.replace(/^[:\s\-()[\]"'.]+/g, '');
      results.push(verseText);
    }
  }
  
  return results;
};

const splitLongTextIntoChunks = (text: string, maxLength = 280): string[] => {
  if (text.length <= maxLength) return [text];
  
  // Split by sentence endings: . ? !
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text];
  const chunks: string[] = [];
  let currentChunk = '';
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;
    
    if ((currentChunk + ' ' + trimmedSentence).trim().length <= maxLength) {
      currentChunk = (currentChunk + ' ' + trimmedSentence).trim();
    } else {
      if (currentChunk) chunks.push(currentChunk);
      
      // If a single sentence is longer than maxLength, split by words
      if (trimmedSentence.length > maxLength) {
        const words = trimmedSentence.split(/\s+/);
        let temp = '';
        for (const word of words) {
          if ((temp + ' ' + word).trim().length <= maxLength) {
            temp = (temp + ' ' + word).trim();
          } else {
            if (temp) chunks.push(temp);
            temp = word;
          }
        }
        currentChunk = temp;
      } else {
        currentChunk = trimmedSentence;
      }
    }
  }
  
  if (currentChunk) chunks.push(currentChunk);
  return chunks;
};

const levenshteinDistance = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1, // deletion
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  return matrix[a.length][b.length];
};

const findClosestBookName = (name: string, list: string[]): string | null => {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  const nName = norm(name);
  
  let bestMatch: string | null = null;
  let bestScore = 999;
  
  for (const item of list) {
    const nItem = norm(item);
    if (nItem === nName) return item;
    if (nItem.includes(nName) || nName.includes(nItem)) {
      return item;
    }
    
    const score = levenshteinDistance(nName, nItem);
    if (score < 4 && score < bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }
  
  return bestMatch;
};

interface OperatorError {
  title: string;
  message: string;
  options: {
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
  }[];
}

export default function App() {
  const [sermonText, setSermonText] = useState<string>('');
  const [slides, setSlides] = useState<Slide[]>(DEFAULT_SLIDES);
  const [activeSlideId, setActiveSlideId] = useState<string | null>(DEFAULT_SLIDES[0].id);
  const [globalStyle, setGlobalStyle] = useState<SlideStyle>(DEFAULT_GLOBAL_STYLE);
  const [viewportMode, setViewportMode] = useState<ViewportMode>('desktop');
  const [operatorError, setOperatorError] = useState<OperatorError | null>(null);

  const askOperator = (
    title: string, 
    message: string, 
    options: { label: string; value: string; variant?: 'primary' | 'secondary' | 'danger' }[]
  ): Promise<string> => {
    return new Promise((resolve) => {
      setOperatorError({
        title,
        message,
        options: options.map(opt => ({
          label: opt.label,
          variant: opt.variant,
          action: () => {
            setOperatorError(null);
            resolve(opt.value);
          }
        }))
      });
    });
  };
  
  // Bible database states
  const [bibleVersion, setBibleVersion] = useState<'rvr1960' | 'nvi' | 'tla' | 'ntv' | 'lbla' | 'dhh' | 'nbla'>('rvr1960');
  const [bibleData, setBibleData] = useState<BibleData | null>(null);
  const [bibleLoading, setBibleLoading] = useState<boolean>(false);
  const bibleCache = useRef<{ [key: string]: BibleData }>({});

  // Export progress states
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Dynamically fetch and cache Bible versions
  const fetchBibleVersion = async (version: string): Promise<BibleData | null> => {
    const normVersion = version.toLowerCase();
    if (bibleCache.current[normVersion]) {
      return bibleCache.current[normVersion];
    }
    try {
      const response = await fetch(`/bibles/${normVersion}.json`);
      if (response.ok) {
        const data = await response.json();
        bibleCache.current[normVersion] = data;
        return data;
      }
    } catch (err) {
      console.error(`Error loading Bible version ${normVersion}:`, err);
    }
    return null;
  };

  // Load Bible Data
  useEffect(() => {
    const loadBible = async () => {
      if (bibleCache.current[bibleVersion]) {
        setBibleData(bibleCache.current[bibleVersion]);
        return;
      }

      setBibleLoading(true);
      try {
        const response = await fetch(`/bibles/${bibleVersion}.json`);
        if (!response.ok) {
          throw new Error('Failed to load Bible JSON');
        }
        const data = await response.json();
        bibleCache.current[bibleVersion] = data;
        setBibleData(data);
      } catch (err) {
        console.error('Error loading Bible:', err);
      } finally {
        setBibleLoading(false);
      }
    };

    loadBible();
  }, [bibleVersion]);

  // Find currently active slide object
  const activeSlideIndex = slides.findIndex(s => s.id === activeSlideId);
  const activeSlide = activeSlideIndex !== -1 ? slides[activeSlideIndex] : null;

  // Slide navigation helpers
  const handlePrevSlide = () => {
    if (activeSlideIndex > 0) {
      setActiveSlideId(slides[activeSlideIndex - 1].id);
    }
  };

  const handleNextSlide = () => {
    if (activeSlideIndex < slides.length - 1) {
      setActiveSlideId(slides[activeSlideIndex + 1].id);
    }
  };

  // State handlers
  const handleSelectSlide = (id: string) => {
    setActiveSlideId(id);
  };

  const handleAddSlide = () => {
    const newSlide: Slide = {
      id: Math.random().toString(36).substr(2, 9),
      text: 'Nueva Diapositiva',
      reference: '',
      isVerse: false,
    };
    setSlides([...slides, newSlide]);
    setActiveSlideId(newSlide.id);
  };

  const handleDeleteSlide = (id: string) => {
    if (slides.length <= 1) {
      alert("Debes tener al menos una diapositiva en tu presentación.");
      return;
    }
    const filtered = slides.filter(s => s.id !== id);
    setSlides(filtered);
    if (activeSlideId === id) {
      setActiveSlideId(filtered[0].id);
    }
  };

  const handleReorderSlides = (index1: number, index2: number) => {
    if (index1 < 0 || index1 >= slides.length || index2 < 0 || index2 >= slides.length) return;
    const newSlides = [...slides];
    const temp = newSlides[index1];
    newSlides[index1] = newSlides[index2];
    newSlides[index2] = temp;
    setSlides(newSlides);
  };

  const handleChangeGlobalStyle = (newStyle: SlideStyle) => {
    setGlobalStyle(newStyle);
  };

  const handleChangeSlideStyle = (newStyle: Partial<SlideStyle> | undefined) => {
    if (!activeSlideId) return;
    setSlides(slides.map(s => {
      if (s.id === activeSlideId) {
        if (newStyle === undefined) {
          // Remove custom overrides
          const { customStyle, ...rest } = s;
          return rest;
        } else {
          return {
            ...s,
            customStyle: {
              ...(s.customStyle || {}),
              ...newStyle
            }
          };
        }
      }
      return s;
    }));
  };

  const handleApplyStyleToAll = () => {
    if (!activeSlide || !activeSlide.customStyle) return;
    if (window.confirm("¿Quieres aplicar este estilo a todas las diapositivas y borrar sus estilos personalizados?")) {
      const mergedStyle = { ...globalStyle, ...activeSlide.customStyle };
      setGlobalStyle(mergedStyle);
      // Remove all slide specific custom overrides
      setSlides(slides.map(s => {
        const { customStyle, ...rest } = s;
        return rest;
      }));
    }
  };

  const handleAddVerseToSlides = (text: string, reference: string) => {
    const newSlide: Slide = {
      id: Math.random().toString(36).substr(2, 9),
      text,
      reference,
      isVerse: true,
    };
    setSlides(prev => [...prev, newSlide]);
    setActiveSlideId(newSlide.id);
  };

  // Clear sermon and all slides
  const handleClearAll = () => {
    if (window.confirm("¿Seguro que deseas limpiar la prédica y borrar todas las diapositivas creadas?")) {
      setSermonText('');
      const firstSlide: Slide = {
        id: Math.random().toString(36).substr(2, 9),
        text: 'Nueva Diapositiva',
        reference: '',
        isVerse: false,
      };
      setSlides([firstSlide]);
      setActiveSlideId(firstSlide.id);
    }
  };

  // Generate slides by parsing sermon text
  const handleGenerateSlides = async () => {
    if (!sermonText.trim()) return;

    setExportProgress('Procesando bosquejo de prédica y versículos...');
    setIsExporting(true);

    try {
      // Split by double line break or manual page break '---'
      const rawSegments = sermonText.split(/---|\n\s*\n/);
      
      // Regex to detect Spanish bible references: (1? \s* [letras]) [cap]:[vers] (optional [version])
      // E.g. "Génesis 1:1", "1 Corintios 13:4-8", "Juan 3:16 TLA", "Hechos 2:1 (NVI)"
      const refRegex = /((?:[1-3]\s+)?[a-zA-ZáéíóúÁÉÍÓÚñÑ]+)\s+(\d+):(\d+)(?:-(\d+))?(?:\s*(?:["'(\[]\s*)?([a-zA-Z0-9]+)(?:\s*["')\]])?)?/i;

      // Pre-process segments to merge reference-only segments with their following text segments
      const processedSegments: string[] = [];
      for (let i = 0; i < rawSegments.length; i++) {
        const current = rawSegments[i].trim();
        if (!current) continue;
        
        let isOnlyRef = false;
        const currentMatch = current.match(refRegex);
        if (currentMatch) {
          let fullMatchText = currentMatch[0];
          if (currentMatch[5] && !KNOWN_VERSIONS.includes(currentMatch[5].toLowerCase())) {
            const lastCoords = `${currentMatch[2]}:${currentMatch[3]}` + (currentMatch[4] ? `-${currentMatch[4]}` : '');
            const lastIndex = current.indexOf(lastCoords);
            if (lastIndex !== -1) {
              fullMatchText = current.substring(current.indexOf(currentMatch[1]), lastIndex + lastCoords.length);
            }
          }
          const remainder = current.replace(fullMatchText, '').replace(/^[:\s\-()[\]"']+|[:\s\-()[\]"']+$/g, '').trim();
          if (remainder.length === 0) {
            isOnlyRef = true;
          }
        }
        
        if (isOnlyRef && i + 1 < rawSegments.length) {
          const next = rawSegments[i + 1].trim();
          const nextMatch = next.match(refRegex);
          if (!nextMatch) {
            processedSegments.push(current + "\n" + next);
            i++;
            continue;
          }
        }
        
        processedSegments.push(current);
      }

      const parsedSlides: Slide[] = [];

      for (const segment of processedSegments) {
        const trimmed = segment.trim();
        if (!trimmed) continue;

        const match = trimmed.match(refRegex);
        if (match) {
          let bookName = match[1].trim();
          const chapterNum = parseInt(match[2]);
          const verseStart = parseInt(match[3]);
          const verseEnd = match[4] ? parseInt(match[4]) : verseStart;
          
          let versionFound = '';
          let fullMatchText = match[0];
          
          if (match[5]) {
            const potentialVersion = match[5].toLowerCase();
            if (KNOWN_VERSIONS.includes(potentialVersion)) {
              versionFound = match[5].toUpperCase();
              if (versionFound === 'RV1960') versionFound = 'RVR1960';
            } else {
              // Not a known version, contract match
              const lastCoords = `${chapterNum}:${verseStart}` + (match[4] ? `-${verseEnd}` : '');
              const lastIndex = trimmed.indexOf(lastCoords);
              if (lastIndex !== -1) {
                const endOfCoords = lastIndex + lastCoords.length;
                fullMatchText = trimmed.substring(trimmed.indexOf(bookName), endOfCoords);
              }
            }
          }

          // Clean the slide text by removing the reference matched
          let slideText = trimmed.replace(fullMatchText, '').trim();
          slideText = slideText.replace(/^[:\s\-()[\]"']+|[:\s\-()[\]"']+$/g, '');

          // Resolve which version to use
          const finalVersion = versionFound ? versionFound.toLowerCase() : bibleVersion;
          const bible = await fetchBibleVersion(finalVersion);

          let useDb = true;
          let matchedBook = null;

          if (bible) {
            matchedBook = bible.books.find(b => b.name.toLowerCase() === bookName.toLowerCase());
            
            // ERROR 1: Unrecognized Book Name
            if (!matchedBook) {
              const allBookNames = bible.books.map(b => b.name);
              const suggestion = findClosestBookName(bookName, allBookNames);
              
              if (suggestion) {
                // Resolve silently and automatically!
                bookName = suggestion;
                matchedBook = bible.books.find(b => b.name.toLowerCase() === bookName.toLowerCase());
              } else {
                // Unresolvable without operator choice
                const choice = await askOperator(
                  "Libro No Reconocido ⚠️",
                  `El libro "${bookName}" no se encontró en la versión ${finalVersion.toUpperCase()} y no pudimos identificar a cuál correspondía.\n¿Cómo deseas proceder?`,
                  [
                    { label: "Tratar como texto normal", value: 'text_fallback', variant: 'primary' as const },
                    { label: "Detener generación", value: 'abort', variant: 'danger' as const }
                  ]
                );

                if (choice === 'abort') {
                  throw new Error('Generación cancelada por el operador para corregir el texto.');
                } else {
                  useDb = false;
                }
              }
            }

            // ERROR 2: Chapter or Verse Out of Bounds
            if (useDb && matchedBook) {
              const actualChapters = matchedBook.chapters.filter(ch => ch.is_chapter);
              const chapter = actualChapters[chapterNum - 1];
              if (!chapter) {
                const choice = await askOperator(
                  "Capítulo Inexistente ⚠️",
                  `El libro "${bookName}" solo tiene ${actualChapters.length} capítulos. Intentaste buscar el capítulo ${chapterNum}.\n¿Cómo deseas proceder?`,
                  [
                    { label: "Tratar como texto normal", value: 'text_fallback', variant: 'primary' as const },
                    { label: "Detener generación", value: 'abort', variant: 'danger' as const }
                  ]
                );
                if (choice === 'abort') {
                  throw new Error('Generación cancelada para corregir el capítulo.');
                } else {
                  useDb = false;
                }
              } else {
                // Check verse boundaries
                const maxVerseInChapter = chapter.items.reduce((max, item) => {
                  if (item.type === 'verse') {
                    const itemMax = Math.max(...item.verse_numbers);
                    return itemMax > max ? itemMax : max;
                  }
                  return max;
                }, 0);

                if (verseStart > maxVerseInChapter || verseEnd > maxVerseInChapter) {
                  const choice = await askOperator(
                    "Versículo Inexistente ⚠️",
                    `El capítulo ${chapterNum} de "${bookName}" tiene ${maxVerseInChapter} versículos. Intentaste buscar el versículo ${verseStart > maxVerseInChapter ? verseStart : verseEnd}.\n¿Cómo deseas proceder?`,
                    [
                      { label: "Tratar como texto normal", value: 'text_fallback', variant: 'primary' as const },
                      { label: "Detener generación", value: 'abort', variant: 'danger' as const }
                    ]
                  );
                  if (choice === 'abort') {
                    throw new Error('Generación cancelada para corregir el versículo.');
                  } else {
                    useDb = false;
                  }
                }
              }
            }
          }

          // If it's a range of multiple verses
          if (verseStart !== verseEnd) {
            let customSplitTexts: string[] = [];
            if (slideText) {
              customSplitTexts = splitCustomTextByVerses(slideText, verseStart, verseEnd);
            }

            // ERROR 3: Missing verses in pasted range (Resolved silently by autocompleting missing verses from DB if useDb is true)

            const rangeVerses: { text: string; num: number }[] = [];
            for (let v = verseStart; v <= verseEnd; v++) {
              let verseText = '';
              const customIdx = v - verseStart;
              
              if (slideText && customSplitTexts.length > customIdx && customSplitTexts[customIdx]) {
                verseText = customSplitTexts[customIdx];
              }
              
              // If verseText is empty and we are allowed to use DB
              if (!verseText && useDb && bible && matchedBook) {
                const actualChapters = matchedBook.chapters.filter(ch => ch.is_chapter);
                const chapter = actualChapters[chapterNum - 1];
                if (chapter) {
                  const vItem = chapter.items.find(item => item.type === 'verse' && item.verse_numbers.includes(v));
                  if (vItem) {
                    verseText = `${v} ${vItem.lines.join(' ')}`;
                  }
                }
              }

              if (!verseText) {
                verseText = slideText || `Versículo ${v}`;
              }
              
              rangeVerses.push({ text: verseText, num: v });
            }

            const combinedText = rangeVerses.map(rv => rv.text).join(' ');
            const totalLength = combinedText.length;

            if (totalLength <= 260) {
              const chunks = splitLongTextIntoChunks(combinedText, 280);
              for (const chunk of chunks) {
                parsedSlides.push({
                  id: Math.random().toString(36).substr(2, 9),
                  text: chunk,
                  reference: `${bookName} ${chapterNum}:${verseStart}-${verseEnd} (${finalVersion.toUpperCase()})`,
                  isVerse: true
                });
              }
            } else {
              for (const rv of rangeVerses) {
                const chunks = splitLongTextIntoChunks(rv.text, 280);
                for (const chunk of chunks) {
                  parsedSlides.push({
                    id: Math.random().toString(36).substr(2, 9),
                    text: chunk,
                    reference: `${bookName} ${chapterNum}:${rv.num} (${finalVersion.toUpperCase()})`,
                    isVerse: true
                  });
                }
              }
            }
          } else {
            // Single verse
            let fetchedText = '';
            if (useDb && !slideText && bible && matchedBook) {
              const actualChapters = matchedBook.chapters.filter(ch => ch.is_chapter);
              const chapter = actualChapters[chapterNum - 1];
              if (chapter) {
                const vItem = chapter.items.find(item => item.type === 'verse' && item.verse_numbers.includes(verseStart));
                if (vItem) {
                  fetchedText = `${verseStart} ${vItem.lines.join(' ')}`;
                }
              }
            }

            const targetText = slideText || fetchedText || trimmed;
            const chunks = splitLongTextIntoChunks(targetText, 280);
            for (const chunk of chunks) {
              parsedSlides.push({
                id: Math.random().toString(36).substr(2, 9),
                text: chunk,
                reference: `${bookName} ${chapterNum}:${verseStart} (${finalVersion.toUpperCase()})`,
                isVerse: true
              });
            }
          }
        } else {
          // Standard slide segment (chunk it if it is a very long paragraph)
          const chunks = splitLongTextIntoChunks(trimmed, 280);
          for (const chunk of chunks) {
            parsedSlides.push({
              id: Math.random().toString(36).substr(2, 9),
              text: chunk,
              reference: '',
              isVerse: false
            });
          }
        }
      }

      if (parsedSlides.length > 0) {
        setSlides(parsedSlides);
        setActiveSlideId(parsedSlides[0].id);
      } else {
        alert("No se pudo extraer ninguna diapositiva del texto.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message && err.message.includes('Generación cancelada')) {
        // Inform cleaner than raw alert
        setExportProgress('');
      } else {
        alert("Ocurrió un error al generar las diapositivas.");
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Helper function to build a full-size HTML node off-screen and return its JPEG base64 Data URL
  const captureFullResolutionSlide = async (slide: Slide): Promise<string> => {
    const dims = getViewportDimensions(viewportMode);
    
    // Merge global and slide-specific style
    const style: SlideStyle = {
      ...globalStyle,
      ...(slide.customStyle || {}),
    };

    // Create sandbox container off-screen
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = `${dims.width}px`;
    container.style.height = `${dims.height}px`;
    document.body.appendChild(container);

    const slideEl = document.createElement('div');
    slideEl.style.width = '100%';
    slideEl.style.height = '100%';
    slideEl.style.display = 'flex';
    slideEl.style.flexDirection = 'column';
    slideEl.style.justifyContent = style.verticalAlign;
    slideEl.style.alignItems = style.horizontalAlign;
    slideEl.style.paddingLeft = `${style.paddingX}%`;
    slideEl.style.paddingRight = `${style.paddingX}%`;
    slideEl.style.paddingTop = `${style.paddingY}%`;
    slideEl.style.paddingBottom = `${style.paddingY}%`;
    slideEl.style.boxSizing = 'border-box';
    slideEl.style.position = 'relative';
    slideEl.style.overflow = 'hidden';

    // Apply Background
    if (style.backgroundType === 'solid') {
      slideEl.style.backgroundColor = style.backgroundColor;
    } else if (style.backgroundType === 'gradient') {
      slideEl.style.background = style.backgroundGradient;
    } else if (style.backgroundType === 'image' && style.backgroundImage) {
      slideEl.style.backgroundImage = `url(${style.backgroundImage})`;
      slideEl.style.backgroundSize = 'cover';
      slideEl.style.backgroundPosition = 'center';
      slideEl.style.backgroundRepeat = 'no-repeat';
    }

    // Apply Overlay
    if (style.backgroundType === 'image' && style.backgroundImage) {
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.inset = '0';
      overlay.style.backgroundColor = style.overlayColor;
      overlay.style.opacity = String(style.overlayOpacity);
      overlay.style.zIndex = '1';
      slideEl.appendChild(overlay);
    }

    // Content wrapper
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.zIndex = '2';
    wrapper.style.width = '100%';
    wrapper.style.display = 'flex';
    wrapper.style.flexDirection = 'column';
    wrapper.style.gap = '24px';
    wrapper.style.textAlign = style.textAlign;

    // Slide reference element
    const refDiv = document.createElement('div');
    refDiv.innerText = slide.reference;
    refDiv.style.color = style.refColor;
    refDiv.style.fontSize = `${style.refFontSize}px`;
    refDiv.style.fontFamily = style.fontFamily;
    refDiv.style.fontWeight = '600';
    refDiv.style.fontStyle = style.refItalic ? 'italic' : 'normal';
    refDiv.style.textTransform = 'uppercase';
    refDiv.style.letterSpacing = '1px';
    if (style.textShadow) {
      refDiv.style.textShadow = '0 2px 4px rgba(0,0,0,0.5)';
    }

    // Slide text element
    const textDiv = document.createElement('div');
    textDiv.innerText = slide.text;
    textDiv.style.color = style.color;
    textDiv.style.fontSize = `${style.fontSize}px`;
    textDiv.style.lineHeight = String(style.lineHeight);
    textDiv.style.fontFamily = style.fontFamily;
    textDiv.style.fontWeight = style.bold ? '700' : '400';
    textDiv.style.fontStyle = style.italic ? 'italic' : 'normal';
    textDiv.style.textTransform = style.uppercase ? 'uppercase' : 'none';
    textDiv.style.whiteSpace = 'pre-wrap';
    textDiv.style.wordBreak = 'break-word';
    if (style.textShadow) {
      textDiv.style.textShadow = `0 ${style.textShadowBlur}px ${style.textShadowBlur * 2}px ${style.textShadowColor}`;
    }

    // Order elements
    if (slide.reference) {
      if (style.refPosition === 'top') {
        wrapper.appendChild(refDiv);
        wrapper.appendChild(textDiv);
      } else {
        wrapper.appendChild(textDiv);
        wrapper.appendChild(refDiv);
      }
    } else {
      wrapper.appendChild(textDiv);
    }

    slideEl.appendChild(wrapper);
    container.appendChild(slideEl);

    // Wait a brief tick for render
    await new Promise(resolve => setTimeout(resolve, 30));

    try {
      const dataUrl = await toJpeg(slideEl, {
        width: dims.width,
        height: dims.height,
        quality: 0.95,
      });
      document.body.removeChild(container);
      return dataUrl;
    } catch (err) {
      document.body.removeChild(container);
      throw err;
    }
  };

  // EXPORTS IMPLEMENTATION
  
  // 1. Export Current Slide to JPG
  const handleExportCurrentJpg = async () => {
    if (!activeSlide) return;
    setIsExporting(true);
    setExportProgress('Generando imagen JPG...');
    try {
      const dataUrl = await captureFullResolutionSlide(activeSlide);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `diapositiva_${activeSlideIndex + 1}.jpg`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Error al exportar la imagen.');
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export All Slides to ZIP
  const handleExportAllJpg = async () => {
    setIsExporting(true);
    const zip = new JSZip();
    try {
      for (let i = 0; i < slides.length; i++) {
        setExportProgress(`Capturando diapositiva ${i + 1} de ${slides.length}...`);
        const dataUrl = await captureFullResolutionSlide(slides[i]);
        // Extract base64 clean string
        const base64Data = dataUrl.split(',')[1];
        zip.file(`diapositiva_${i + 1}.jpg`, base64Data, { base64: true });
      }
      setExportProgress('Comprimiendo archivo ZIP...');
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `diapositivas_predica.zip`;
      link.click();
    } catch (err) {
      console.error(err);
      alert('Error al generar el archivo ZIP.');
    } finally {
      setIsExporting(false);
    }
  };

  // 3. Export to PDF (Multi-page Landscape)
  const handleExportPdf = async () => {
    setIsExporting(true);
    try {
      const dims = getViewportDimensions(viewportMode);
      const orientation = dims.width > dims.height ? 'l' : 'p';
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'px',
        format: [dims.width, dims.height]
      });

      for (let i = 0; i < slides.length; i++) {
        setExportProgress(`Renderizando PDF: página ${i + 1} de ${slides.length}...`);
        const dataUrl = await captureFullResolutionSlide(slides[i]);
        
        if (i > 0) {
          pdf.addPage([dims.width, dims.height], orientation);
        }
        
        pdf.addImage(dataUrl, 'JPEG', 0, 0, dims.width, dims.height);
      }

      setExportProgress('Guardando documento PDF...');
      pdf.save(`presentacion_predica.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error al generar el PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // 4. Export to PPTX (Native Slides carrying captured full-res images)
  const handleExportPptx = async () => {
    setIsExporting(true);
    try {
      const pptx = new pptxgen();
      
      // Configure aspect ratio
      if (viewportMode === 'mobile') {
        pptx.defineLayout({ name: 'MOBILE', width: 5.625, height: 10.0 });
        pptx.layout = 'MOBILE';
      } else if (viewportMode === 'tablet') {
        pptx.layout = 'LAYOUT_4x3';
      } else {
        pptx.layout = 'LAYOUT_16x9';
      }

      for (let i = 0; i < slides.length; i++) {
        setExportProgress(`Preparando PPTX: diapositiva ${i + 1} de ${slides.length}...`);
        const dataUrl = await captureFullResolutionSlide(slides[i]);
        
        const pptxSlide = pptx.addSlide();
        pptxSlide.addImage({
          data: dataUrl,
          x: 0,
          y: 0,
          w: '100%',
          h: '100%'
        });
      }

      setExportProgress('Generando archivo PowerPoint...');
      await pptx.writeFile({ fileName: `presentacion_predica.pptx` });
    } catch (err) {
      console.error(err);
      alert('Error al generar la presentación de PowerPoint.');
    } finally {
      setIsExporting(false);
    }
  };

  const getViewportDimensions = (mode: ViewportMode) => {
    switch (mode) {
      case 'desktop':
        return { width: 1920, height: 1080, scale: 0.5 };
      case 'tablet':
        return { width: 1024, height: 768, scale: 0.703125 };
      case 'mobile':
        return { width: 1080, height: 1920, scale: 0.28125 };
    }
  };

  return (
    <div className="app-container">
      {/* Left panel: Inputs, Bible searches, and Slides thumbnails list */}
      <SermonInputPanel
        sermonText={sermonText}
        onChangeSermonText={setSermonText}
        slides={slides}
        activeSlideId={activeSlideId}
        onSelectSlide={handleSelectSlide}
        onAddSlide={handleAddSlide}
        onDeleteSlide={handleDeleteSlide}
        onReorderSlides={handleReorderSlides}
        onGenerateSlides={handleGenerateSlides}
        onClearAll={handleClearAll}
        bibleVersion={bibleVersion}
        onChangeBibleVersion={setBibleVersion}
        bibleData={bibleData}
        bibleLoading={bibleLoading}
        onAddVerseToSlides={handleAddVerseToSlides}
      />

      {/* Central panel: Viewport control and Slide render canvas */}
      <div className="workspace">
        <div className="control-bar">
          <div className="viewport-selectors">
            <button 
              className={`viewport-btn ${viewportMode === 'desktop' ? 'active' : ''}`}
              onClick={() => setViewportMode('desktop')}
            >
              <Monitor size={14} />
              Desktop 16:9
            </button>
            <button 
              className={`viewport-btn ${viewportMode === 'tablet' ? 'active' : ''}`}
              onClick={() => setViewportMode('tablet')}
            >
              <Tablet size={14} />
              Tableta 4:3
            </button>
            <button 
              className={`viewport-btn ${viewportMode === 'mobile' ? 'active' : ''}`}
              onClick={() => setViewportMode('mobile')}
            >
              <Smartphone size={14} />
              Móvil 9:16
            </button>
          </div>

          {/* Quick Slide Navigation */}
          {slides.length > 0 && (
            <div className="slide-number-nav">
              <button 
                className="slide-nav-btn"
                onClick={handlePrevSlide}
                disabled={activeSlideIndex <= 0}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="slide-nav-indicator">
                {activeSlideIndex !== -1 ? activeSlideIndex + 1 : 0} / {slides.length}
              </span>
              <button 
                className="slide-nav-btn"
                onClick={handleNextSlide}
                disabled={activeSlideIndex >= slides.length - 1}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Live Preview Canvas */}
        <SlidePreview
          slide={activeSlide}
          globalStyle={globalStyle}
          viewportMode={viewportMode}
          canvasRef={canvasRef}
        />
      </div>

      {/* Right panel: Typography, alignment, colors, backgrounds, export operations */}
      <EditorPanel
        activeSlide={activeSlide}
        globalStyle={globalStyle}
        onChangeGlobalStyle={handleChangeGlobalStyle}
        onChangeSlideStyle={handleChangeSlideStyle}
        onApplyStyleToAll={handleApplyStyleToAll}
        onExportCurrentJpg={handleExportCurrentJpg}
        onExportAllJpg={handleExportAllJpg}
        onExportPdf={handleExportPdf}
        onExportPptx={handleExportPptx}
        isExporting={isExporting}
        exportProgress={exportProgress}
      />
      {/* Operator Warning / Error Dialog Modal */}
      {operatorError && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <AlertTriangle size={24} color="#f59e0b" style={{ flexShrink: 0 }} />
              <h3>{operatorError.title}</h3>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{operatorError.message}</p>
            </div>
            <div className="modal-actions">
              {operatorError.options.map((opt, idx) => (
                <button
                  key={idx}
                  className={`modal-btn ${opt.variant || 'secondary'}`}
                  onClick={opt.action}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
