// ============================================================
// parser.js  —  LaTeX expression → JS function compiler
// ============================================================

function compileMathExpression(latex) {
    if (!latex) return null;
    let s = latex
        .replace(/\\left/g, '').replace(/\\right/g, '')
        .replace(/\\ /g, '').replace(/\s+/g, '');

    // Fractions
    let prevS;
    do {
        prevS = s;
        s = s.replace(/\\frac(\d)(\d)/g, '($1)/($2)');
        s = s.replace(/\\frac{([^{}]+)}{([^{}]+)}/g, '($1)/($2)');
    } while (s !== prevS);

    s = s.replace(/\\cdot/g, '*').replace(/\\times/g, '*');

    // Superscripts
    s = s.replace(/\^{([^{}]+)}/g, '^($1)');
    s = s.replace(/\^/g, '**');

    // Implicit multiplication
    s = s.replace(/(\d)([xX\(])/g, '$1*$2');
    s = s.replace(/([xX\)])(\()/g, '$1*$2');
    s = s.replace(/(\))([xX\d])/g, '$1*$2');

    // Unary minus fix
    s = s.replace(/(^|[\+\-\*\/\(\=])(-)(?=[xX\(])/g, '$1(-1)*');

    try {
        const fn = new Function('x', `return ${s};`);
        const testVal = fn(1);
        if (isNaN(testVal) && typeof testVal !== 'number') return null;
        return fn;
    } catch (e) {
        console.error('수식 변환 오류:', e, '원본:', latex, '변환:', s);
        return null;
    }
}
