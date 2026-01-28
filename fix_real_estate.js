const fs = require('fs');
const path = 'd:\\Projects\\VeriMetre\\app\\(tabs)\\real-estate.tsx';

try {
    let content = fs.readFileSync(path, 'utf8');

    // 1. Reset imports if mangled ` ``` ` logic
    // We already removed ` ``` ` in previous step, so just reading clean file.

    // 2. Remove misplaced imports
    // Regex to remove `import { useRouter } from 'expo-router';` at line 31
    // We will place it at the top.
    const importRouter = "import { useRouter } from 'expo-router';";
    if (content.includes(importRouter)) {
        content = content.replace(importRouter, '');
        // Add to top if not present (it was removed)
        // Insert after last import
        const lastImportIdx = content.lastIndexOf('import ');
        const endOfImportLine = content.indexOf('\n', lastImportIdx);
        content = content.slice(0, endOfImportLine + 1) + importRouter + '\n' + content.slice(endOfImportLine + 1);
    }

    // 3. Fix `</Modal            {/*`
    content = content.replace(/<\/Modal\s+\{\/\*/g, '</Modal>\n            {/*');

    // 4. Fix spaces in className hyphens
    // Regex: look for `className="` or `className={` and fix inside.
    // Simplifying: search for ` - ` and replace with `-` IF it looks like a class.
    // Safer: Replace ` - ` with `-` globally? No.
    // Only where it matches `[a-z0-9] - [a-z0-9]`.
    // Valid math `width - 40` (h - 4). `activeSlide - 1` (e - 1).
    // Valid classes `flex - row` (x - r). `items - center` (s - c).
    // `text - [10px]` (t - [).
    // `w - full` (w - f).

    // Strategy: Replace ` - ` with `-` if left char is a word char, and right char IS NOT A DIGIT (unless inside brackets?).
    // No, `w-1` is valid.
    // The issue is distinguishing `width - 40` from `w - 40`.
    // `width` is a variable. `w` is a class prefix.

    // Let's use specific replacements for common patterns found in the file.
    const patterns = [
        /flex - row/g, /flex-row/,
        /items - center/g, /items-center/,
        /items - start/g, /items-start/,
        /justify - between/g, /justify-between/,
        /justify - center/g, /justify-center/,
        /self - start/g, /self-start/,
        /gap - /g, /gap-/,
        /text - /g, /text-/,
        /font - /g, /font-/,
        /bg - /g, /bg-/,
        /border - /g, /border-/,
        /px - /g, /px-/,
        /py - /g, /py-/,
        /p - /g, /p-/,
        /m - /g, /m-/,
        /mt - /g, /mt-/,
        /mb - /g, /mb-/,
        /mr - /g, /mr-/,
        /ml - /g, /ml-/,
        /rounded - /g, /rounded-/,
        /w - /g, /w-/,
        /h - /g, /h-/,
        /min - /g, /min-/,
        /max - /g, /max-/,
        /shadow - /g, /shadow-/,
        /transition - /g, /transition-/,
        /active:bg - /g, /active:bg-/,
        / - full/g, /-full/, // absolute - full -> absolute-full is not class? rounded - full -> rounded-full
        /absolute - /g, /absolute-/, // absolute-fill ? No, absolute is class.
        // Special cases
        / - \[/g, '-[' // text - [10px] -> text-[10px]
    ];

    // We need to iterate carefully.
    // Actually, simple strings replacement is safer than global regex for vague patterns.
    // I entered pairs above.
    // Let's iterate.

    // Wait, `patterns` array above is pseudo-code.
    // Let's build a chain of replaces.

    const replacements = [
        // "Bad" -> "Good"
        // Common prefixes
        { r: /(flex|items|justify|self|text|font|bg|border|rounded|shadow|transition|absolute|relative|overflow|tracking|leading) - /g, to: '$1-' },
        // Spacing/Sizing
        { r: /(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|gap|top|bottom|left|right|z) - /g, to: '$1-' },
        // Suffixes that might be detached
        { r: / - (full|screen|center|between|start|end|bold|medium|semibold|extrabold|white|slate|blue|red|green|orange|yellow|transparent|hidden|visible|auto)/g, to: '-$1' },
        // Bracket start
        { r: / - \[/g, to: '-[' },
        // Colors / Opacity: `bg-slate-800` -> `bg - slate - 800` (already handled by prefix `bg - ` -> `bg-slate - 800`. Then `slate - 800`?
        // We need to run multiple passes or handle `word - word - number`.
        // `slate - 800` -> `slate-800`.
        // `blue - 600`
        { r: /(slate|blue|red|green|orange|yellow|black|white|gray) - (\d+)/g, to: '$1-$2' },
        // Opacity slash? `bg-red-500/20` -> `bg - red - 500 / 20`?
        // ` / ` -> `/`.
        // Inside className matches only?
        // Risky if math `width / 2`.
        // But `width / 2` usually has spaces.
        // `bg-red-500/20` usually NO spaces.
        // If I see ` / \d` inside a string... 
        // Let's skip slash for now, or just look for `0 / 20`?

        // Also fix `width: \`\${...}% \``
        { r: /\}% `/g, to: '}%`' },

        // Fix `visible = {` -> `visible={`
        { r: / = \{/g, to: '={' },

        // Fix `< View`
        { r: /< View/g, to: '<View' },
        { r: /<\/ View/g, to: '</View' },
        { r: /<\/View >/g, to: '</View>' },
        { r: /< Text/g, to: '<Text' },
        { r: /< TouchableOpacity/g, to: '<TouchableOpacity' },
        { r: /< Modal/g, to: '<Modal' },
        { r: /< ScrollView/g, to: '<ScrollView' },
    ];

    replacements.forEach(item => {
        content = content.replace(item.r, item.to);
    });

    // Double pass for chained hyphens like `bg - slate - 800`
    // First pass `bg - ` -> `bg-slate - 800`.
    // Second pass `slate - 800` -> `slate-800`.
    replacements.forEach(item => {
        content = content.replace(item.r, item.to);
    });

    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed real-estate.tsx');
} catch (e) {
    console.error(e);
}
