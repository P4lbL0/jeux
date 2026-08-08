# §2 Décisions verrouillées

> [← Sommaire du design](../DESIGN.md)

---

Ces points sont tranchés. On ne les remet pas en question sans une bonne raison,
parce que l'architecture du code repose dessus.

| Sujet | Décision |
|---|---|
| Mode de jeu | **Solo, hors-ligne.** Un **leaderboard en ligne** est prévu, uniquement pour envoyer les scores (voir §4.9). |
| Vue | Vue de dessus (top-down), pixel-art 2D. |
| Durée | **Sans fin.** Vagues infinies, montée en puissance continue des deux côtés. |
| Combat | **Survivors-like** : le joueur contrôle le déplacement + ses **ultimes**. Attaque de base, visée et esquive sont automatiques. |
| Caméra | **Zoom libre à la molette.** Le jeu doit rester lisible à toutes les distances. |
| Esquive | C'est une **statistique**, pas un réflexe (ex. assassin : 10% de chance d'esquiver). |
| Mort d'un héros | **Définitive** — mais elle ne peut résulter que d'une décision du joueur (voir §4.3). |
| Changement de héros | À tout moment, **sauf sous 20% de vie** : il faut alors rentrer dans la cité. |
| IA | Un héros joué par l'IA **se replie automatiquement à 20% de vie**. L'IA ne perd donc jamais un héros. |
| Ordres | Le joueur donne des **ordres de position, de posture et de formation** aux héros IA (voir §4.4). |
| Améliorations | L'IA **ne choisit jamais**. Le choix appartient toujours au joueur. Le jeu se met en **pause** pour choisir. |
| Ressources | **Trois, jamais fusionnées** : l'XP (puissance), l'argent (matériel), les matériaux (rangs). |
| Rank up | Avec des **matériaux rares** lâchés par les monstres. |
| Rythme | Un **cycle jour/nuit** : 30 min de jour, 15 min de nuit (§4.19). |
| Fin de partie | Tous les héros morts **ou** **plus un seul habitant vivant** = partie terminée (§4.18). |
| Après une défaite | Le héros de départ survit, s'affaiblit et **se corrompt**. Au bout de plusieurs défaites, il bascule et devient l'antagoniste (§4.12). |
