# 📘 BacPratique

## 🧠 Résumé du Projet

**Application de Répartition Automatique des Copies d’Examens**

---

## 🎯 Objectif Général

Développement d’une application web permettant aux enseignants de gérer et répartir de manière automatique, équitable et structurée les copies d’examens des élèves entre plusieurs professeurs, tout en respectant une organisation par créneaux horaires, lycées et labos.

L’application vise à éliminer le travail manuel de tri et de distribution des copies, réduire les erreurs et garantir une répartition équilibrée des travaux de correction.

---

## ⚙️ Fonctionnalités Principales

### 🔹 Gestion dynamique des données
- Ajout, modification et suppression des professeurs et des lycées via l’interface

### 🔹 Importation en masse
- Chargement des listes de professeurs et lycées depuis un fichier Excel/CSV

### 🔹 Répartition intelligente des copies
Selon les règles suivantes :
- Commence par le premier créneau horaire (08-09)
- Distribue les labos entiers (indivisibles) aux professeurs dans l’ordre
- Chaque professeur reçoit un nombre de travaux approximativement équitable
- Passe au professeur suivant lorsqu’un quota est atteint
- Passe au créneau suivant une fois tous les labos du créneau actuel distribués

### 🔹 Structure de sortie organisée
```
Sortie_Repartition/
└── Date/
    └── Professeur/
        └── Lycée/
            └── Créneau/
                └── Labo/
                    └── Identifiant_Élève/
```

### 🔹 Génération de PDF
- Génération automatique de bordereaux PDF pour chaque professeur contenant la liste détaillée des élèves à corriger (par créneau et labo)

### 🔹 Interface web intuitive
- Sélection multiple des professeurs et lycées (option "Tous" incluse)

---

## 🛠️ Technologies Utilisées

- **Backend** : Node.js + Express.js
- **Templating** : EJS (Embedded JavaScript)
- **Gestion des fichiers** : fs-extra
- **Génération PDF** : pdfkit
- **Import Excel/CSV** : xlsx + Multer
- **Stockage des configurations** : JSON (professeurs.json, lycees.json)
- **Frontend** : HTML5, CSS3, JavaScript (vanilla)

---

## 🔄 Approche de Répartition

L’algorithme de répartition suit une logique séquentielle et équitable :

- **Parcours ordonné** : Créneaux horaires → Lycées (ordre alphabétique) → Labos
- **Unités indivisibles** : Chaque labo est attribué entièrement à un seul professeur
- **Équilibrage** : Calcul d’un quota moyen par professeur (total_travaux / nombre_professeurs)
- **Compensation** : Ajustement dynamique pour éviter qu’un professeur reçoive trop ou trop peu de travaux
- **Priorité temporelle** : On termine un créneau avant de passer au suivant

👉 Cette approche garantit à la fois l’équité et le respect des contraintes opérationnelles.

---

## 📁 Structure des Dossiers

```
C:\GestionExamens_Kef\
│
├── Sources_Uploads\
│   └── (date\lycee\creneau\labo\identifiant_eleve\)
│
└── Sortie_Repartition\
    └── (résultats + PDF)
```

---

## 🚀 Valeur Ajoutée

- ⏱️ Gain de temps considérable lors des sessions d’examens
- ❌ Réduction des erreurs humaines
- 📊 Traçabilité et organisation claire des copies
- 👨‍🏫 Interface simple pour utilisateurs non techniques
- 🔧 Flexibilité : possibilité d’exclure certains professeurs ou lycées

---

## 📌 Auteur

Projet développé dans le cadre de l’amélioration de la gestion des examens (région du Kef).
