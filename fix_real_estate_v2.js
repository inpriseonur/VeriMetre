const fs = require('fs');
const path = 'd:\\Projects\\VeriMetre\\app\\(tabs)\\real-estate.tsx';

try {
    let content = fs.readFileSync(path, 'utf8');

    // 1. Fix `</Modal            {/*`
    content = content.replace(/<\/Modal\s+\{\/\*/g, '</Modal>\n            {/*');

    // 2. Aggressive ClassName Fixes
    // Pattern: prefixes followed by " - " followed by something.
    // Handles `flex - row` (spaces on both sides).
    // Handles `w - full`.
    // Handles `text - [`.

    const prefixes = [
        'flex', 'items', 'justify', 'self', 'content',
        'text', 'font', 'bg', 'border', 'rounded', 'shadow', 'transition', 'overflow', 'tracking', 'leading',
        'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr',
        'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr',
        'w', 'h', 'min', 'max', 'z', 'gap',
        'top', 'bottom', 'left', 'right',
        'active:bg', 'hover:bg',
        'slate', 'blue', 'red', 'green', 'orange', 'yellow', 'black', 'white', 'gray'
    ];

    const prefixPattern = `(${prefixes.join('|')})`;

    // Regex: prefix + space + hyphen + space + (word char or bracket)
    // We use \s*-\s* to catch any spacing around hyphen.
    // capture group 1: prefix
    // capture group 2: the char after hyphen
    const regex = new RegExp(`${prefixPattern}\\s*-\\s*([a-zA-Z0-9\\[])`, 'g');

    content = content.replace(regex, '$1-$2');

    // Run it again to catch chained things like `bg - red - 500` -> `bg-red - 500` -> `bg-red-500`
    content = content.replace(regex, '$1-$2');

    // Special suffixes that might be detached like ` - full` without a known prefix? 
    // e.g. `rounded - full` (handled above), `absolute - full` (absolute not in list).
    // Add `absolute`, `relative`.

    const extraPrefixes = ['absolute', 'relative', 'fixed', 'sticky'];
    const extraRegex = new RegExp(`(${extraPrefixes.join('|')})\\s*-\\s*([a-zA-Z0-9\\[])`, 'g');
    content = content.replace(extraRegex, '$1-$2');

    // Fix ` - full`, ` - screen` if they were missed (e.g. if prefix wasn't matched)
    // replace / - (full|screen)/ -> -$1
    content = content.replace(/\s*-\s*(full|screen)/g, '-$1');

    // Fix `visible = {` -> `visible={` 
    content = content.replace(/(\w+)\s+=\s+\{/g, '$1={');

    // Fix spaces within `${...}% `
    content = content.replace(/\}% `/g, '}%`');

    // Fix tags `< View`
    content = content.replace(/<\s+([a-zA-Z]+)/g, '<$1');
    content = content.replace(/<\/\s+([a-zA-Z]+)/g, '</$1');
    content = content.replace(/\/ >/g, '/>'); // self closing ` />`? No, `/>` usually. `\s+>` -> `>`.
    content = content.replace(/([a-zA-Z])\s+>/g, '$1>'); // `</View >` -> `</View>`

    // Fix `useRouter` location again just in case
    const importRouter = "import { useRouter } from 'expo-router';";
    if (content.match(/import \{ useRouter \} from 'expo-router';/)) {
        // Check if it is at top (before `export default`)
        const idx = content.indexOf(importRouter);
        const exportIdx = content.indexOf('export default');
        if (idx > exportIdx) {
            content = content.replace(importRouter, '');
            content = importRouter + '\n' + content;
        }
    }

    fs.writeFileSync(path, content, 'utf8');
    console.log('Fixed real-estate.tsx v2');
} catch (e) {
    console.error(e);
}
