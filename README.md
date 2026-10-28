# Caisse

Suivi freelance **local**: TJM, jours ouvrables, congés, heures sup, charges, budget perso, reste.

## Formules

- Les montants sont affichés et saisis en milliers d'Ariary: 300 = 300 000 Ar, 13000 = 13 000 000 Ar
- Jours ouvrables = lundi–vendredi du mois
- Jours facturés = ouvrables − congés + jours sup (journée ou demi-journée)
- En 2027, les congés par défaut ajoutent le 23 de chaque mois, reporté au prochain jour ouvrable si besoin, et un jour férié ouvrable du mois quand il existe; sinon le deuxième congé est le dernier jour ouvrable du mois
- Gagné = jours facturés × TJM (demi-journée = 157 500 Ar)
- Charges = charge fixe + dépenses variables du mois + épargne mensuelle à partir de janvier 2027
- Les nouveaux totaux de dépenses s'appliquent à partir de septembre 2026
- Charge fixe = 3 380 000 Ar à partir de septembre 2026
- Détail charge fixe: logement 280 (Jirama 200 + Mpanampy 80), sakafo 690, transport 300, santé 50, internet 310, provision 450, dépense commune 1 300
- Détail charge variable: enfants 260, shopping 120, autre 260, loisirs 150, adidy 130
- Charge variable = 920 000 Ar à partir de septembre 2026
- Épargne mensuelle = 2 000 000 Ar à partir de janvier 2027: retraite 500, université bébé 500, vacances étranger 700, vacances locales 200, assurance santé 100
- Projet du mois = 500 000 Ar par défaut, modifiable mois par mois
- Reste / économies = salaire départ − charges − projet du mois
- À date (mois en cours) = même calcul sur les jours déjà passés
- L'application démarre en juillet 2026
- Prévision annuelle = année civile avec jours ouvrables, congés, jours sup, jours travaillés, total salaire, salaire départ arrondi vers le bas, perso, charge fixe, budget variable, projet du mois, achats, reste variable et économie
- Pour 2026, le tableau commence en juillet; 2027 reste dans le tableau 2027
- Salaire départ = total salaire arrondi vers le bas au pas choisi (500 000 ou 1 000 000 Ar) jusqu'en août 2027, puis arrondi vers le bas à 100 000 Ar à partir de septembre 2027
- Perso = total salaire − salaire départ jusqu'en août 2026, puis 300 000 Ar par mois à partir de septembre 2026
- Exemple en pas de 500 000 Ar: 5 600 000 Ar donne 5 500 000 Ar de départ et 100 000 Ar de perso
- Dépenses perso = suivi séparé avec libellé + valeur, limité au montant Perso du mois
- Économie du mois = salaire départ − charge fixe − achats du mois − projet du mois
- Total économies annuel = somme des économies des 12 mois
- Projets = liste annuelle avec libellé + prix, mois prévu optionnel et case "fait".
- Un projet avec mois prévu apparaît dans le planning de l'année; sans mois prévu, il reste dans la bucket list libre.
- Si un mois contient des projets planifiés, la colonne Projet de la prévision utilise automatiquement le total de ces projets.
- La faisabilité indique si un projet non planifié peut passer sur le mois affiché, le mois suivant ou les deux mois.

## Lancer

```bash
cd gestion-depenses
npm install
npm run dev
```

## Supabase

L'application utilise Supabase pour l'authentification et la synchronisation cloud.

Variables à configurer dans Vercel:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Pour créer la table cloud, ouvrir Supabase SQL Editor et exécuter:

```text
supabase/schema.sql
```

Une copie locale reste gardée dans `localStorage` comme secours.
