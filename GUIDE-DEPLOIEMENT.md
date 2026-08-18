# Mettre le site en ligne sur GitHub Pages

Objectif : le site accessible depuis n'importe quel navigateur, à une adresse
fixe, avec une collecte automatique chaque matin — sans jamais ouvrir le
Terminal.

Durée : environ 45 minutes la première fois. Aucune connaissance technique
requise, mais **lis l'étape 0 avant de commencer**.

---

## Étape 0 — Ce qu'il faut savoir avant de se lancer

**Le dépôt sera public.** GitHub Pages n'est gratuit que pour les dépôts
publics. N'importe qui pourra donc lire le code et voir les offres collectées.
Ce n'est pas gênant : ce sont des annonces publiques. Mais cela impose une
règle absolue, objet de l'étape 4.

**Trois choses ne seront jamais publiées :**

| Élément | Où il reste |
|---|---|
| La clé d'API | Dans un coffre GitHub, lisible seulement par le robot |
| Tes favoris, notes et statuts | Dans ton navigateur, jamais envoyés |
| Tes pondérations de critères | Dans ton navigateur, jamais envoyées |

Personne ne verra donc où tu as postulé.

**Ce qui ne change pas :** le lanceur local continue de fonctionner. Tu pourras
utiliser les deux, le site en ligne au quotidien, le lanceur pour tester une
modification avant de la publier.

---

## Étape 1 — Créer le compte et installer l'outil

1. Créer un compte sur **github.com** — bouton *Sign up*. Choisis un nom
   d'utilisateur sobre : il apparaîtra dans l'adresse de ton site.
2. Confirmer l'adresse e-mail reçue.
3. Télécharger **GitHub Desktop** sur *desktop.github.com*, l'installer, puis
   s'y connecter avec ce compte.

GitHub Desktop évite entièrement la ligne de commande. C'est l'outil que tu
utiliseras pour toutes les mises à jour futures.

---

## Étape 2 — Créer le dépôt

Dans GitHub Desktop :

1. `File` → `New repository`
2. **Name** : `veille-vie` (ce nom apparaîtra dans l'adresse du site)
3. **Local path** : choisis un emplacement, par exemple `Documents`
4. Laisse le reste par défaut, clique `Create repository`
5. Clique `Publish repository` en haut
6. **Décoche impérativement « Keep this code private »** — sinon Pages ne
   fonctionnera pas
7. `Publish repository`

GitHub Desktop a créé un dossier `veille-vie` à l'emplacement choisi. Il est
vide pour l'instant.

---

## Étape 3 — Y déposer le projet

1. Ouvre l'archive `vie-radar.zip` et **copie tout son contenu** dans le
   dossier `veille-vie` créé à l'étape précédente. Tu dois y retrouver
   `site`, `collector`, `data`, `.github`, `README.md`, `Lancer.command`.
2. Retourne dans GitHub Desktop : la colonne de gauche liste maintenant tous
   les fichiers ajoutés.

**Vérification qui évite le pire :** parcours cette liste et assure-toi que
**`cle-api.txt` n'y figure pas**. Le projet contient un fichier `.gitignore`
qui l'exclut automatiquement — mais vérifie de tes yeux. Si tu le vois
apparaître, arrête-toi et dis-le moi avant de continuer.

3. En bas à gauche, dans le champ *Summary*, écris `Première mise en ligne`
4. Clique `Commit to main`, puis `Push origin` en haut

Ton code est en ligne. Le site, lui, n'est pas encore actif.

---

## Étape 4 — Mettre la clé d'API à l'abri

C'est l'étape à ne pas manquer. Sans elle, la collecte échouera en ligne.

1. Sur **github.com**, ouvre ton dépôt `veille-vie`
2. Onglet `Settings` (en haut à droite du dépôt, pas celui du compte)
3. Menu de gauche : `Secrets and variables` → `Actions`
4. Bouton `New repository secret`
5. **Name** : `VIE_API_KEY` — exactement cette orthographe, en majuscules
6. **Secret** : colle la clé, celle que contient ton fichier `cle-api.txt`
7. `Add secret`

La clé est maintenant dans un coffre. Le robot de collecte peut la lire, mais
elle n'apparaît ni dans le code, ni dans les journaux d'exécution : GitHub la
masque automatiquement. Toi-même ne pourras plus la relire — seulement la
remplacer. Garde donc ton `cle-api.txt` local.

---

## Étape 5 — Autoriser le robot à travailler

Toujours dans `Settings` :

1. `Actions` → `General`
2. Section **Workflow permissions**, tout en bas
3. Coche **Read and write permissions**
4. `Save`

Sans cette autorisation, le robot pourra collecter les offres mais pas les
enregistrer.

---

## Étape 6 — Activer Pages

1. `Settings` → `Pages`
2. Section **Build and deployment**, champ **Source**
3. Choisis **GitHub Actions** (et non « Deploy from a branch »)

Rien d'autre à régler.

---

## Étape 7 — Premier lancement

1. Onglet `Actions` du dépôt
2. À gauche, clique sur *Collecte quotidienne des offres V.I.E*
3. Bouton `Run workflow` → `Run workflow`
4. Attends deux à trois minutes, rafraîchis la page

Une pastille verte signifie que tout s'est bien passé. Ton site est alors à :

```
https://TON-NOM-UTILISATEUR.github.io/veille-vie/
```

Ouvre-le, vérifie que les offres s'affichent et que « Interface v8 » apparaît
en pied de page. Ajoute l'adresse aux favoris de ton téléphone.

---

## À partir de là

**Chaque matin**, vers 7h10, le robot collecte les nouvelles offres et met le
site à jour. Tu n'as rien à faire.

**Pour publier une modification** que je t'aurai envoyée : copie les fichiers
dans le dossier `veille-vie`, puis dans GitHub Desktop, écris un résumé,
`Commit to main`, `Push origin`. Le site se met à jour en une minute environ.

**Pour revenir à une version antérieure** : dans GitHub Desktop, onglet
`History`, clic droit sur une modification → `Revert changes`. C'est le filet
de sécurité qui manquait jusqu'ici.

---

## Si quelque chose ne va pas

| Symptôme | Cause probable | Correction |
|---|---|---|
| Erreur 404 sur l'adresse | Pages pas encore actif ou dépôt privé | Étape 6, et vérifier que le dépôt est public |
| Site en ligne mais aucune offre | Secret absent ou mal nommé | Étape 4, vérifier l'orthographe `VIE_API_KEY` |
| Pastille rouge dans Actions | Permissions manquantes | Étape 5 |
| Message « cle-api.txt serait publié » | Le fichier a été ajouté au dépôt | Me le signaler, correction en deux commandes |
| Offres figées depuis plusieurs jours | Clé changée par Business France | Relancer `Diagnostic.command` en local, puis mettre à jour le secret |

Le journal d'exécution est consultable dans l'onglet `Actions` : clique sur
une exécution puis sur l'étape en rouge. Les messages y sont explicites, et
tu peux me les transmettre.

---

## Les deux règles à retenir

1. **`cle-api.txt` ne doit jamais partir dans le dépôt.** Trois garde-fous
   existent — le `.gitignore`, ta vérification à l'étape 3, et un contrôle
   automatique qui bloque la publication le cas échéant. Ne les contourne pas.
2. **Si tu changes de clé un jour**, mets à jour les deux endroits : ton
   fichier local pour le lanceur, et le secret GitHub pour le robot.
