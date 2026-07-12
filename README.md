# AutoRedactor 📖✨

**AutoRedactor** es una aplicación web premium, moderna y responsiva diseñada específicamente para pastores, predicadores y líderes ministeriales. Permite recibir bosquejos o textos de prédicas, extraer y formatear versículos bíblicos de forma automática, y diseñar diapositivas visualmente impactantes para proyectar en pantallas, tabletas o dispositivos móviles.

El sistema funciona **100% en el cliente (offline)** y cuenta con potentes capacidades de exportación a PowerPoint (.pptx), PDF y colecciones de imágenes en alta definición (.jpg / .zip).

---

## 🌟 Características Principales

### 1. Procesamiento Inteligente de Prédicas
* **División Automática**: Separa el texto de tu bosquejo en diapositivas individuales por párrafos (doble salto de línea) o mediante el delimitador manual `---`.
* **Detección de Citas Bíblicas**: Identifica de forma automática citas en el texto como `Juan 3:16`, `Mateo 6:33 (NVI)` o `1 Crónicas 29:3 "TLA"`.
  * **Extracción Inteligente**: Si escribes solo la cita, el sistema busca y extrae automáticamente el texto bíblico desde las bases de datos locales.
  * **Soporte de Traducciones**: Reconoce el sufijo de la versión (ej: `TLA`, `NVI`, `DHH`) directamente en el texto del bosquejo y aplica la traducción correspondiente.

### 2. Base de Datos Bíblica Offline (7 Versiones)
El proyecto incluye bases de datos estáticas en formato JSON cargadas dinámicamente y bajo demanda para evitar el uso de APIs externas o conexión a internet:
* **RVR1960** (Reina Valera 1960)
* **NVI** (Nueva Versión Internacional)
* **TLA** (Traducción en Lenguaje Actual)
* **NTV** (Nueva Traducción Viviente)
* **LBLA** (La Biblia de las Américas)
* **DHH** (Dios Habla Hoy)
* **NBLA** (Nueva Biblia de las Américas)

### 3. Buscador Bíblico Integrado
* **Búsqueda por Referencia**: Selecciona Libro, Capítulo y rango de Versículos en cualquiera de las 7 versiones disponibles e insértalos directamente como una nueva diapositiva.
* **Búsqueda Global por Palabras Clave**: Escribe palabras como *"fe"*, *"fortaleza"* o *"esperanza"* y el buscador buscará coincidencias en toda la Biblia en milisegundos.

### 4. Lienzo de Previsualización Multidispositivo
* Alterna la vista del lienzo para simular múltiples pantallas:
  * **Desktop**: Relación 16:9 (1920x1080 escalado proporcionalmente al 50%).
  * **Tableta**: Relación 4:3 (1024x768 escalado al 70%).
  * **Móvil**: Relación 9:16 (1080x1920 escalado al 28%).
* Navegación rápida entre diapositivas en la barra superior.

### 5. Edición Estilizada y Personalización Premium
* **Tipografía**: Selección de fuentes elegantes preinstaladas y cargadas desde Google Fonts (*Inter*, *Montserrat*, *Playfair Display*, *Lora*, *Cinzel*). Controles de tamaño, interlineado, color, negrita, cursiva y mayúsculas.
* **Posicionamiento**: Alineación de texto (izquierda, centro, derecha, justificado) y distribución vertical/horizontal mediante una cuadrícula visual de 3x3 (Flexbox).
* **Sombras**: Añade sombreado de texto personalizable (difuminado y color) para asegurar legibilidad en cualquier fondo.
* **Fondos**:
  * **Sólidos**: Paletas de colores curadas y selector personalizado.
  * **Degradados**: Fondos lineales premium listos para usar (Midnight Purple, Warm Ember, Deep Sea...).
  * **Imágenes**: Pega URLs de imágenes o sube tus propios archivos locales (JPG / PNG).
  * **Capa Superpuesta (Overlay)**: Añade un filtro de color oscuro con opacidad regulable sobre las imágenes de fondo para garantizar la perfecta lectura del texto.
* **Ámbito del Estilo**: Modifica estilos globalmente para toda la presentación o activa "Solo Esta" para darle un diseño único a una diapositiva especial (ej: un versículo dorado).

### 6. Sistema de Exportación en Alta Definición
El renderizado se realiza en un contenedor del DOM oculto a resolución nativa completa (sin escalado de previsualización) para asegurar descargas ultra nítidas y sin deformaciones:
* **JPG Actual**: Descarga la diapositiva seleccionada en formato de imagen JPG.
* **ZIP Imágenes**: Exporta toda la presentación como una colección ordenada de imágenes empaquetadas en un archivo `.zip`.
* **Exportar PDF**: Genera un archivo PDF horizontal con una diapositiva de alta calidad por página.
* **PowerPoint (.pptx)**: Genera una presentación nativa de PowerPoint donde cada diapositiva tiene insertada su imagen renderizada a pantalla completa, garantizando precisión de pixel y fidelidad tipográfica en cualquier equipo.

---

## 🛠️ Tecnologías Utilizadas

* **Framework**: React (con TypeScript) + Vite.
* **Estilos**: CSS Nativo Moderno (Flexbox, CSS Grid, variables CSS, transiciones, animaciones).
* **Iconos**: Lucide React.
* **Render de Diapositivas**: html-to-image (DOM a Canvas/JPEG).
* **Compilación de PDF**: jsPDF.
* **Compilación de PowerPoint**: pptxgenjs.
* **Compilación de ZIP**: JSZip.

---

## 🚀 Instalación y Uso Local

Sigue estos pasos para ejecutar la aplicación en tu entorno local:

### Requisitos Previos
* Tener instalado **Node.js** (versión 18 o superior recomendada).
* Tener instalado **npm** (incluido por defecto con Node.js).

### Pasos de Configuración

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/leonnnc/autoredactor.git
   cd autoredactor
   ```

2. **Instalar las dependencias**:
   ```bash
   npm install
   ```

3. **Iniciar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   Abre tu navegador en la URL indicada en la terminal (por defecto, **http://localhost:5173/** o la siguiente libre).

4. **Compilar para producción (opcional)**:
   ```bash
   npm run build
   ```
   Los archivos listos para desplegar se generarán en la carpeta `/dist`.
