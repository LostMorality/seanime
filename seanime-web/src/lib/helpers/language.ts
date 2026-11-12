type LanguageSource = {
    label?: string;
    language?: string;
};

type LanguageMatchSource = LanguageSource & {
    title?: string;
};

const LANG_MAP: Record<string, string> = {
    en: "en", eng: "en", english: "en",
    ru: "ru", rus: "ru", russian: "ru",
    fr: "fr", fre: "fr", fra: "fr", french: "fr",
    de: "de", ger: "de", deu: "de", german: "de",
    es: "es", spa: "es", spanish: "es",
    it: "it", ita: "it", italian: "it",
    pt: "pt", por: "pt", portuguese: "pt",
    nl: "nl", dut: "nl", nld: "nl", dutch: "nl",
    pl: "pl", pol: "pl", polish: "pl",
    uk: "uk", ukr: "uk", ukrainian: "uk",
    ja: "ja", jpn: "ja", japanese: "ja", jp: "ja", jap: "ja",
    zh: "zh", chi: "zh", zho: "zh", chinese: "zh",
    ko: "ko", kor: "ko", korean: "ko",
    ar: "ar", ara: "ar", arabic: "ar",
    hi: "hi", hin: "hi", hindi: "hi",
    tr: "tr", tur: "tr", turkish: "tr",
    vi: "vi", vie: "vi", vietnamese: "vi",
    sv: "sv", swe: "sv", swedish: "sv",
    da: "da", dan: "da", danish: "da",
    fi: "fi", fin: "fi", finnish: "fi",
    no: "no", nor: "no", norwegian: "no",
    el: "el", gre: "el", greek: "el",
    he: "he", heb: "he", hebrew: "he",
    id: "id", ind: "id", indonesian: "id",
    th: "th", tha: "th", thai: "th",

    deutsch: "de",
    español: "es", castellano: "es",
    français: "fr",
    italiano: "it",
    português: "pt", brazilian: "pt",
    polski: "pl",
    nederlands: "nl",
    dansk: "da",
    suomi: "fi",
    norsk: "no",
    svenska: "sv",
}

const SCRIPT_CHECKS = [
    { code: "ko", re: /[\uAC00-\uD7AF]/ },        // Hangul
    { code: "ja", re: /[\u3040-\u30FF]/ },        // Hiragana/Katakana
    { code: "zh", re: /[\u4E00-\u9FFF]/ },        // Han (Chinese)
    { code: "uk", re: /[ЄІЇҐєіїґ]/ },             // Specific Ukrainian Cyrillic
    { code: "ru", re: /[\u0400-\u04FF]/ },        // General Cyrillic
    { code: "th", re: /[\u0E00-\u0E7F]/ },        // Thai
    { code: "ar", re: /[\u0600-\u06FF]/ },        // Arabic
    { code: "he", re: /[\u0590-\u05FF]/ },        // Hebrew
    { code: "el", re: /[\u0370-\u03FF]/ },        // Greek
    { code: "hi", re: /[\u0900-\u097F]/ },        // Devanagari
    { code: "bn", re: /[\u0980-\u09FF]/ },        // Bengali
    { code: "vi", re: /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/ }, // Viet specific
]

const HAS_NON_ASCII = /[^\u0000-\u007f]/

const TOKENIZER = /[a-z0-9\u00C0-\u00FF]+/g

export function detectTrackLanguage(source: LanguageSource): string | null {
    if (source.language) {
        const cleanLang = source.language.trim().toLowerCase()
        if (LANG_MAP[cleanLang]) return LANG_MAP[cleanLang]
        if (cleanLang.length === 2) return cleanLang // Fallback for valid ISO codes
    }

    if (!source.label) return null
    const label = source.label

    if (HAS_NON_ASCII.test(label)) {
        for (let i = 0; i < SCRIPT_CHECKS.length; i++) {
            if (SCRIPT_CHECKS[i].re.test(label)) {
                return SCRIPT_CHECKS[i].code
            }
        }
    }

    const lowerLabel = label.toLowerCase()
    const tokens = lowerLabel.match(TOKENIZER)

    if (tokens) {
        for (let i = 0; i < tokens.length; i++) {
            const match = LANG_MAP[tokens[i]]
            if (match) return match
        }
    }

    return null
}

function tokenizeLanguageValue(value?: string | null): string[] {
    return value?.toLowerCase().match(TOKENIZER) ?? []
}

export function isTrackLanguageMatch(source: LanguageMatchSource, preference: string): boolean {
    const pref = preference.trim().toLowerCase()
    if (!pref) return false

    const normalizedPref = detectTrackLanguage({ language: pref }) || pref
    const trackLang = detectTrackLanguage({
        language: source.language,
        label: source.label ?? source.title,
    })
    if (trackLang && trackLang === normalizedPref) return true

    const lang = source.language?.trim().toLowerCase()
    if (lang && (lang === pref || lang === normalizedPref)) return true
    if (lang) {
        const langTokens = tokenizeLanguageValue(lang)
        if (langTokens.some(token => token === pref || detectTrackLanguage({ language: token }) === normalizedPref)) return true
    }

    return [
        ...tokenizeLanguageValue(source.label),
        ...tokenizeLanguageValue(source.title),
    ].some(token => token === pref || detectTrackLanguage({ language: token }) === normalizedPref)
}

const LANGUAGE_NAMES: Record<string, string> = {
    en: "English", ru: "Russian", fr: "French", de: "German", es: "Spanish", it: "Italian", pt: "Portuguese",
    nl: "Dutch", pl: "Polish", uk: "Ukrainian", ja: "Japanese", zh: "Chinese", ko: "Korean", ar: "Arabic",
    hi: "Hindi", tr: "Turkish", vi: "Vietnamese", sv: "Swedish", da: "Danish", fi: "Finnish", no: "Norwegian",
    el: "Greek", he: "Hebrew", id: "Indonesian", th: "Thai",
}

export type LanguageSuggestion = { code: string, name: string, aliases: string[] }

// "English", "eng", "español" -> "en"/"es". Unlisted 2-letter codes are kept as they are, like detectTrackLanguage does.
export function getLanguageCode(word: string): string | null {
    const w = word.trim().toLowerCase()
    if (LANG_MAP[w]) return LANG_MAP[w]
    if (/^[a-z]{2}$/.test(w)) return w
    return null
}

// Every spelling the matcher understands for a language, e.g. "en" -> ["en", "eng", "english"]
export function getLanguageAliases(code: string): string[] {
    const aliases = Object.keys(LANG_MAP).filter(k => LANG_MAP[k] === code && /^[a-z]+$/.test(k))
    return aliases.length ? aliases.sort((a, b) => a.length - b.length) : [code]
}

function toSuggestion(code: string): LanguageSuggestion {
    return { code, name: LANGUAGE_NAMES[code] ?? code.toUpperCase(), aliases: getLanguageAliases(code) }
}

// Turns a typed word ("english", "eng", "japan", "spa") into the languages it most likely means
export function suggestLanguages(text: string, limit = 3): LanguageSuggestion[] {
    const q = text.trim().toLowerCase()
    if (!q) return []
    const exact = LANG_MAP[q]
    if (exact) return [toSuggestion(exact)]
    const codes: string[] = []
    for (const [key, code] of Object.entries(LANG_MAP)) {
        if (key.startsWith(q) && !codes.includes(code)) codes.push(code)
    }
    for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
        if (name.toLowerCase().startsWith(q) && !codes.includes(code)) codes.push(code)
    }
    return codes.slice(0, limit).map(toSuggestion)
}

// What a comma separated preference like "en,eng,jpn,xyz" is understood as, in order
export function describeLanguageList(value: string): { known: LanguageSuggestion[], unknown: string[] } {
    const known: LanguageSuggestion[] = []
    const unknown: string[] = []
    for (const part of value.split(",").map(p => p.trim()).filter(Boolean)) {
        if (part.toLowerCase() === "none") continue
        const code = getLanguageCode(part)
        if (code) {
            if (!known.some(k => k.code === code)) known.push(toSuggestion(code))
        } else {
            unknown.push(part)
        }
    }
    return { known, unknown }
}
