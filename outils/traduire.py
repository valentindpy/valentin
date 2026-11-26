# -*- coding: utf-8 -*-
"""Traduit une page construite, sans toucher à sa structure.

    from traduire import Langue
    en = Langue("en")
    page_en, manquants = en.traduire(page_fr)

LE PRINCIPE
Le site n'a qu'une source, en français. Les autres langues sont produites
à la construction, en remplaçant des fragments entiers par leur
traduction. Pas de clés semées dans le HTML, pas de `data-i18n`, pas de
bibliothèque : la page française reste lisible et modifiable telle
quelle, et c'est elle qui fait foi.

LA RÈGLE QUI ÉVITE LES ACCIDENTS
On ne remplace jamais un bout de texte : seulement un fragment entier,
à l'un des trois endroits où un visiteur peut lire quelque chose.

  1. un nœud de texte      <p>Un souci ?</p>
  2. un attribut visible   placeholder, aria-label, title, alt
  3. une chaîne JavaScript "Que se passe-t-il ?"

Un dictionnaire dont la clé serait « Contact » ne touchera donc jamais
`MAIL_CONTACT`, ni `#f-contact`, ni `contactez` — seulement un fragment
qui vaut exactement « Contact ». C'est ce qui rend la chose sûre sur un
formulaire de trois mille lignes dont tout le texte vit dans du script.

CE QUI N'EST PAS TRADUIT EST SIGNALÉ
`traduire` renvoie la liste des fragments français restés sans
traduction. La construction les affiche : une phrase ajoutée au site et
oubliée dans le dictionnaire se voit tout de suite, au lieu d'apparaître
en français au milieu d'une page anglaise.
"""
import io, json, os, re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Les attributs qu'un visiteur peut lire. `value` et `id` n'en sont pas.
ATTRIBUTS = ("placeholder", "aria-label", "title", "alt", "content")

# Ce qui ressemble à du français et mérite d'être signalé s'il reste.
FRANCAIS = re.compile(
    r"\b(vous|nous|votre|notre|des|une|les|est|avec|pour|dans|sur|qui|que|"
    r"d[eu]|la|le|aux?|par|sans|plus|tout|être|fait)\b", re.I)


class Langue(object):
    def __init__(self, code):
        self.code = code
        chemin = os.path.join(RACINE, "outils/langues/%s.json" % code)
        d = json.load(io.open(chemin, encoding="utf-8"))
        self.nom = d["nom"]
        self.prefixe = d["prefixe"]          # "/en"
        self.chemin_form = d["chemin_form"]  # "form"
        self.mots = d["textes"]
        # Ce qu'on laisse volontairement tel quel : un bout de balisage,
        # un selecteur, un nom propre, un en-tete HTTP. Sans cette liste,
        # le rapport des fragments manquants serait trop long pour servir
        # a quelque chose — et un rapport qu'on ne lit plus ne sert a rien.
        self.ignores = set(d.get("ignorer", []))
        self.employes = set()

    # ---------- l'outil ----------
    def _rendre(self, brut):
        """Un fragment cherché dans le dictionnaire.

        D'abord tel quel : dans une chaîne de script, l'espace du bord
        fait partie du texte — « Thème : » se recolle à ce qui suit.
        Ensuite normalisé, pour le HTML où le texte d'un paragraphe est
        coupé sur plusieurs lignes ; les espaces de bord sont alors
        rendus à la traduction."""
        if brut in self.mots:
            self.employes.add(brut)
            return self.mots[brut]
        cle = " ".join(brut.split())
        if not cle or cle not in self.mots:
            return None
        self.employes.add(cle)
        avant = brut[:len(brut) - len(brut.lstrip())]
        apres = brut[len(brut.rstrip()):]
        return avant + self.mots[cle] + apres

    def mot(self, texte):
        """Un fragment isole — un champ de manifeste, par exemple — rendu
        dans la langue, et compte comme employe."""
        return self._rendre(texte) or texte

    def traduire(self, page):
        manquants = []

        def noter(cle):
            """Tout ce qui n'a pas de traduction est signale, meme un mot
            seul. Une premiere version ne signalait que les fragments
            contenant un mot grammatical francais : « Locataire » et
            « Plomberie » passaient a travers, et se retrouvaient en
            francais au milieu d'une page anglaise."""
            cle = " ".join(cle.split())
            if not cle or len(cle) < 2 or cle in manquants or cle in self.ignores:
                return
            if not re.search(r"[A-Za-zÀ-ÿ]{2}", cle):
                return
            # ce qui n'est pas du texte : une regle de style, un selecteur,
            # un identifiant, une adresse, un bout de code
            if re.match(r"^[\w.#/\-]+$", cle) and " " not in cle:
                if not re.search(r"[À-ÿ]", cle) and cle.islower():
                    return
            if re.search(r"[{};]|=>|\bfunction\b|^var\b", cle):
                return
            manquants.append(cle)

        # --- 1. les nœuds de texte, hors script et style ---
        morceaux = re.split(r"(<script\b.*?</script>|<style\b.*?</style>)",
                            page, flags=re.S)
        for i, m in enumerate(morceaux):
            if m.startswith("<script") or m.startswith("<style"):
                continue

            def un_noeud(k):
                brut = k.group(1)
                neuf = self._rendre(brut)
                if neuf is None:
                    noter(brut)
                    return k.group(0)
                # on garde l'espace de bord : il sépare deux éléments
                avant = " " if brut[:1].isspace() else ""
                apres = " " if brut[-1:].isspace() else ""
                return ">" + avant + neuf + apres + "<"

            morceaux[i] = re.sub(r">([^<>]+)<", un_noeud, m)
        page = "".join(morceaux)

        # --- 2. les attributs visibles, hors script ---
        # Un attribut ecrit a l'interieur d'une chaine de script appartient
        # a cette chaine : le traduire ici couperait le fragment en deux et
        # l'empecherait d'etre reconnu a l'etape suivante.
        def un_attribut(k):
            nom, val = k.group(1), k.group(2)
            neuf = self._rendre(val)
            if neuf is None:
                if nom != "content" or " " in val:
                    noter(val)
                return k.group(0)
            return '%s="%s"' % (nom, neuf.replace('"', "&quot;"))

        morceaux = re.split(r"(<script\b.*?</script>|<style\b.*?</style>)",
                            page, flags=re.S)
        for i, m in enumerate(morceaux):
            if m.startswith("<script") or m.startswith("<style"):
                continue
            morceaux[i] = re.sub(r'(%s)="([^"]*)"' % "|".join(ATTRIBUTS), un_attribut, m)
        page = "".join(morceaux)

        # --- 3. les chaînes de caractères du script ---
        def un_script(k):
            corps = k.group(2)

            def une_chaine(c):
                guillemet, texte = c.group(1), c.group(2)
                if "\\" in texte and not re.search(r"[A-Za-zÀ-ÿ]", texte):
                    return c.group(0)
                neuf = self._rendre(texte)
                if neuf is None:
                    noter(texte)
                    return c.group(0)
                # la traduction retourne dans le même type de guillemets,
                # échappée si elle en contient un
                return guillemet + neuf.replace(guillemet, "\\" + guillemet) + guillemet

            # On ne traduit ni ne signale ce qui est dans un commentaire :
            # une apostrophe francaise y ouvrirait une fausse chaine, et le
            # rapport se remplirait de morceaux de phrases coupees.
            morceaux, i, n = [], 0, len(corps)
            while i < n:
                deb = corps.find("/*", i)
                ligne = corps.find("//", i)
                if ligne != -1 and (deb == -1 or ligne < deb):
                    fin = corps.find("\n", ligne)
                    fin = n if fin == -1 else fin
                    morceaux.append((corps[i:ligne], True))
                    morceaux.append((corps[ligne:fin], False))
                    i = fin
                elif deb != -1:
                    fin = corps.find("*/", deb)
                    fin = n if fin == -1 else fin + 2
                    morceaux.append((corps[i:deb], True))
                    morceaux.append((corps[deb:fin], False))
                    i = fin
                else:
                    morceaux.append((corps[i:], True))
                    i = n
            sortie = []
            for bout, code in morceaux:
                sortie.append(
                    re.sub(r"""(['"])((?:\\.|(?!\1)[^\\\n])*)\1""", une_chaine, bout)
                    if code else bout)
            return k.group(1) + "".join(sortie) + k.group(3)

        page = re.sub(r"(<script\b[^>]*>)(.*?)(</script>)", un_script, page, flags=re.S)
        return page, manquants

    def inemployes(self):
        return [c for c in self.mots if c not in self.employes]
