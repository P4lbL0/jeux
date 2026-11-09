/**
 * Greffe les méthodes de parts de classe sur une classe : le motif des « mixins » de
 * TypeScript. Chaque part est une classe qu'on n'instancie jamais ; ses méthodes sont
 * recopiées telles quelles (descripteurs compris, donc non énumérables, comme celles d'une
 * classe) sur le prototype de la cible. Un nom déjà présent arrête tout : deux parts ne
 * peuvent pas se marcher dessus sans qu'on le voie au chargement.
 */
export function greffer(cible: { prototype: object }, parts: Array<{ prototype: object; name: string }>): void {
  for (const part of parts) {
    for (const [nom, descripteur] of Object.entries(Object.getOwnPropertyDescriptors(part.prototype))) {
      if (nom === "constructor") continue;
      if (Object.prototype.hasOwnProperty.call(cible.prototype, nom)) {
        throw new Error(`greffer : « ${nom} » de ${part.name} existe déjà`);
      }
      Object.defineProperty(cible.prototype, nom, descripteur);
    }
  }
}
