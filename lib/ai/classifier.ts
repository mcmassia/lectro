import { BookCategory } from '@/lib/db';

// ===================================
// Definiciones de Categorías
// ===================================

export const CATEGORY_DEFINITIONS: Record<BookCategory, string> = {
    'Pensamiento': 'Filosofía, ética, marcos teóricos mentales, lógica, epistemología',
    'Espiritualidad': 'Religión, teología, mística, mitología, espiritualidad no religiosa',
    'Sociedad': 'Historia, política, sociología, economía aplicada',
    'Ciencia': 'Divulgación científica, física, biología, matemáticas, astronomía',
    'Tecnología': 'IA, informática, ingeniería, futuro digital, innovación',
    'Narrativa': 'Novela, cuento, épica, ficción general (realista, fantástica, distópica)',
    'PoesíaDrama': 'Poesía lírica, teatro, drama escénico',
    'ArteCultura': 'Pintura, arquitectura, música, cine, diseño, crítica cultural',
    'Crecimiento': 'Psicología, salud, desarrollo personal, liderazgo, productividad',
    'Práctica': 'Manuales, idiomas, guías, cocina, viajes, geografía',
    'SinClasificar': 'No se pudo clasificar automáticamente'
};

// Mapeo de palabras clave a categorías (multilingüe ES/EN)
const KEYWORD_MAP: Record<string, BookCategory> = {
    // Narrativa
    'fiction': 'Narrativa',
    'ficción': 'Narrativa',
    'novel': 'Narrativa',
    'novela': 'Narrativa',
    'fantasy': 'Narrativa',
    'fantasía': 'Narrativa',
    'science fiction': 'Narrativa',
    'ciencia ficción': 'Narrativa',
    'thriller': 'Narrativa',
    'mystery': 'Narrativa',
    'misterio': 'Narrativa',
    'romance': 'Narrativa',
    'horror': 'Narrativa',
    'terror': 'Narrativa',
    'adventure': 'Narrativa',
    'aventura': 'Narrativa',
    'dystopian': 'Narrativa',
    'distopía': 'Narrativa',
    'literary fiction': 'Narrativa',
    'literature': 'Narrativa',
    'literatura': 'Narrativa',
    'story': 'Narrativa',
    'stories': 'Narrativa',
    'relato': 'Narrativa',
    'cuento': 'Narrativa',
    'cuentos': 'Narrativa',
    'comic': 'Narrativa',
    'manga': 'Narrativa',
    'novels': 'Narrativa',
    'general fiction': 'Narrativa',

    // Poesía y Drama
    'poetry': 'PoesíaDrama',
    'poesía': 'PoesíaDrama',
    'poems': 'PoesíaDrama',
    'poemas': 'PoesíaDrama',
    'drama': 'PoesíaDrama',
    'theater': 'PoesíaDrama',
    'teatro': 'PoesíaDrama',
    'plays': 'PoesíaDrama',
    'tragedy': 'PoesíaDrama',
    'comedy': 'PoesíaDrama',

    // Pensamiento
    'philosophy': 'Pensamiento',
    'filosofía': 'Pensamiento',
    'ethics': 'Pensamiento',
    'ética': 'Pensamiento',
    'logic': 'Pensamiento',
    'lógica': 'Pensamiento',
    'epistemology': 'Pensamiento',
    'epistemología': 'Pensamiento',
    'metaphysics': 'Pensamiento',
    'metafísica': 'Pensamiento',
    'stoicism': 'Pensamiento',
    'estoicismo': 'Pensamiento',

    // Espiritualidad
    'religion': 'Espiritualidad',
    'religión': 'Espiritualidad',
    'spirituality': 'Espiritualidad',
    'espiritualidad': 'Espiritualidad',
    'theology': 'Espiritualidad',
    'teología': 'Espiritualidad',
    'mythology': 'Espiritualidad',
    'mitología': 'Espiritualidad',
    'bible': 'Espiritualidad',
    'biblia': 'Espiritualidad',
    'buddhism': 'Espiritualidad',
    'budismo': 'Espiritualidad',
    'christianity': 'Espiritualidad',
    'cristianismo': 'Espiritualidad',
    'islam': 'Espiritualidad',
    'hinduism': 'Espiritualidad',
    'meditation': 'Espiritualidad',
    'meditación': 'Espiritualidad',
    'occult': 'Espiritualidad',
    'esoterismo': 'Espiritualidad',

    // Sociedad
    'history': 'Sociedad',
    'historia': 'Sociedad',
    'politics': 'Sociedad',
    'política': 'Sociedad',
    'economics': 'Sociedad',
    'economía': 'Sociedad',
    'sociology': 'Sociedad',
    'sociología': 'Sociedad',
    'anthropology': 'Sociedad',
    'antropología': 'Sociedad',
    'war': 'Sociedad',
    'guerra': 'Sociedad',
    'biography': 'Sociedad',
    'biografía': 'Sociedad',
    'memoir': 'Sociedad',
    'memorias': 'Sociedad',
    'social science': 'Sociedad',
    'ciencias sociales': 'Sociedad',

    // Ciencia
    'science': 'Ciencia',
    'ciencia': 'Ciencia',
    'physics': 'Ciencia',
    'física': 'Ciencia',
    'biology': 'Ciencia',
    'biología': 'Ciencia',
    'chemistry': 'Ciencia',
    'química': 'Ciencia',
    'mathematics': 'Ciencia',
    'matemáticas': 'Ciencia',
    'astronomy': 'Ciencia',
    'astronomía': 'Ciencia',
    'neuroscience': 'Ciencia',
    'neurociencia': 'Ciencia',
    'evolution': 'Ciencia',
    'evolución': 'Ciencia',
    'cosmology': 'Ciencia',
    'cosmología': 'Ciencia',
    'popular science': 'Ciencia',
    'divulgación': 'Ciencia',

    // Tecnología
    'technology': 'Tecnología',
    'tecnología': 'Tecnología',
    'computer': 'Tecnología',
    'informática': 'Tecnología',
    'programming': 'Tecnología',
    'programación': 'Tecnología',
    'artificial intelligence': 'Tecnología',
    'inteligencia artificial': 'Tecnología',
    'software': 'Tecnología',
    'engineering': 'Tecnología',
    'ingeniería': 'Tecnología',
    'data science': 'Tecnología',
    'machine learning': 'Tecnología',
    'cybersecurity': 'Tecnología',
    'blockchain': 'Tecnología',
    'web development': 'Tecnología',

    // Arte y Cultura
    'art': 'ArteCultura',
    'arte': 'ArteCultura',
    'music': 'ArteCultura',
    'música': 'ArteCultura',
    'architecture': 'ArteCultura',
    'arquitectura': 'ArteCultura',
    'photography': 'ArteCultura',
    'fotografía': 'ArteCultura',
    'film': 'ArteCultura',
    'cine': 'ArteCultura',
    'cinema': 'ArteCultura',
    'design': 'ArteCultura',
    'diseño': 'ArteCultura',
    'painting': 'ArteCultura',
    'pintura': 'ArteCultura',
    'sculpture': 'ArteCultura',
    'escultura': 'ArteCultura',
    'culture': 'ArteCultura',
    'cultura': 'ArteCultura',
    'fashion': 'ArteCultura',
    'moda': 'ArteCultura',

    // Crecimiento
    'self-help': 'Crecimiento',
    'autoayuda': 'Crecimiento',
    'psychology': 'Crecimiento',
    'psicología': 'Crecimiento',
    'personal development': 'Crecimiento',
    'desarrollo personal': 'Crecimiento',
    'business': 'Crecimiento',
    'negocios': 'Crecimiento',
    'productivity': 'Crecimiento',
    'productividad': 'Crecimiento',
    'leadership': 'Crecimiento',
    'liderazgo': 'Crecimiento',
    'management': 'Crecimiento',
    'gestión': 'Crecimiento',
    'motivation': 'Crecimiento',
    'motivación': 'Crecimiento',
    'health': 'Crecimiento',
    'salud': 'Crecimiento',
    'fitness': 'Crecimiento',
    'nutrition': 'Crecimiento',
    'nutrición': 'Crecimiento',
    'mindfulness': 'Crecimiento',
    'habits': 'Crecimiento',
    'hábitos': 'Crecimiento',
    'marketing': 'Crecimiento',

    // Práctica
    'cooking': 'Práctica',
    'cocina': 'Práctica',
    'recipes': 'Práctica',
    'recetas': 'Práctica',
    'travel': 'Práctica',
    'viajes': 'Práctica',
    'language': 'Práctica',
    'idiomas': 'Práctica',
    'guide': 'Práctica',
    'guía': 'Práctica',
    'manual': 'Práctica',
    'how-to': 'Práctica',
    'tutorial': 'Práctica',
    'reference': 'Práctica',
    'referencia': 'Práctica',
    'gardening': 'Práctica',
    'jardinería': 'Práctica',
    'crafts': 'Práctica',
    'manualidades': 'Práctica',
    'diy': 'Práctica',
    'ecology': 'Práctica',
    'ecología': 'Práctica',
    'geography': 'Práctica',
    'geografía': 'Práctica'
};

// ===================================
// Clasificación por Reglas
// ===================================

/**
 * Clasifica un libro basándose en sus metadatos (subjects, description, título)
 * Sin usar IA - solo coincidencia de palabras clave
 * Retorna TODAS las categorías que coincidan con un score mínimo
 */
export function classifyByRules(
    title: string,
    author: string,
    description?: string,
    subjects?: string[]
): BookCategory[] {
    // Combinar todos los textos disponibles para buscar palabras clave
    const textsToSearch: string[] = [];

    if (subjects?.length) {
        textsToSearch.push(...subjects.map(s => s.toLowerCase()));
    }

    if (description) {
        textsToSearch.push(description.toLowerCase());
    }

    // También buscar en el título (puede dar pistas)
    textsToSearch.push(title.toLowerCase());

    const combinedText = textsToSearch.join(' ');

    // Si no hay suficiente texto para analizar, retornar array vacío
    if (combinedText.length < 10) {
        return [];
    }

    // Contar coincidencias por categoría
    const categoryScores: Record<BookCategory, number> = {
        'Pensamiento': 0,
        'Espiritualidad': 0,
        'Sociedad': 0,
        'Ciencia': 0,
        'Tecnología': 0,
        'Narrativa': 0,
        'PoesíaDrama': 0,
        'ArteCultura': 0,
        'Crecimiento': 0,
        'Práctica': 0,
        'SinClasificar': 0
    };

    // Buscar coincidencias de palabras clave
    for (const [keyword, category] of Object.entries(KEYWORD_MAP)) {
        if (combinedText.includes(keyword)) {
            categoryScores[category] += 1;

            // Bonus si la palabra clave está en los subjects (más confiable)
            if (subjects?.some(s => s.toLowerCase().includes(keyword))) {
                categoryScores[category] += 2;
            }
        }
    }

    // Retornar TODAS las categorías con score >= 1, ordenadas por score (max 2)
    const matchedCategories = Object.entries(categoryScores)
        .filter(([category, score]) => score >= 1 && category !== 'SinClasificar')
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([category]) => category as BookCategory);

    return matchedCategories;
}

// ===================================
// Clasificación con IA (Fallback)
// ===================================

/**
 * Clasifica un libro usando Gemini cuando las reglas no son suficientes
 */
export async function classifyWithAI(
    title: string,
    author: string,
    description?: string,
    subjects?: string[]
): Promise<BookCategory[]> {
    // Importar dinámicamente para evitar problemas si no hay API key
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!apiKey) {
        console.warn('No Gemini API key available for AI classification');
        return [];
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            generationConfig: { responseMimeType: 'application/json' }
        });

        const categoryList = Object.entries(CATEGORY_DEFINITIONS)
            .filter(([k]) => k !== 'SinClasificar')
            .map(([k, v]) => `- ${k}: ${v}`)
            .join('\n');

        const prompt = `Clasifica este libro en HASTA DOS (2) de las siguientes categorías temáticas. Elige las más relevantes.

${categoryList}

Libro:
- Título: ${title}
- Autor: ${author}
${description ? `- Descripción: ${description.slice(0, 500)}` : ''}
${subjects?.length ? `- Temas: ${subjects.join(', ')}` : ''}

Responde SOLO con JSON: {"categories": ["NombreCategoría1", "NombreCategoría2"]}
Las categorías deben ser exactamente de las listadas arriba. Retorna un array vacío si no encaja en ninguna.`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Limpiar posibles bloques de código markdown
        const cleanedResponse = responseText
            .replace(/^```json\n?/, '')
            .replace(/\n?```$/, '')
            .trim();

        const response = JSON.parse(cleanedResponse);

        // Validar que las categorías son válidas
        if (response.categories && Array.isArray(response.categories)) {
            const validCategories = response.categories.filter((c: string) => c in CATEGORY_DEFINITIONS) as BookCategory[];
            return validCategories.slice(0, 2);
        }

        return [];
    } catch (error) {
        console.error('AI classification failed:', error);
        return [];
    }
}

// ===================================
// Función Principal de Clasificación
// ===================================

export interface ClassificationResult {
    categories: BookCategory[];
    method: 'rules' | 'ai' | 'none';
    confidence: 'high' | 'medium' | 'low';
}

/**
 * Clasifica un libro usando reglas primero, luego IA si es necesario.
 * Retorna múltiples categorías si aplican.
 * Si no hay metadatos suficientes, retorna array vacío.
 */
export async function classifyBookCategories(
    title: string,
    author: string,
    description?: string,
    subjects?: string[]
): Promise<ClassificationResult> {
    // Verificar si hay metadatos suficientes
    const hasMetadata = (subjects && subjects.length > 0) ||
        (description && description.length > 50);

    if (!hasMetadata) {
        return {
            categories: [],
            method: 'none',
            confidence: 'low'
        };
    }

    // Intentar clasificación por reglas primero
    const ruleBasedCategories = classifyByRules(title, author, description, subjects);

    if (ruleBasedCategories.length > 0) {
        return {
            categories: ruleBasedCategories,
            method: 'rules',
            confidence: 'high'
        };
    }

    // Si hay API key, usar IA como fallback (solo retorna una categoría)
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (apiKey) {
        const aiCategories = await classifyWithAI(title, author, description, subjects);
        return {
            categories: aiCategories,
            method: 'ai',
            confidence: aiCategories.length === 0 ? 'low' : 'medium'
        };
    }

    // Sin reglas ni IA disponible
    return {
        categories: [],
        method: 'none',
        confidence: 'low'
    };
}

// Mantener función legacy para compatibilidad (deprecated)
export async function classifyBookCategory(
    title: string,
    author: string,
    description?: string,
    subjects?: string[]
): Promise<{ category: BookCategory; method: string; confidence: string }> {
    const result = await classifyBookCategories(title, author, description, subjects);
    return {
        category: result.categories[0] || 'SinClasificar',
        method: result.method,
        confidence: result.confidence
    };
}
