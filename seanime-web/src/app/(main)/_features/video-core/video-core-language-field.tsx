import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TextInput } from "@/components/ui/text-input"
import { describeLanguageList, getLanguageAliases, getLanguageCode, suggestLanguages } from "@/lib/helpers/language"
import React from "react"

function splitList(value: string) {
    return value.split(",").map(p => p.trim()).filter(Boolean)
}

// Comma separated language preference with plain-language feedback:
// shows what each entry is understood as, suggests a language for words it doesn't know ("engl" -> English)
// and can fill in every spelling of a language so tracks tagged "en", "eng" or "English" all match
export function VideoCoreLanguageField(props: {
    label: string
    value: string
    onValueChange: (value: string) => void
    placeholder?: string
}) {
    const { label, value, onValueChange, placeholder } = props
    const { known, unknown } = React.useMemo(() => describeLanguageList(value), [value])

    const parts = splitList(value)
    const missingSpellings = known.some(lang => lang.aliases.some(a => !parts.some(p => p.toLowerCase() === a)))
    const codeOf = (part: string) => getLanguageCode(part)

    const replacePart = (part: string, code: string) => {
        const aliases = getLanguageAliases(code)
        const next: string[] = []
        for (const p of parts) {
            if (p === part) next.push(...aliases)
            else next.push(p)
        }
        onValueChange(Array.from(new Set(next)).join(","))
    }

    const removeLanguage = (code: string) => {
        onValueChange(parts.filter(p => codeOf(p) !== code).join(","))
    }

    // Expands each language in place, keeping the order (order decides which language wins)
    const addAllSpellings = () => {
        const next: string[] = []
        for (const p of parts) {
            const lang = known.find(k => k.code === codeOf(p))
            next.push(...(lang ? lang.aliases : [p]))
        }
        onValueChange(Array.from(new Set(next)).join(","))
    }

    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">{label}</label>
            <TextInput
                value={value}
                onValueChange={onValueChange}
                placeholder={placeholder}
                onKeyDown={(e) => e.stopPropagation()}
                onInput={(e) => e.stopPropagation()}
            />
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {known.length > 0 && <span className="text-[--muted]">Understood as:</span>}
                {known.map((lang, i) => (
                    <Badge
                        key={lang.code}
                        intent="gray"
                        size="sm"
                        isClosable
                        onClose={() => removeLanguage(lang.code)}
                    >
                        {i + 1}. {lang.name}
                    </Badge>
                ))}
                {missingSpellings && (
                    <Button size="xs" intent="primary-subtle" onClick={addAllSpellings}>
                        Add all spellings
                    </Button>
                )}
            </div>
            {unknown.map(part => {
                const suggestions = suggestLanguages(part)
                return (
                    <div key={part} className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[--orange]">"{part}" isn't a known language.</span>
                        {suggestions.length > 0 && <span className="text-[--muted]">Did you mean</span>}
                        {suggestions.map(s => (
                            <Button key={s.code} size="xs" intent="primary-subtle" onClick={() => replacePart(part, s.code)}>
                                {s.name}
                            </Button>
                        ))}
                    </div>
                )
            })}
        </div>
    )
}
