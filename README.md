# Caisse

Suivi freelance **local**: TJM, jours ouvrables, congés, heures sup, charges, budget perso, reste.

## Formules

- Les montants sont affichés et saisis en milliers d'Ariary: 300 = 300 000 Ar, 13000 = 13 000 000 Ar
- Jours ouvrables = lundi–vendredi du mois
- Jours facturés = ouvrables − congés + jours sup (journée ou demi-journée)
- Gagné = jours facturés × TJM (demi-journée = 157 500 Ar)
- Charges = charge fixe + dépenses variables du mois
- Charge fixe = 3 000 000 Ar par défaut
- Détail charge fixe: provision 300, essence 300, panampy 100, mama auri 400, mama valisoa 400, starlink 140, connexion 67 110, jirama 150, sakafo 600, hery 250, noella 250
- Charge variable = 1 000 000 Ar par défaut, modifiable mois par mois
- Projet du mois = 1 000 000 Ar par défaut, modifiable mois par mois
- Reste / économies = salaire départ − charge fixe − dépenses variables − projet du mois
- À date (mois en cours) = même calcul sur les jours déjà passés
- L'application démarre en juillet 2026
- Prévision annuelle = année civile avec jours ouvrables, congés, jours sup, jours travaillés, total salaire, salaire départ arrondi vers le bas, perso, charge fixe, budget variable, projet du mois, achats, reste variable et économie
- Pour 2026, le tableau commence en juillet; 2027 reste dans le tableau 2027
- Salaire départ = total salaire arrondi vers le bas au pas choisi (500 000 ou 1 000 000 Ar)
- Perso = total salaire − salaire départ
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

Données dans `localStorage`. Les anciennes dépenses `v1` sont reprises.
