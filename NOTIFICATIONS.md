# Recevoir les nouvelles offres sur ton iPhone

Le robot t'envoie une notification dès qu'une offre inédite dépasse 50/100.
Mise en place : cinq minutes, une seule fois, sans compte à créer.

## 1. Choisir un nom de canal

Les notifications passent par ntfy, un service gratuit qui fonctionne sans
inscription. Le seul identifiant est un **nom de canal** que tu inventes.

Ce nom est ton unique protection : quiconque le connaît peut lire tes
notifications, ou t'en envoyer. Prends donc quelque chose d'imprévisible,
et non `veille-vie` ou `elias-offres`.

Bon exemple : `vie-mat-k7x9r2mq4p`

Une méthode simple : un mot court, un tiret, puis une douzaine de caractères
au hasard tapés sans réfléchir.

## 2. Installer l'application

Sur l'App Store, cherche **ntfy** (icône verte, éditeur « Philipp Heckel »).
Installe-la, ouvre-la, autorise les notifications.

Appuie sur **+**, entre exactement ton nom de canal, valide. C'est tout :
pas de compte, pas de mot de passe.

## 3. Déclarer le canal à GitHub

Sur github.com, dans ton dépôt `veille-vie` :

1. `Settings` → `Secrets and variables` → `Actions`
2. `New repository secret`
3. **Name** : `NTFY_TOPIC`
4. **Secret** : ton nom de canal, seul, sans espace ni adresse complète
5. `Add secret`

## 4. Vérifier

Onglet `Actions` → `Collecte quotidienne des offres V.I.E` → `Run workflow`.

Dans le journal, la ligne « Notification envoyée » ou « Aucune nouvelle offre »
confirme que le mécanisme fonctionne. La première annonce dépendra d'une
publication réelle chez Business France, ce qui peut prendre un jour ou deux.

Pour tester immédiatement, ouvre cette adresse dans un navigateur en
remplaçant le nom : `https://ntfy.sh/TON-CANAL` puis envoie-toi un message
depuis la page. La notification doit arriver sur ton téléphone en une seconde.

## Ce que tu recevras

Un message par collecte, jamais un par offre. Il indique le nombre de
nouveautés, puis les huit meilleures avec leur score, leur entreprise et leur
pays. Un appui sur la notification ouvre le site.

Une offre n'est signalée qu'une fois : la comparaison se fait avec la collecte
précédente, pas avec une date. Une collecte manquée ne provoque donc ni doublon
ni oubli.

## Régler le seuil

Le seuil de 50/100 se modifie dans `.github/workflows/update.yml`, ligne
`NOTIFY_MIN_SCORE`. À 70, tu ne seras prévenu que pour le cœur de cible.
Descendre sous 40 provoquera des alertes fréquentes et peu utiles.

## Fréquence de collecte

Toutes les 30 minutes, du lundi au vendredi, de 8h à 18h (heure de Paris), plus
un passage le week-end à midi. Les tâches planifiées de GitHub subissent un
retard habituel de 15 à 60 minutes : compte être alerté dans l'heure suivant la
publication d'une offre.

Ce réglage se trouve en haut du même fichier, section `schedule`.
