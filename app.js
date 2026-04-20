const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const PDFDocument = require('pdfkit');
const xlsx = require('xlsx');
const multer = require('multer');
const AdmZip = require('adm-zip');

const app = express();
const PORT = 3000;

// Configuration Multer pour les fichiers ZIP (stockage temporaire)
const uploadZip = multer({
    dest: 'temp/', 
    limits: { fileSize: 2 * 1024 * 1024 * 1024 } // Maximum 2 Go
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// ====================== STRUCTURE DES DOSSIERS ======================
const BASE_DIR = 'C:\\GestionExamens_Kef';
const SOURCES_DIR = path.join(BASE_DIR, 'Sources_Uploads');      // Dossier source des copies
const REPARTITION_DIR = path.join(BASE_DIR, 'Sortie_Repartition'); // Dossier de sortie

const PROF_FILE = path.join(__dirname, 'professeurs.json');
const LYCEE_FILE = path.join(__dirname, 'lycees.json');

// Création automatique des dossiers de base
fs.ensureDirSync(BASE_DIR);
fs.ensureDirSync(SOURCES_DIR);
fs.ensureDirSync(REPARTITION_DIR);
fs.ensureDirSync(path.join(__dirname, 'temp')); // Dossier pour les uploads temporaires

let professeurs = [];
let lycees = [];

function chargerDonnees() {
    if (fs.existsSync(PROF_FILE)) {
        professeurs = fs.readJsonSync(PROF_FILE);
    } else {
        professeurs = ["Mohamed", "Ali bensalah", "ihem samali"];
        fs.writeJsonSync(PROF_FILE, professeurs);
    }
    if (fs.existsSync(LYCEE_FILE)) {
        lycees = fs.readJsonSync(LYCEE_FILE);
    } else {
        lycees = ["AA", "MS", "LPK"];
        fs.writeJsonSync(LYCEE_FILE, lycees);
    }
}

function sauvegarderDonnees() {
    fs.writeJsonSync(PROF_FILE, professeurs);
    fs.writeJsonSync(LYCEE_FILE, lycees);
}

chargerDonnees();

// Liste officielle des créneaux pour la validation et la répartition
const CRENEAUX = ["08--09", "09-30--10-30", "11--12", "13--14", "14-30--15-30", "16--17"];

// ====================== ROUTES DE GESTION (INDEX) ======================

app.get('/', (req, res) => {
    res.render('index', { professeurs, lycees, message: null });
});

app.post('/add-prof', (req, res) => {
    const { nom } = req.body;
    if (nom && !professeurs.includes(nom.trim())) {
        professeurs.push(nom.trim());
        sauvegarderDonnees();
    }
    res.redirect('/');
});

app.post('/add-lycee', (req, res) => {
    const { nom } = req.body;
    if (nom && !lycees.includes(nom.trim())) {
        lycees.push(nom.trim());
        sauvegarderDonnees();
    }
    res.redirect('/');
});

app.get('/delete-prof', (req, res) => {
    professeurs = professeurs.filter(p => p !== req.query.nom);
    sauvegarderDonnees();
    res.redirect('/');
});

app.get('/delete-lycee', (req, res) => {
    lycees = lycees.filter(l => l !== req.query.nom);
    sauvegarderDonnees();
    res.redirect('/');
});

app.get('/edit-prof', (req, res) => {
    const oldName = req.query.old;
    const newName = req.query.new?.trim();
    if (oldName && newName && newName !== '') {
        const index = professeurs.indexOf(oldName);
        if (index !== -1) {
            professeurs[index] = newName;
            sauvegarderDonnees();
        }
    }
    res.redirect('/');
});

app.get('/edit-lycee', (req, res) => {
    const oldName = req.query.old;
    const newName = req.query.new?.trim();
    if (oldName && newName && newName !== '') {
        const index = lycees.indexOf(oldName);
        if (index !== -1) {
            lycees[index] = newName;
            sauvegarderDonnees();
        }
    }
    res.redirect('/');
});

app.post('/upload-csv', uploadZip.single('csvFile'), (req, res) => {
    if (!req.file) return res.redirect('/');
    try {
        const workbook = xlsx.readFile(req.file.path);
        const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        data.forEach(row => {
            const type = row.type?.toLowerCase();
            const nom = row.nom?.toString().trim();
            if (nom) {
                if (type === 'prof' && !professeurs.includes(nom)) professeurs.push(nom);
                if (type === 'lycee' && !lycees.includes(nom)) lycees.push(nom);
            }
        });
        sauvegarderDonnees();
        fs.unlinkSync(req.file.path);
        res.render('index', { professeurs, lycees, message: "✅ Importation réussie !" });
    } catch (err) {
        res.render('index', { professeurs, lycees, message: "❌ Erreur fichier." });
    }
});

// ====================== UPLOAD DES COPIES VIA ZIP (AVEC INJECTION LYCÉE) ======================

app.get('/upload-copies', (req, res) => {
    res.render('upload-copies', { lycees, message: null });
});
/*
app.post('/upload-copies', uploadZip.single('zipFile'), async (req, res) => {
    const { lyceeSource } = req.body;
    const tempExtractPath = path.join(__dirname, 'temp', 'extract_' + Date.now());

    try {
        if (!req.file || !lyceeSource) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.render('upload-copies', { lycees, message: '❌ Fichier ou lycée manquant.' });
        }

        // 1. Décompression temporaire
        const zip = new AdmZip(req.file.path);
        zip.extractAllTo(tempExtractPath, true);

        // 2. Trouver le dossier de la date (ex: 30-04-2026)
        const items = await fs.readdir(tempExtractPath);
        const dateFolder = items.find(item => item.match(/^\d{2}-\d{2}-\d{4}$/));

        if (!dateFolder) {
            throw new Error("Le ZIP doit contenir un dossier nommé avec la date (JJ-MM-AAAA) à la racine.");
        }

        // --- DÉBUT DE LA VÉRIFICATION DE L'ARBORESCENCE ---
        const sourceSubPath = path.join(tempExtractPath, dateFolder);
        const subItems = await fs.readdir(sourceSubPath); // Dossiers de créneaux
        
        if (subItems.length === 0) {
            throw new Error(`Le dossier ${dateFolder} est vide.`);
        }

        for (const item of subItems) {
            // Vérification du Créneau (doit être dans la liste officielle)
            if (!CRENEAUX.includes(item)) {
                throw new Error(`Créneau invalide : "${item}". Les noms autorisés sont : ${CRENEAUX.join(', ')}`);
            }

            const creneauPath = path.join(sourceSubPath, item);
            const labosFound = await fs.readdir(creneauPath);

            // Vérification du format des Labos (laboX sans espace)
            for (const labo of labosFound) {
                const laboPath = path.join(creneauPath, labo);
                const stats = await fs.stat(laboPath);
                
                if (stats.isDirectory()) {
                    const laboRegex = /^labo\d+$/; 
                    if (!laboRegex.test(labo)) {
                        throw new Error(`Format de laboratoire invalide : "${labo}" dans le créneau ${item}. Utilisez le format "laboX" (ex: labo1) sans espace.`);
                    }
                }
            }
        }
        // --- FIN DE LA VÉRIFICATION ---

        // 3. Intégration (Copie puis suppression pour éviter l'erreur EPERM sur Windows)
        const finalTargetDatePath = path.join(SOURCES_DIR, dateFolder, lyceeSource);
        await fs.ensureDir(finalTargetDatePath);

        for (const content of subItems) {
            const oldPath = path.join(sourceSubPath, content);
            const newPath = path.join(finalTargetDatePath, content);
            await fs.copy(oldPath, newPath, { overwrite: true });
        }

        // 4. Nettoyage réussi
        await fs.remove(tempExtractPath);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.render('upload-copies', { 
            lycees, 
            message: `✅ Validation réussie et copies importées pour le lycée : ${lyceeSource}.` 
        });

    } catch (err) {
        // En cas d'erreur, nettoyage du dossier temporaire
        await fs.remove(tempExtractPath);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        console.error("Erreur de traitement:", err.message);
        res.render('upload-copies', { 
            lycees, 
            message: `❌ Erreur : ${err.message}` 
        });
    }
});
*/
app.post('/upload-copies', uploadZip.single('zipFile'), async (req, res) => {
    const { lyceeSource } = req.body;
    const tempExtractPath = path.resolve(__dirname, 'temp', 'extract_' + Date.now());

    try {
        if (!req.file || !lyceeSource) {
            if (req.file) fs.unlinkSync(req.file.path);
            return res.render('upload-copies', { lycees, message: '❌ Fichier ou lycée manquant.' });
        }

        const zip = new AdmZip(req.file.path);
        zip.extractAllTo(tempExtractPath, true);

        const items = await fs.readdir(tempExtractPath);
        const dateFolder = items.find(item => item.match(/^\d{2}-\d{2}-\d{4}$/));

        if (!dateFolder) {
            throw new Error("Le ZIP doit contenir un dossier nommé avec la date (JJ-MM-AAAA) à la racine.");
        }

        const sourceSubPath = path.resolve(tempExtractPath, dateFolder);
        let subItems = await fs.readdir(sourceSubPath); 

        // --- NORMALISATION ET VÉRIFICATION ---
        for (const item of subItems) {
            const normalizedCreneau = item.trim();
            const oldCreneauPath = path.resolve(sourceSubPath, item);
            const newCreneauPath = path.resolve(sourceSubPath, normalizedCreneau);

            if (path.relative(oldCreneauPath, newCreneauPath) !== "") {
                await fs.rename(oldCreneauPath, newCreneauPath);
            }

            if (!CRENEAUX.includes(normalizedCreneau)) {
                throw new Error(`Créneau invalide : "${normalizedCreneau}".`);
            }

            const labosFound = await fs.readdir(newCreneauPath);
            for (const labo of labosFound) {
                const oldLaboPath = path.resolve(newCreneauPath, labo);
                const stats = await fs.stat(oldLaboPath);
                
                if (stats.isDirectory()) {
                    // --- NOUVELLE LOGIQUE DE NORMALISATION ---
                    // 1. Mise en minuscule et suppression de tous les espaces
                    // 2. Remplacement de "labo0" par "labo" (ex: labo02 -> labo2)
                    const normalizedLabo = labo.toLowerCase()
                                               .replace(/\s+/g, '')
                                               .replace(/labo0+/g, 'labo'); 

                    const newLaboPath = path.resolve(newCreneauPath, normalizedLabo);

                    if (path.relative(oldLaboPath, newLaboPath) !== "") {
                        if (await fs.pathExists(newLaboPath)) {
                            // Fusion en cas de doublon (ex: "labo01" et "labo1")
                            await fs.copy(oldLaboPath, newLaboPath);
                            await fs.remove(oldLaboPath);
                        } else {
                            await fs.rename(oldLaboPath, newLaboPath);
                        }
                    }

                    const laboRegex = /^labo\d+$/; 
                    if (!laboRegex.test(normalizedLabo)) {
                        throw new Error(`Format invalide : "${labo}" dans ${normalizedCreneau}.`);
                    }
                }
            }
        }

        // 3. TRANSFERT FINAL VERS SOURCES_DIR
        const finalizedSubItems = await fs.readdir(sourceSubPath);
        const finalTargetDatePath = path.resolve(SOURCES_DIR, dateFolder, lyceeSource);
        await fs.ensureDir(finalTargetDatePath);

        for (const content of finalizedSubItems) {
            const oldPath = path.resolve(sourceSubPath, content);
            const newPath = path.resolve(finalTargetDatePath, content);
            
            if (path.relative(oldPath, newPath) !== "") {
                await fs.copy(oldPath, newPath, { overwrite: true });
            }
        }

        await fs.remove(tempExtractPath);
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        res.render('upload-copies', { 
            lycees, 
            message: `✅ Succès : Copies du lycée ${lyceeSource} importées et renommées (ex: labo2).` 
        });

    } catch (err) {
        await fs.remove(tempExtractPath);
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.render('upload-copies', { lycees, message: `❌ Erreur : ${err.message}` });
    }
});
// ====================== ROUTES RÉPARTITION ======================

app.get('/repartir', (req, res) => {
    res.render('repartir', { professeurs, lycees, message: null });
});

app.post('/repartir', async (req, res) => {
    try {
        let { date, profsSelection, lyceesSelection } = req.body;
        const normalizedDate = normalizeDate(date);
        
        let selP = Array.isArray(profsSelection) ? profsSelection : [profsSelection];
        let selL = Array.isArray(lyceesSelection) ? lyceesSelection : [lyceesSelection];

        const profsChoisis = selP.includes('Tous') ? professeurs : selP.filter(Boolean);
        const lyceesChoisis = selL.includes('Tous') ? lycees : selL.filter(Boolean);

        const resultat = await repartirSelonOrdreStrict(normalizedDate, profsChoisis, lyceesChoisis);

        res.render('resultat', { 
            message: `✅ Répartition terminée`, 
            result: resultat, 
            date: normalizedDate 
        });
    } catch (err) {
        res.render('repartir', { professeurs, lycees, message: `❌ ${err.message}` });
    }
});

function normalizeDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.trim().split(/[/\-\s]+/);
    return parts.length === 3 ? `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}` : dateStr;
}

// ====================== LOGIQUE DE RÉPARTITION ======================

async function collectLabosFiltres(baseDir, date, lyceesSelection) {
    const labosOrdonnes = [];
    const datePath = path.join(baseDir, date);
    if (!await fs.pathExists(datePath)) return [];

    const itemsSurDisque = await fs.readdir(datePath);

    for (const creneau of CRENEAUX) {
        for (const lyceeNom of itemsSurDisque.sort()) {
            if (!lyceesSelection.includes(lyceeNom)) continue;

            const creneauPath = path.join(datePath, lyceeNom, creneau);
            if (!await fs.pathExists(creneauPath)) continue;
            
            const labos = await fs.readdir(creneauPath, { withFileTypes: true });
            for (const labo of labos.filter(e => e.isDirectory()).sort((a,b) => a.name.localeCompare(b.name))) {
                const laboPath = path.join(creneauPath, labo.name);
                const eleveEntries = await fs.readdir(laboPath);
                const eleves = [];
                for (const e of eleveEntries) {
                    const elevePath = path.join(laboPath, e);
                    if ((await fs.stat(elevePath)).isDirectory()) {
                        const fichiers = await fs.readdir(elevePath);
                        eleves.push({ identifiant: e, fichiers: fichiers.map(f => path.join(elevePath, f)) });
                    }
                }
                if (eleves.length > 0) {
                    labosOrdonnes.push({ lycee: lyceeNom, creneau, laboName: labo.name, eleves });
                }
            }
        }
    }
    return labosOrdonnes;
}

async function repartirSelonOrdreStrict(date, profsSelection, lyceesSelection) {
    const targetBase = path.join(REPARTITION_DIR, date);
    const allLabos = await collectLabosFiltres(SOURCES_DIR, date, lyceesSelection);
    if (allLabos.length === 0) throw new Error('Aucun travail trouvé pour cette date et ces lycées.');

    const totalTravaux = allLabos.reduce((sum, labo) => sum + labo.eleves.length, 0);
    const quotaMoyen = totalTravaux / profsSelection.length;

    const repartition = {};
    profsSelection.forEach(p => repartition[p] = []);

    let profIndex = 0;
    let travauxAccumulesPourCeProf = 0;
    let balanceCompensation = 0;

    for (const labo of allLabos) {
        const currentProf = profsSelection[profIndex];
        repartition[currentProf].push(labo);
        travauxAccumulesPourCeProf += labo.eleves.length;

        let cibleAjustee = quotaMoyen - balanceCompensation;

        if (travauxAccumulesPourCeProf >= cibleAjustee && profIndex < profsSelection.length - 1) {
            balanceCompensation = travauxAccumulesPourCeProf - cibleAjustee;
            profIndex++;
            travauxAccumulesPourCeProf = 0;
        }
    }

    // Copie physique des fichiers
    for (const [prof, labosAttribues] of Object.entries(repartition)) {
        for (const labo of labosAttribues) {
            for (const eleve of labo.eleves) {
                const destDir = path.join(targetBase, prof, labo.lycee, labo.creneau, labo.laboName, eleve.identifiant);
                await fs.ensureDir(destDir);
                for (const file of eleve.fichiers) {
                    await fs.copy(file, path.join(destDir, path.basename(file)));
                }
            }
        }
    }

    // Génération des bordereaux PDF
    const bordereaux = [];
    for (const prof of profsSelection) {
        const pdfPath = await genererBordereau(prof, repartition[prof], date);
        const webPath = '/repartition/' + date + '/' + path.basename(pdfPath);
        bordereaux.push({ professeur: prof, pdfPath: webPath });
    }

    return { 
        totalTravaux, 
        repartitionParProf: Object.fromEntries(Object.entries(repartition).map(([p, labs]) => [p, labs.reduce((s, l) => s + l.eleves.length, 0)])), 
        bordereaux 
    };
}

async function genererBordereau(prof, labosAttribues, date) {
    const pdfPath = path.join(REPARTITION_DIR, date, `bordereau_${prof}.pdf`);
    await fs.ensureDir(path.dirname(pdfPath));
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(pdfPath));

    doc.fontSize(20).text(`Bordereau de Correction`, { align: 'center' });
    doc.fontSize(16).text(`${prof}`, { align: 'center' });
    doc.fontSize(12).text(`Date de l'examen : ${date}`, { align: 'center' });
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    labosAttribues.forEach(labo => {
        doc.fontSize(12).fillColor('#2563eb').text(`Lycée: ${labo.lycee} | Créneau: ${labo.creneau} | Labo: ${labo.laboName}`, { underline: true });
        doc.moveDown(0.2);
        labo.eleves.forEach((e, i) => {
            doc.fontSize(10).fillColor('black').text(`   [ ] ${i+1}. Élève ID: ${e.identifiant} ........................................ Note: ____ / 20`);
        });
        doc.moveDown(0.8);
    });

    doc.end();
    return pdfPath;
}

// Servir les fichiers générés
app.use('/repartition', express.static(REPARTITION_DIR));

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    console.log(`📁 Dossier Racine : ${BASE_DIR}`);
});