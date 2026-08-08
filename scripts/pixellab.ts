/**
 * Un client REST minimal pour l'API PixelLab.
 *
 * Pourquoi pas le SDK officiel `@pixellab-code/pixellab` ? Parce qu'il valide
 * la reponse avec un schema qui exige `usage: { type: "usd" }`. Un compte en
 * periode d'essai est facture **en generations**, pas en dollars : le SDK
 * rejette donc toutes ses propres reponses. Trente lignes de `fetch` coutent
 * moins cher qu'un contournement.
 *
 * Deux endpoints suffisent au lot statique :
 * - `POST /v1/generate-image-pixflux`  : invente librement a partir du texte ;
 * - `POST /v1/generate-image-bitforge` : reprend le style d'une image donnee.
 *
 * Le solde utile, lui, est sur `GET /v2/balance` : `/v1/balance` ne connait que
 * le porte-monnaie en dollars et affiche 0 alors qu'il reste des generations.
 */

import { readFile, writeFile } from "node:fs/promises";

const BASE = "https://api.pixellab.ai";

export type Vue = "side" | "low top-down" | "high top-down";
export type Direction = "south" | "east" | "north" | "west";
export type Contour = "single color black outline" | "single color outline" | "selective outline" | "lineless";
export type Ombrage = "flat shading" | "basic shading" | "medium shading" | "detailed shading";
export type Detail = "low detail" | "medium detail" | "highly detailed";

/** Une image telle que l'API les echange : du base64 et un format. */
export interface ImageApi {
  type: "base64";
  base64: string;
  format?: string;
}

/**
 * Ce que coute un appel.
 *
 * Deux formes existent selon le compte : un montant en dollars, ou un nombre de
 * generations pour un compte d'essai. On accepte les deux.
 */
export type Cout = { type: "usd"; usd: number } | { type: "generations"; generations: number };

export interface Solde {
  /** Le porte-monnaie, en dollars. */
  usd: number;
  /** Les generations restantes de l'abonnement ou de l'essai. */
  generations: number;
  /** Le total de l'offre, pour situer ce qu'il reste. */
  generationsTotal: number;
  statut: string;
}

export interface ParametresCommuns {
  description: string;
  negativeDescription?: string;
  imageSize: { width: number; height: number };
  outline?: Contour;
  shading?: Ombrage;
  detail?: Detail;
  view?: Vue;
  direction?: Direction;
  noBackground?: boolean;
  coveragePercentage?: number;
  seed?: number;
}

export interface ParametresBitforge extends ParametresCommuns {
  styleImage: ImageApi;
  styleStrength?: number;
}

export interface Reponse {
  image: ImageApi;
  usage: Cout;
}

export class ClientPixelLab {
  constructor(private readonly secret: string) {}

  /** Lit `PIXELLAB_SECRET` dans un fichier `.env`, sans dependance. */
  static async depuisEnv(cheminEnv: string): Promise<ClientPixelLab> {
    const contenu = await readFile(cheminEnv, "utf8");
    const ligne = contenu
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith("PIXELLAB_SECRET="));
    const secret = ligne?.slice(ligne.indexOf("=") + 1).trim();
    if (!secret) throw new Error(`PIXELLAB_SECRET absent de ${cheminEnv}`);
    return new ClientPixelLab(secret);
  }

  private async appeler<T>(chemin: string, corps?: unknown): Promise<T> {
    const reponse = await fetch(`${BASE}${chemin}`, {
      method: corps ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${this.secret}`,
        ...(corps ? { "Content-Type": "application/json" } : {}),
      },
      ...(corps ? { body: JSON.stringify(corps) } : {}),
    });
    if (!reponse.ok) {
      const texte = await reponse.text();
      throw new Error(`HTTP ${reponse.status} sur ${chemin} — ${texte.slice(0, 300)}`);
    }
    return (await reponse.json()) as T;
  }

  async solde(): Promise<Solde> {
    const brut = await this.appeler<{
      credits?: { usd?: number };
      subscription?: { generations?: number; total?: number; status?: string };
    }>("/v2/balance");
    return {
      usd: brut.credits?.usd ?? 0,
      generations: brut.subscription?.generations ?? 0,
      generationsTotal: brut.subscription?.total ?? 0,
      statut: brut.subscription?.status ?? "inconnu",
    };
  }

  /** Genere a partir du texte seul. */
  pixflux(p: ParametresCommuns): Promise<Reponse> {
    return this.appeler<Reponse>("/v1/generate-image-pixflux", charge(p));
  }

  /** Genere en imitant le style d'une image de reference. */
  bitforge(p: ParametresBitforge): Promise<Reponse> {
    return this.appeler<Reponse>("/v1/generate-image-bitforge", {
      ...charge(p),
      style_image: p.styleImage,
      style_strength: p.styleStrength,
    });
  }
}

/** Le corps de requete, en snake_case comme l'attend l'API. */
function charge(p: ParametresCommuns): Record<string, unknown> {
  return {
    description: p.description,
    negative_description: p.negativeDescription,
    image_size: p.imageSize,
    outline: p.outline,
    shading: p.shading,
    detail: p.detail,
    view: p.view,
    direction: p.direction,
    no_background: p.noBackground,
    coverage_percentage: p.coveragePercentage,
    seed: p.seed,
  };
}

export async function enregistrer(image: ImageApi, chemin: string): Promise<void> {
  await writeFile(chemin, Buffer.from(image.base64, "base64"));
}

export async function chargerImage(chemin: string): Promise<ImageApi> {
  const donnees = await readFile(chemin);
  return { type: "base64", base64: donnees.toString("base64"), format: "png" };
}
