# Demarre le serveur ComfyUI local, celui que `generer-batiment.ts` pilote.
#
# ComfyUI vit hors du depot : c'est 8 Go de modeles et de dependances Python,
# ca n'a rien a faire dans un depot de jeu. Ce script ne sert qu'a le lancer
# avec les bons reglages pour cette machine.
#
#   powershell -ExecutionPolicy Bypass -File scripts/demarrer-comfyui.ps1
#
# Puis, dans un autre terminal :
#   npx tsx scripts/generer-batiment.ts eglise-1 "small stone chapel"

$racine = "C:\Users\lemir\Desktop\Projet\outils\ComfyUI"
$py = "$racine\venv\Scripts\python.exe"

if (-not (Test-Path $py)) {
  Write-Error "ComfyUI n'est pas installe dans $racine. Voir SUITE.md."
  exit 1
}

# --lowvram : la RTX 1000 Ada n'a que 6 Go. En SD1.5/512px ce n'est pas
# necessaire en theorie, mais le navigateur et le jeu tournent souvent en meme
# temps sur cette machine, et une generation qui echoue par manque de memoire
# coute plus cher que les quelques secondes que --lowvram fait perdre.
& $py "$racine\main.py" --lowvram --port 8188
