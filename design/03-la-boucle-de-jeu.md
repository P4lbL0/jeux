# §3 La boucle de jeu

> [← Sommaire du design](../DESIGN.md)

---

```
   PROLOGUE (une seule fois par partie)
   Choix de classe → arrivée au village en ruine → exploration libre,
   dialogue avec les PNJ → on apprend l'absence de Protecteur → on accepte le poste

                              ↓

   ┌────────────────────────────────────────────────────────┐
   │  LE JOUR  (30 minutes réelles)                         │
   │  · les habitants travaillent, la récolte tombe seule   │
   │  · le joueur récolte à la main, bien plus vite         │
   │  · réparer, construire, placer et orienter les défenses│
   │  · affecter les métiers, donner les postures civiles   │
   │  · accueillir ou refuser ceux qui attendent aux portes │
   │  · attribuer les montées de niveau en attente          │
   │  · MAIS : une horde peut tomber à tout moment (§4.19)  │
   └────────────────────────────────────────────────────────┘
                              ↓
                     le soleil se couche
                    (l'annonce, c'est le ciel)
                              ↓
   ┌────────────────────────────────────────────────────────┐
   │  LA NUIT  (15 minutes réelles)                         │
   │  · un effectif défini d'avance arrive par les fronts   │
   │  · les habitants rentrent — sauf ceux qu'on laisse     │
   │  · le joueur incarne un héros, les autres sont en IA   │
   │  · switch libre entre héros — sauf sous 20% de vie     │
   │  · les défenses et les tours occupées agissent         │
   │  · montée de niveau du héros incarné → PAUSE + choix   │
   │  · effectif épuisé avant l'aube → la nuit devient      │
   │    calme : c'est la récompense d'avoir nettoyé vite    │
   └────────────────────────────────────────────────────────┘
                              ↓
   ┌────────────────────────────────────────────────────────┐
   │  L'AUBE                                                │
   │  · versement de l'argent                               │
   │  · ce que la nuit a cassé reste cassé, à réparer       │
   │  · naissances, arrivées aux portes, survivants à aller │
   │    chercher                                            │
   └────────────────────────────────────────────────────────┘
                              ↓
                        retour au jour
                 (jusqu'à la défaite — le jeu est sans fin)
```
