# Application desktop de gestion de VPS — document de conception (V0)

Date : 2026-10-21 · Statut : à approuver · Nom de travail : **lookout** (toujours en minuscules ; **non figé**, il peut changer à tout moment, donc le nom doit rester facile à remplacer dans le code)

Convention : ce qui est écrit sans mention vient de Kokouvi (le porteur du projet). Ce qui est marqué **[choix validé]** est une proposition que le porteur a validée ; il peut la changer.

## 1. Intention et raison d'être

Un développeur qui héberge plusieurs projets sur un ou plusieurs VPS finit par tout piloter en ligne de commande : il doit se souvenir des commandes, de l'emplacement de chaque dossier, de quel conteneur appartient à quel projet, de quel domaine pointe où. Avec 2 à 5 VPS, cette charge mentale devient pesante. Les outils de supervision que le porteur a essayés affichent des statistiques, mais leur interface est trop compliquée.

On construit une **application desktop open source (Mac et Windows)** qui se connecte aux VPS d'un développeur et lui montre, de façon claire et épurée, **ce qui tourne, où, comment, et ce que ça consomme**. À terme elle doit pouvoir **remplacer complètement le terminal** pour les gestes courants. Une personne qui l'ouvre le matin doit comprendre en quelques secondes que tout va bien (« pas de rouge, tout est vert »), ou voir immédiatement quel projet consomme anormalement de la RAM ou du CPU.

La vraie valeur est la vue **par projet** : comment il tourne, ce qu'il utilise, comment il est déployé. Les statistiques du serveur sont importantes aussi, pas secondaires.

## 2. Public

Le porteur et d'autres développeurs qui ont **2 à 5 VPS** avec plusieurs projets chacun. Donc le multi-serveur et l'authentification sont dans le périmètre dès le départ. Ils sont à l'aise avec Docker et Git mais ne veulent pas retenir les commandes.

## 3. Objectifs

1. Voir en un coup d'œil l'état de santé de tous ses serveurs et de leurs projets (vert/orange/rouge).
2. Voir la consommation du serveur (CPU, RAM, disque) et **quel projet ou conteneur consomme** ; le repérer clairement quand ça dérape.
3. **Détection automatique des projets** : l'utilisateur n'a rien à configurer au départ.
4. Pour chaque projet : espace occupé sur le VPS, RAM et CPU actuels, domaines (DNS) sur lesquels il est déployé, ressources utilisées (conteneurs, base de données, volumes), informations de déploiement (dépôt, branche, dernier commit, méthode), et **logs**.
5. Quelques actions sûres : **redémarrer un conteneur** et **lire les logs**.
6. Interface très sobre : fond noir, lignes simples, cartes ; graphiques limités à des **courbes simples**.
7. Facile à contribuer : technologies courantes, code lisible, projet open source sur le GitHub du porteur.

## 4. Hors périmètre de la V0 (non-objectifs)

- **Pas de bouton Déployer, pas de déclenchement de déploiement.** Le développeur continue de faire ses commits et pulls depuis sa machine pour déclencher merges et déploiements. La page projet *affiche* les informations de déploiement mais ne déclenche rien.
- Rien n'est installé sur le serveur (pas d'agent, pas de panneau web).
- Pas de compte utilisateur, pas de cloud, pas de collecte de données (télémétrie).
- Pas de gestion de contenu des bases de données (naviguer dans les tables, éditer) : en V0 une base est une ressource du projet avec son état et sa taille **[choix validé]**.
- Pas d'historique persistant des métriques : les courbes couvrent les dernières minutes en mémoire **[choix validé]**.
- Pas de Kubernetes, pas de PaaS, pas de gestion des pare-feu ni de la sécurité du serveur.

## 5. Anti-objectifs (échec même si ça « marche »)

- Une interface qui demande un manuel ou qui ressemble aux outils trop compliqués déjà testés.
- Une application qui conserve des clés ou mots de passe SSH dans ses propres fichiers.
- Toute modification de la production **sans confirmation explicite** de l'utilisateur.
- Une application qui devient un « Portainer de plus » en accumulant des fonctions de gestion.

## 6. Contraintes décidées

- **Electron** pour Mac et Windows, **React + Tailwind** pour l'interface, thème sombre sobre. Choisi pour la simplicité de contribution.
- Open source, publié sur le GitHub du porteur. Licence **MIT [choix validé]**.
- Connexion **SSH uniquement**, aucune installation côté serveur.
- Toute action qui touche la production demande une confirmation. Pour un redémarrage, la confirmation affiche la **commande exacte** qui sera exécutée **[choix validé pour l'affichage de la commande]**.
- TypeScript pour tout le code **[choix validé]**.

## 7. Ce que fait la V0

### 7.1 Serveurs et authentification

- Une barre latérale liste les serveurs, chacun avec son état (vert/orange/rouge). La liste est enregistrée localement.
- **Ajouter un serveur** : (1) l'app propose d'abord les hôtes présents dans `~/.ssh/config` ; (2) sinon l'utilisateur saisit IP/nom d'hôte, utilisateur et port ; (3) il choisit sa méthode : agent SSH, fichier de clé, ou mot de passe en dernier recours.
- Les passphrases et mots de passe sont stockés dans le **trousseau du système** (Keychain / gestionnaire d'identifiants Windows). L'app ne stocke jamais de clé privée dans ses fichiers.
- À la première connexion, l'**empreinte du serveur** est affichée et doit être validée ; si elle change ensuite, l'app alerte.
- Un utilisateur non-root est recommandé ; l'app fonctionne aussi en root (cas du porteur) en le signalant, et indique ce qui manque pour un compte restreint (par exemple l'appartenance au groupe `docker`).
- Le serveur injoignable apparaît en rouge ; l'app retente la connexion.

### 7.2 Écran d'accueil d'un serveur (« écran B », choisi par le porteur)

- Trois cartes en haut : **CPU** (courbe), **RAM** (courbe), **Disque** (barre). Courbes simples, sans axes chargés.
- En dessous, **« Qui consomme en ce moment »** : liste de projets/conteneurs avec point de statut, barre de consommation, nom, et la valeur critique en clair quand elle dépasse un seuil (par exemple « CPU 71 % » en orange).
- Les points verts/orange/rouges n'apparaissent **que** sur cette liste et sur les pages projet ; pas de grand bandeau d'alerte.
- Seuils : orange quand un projet dépasse un seuil de CPU/RAM (valeur initiale : CPU > 70 %, RAM élevée) **[valeurs de départ : choix validé]**. Rouge pour un conteneur arrêté ou en échec de santé. Les seuils sont prévus pour être réglables plus tard.
- Maquette de référence : écran B, validé. Les barres de la liste comparent chaque projet à la machine entière.

### 7.3 Navigation

Sections : Vue d'ensemble, Projets, Conteneurs, Bases, Déploiements **[choix validé pour les noms exacts des sections]**. Le contenu détaillé des sections « Bases » et « Déploiements » en V0 est limité à l'affichage des informations (aucune action).

### 7.4 Page d'un projet (validée)

- **En-tête** : nom, état, technologie détectée, depuis quand en ligne ; boutons **Redémarrer** et **Logs**. Pas de bouton Déployer.
- **Cartes** : espace disque occupé (images + volumes), RAM actuelle (petite courbe), CPU (petite courbe).
- **Domaines** : domaines du projet, état du certificat HTTPS, IP vers laquelle ils pointent, avec le proxy utilisé.
- **Ressources utilisées** : conteneurs du projet (app, worker, IA, base de données…) avec leur état de santé.
- **Déploiement (lecture seule)** : dépôt, branche, dernier commit, résultat du dernier déploiement quand c'est connu, méthode (GitHub Actions, git pull, rsync…).
- **Logs** : un onglet par conteneur. La vue peut être **agrandie en plein écran pour tout lire**. J'ajoute une recherche et un défilement en direct **[choix validé]**. Les erreurs sont en rouge.
- Un projet **sans back-end** (site statique) n'affiche pas la carte Logs.

### 7.5 Actions

- **Redémarrer un conteneur** (ou tous les conteneurs d'un projet **[à trancher par le builder, voir §10]**) et **voir les logs**.
- Toute action passe par une **liste fixe de commandes autorisées**, jamais par une chaîne libre construite à partir d'une entrée. Une confirmation précède toute modification de production.

### 7.6 Détection automatique des projets

Sans configuration, l'app reconstruit « projet → conteneurs → dépôt → domaines » à partir de ce qu'elle trouve **[méthode : choix validé]** :

- **Docker / Docker Compose** : regroupement des conteneurs par projet Compose (étiquettes Compose, dossier de travail, fichiers de configuration).
- **Dépôt Git** : si le dossier du projet est un dépôt Git, lecture de l'origine, de la branche et du dernier commit.
- **Domaines** : lecture de la configuration du reverse proxy et rattachement d'un domaine à un conteneur via le port local publié. **Caddy en priorité** ; nginx au mieux de l'effort **[choix validé]**. Un site statique servi directement par le proxy est un projet sans conteneur.
- Tout ce qui n'est pas géré (processus hors Docker, PM2, systemd, Kubernetes) est signalé clairement comme « non détecté » plutôt qu'ignoré en silence **[choix validé]**.

### 7.7 Collecte des données

- Rafraîchissement automatique toutes les quelques secondes (valeur de départ : environ 5 s **[choix validé]**) pour l'état, les métriques et les logs en direct.
- Métriques de l'hôte (CPU, RAM, disque, uptime) et par conteneur (CPU, RAM) ; espace disque par projet (images + volumes).
- Les informations sont obtenues par des commandes en lecture seule exécutées via SSH. Les sorties sont lues en format structuré (JSON) quand c'est possible plutôt que par analyse de texte **[choix validé]**.

## 8. Architecture (indicative)

- **Processus principal Electron** : gestion des connexions SSH (une par serveur, avec reconnexion), collecte des données, liste fixe de commandes, accès au trousseau. **Les clés et secrets n'atteignent jamais l'interface.**
- **Interface (React + Tailwind)** : n'appelle le processus principal que par des canaux typés (isolation de contexte activée).
- Un module de « collecte » par source (hôte, Docker, Caddy/nginx, Git) qui produit un modèle de données commun (serveur → projets → ressources), de façon à pouvoir ajouter des sources.
- Les parseurs de configuration (Caddy, Compose) doivent être testables sans serveur réel.

## 9. Distribution et contribution

- Installateurs pour Mac et Windows (par exemple via `electron-builder`) **[choix validé]**. La signature de code n'est pas dans la V0 ; les avertissements du système à l'installation sont documentés.
- Dépôt avec README, guide de contribution, et un moyen de tester sans VPS réel (par exemple un serveur de test conteneurisé) **[choix validé]**.
- Licence MIT **[choix validé]**.

## 10. Laissé au builder

- Le choix de la bibliothèque SSH, de la bibliothèque de graphiques (piste : uPlot) et de la structure exacte du code.
- Le format précis du script/commande de collecte et la manière d'obtenir l'état Docker (CLI ou API du socket).
- Les seuils exacts et la durée d'historique des courbes.
- Si « Redémarrer » s'applique à un conteneur, à un projet entier, ou aux deux.
- Les détails d'accessibilité, de raccourcis clavier et de gestion des erreurs réseau.

## 11. Précisions issues de la relecture [choix validé]

Ces points ont été tranchés après une relecture indépendante du document. Le porteur peut les changer.

**Modèle d'état (vert / orange / rouge / neutre)**
- Un conteneur qui a **terminé normalement** (code de sortie 0, par exemple une migration ou une tâche ponctuelle) est **neutre** (« terminé »), jamais rouge.
- **Rouge** : conteneur en échec de santé, qui redémarre en boucle, sorti avec un code non nul, ou **arrêté alors que sa politique de redémarrage dit qu'il devrait tourner** (`always`, `unless-stopped`).
- **Orange** : seuil de CPU/RAM dépassé (§7.2), ou projet « dégradé » (une partie seulement de ses conteneurs est saine).
- État d'un **projet** = le pire état de ses conteneurs (rouge > orange > vert ; les conteneurs neutres sont ignorés). État d'un **serveur** (point dans la barre latérale) = le pire état de ses projets et de ses seuils d'hôte, ou rouge s'il est injoignable.

**Périmètre de détection de la V0 (§7.6)**
- Pris en charge : projets Docker Compose, conteneurs Docker isolés (un conteneur lancé sans Compose est un projet à lui seul, nommé d'après le conteneur), et **Caddy** comme proxy de référence.
- **nginx** : prévu (décision du porteur) via une interface commune de fournisseurs de reverse proxy, dont Caddy est le premier ; nginx est livré juste après la V0 de base. Traefik, Apache et les autres pourront s'y ajouter plus tard.
- « Terminé » pour la V0 = fonctionne sur les VPS réels du porteur (Docker Compose + Caddy) et sur des serveurs de test fournis dans le dépôt qui reproduisent ces cas.
- Docker : démon classique, utilisé par root ou par un utilisateur du groupe `docker`. Docker rootless et Podman sont hors V0. Versions minimales visées : Docker 20.10 et Compose v2.

**Lecture de fichiers sur le serveur et sécurité (§6, §7.5)**
- La règle « liste fixe de commandes » est maintenue. Elle inclut des **lectures de fichiers paramétrées** (Caddyfile, fichiers Compose, dépôt Git) uniquement sur des chemins **découverts** par l'app (étiquettes Docker, emplacements connus) et validés ; jamais une chaîne libre composée à partir d'une saisie.
- Pour Caddy, l'API d'administration locale (interrogée depuis le serveur) est préférée ; la lecture du Caddyfile est le repli.
- Si l'utilisateur SSH n'a pas le droit de lire un fichier, l'app l'indique (« accès refusé : voici ce qu'il manque ») au lieu d'échouer en silence.

**Informations de déploiement (§7.4)**
- La V0 n'appelle **pas** l'API GitHub (pas de jeton, pas d'appel vers des services tiers). Elle affiche ce qui est lisible sur le serveur : dépôt, branche, dernier commit (depuis le dossier Git du serveur).
- La **méthode** de déploiement est **estimée** et marquée comme telle : image tirée d'un registre (ghcr.io…) → « image construite par CI » ; dossier Git sur le serveur → « git pull » ; ni l'un ni l'autre → « copie de fichiers ». Le **résultat du dernier déploiement** est « inconnu » en V0.

**Domaines, DNS, HTTPS (§7.4)**
- Les domaines viennent de la configuration du proxy. L'IP vers laquelle un domaine pointe est résolue **depuis la machine de l'utilisateur** et comparée à l'IP du serveur (un écart est signalé).
- L'état du certificat HTTPS (valide / expire dans N jours) est obtenu par une **connexion TLS depuis le poste de l'utilisateur vers ses propres domaines**. Aucune autre connexion sortante n'est faite, et rien n'est envoyé à des tiers.

**SSH (§7.1)**
- Lecture de `~/.ssh/config` : hôte, nom d'hôte, utilisateur, port, fichier de clé, `Include` et `ProxyJump` au mieux de ce que permet la bibliothèque choisie.
- Windows : l'agent OpenSSH et les fichiers de clé sont pris en charge ; Pageant n'est pas exigé en V0.

**Windows (§6, §9)**
- Mac et Windows sont tous deux visés. Windows est compilé et testé automatiquement en intégration continue (GitHub Actions) ; la vérification manuelle (agent SSH, installation) revient aux contributeurs, ce qui est signalé dans le README.

**Logs (§7.4)**
- Chaque onglet garde en mémoire les **N dernières lignes** (valeur de départ : 5 000). La recherche s'applique à ce tampon. Un bouton « charger plus ancien » remonte progressivement dans l'historique, de sorte que l'utilisateur puisse atteindre l'intégralité des logs à la demande, sans tout charger d'un coup.

**Fréquence de collecte (§7.7)**
- Le serveur **affiché** est interrogé environ toutes les 5 s ; les **autres serveurs** toutes les 30 à 60 s, juste assez pour mettre à jour leur point de statut. Une seule connexion SSH par serveur, réutilisée.

## 12. Décisions du porteur après relecture

- **Langue** : anglais par défaut, avec traduction française. L'internationalisation (i18n) est donc en place dès le premier écran ; le README, le guide de contribution et les messages de commit sont en anglais.
- **Licence** : MIT, confirmée.

- **Nom** : **lookout**, toujours en minuscules (dépôt, titre de fenêtre, documentation, installateurs). Sur GitHub, des dépôts nommés « lookout » existent déjà (par exemple `src-d/lookout`, `delan/lookout`) mais ce ne sont pas des outils de gestion de serveurs ; la disponibilité sur npm et comme nom de domaine reste à vérifier avant la publication, et le nom du dépôt peut alors être `nyamek0/lookout`.

## 13. Questions ouvertes (pour le porteur)

Aucune question bloquante. Reste à faire avant publication : vérifier la disponibilité de « lookout » sur npm et en nom de domaine, et choisir l'identifiant d'application des installateurs (par exemple `com.nyamek0.lookout`).
