// name-matcher.mjs
import stringSimilarity from 'string-similarity';
import jaroWinkler from 'jaro-winkler';
import levenshtein from 'levenshtein';
import { metaphone } from 'metaphone';
import { soundex } from 'soundex-code';

class NameMatcher {
    static defaultConfig = {
        replacements: {
            'mr.': '', 'mrs.': '', 'ms.': '', 'dr.': '',
            'bin': 'b', 'binti': 'b', 'al': '', 'ben': 'b',
            'kumari': 'kum', 'kumar': 'kum', 'singh': 's', 'kaur': 'k',
            's/o': 'son of', 'd/o': 'daughter of', 'w/o': 'wife of', 'c/o': 'care of'
        },
        weights: { dice: 0.3, jaro: 0.3, levenshtein: 0.2, phonetic: 0.2 },
        phoneticAlgorithms: ['metaphone', 'soundex'],
        specialCharMap: {
            'àáâãäå': 'a', 'èéêë': 'e', 'ìíîï': 'i',
            'òóôõö': 'o', 'ùúûü': 'u', 'ñ': 'n', 'ç': 'c', 'ß': 'ss'
        }
    };

    constructor(config = {}) {
        this.config = { ...NameMatcher.defaultConfig, ...config };
    }

    #normalizeSpecialCharacters(name) {
        return name.toLowerCase().split('').map(char => {
            for (const [chars, replacement] of Object.entries(this.config.specialCharMap)) {
                if (chars.includes(char)) return replacement;
            }
            return char;
        }).join('');
    }

    #expandAbbreviations(name) {
        return name.replace(
            new RegExp(`\\b(${Object.keys(this.config.replacements).join('|')})\\b`, 'gi'),
            match => this.config.replacements[match.toLowerCase()] || ''
        );
    }

    normalizeName(name) {
        let processed = this.#expandAbbreviations(name);
        processed = this.#normalizeSpecialCharacters(processed);

        processed = processed
            .replace(/([a-z])\./g, '$1')
            .replace(/\b([a-z])\s+/g, '$1 ')
            .replace(/\s+/, ' ')
            .replace(/[^a-z ]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

        const phoneticCodes = {};
        for (const algo of this.config.phoneticAlgorithms) {
            switch (algo) {
                case 'metaphone':
                    phoneticCodes.metaphone = metaphone(processed);
                    break;
                case 'soundex':
                    phoneticCodes.soundex = soundex(processed);
                    break;
            }
        }

        return { original: name, clean: processed, phonetic: phoneticCodes };
    }

    #getPhoneticScore(norm1, norm2) {
        const scores = this.config.phoneticAlgorithms
            .filter(algo => norm1.phonetic[algo] && norm2.phonetic[algo])
            .map(algo => norm1.phonetic[algo] === norm2.phonetic[algo] ? 1 : 0);
        return scores.length ? Math.max(...scores) : 0;
    }

    getSimilarityScore(name1, name2) {
        const norm1 = this.normalizeName(name1);
        const norm2 = this.normalizeName(name2);

        const levDistance = new levenshtein(norm1.clean, norm2.clean).distance;
        const maxLength = Math.max(norm1.clean.length, norm2.clean.length);

        const measures = {
            dice: stringSimilarity.compareTwoStrings(norm1.clean, norm2.clean),
            jaro: jaroWinkler(norm1.clean, norm2.clean),
            levenshtein: 1 - (levDistance / maxLength),
            phonetic: this.#getPhoneticScore(norm1, norm2)
        };

        const totalWeight = Object.values(this.config.weights).reduce((a, b) => a + b, 0);
        const weightedScore = Object.entries(this.config.weights)
            .reduce((sum, [algo, weight]) => sum + (measures[algo] * (weight / totalWeight)), 0);

        return {
            measures,
            normalized: [norm1, norm2],
            score: Math.min(1, weightedScore * 1.15)
        };
    }

    matchDocuments(documents) {
        console.log("Hii-->" , documents)
        const comparisons = {};
        const docs = Object.entries(documents);

        for (let i = 0; i < docs.length; i++) {
            for (let j = i + 1; j < docs.length; j++) {
                const [key1, name1] = docs[i];
                const [key2, name2] = docs[j];
                comparisons[`${key1}-${key2}`] = this.getSimilarityScore(name1, name2);
            }
        }

        return {
            comparisons,
            overallScore: Object.values(comparisons).reduce((sum, { score }) => sum + score, 0)
                / Object.keys(comparisons).length
        };
    }
}

export default NameMatcher;