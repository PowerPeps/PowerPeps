'use strict';

// ─────────────────────────────────────────────────────────────────────────────
//  CV PDF Generator — Papillon Virton
//  Usage : npm install   (première fois)
//          node generate-pdfs.js   (ou : npm run pdf)
//
//  Sortie : ./pdf/cv-fr.pdf  ./pdf/cv-en.pdf  ./pdf/cv-ru.pdf
// ─────────────────────────────────────────────────────────────────────────────

const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');
const vm        = require('vm');

const LANGS   = ['fr', 'en', 'ru'];
const PDF_DIR = path.join(__dirname, 'pdf');

// ── Helpers ──────────────────────────────────────────────────────────────────

function mkdirSafe(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function computeAge() {
    const birth = new Date(2003, 3, 22); // 22 avril 2003
    const now   = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
    return age;
}

function loadData(lang) {
    const sandbox = { window: {} };
    vm.createContext(sandbox);

    const read = f => fs.readFileSync(path.join(__dirname, 'data', f), 'utf8');
    vm.runInContext(read(`${lang}.js`),   sandbox);
    vm.runInContext(read('statics.js'),   sandbox);

    return {
        ...sandbox.window.cvLangData,
        technologies: sandbox.window.cvStaticData?.technologies ?? [],
        age: computeAge(),
    };
}

// ── Badge / Tag helpers ───────────────────────────────────────────────────────

function badgeCls(cls) {
    if (!cls) return 'b-gray';
    if (cls.includes('accent')) return 'b-blue';
    if (cls.includes('cyan'))   return 'b-cyan';
    if (cls.includes('green'))  return 'b-green';
    if (cls.includes('orange')) return 'b-orange';
    if (cls.includes('purple')) return 'b-purple';
    return 'b-gray';
}

function badge(text, cls) {
    if (!text) return '';
    return `<span class="badge ${badgeCls(cls)}">${esc(text)}</span>`;
}

function tagCls(c) {
    if (!c) return 't-gray';
    if (c.includes('red'))    return 't-red';
    if (c.includes('orange')) return 't-orange';
    if (c.includes('green'))  return 't-green';
    if (c.includes('accent')) return 't-blue';
    if (c.includes('purple')) return 't-purple';
    if (c.includes('cyan'))   return 't-cyan';
    return 't-gray';
}

function tagList(tags) {
    if (!tags?.length) return '';
    const pills = tags.map(t => `<span class="tag ${tagCls(t.c)}">${esc(t.t)}</span>`).join('');
    return `<div class="tags">${pills}</div>`;
}

function esc(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ── HTML template ─────────────────────────────────────────────────────────────

function generateHtml(data) {
    const { labels, bio, formation, exps, projects, passions, technologies, age, lang } = data;

    // ── Formation (sidebar) ─────────────────────────────────────────────────
    const formHtml = formation.map(f => `
        <div class="form-entry">
            <div class="form-date">${esc(f.date)}</div>
            <div class="form-title-row">
                <span class="form-title">${esc(f.title)}</span>
                ${badge(f.badge, f.badgeCls)}
            </div>
            <div class="form-org">${esc(f.org)}</div>
        </div>`).join('');

    // ── Technologies (sidebar) ──────────────────────────────────────────────
    const techHtml = technologies.map(t => `
        <span class="tech-icon" title="${esc(t.name)}" style="color:${t.color}">${t.svg}</span>
    `).join('');

    // ── Passions (sidebar) ──────────────────────────────────────────────────
    const passHtml = passions.map(p =>
        `<span class="passion-pill">${esc(p.label)}</span>`
    ).join('');

    // ── Expériences (main) ──────────────────────────────────────────────────
    const expHtml = exps.map(e => `
        <div class="exp-row">
            <span class="exp-date">${esc(e.date)}</span>
            <div class="exp-body">
                <div class="exp-title-row">
                    <span class="exp-title">${esc(e.title)}</span>
                    ${badge(e.badge, e.badgeCls)}
                </div>
                ${e.desc ? `<p class="exp-desc">${esc(e.desc)}</p>` : ''}
                ${tagList(e.tags)}
            </div>
        </div>`).join('');

    // ── Projets (main) ──────────────────────────────────────────────────────
    const projHtml = projects.map(p => `
        <div class="proj-row">
            <div class="proj-header">
                <span class="proj-name">${esc(p.name)}</span>
                ${badge(p.badge, p.badgeCls)}
                <span class="proj-sep">—</span>
                <span class="proj-short">${esc(p.short)}</span>
            </div>
            ${p.desc ? `<p class="proj-desc">${esc(p.desc)}</p>` : ''}
        </div>`).join('');

    const currentStudy = esc(formation[0]?.title ?? '');

    // ── Full HTML ───────────────────────────────────────────────────────────
    return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="UTF-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
/* ── Reset ─────────────────────────────────────────── */
@page { size: A4; margin: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: 'IBM Plex Sans', Helvetica, Arial, sans-serif;
    font-size: 7.8pt;
    line-height: 1.38;
    color: #1e293b;
    background: #fff;
    width: 210mm;
    height: 297mm;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
}

/* ── Header ────────────────────────────────────────── */
.header {
    flex-shrink: 0;
    background: #0f2460;
    padding: 7mm 13mm 6mm;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 6mm;
}
.hd-name {
    font-size: 22pt;
    font-weight: 700;
    letter-spacing: -0.03em;
    color: #fff;
    line-height: 1;
}
.hd-sub {
    font-size: 7.5pt;
    color: #93c5fd;
    margin-top: 2mm;
    font-style: italic;
    font-weight: 300;
}
.hd-meta {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 6.3pt;
    color: #bfdbfe;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1.3mm;
    text-align: right;
    white-space: nowrap;
}
.hd-meta a { color: #93c5fd; text-decoration: none; }

/* ── Body columns ──────────────────────────────────── */
.body {
    display: flex;
    flex: 1;
    overflow: hidden;
}
.sidebar {
    width: 62mm;
    flex-shrink: 0;
    background: #f1f5f9;
    border-right: 0.5mm solid #cbd5e1;
    padding: 6mm 5.5mm 5mm 7mm;
    display: flex;
    flex-direction: column;
    gap: 5mm;
    overflow: hidden;
}
.main {
    flex: 1;
    padding: 6mm 10mm 5mm 7mm;
    display: flex;
    flex-direction: column;
    gap: 4.5mm;
    overflow: hidden;
}

/* ── Section title ─────────────────────────────────── */
.sec-title {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 5.6pt;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #1d4ed8;
    padding-bottom: 1.3mm;
    margin-bottom: 2.5mm;
    border-bottom: 0.4mm solid #bfdbfe;
}

/* ── Formation ─────────────────────────────────────── */
.form-entry { margin-bottom: 3mm; }
.form-entry:last-child { margin-bottom: 0; }
.form-date {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 5.8pt;
    color: #64748b;
    margin-bottom: 0.7mm;
}
.form-title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.5mm;
}
.form-title {
    font-size: 7.3pt;
    font-weight: 600;
    color: #0f172a;
    line-height: 1.3;
}
.form-org {
    font-size: 6.2pt;
    color: #64748b;
    margin-top: 0.8mm;
}

/* ── Technologies ──────────────────────────────────── */
.tech-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 2mm;
}
.tech-icon {
    width: 9mm;
    height: 9mm;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}
.tech-icon svg {
    width: 100%;
    height: 100%;
    fill: currentColor;
    display: block;
}

/* ── Passions ──────────────────────────────────────── */
.passion-list {
    display: flex;
    flex-wrap: wrap;
    gap: 1.3mm;
}
.passion-pill {
    font-size: 6.2pt;
    padding: 0.7mm 2mm;
    border-radius: 1.5mm;
    background: #e0e7ff;
    color: #3730a3;
    border: 0.3mm solid #c7d2fe;
    line-height: 1.3;
}

/* ── Bio ───────────────────────────────────────────── */
.bio {
    font-size: 7.5pt;
    line-height: 1.45;
    color: #334155;
}

/* ── Expériences ───────────────────────────────────── */
.exp-list { display: flex; flex-direction: column; }
.exp-row {
    display: flex;
    align-items: flex-start;
    gap: 2mm;
    padding: 1.8mm 0;
    border-bottom: 0.3mm solid #f1f5f9;
}
.exp-row:last-child { border-bottom: none; padding-bottom: 0; }
.exp-date {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 5.6pt;
    color: #94a3b8;
    min-width: 16mm;
    flex-shrink: 0;
    padding-top: 0.5mm;
    white-space: nowrap;
}
.exp-body { flex: 1; min-width: 0; }
.exp-title-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1.5mm;
}
.exp-title {
    font-size: 7.3pt;
    font-weight: 500;
    color: #0f172a;
    line-height: 1.3;
    flex: 1;
}
.exp-desc {
    font-size: 6.5pt;
    color: #475569;
    line-height: 1.42;
    margin-top: 1mm;
}

/* ── Projets ───────────────────────────────────────── */
.proj-list { display: flex; flex-direction: column; gap: 2mm; }
.proj-row { display: flex; flex-direction: column; gap: 0.8mm; }
.proj-header {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 1.5mm;
}
.proj-name {
    font-size: 7.5pt;
    font-weight: 700;
    color: #1e40af;
    white-space: nowrap;
}
.proj-sep { color: #cbd5e1; font-size: 7pt; }
.proj-short { font-size: 7pt; color: #475569; }
.proj-desc {
    font-size: 6.5pt;
    color: #475569;
    line-height: 1.42;
}

/* ── Tags ──────────────────────────────────────────── */
.tags {
    display: flex;
    flex-wrap: wrap;
    gap: 1mm;
    margin-top: 1.2mm;
}
.tag {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 5.5pt;
    padding: 0.3mm 1.8mm;
    border-radius: 1mm;
    line-height: 1.4;
}

/* ── Badges ────────────────────────────────────────── */
.badge {
    font-family: 'IBM Plex Mono', monospace;
    font-size: 5.5pt;
    padding: 0.4mm 2mm;
    border-radius: 2mm;
    font-weight: 500;
    white-space: nowrap;
    line-height: 1.5;
    flex-shrink: 0;
}

/* Colors */
.b-blue,   .t-blue   { background: #dbeafe; color: #1e40af; }
.b-cyan,   .t-cyan   { background: #cffafe; color: #0e7490; }
.b-green,  .t-green  { background: #dcfce7; color: #15803d; }
.b-orange, .t-orange { background: #ffedd5; color: #c2410c; }
.b-purple, .t-purple { background: #ede9fe; color: #6d28d9; }
.b-gray,   .t-gray   { background: #f1f5f9; color: #475569; }
.t-red                { background: #fee2e2; color: #991b1b; }
</style>
</head>
<body>

<!-- ── HEADER ──────────────────────────────────────── -->
<div class="header">
    <div>
        <div class="hd-name">Papillon Virton</div>
        <div class="hd-sub">${currentStudy}</div>
    </div>
    <div class="hd-meta">
        <a href="mailto:papillonvirton.pro@gmail.com">papillonvirton.pro@gmail.com</a>
        <span>${esc(labels.location)} &middot; ${age} ${esc(labels.ageSuffix)}</span>
        <span>github.com/PowerPeps</span>
    </div>
</div>

<!-- ── COLUMNS ─────────────────────────────────────── -->
<div class="body">

    <!-- SIDEBAR -->
    <div class="sidebar">

        <div>
            <div class="sec-title">${esc(labels.sectionFormation)}</div>
            ${formHtml}
        </div>

        <div>
            <div class="sec-title">Technologies</div>
            <div class="tech-grid">${techHtml}</div>
        </div>

        <div>
            <div class="sec-title">${esc(labels.sectionPassions)}</div>
            <div class="passion-list">${passHtml}</div>
        </div>

    </div>

    <!-- MAIN -->
    <div class="main">

        <div>
            <div class="sec-title">${esc(labels.sectionAbout)}</div>
            <p class="bio">${esc(bio)}</p>
        </div>

        <div>
            <div class="sec-title">${esc(labels.sectionExp)}</div>
            <div class="exp-list">${expHtml}</div>
        </div>

        <div>
            <div class="sec-title">${esc(labels.sectionProjects)}</div>
            <div class="proj-list">${projHtml}</div>
        </div>

    </div>
</div>

</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    mkdirSafe(PDF_DIR);

    console.log('Lancement de Puppeteer...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const lang of LANGS) {
        process.stdout.write(`  Génération de cv-${lang}.pdf ... `);

        const data    = loadData(lang);
        const html    = generateHtml(data);
        const outPath = path.join(PDF_DIR, `cv-${lang}.pdf`);

        const page = await browser.newPage();

        // Charger la page — waitUntil 'networkidle0' pour les Google Fonts
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });

        await page.pdf({
            path: outPath,
            format: 'A4',
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
        });

        await page.close();
        console.log(`OK  →  ${path.relative(__dirname, outPath)}`);
    }

    await browser.close();
    console.log('\nTous les PDFs sont dans ./pdf/');
}

main().catch(err => {
    console.error('\nErreur :', err.message);
    process.exit(1);
});
