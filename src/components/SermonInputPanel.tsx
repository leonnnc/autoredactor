import React, { useState, useEffect } from 'react';
import type { Slide, BibleData, BibleBook, BibleChapter } from '../types';
import { 
  BookOpen, 
  FileText, 
  Plus, 
  Trash2, 
  Search, 
  Sparkles, 
  ChevronUp, 
  ChevronDown 
} from 'lucide-react';

interface SermonInputPanelProps {
  sermonText: string;
  onChangeSermonText: (text: string) => void;
  slides: Slide[];
  activeSlideId: string | null;
  onSelectSlide: (id: string) => void;
  onAddSlide: () => void;
  onDeleteSlide: (id: string) => void;
  onReorderSlides: (index1: number, index2: number) => void;
  onGenerateSlides: () => void;
  onClearAll: () => void;
  
  // Bible states passed from App
  bibleVersion: 'rvr1960' | 'nvi' | 'tla' | 'ntv' | 'lbla' | 'dhh' | 'nbla';
  onChangeBibleVersion: (version: 'rvr1960' | 'nvi' | 'tla' | 'ntv' | 'lbla' | 'dhh' | 'nbla') => void;
  bibleData: BibleData | null;
  bibleLoading: boolean;
  onAddVerseToSlides: (text: string, reference: string) => void;
}

export const SermonInputPanel: React.FC<SermonInputPanelProps> = ({
  sermonText,
  onChangeSermonText,
  slides,
  activeSlideId,
  onSelectSlide,
  onAddSlide,
  onDeleteSlide,
  onReorderSlides,
  onGenerateSlides,
  onClearAll,
  bibleVersion,
  onChangeBibleVersion,
  bibleData,
  bibleLoading,
  onAddVerseToSlides,
}) => {
  const [activeTab, setActiveTab] = useState<'sermon' | 'bible'>('sermon');
  
  // Bible reference selection states
  const [selectedBookIndex, setSelectedBookIndex] = useState<number>(0);
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);
  const [selectedVerseStart, setSelectedVerseStart] = useState<number>(1);
  const [selectedVerseEnd, setSelectedVerseEnd] = useState<number>(1);
  
  // Search keyword state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ reference: string; text: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  const currentBook: BibleBook | undefined = bibleData?.books[selectedBookIndex];
  const actualChapters = currentBook?.chapters.filter(c => c.is_chapter) || [];
  const currentChapter: BibleChapter | undefined = actualChapters[selectedChapterIndex];
  
  // Total chapters in selected book
  const totalChapters = currentBook?.chapters.filter(c => c.is_chapter).length || 0;
  
  // Total verses in selected chapter
  const versesInChapter = currentChapter?.items.filter(item => item.type === 'verse') || [];
  const totalVerses = versesInChapter.length || 0;

  // Reset indices when bibleVersion or bibleData changes
  useEffect(() => {
    setSelectedBookIndex(0);
    setSelectedChapterIndex(0);
    setSelectedVerseStart(1);
    setSelectedVerseEnd(1);
    setSearchResults([]);
    setSearchQuery('');
  }, [bibleVersion, bibleData]);

  // Reset chapter and verse selections when book changes
  useEffect(() => {
    setSelectedChapterIndex(0);
    setSelectedVerseStart(1);
    setSelectedVerseEnd(1);
  }, [selectedBookIndex]);

  // Reset verse selections when chapter changes
  useEffect(() => {
    setSelectedVerseStart(1);
    setSelectedVerseEnd(1);
  }, [selectedChapterIndex]);

  // Handle Bible Keyword Search
  const handleKeywordSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bibleData || searchQuery.trim().length < 3) return;
    
    setIsSearching(true);
    
    // Run keyword search in a brief timeout to avoid blocking main thread UI update
    setTimeout(() => {
      const query = searchQuery.toLowerCase().trim();
      const results: { reference: string; text: string }[] = [];
      
      // Iterate through books, chapters, and verses
      for (const book of bibleData.books) {
        const actualChapters = book.chapters.filter(ch => ch.is_chapter);
        for (let chNum = 1; chNum <= actualChapters.length; chNum++) {
          const ch = actualChapters[chNum - 1];
          
          for (const item of ch.items) {
            if (item.type !== 'verse') continue;
            
            const verseNumbersStr = item.verse_numbers.join('-');
            const verseText = `${verseNumbersStr} ${item.lines.join(' ')}`;
            if (verseText.toLowerCase().includes(query)) {
              const ref = `${book.name} ${chNum}:${verseNumbersStr}`;
              results.push({ reference: ref, text: verseText });
              
              if (results.length >= 60) break; // Limit search results to avoid DOM bloat
            }
          }
          if (results.length >= 60) break;
        }
        if (results.length >= 60) break;
      }
      
      setSearchResults(results);
      setIsSearching(false);
    }, 50);
  };

  // Get and add a verse by dropdown reference
  const handleAddReference = () => {
    if (!currentBook || !currentChapter || !versesInChapter.length) return;
    
    const start = Math.min(selectedVerseStart, selectedVerseEnd);
    const end = Math.max(selectedVerseStart, selectedVerseEnd);
    
    for (let v = start; v <= end; v++) {
      const match = versesInChapter.find(item => item.verse_numbers.includes(v));
      if (match) {
        const text = `${v} ${match.lines.join(' ')}`;
        const reference = `${currentBook.name} ${selectedChapterIndex + 1}:${v} (${bibleVersion.toUpperCase()})`;
        onAddVerseToSlides(text, reference);
      }
    }
  };

  return (
    <div className="panel">
      {/* App Header */}
      <div className="panel-header" style={{ justifyContent: 'space-between' }}>
        <h1 className="panel-title" style={{ fontSize: '18px', margin: 0 }}>
          <Sparkles size={20} style={{ color: 'var(--accent-secondary)' }} />
          AutoRedactor
        </h1>
        <span 
          style={{ 
            fontSize: '10px', 
            background: 'rgba(255,255,255,0.06)', 
            padding: '3px 8px', 
            borderRadius: '12px',
            color: 'var(--text-muted)'
          }}
        >
          v1.0.0
        </span>
      </div>

      <div className="panel-content" style={{ paddingBottom: '10px' }}>
        {/* Navigation Tabs */}
        <div className="tabs-header">
          <button 
            className={`tab-btn ${activeTab === 'sermon' ? 'active' : ''}`}
            onClick={() => setActiveTab('sermon')}
          >
            <FileText size={14} />
            Prédica
          </button>
          <button 
            className={`tab-btn ${activeTab === 'bible' ? 'active' : ''}`}
            onClick={() => setActiveTab('bible')}
          >
            <BookOpen size={14} />
            Biblia
          </button>
        </div>

        {/* Tab 1: Sermon Input */}
        {activeTab === 'sermon' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <span className="form-label">Texto de la Prédica</span>
              <textarea 
                className="form-textarea"
                placeholder="Escribe o pega tu bosquejo o prédica aquí. Separa las diapositivas con una línea en blanco doble o escribe '---' para un salto manual. Ej: Mateo 6:33 se autodetectará."
                value={sermonText}
                onChange={(e) => onChangeSermonText(e.target.value)}
                style={{ minHeight: '180px' }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }}
                onClick={onGenerateSlides}
                disabled={sermonText.trim() === ''}
              >
                Generar Diapositivas
              </button>
              <button 
                className="btn btn-secondary btn-danger"
                onClick={onClearAll}
                title="Limpiar Prédica y Diapositivas"
              >
                Limpiar Todo
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Bible Search */}
        {activeTab === 'bible' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Version Select */}
            <div className="form-group">
              <span className="form-label">Versión de la Biblia</span>
              <select 
                className="form-select"
                value={bibleVersion}
                onChange={(e) => onChangeBibleVersion(e.target.value as any)}
              >
                <option value="rvr1960">Reina Valera 1960 (RVR1960)</option>
                <option value="nvi">Nueva Versión Internacional (NVI)</option>
                <option value="tla">Traducción en Lenguaje Actual (TLA)</option>
                <option value="ntv">Nueva Traducción Viviente (NTV)</option>
                <option value="lbla">La Biblia de las Américas (LBLA)</option>
                <option value="dhh">Dios Habla Hoy (DHH)</option>
                <option value="nbla">Nueva Biblia de las Américas (NBLA)</option>
              </select>
            </div>

            {bibleLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px 0' }}>
                <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Cargando versión de la Biblia...</span>
              </div>
            ) : bibleData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Book & Chapter Reference Selectors */}
                <div className="form-group">
                  <span className="form-label">Búsqueda por Referencia</span>
                  
                  {/* Book Dropdown */}
                  <select 
                    className="form-select"
                    value={selectedBookIndex}
                    onChange={(e) => setSelectedBookIndex(parseInt(e.target.value))}
                    style={{ marginBottom: '8px' }}
                  >
                    {bibleData.books.map((b, idx) => (
                      <option key={b.book_usfm} value={idx}>{b.name}</option>
                    ))}
                  </select>

                  {/* Chapter and Verses Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                    <select
                      className="form-select"
                      value={selectedChapterIndex}
                      onChange={(e) => setSelectedChapterIndex(parseInt(e.target.value))}
                      title="Capítulo"
                    >
                      {Array.from({ length: totalChapters }).map((_, idx) => (
                        <option key={idx} value={idx}>Cap. {idx + 1}</option>
                      ))}
                    </select>

                    <select
                      className="form-select"
                      value={selectedVerseStart}
                      onChange={(e) => setSelectedVerseStart(parseInt(e.target.value))}
                      title="Versículo Desde"
                    >
                      {Array.from({ length: totalVerses }).map((_, idx) => (
                        <option key={idx} value={idx + 1}>Ver. {idx + 1}</option>
                      ))}
                    </select>

                    <select
                      className="form-select"
                      value={selectedVerseEnd}
                      onChange={(e) => setSelectedVerseEnd(parseInt(e.target.value))}
                      title="Versículo Hasta"
                    >
                      {Array.from({ length: totalVerses }).map((_, idx) => (
                        <option key={idx} value={idx + 1}>Ver. {idx + 1}</option>
                      ))}
                    </select>
                  </div>
                  
                  <button 
                    className="btn btn-secondary" 
                    style={{ marginTop: '8px', fontSize: '13px' }}
                    onClick={handleAddReference}
                  >
                    <Plus size={14} />
                    Insertar Referencia
                  </button>
                </div>

                {/* Keyword Search Field */}
                <form className="form-group" onSubmit={handleKeywordSearch} style={{ borderTop: '1px dashed var(--border-subtle)', paddingTop: '12px' }}>
                  <span className="form-label">Buscador por Palabras Clave</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input 
                      type="text" 
                      className="form-input"
                      placeholder="Ej: fortaleza, fe, amor..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button 
                      type="submit" 
                      className="btn btn-secondary"
                      disabled={searchQuery.trim().length < 3 || isSearching}
                      style={{ padding: '8px 12px' }}
                    >
                      <Search size={15} />
                    </button>
                  </div>
                  {searchQuery.trim().length > 0 && searchQuery.trim().length < 3 && (
                    <span style={{ fontSize: '10px', color: 'var(--text-disabled)' }}>Escribe al menos 3 caracteres</span>
                  )}
                </form>

                {/* Search Results list */}
                {searchResults.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '8px', backgroundColor: 'var(--bg-deep)' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: '600', padding: '0 4px 4px 4px', borderBottom: '1px dashed var(--border-subtle)' }}>
                      Resultados ({searchResults.length}):
                    </div>
                    {searchResults.map((res, idx) => (
                      <div key={idx} className="bible-result-item" style={{ padding: '8px', gap: '4px' }}>
                        <div className="bible-result-header">
                          <span className="bible-result-ref" style={{ fontSize: '11px' }}>{res.reference}</span>
                          <button 
                            className="btn btn-secondary"
                            style={{ padding: '2px 6px', fontSize: '10px', borderRadius: '4px' }}
                            onClick={() => onAddVerseToSlides(res.text, `${res.reference} (${bibleVersion.toUpperCase()})`)}
                          >
                            + Añadir
                          </button>
                        </div>
                        <p className="bible-result-text" style={{ fontSize: '11px', lineHeight: '1.4' }}>{res.text}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchQuery.trim().length >= 3 && searchResults.length === 0 && !isSearching && (
                  <div style={{ textAlign: 'center', padding: '10px', fontSize: '11px', color: 'var(--text-disabled)' }}>
                    No se encontraron resultados
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--danger)', fontSize: '12px', textAlign: 'center' }}>
                Error al cargar datos bíblicos.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Slide List Footer / Slide Management */}
      <div 
        style={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          borderTop: '1px solid var(--border-subtle)', 
          overflow: 'hidden' 
        }}
      >
        <div 
          style={{ 
            padding: '12px 20px', 
            borderBottom: '1px solid var(--border-subtle)', 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.01) 100%)'
          }}
        >
          <span className="form-label" style={{ margin: 0 }}>Diapositivas ({slides.length})</span>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '11px', borderRadius: '6px' }}
            onClick={onAddSlide}
          >
            <Plus size={12} style={{ marginRight: '4px' }} />
            Nueva
          </button>
        </div>

        {/* Slide List container */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {slides.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-disabled)', fontSize: '12px', marginTop: '20px' }}>
              Ninguna diapositiva creada. Escribe una prédica o añade un versículo.
            </div>
          ) : (
            <div className="slides-list">
              {slides.map((slide, idx) => (
                <div 
                  key={slide.id} 
                  className={`slide-thumb-card ${activeSlideId === slide.id ? 'active' : ''}`}
                  onClick={() => onSelectSlide(slide.id)}
                >
                  <div className="slide-thumb-index">{idx + 1}</div>
                  
                  <div className="slide-thumb-info">
                    <span className="slide-thumb-text">{slide.text || '(Vacía)'}</span>
                    {slide.reference && (
                      <span className="slide-thumb-ref">{slide.reference}</span>
                    )}
                  </div>
                  
                  {/* Reordering and Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                      <button 
                        className="slide-thumb-delete" 
                        style={{ opacity: idx > 0 ? 1 : 0.3 }}
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); onReorderSlides(idx, idx - 1); }}
                        title="Subir"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <button 
                        className="slide-thumb-delete" 
                        style={{ opacity: idx < slides.length - 1 ? 1 : 0.3 }}
                        disabled={idx === slides.length - 1}
                        onClick={(e) => { e.stopPropagation(); onReorderSlides(idx, idx + 1); }}
                        title="Bajar"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </div>
                    <button 
                      className="slide-thumb-delete"
                      onClick={(e) => { e.stopPropagation(); onDeleteSlide(slide.id); }}
                      title="Eliminar diapositiva"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
