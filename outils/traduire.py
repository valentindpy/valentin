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


# Les caracteres apres lesquels un « / » ouvre une expression reguliere
# et non une division.
AVANT_REGEX = set("(,=:[!&|?{};+-*%~^<>")


def parcourir(code):
    """Parcourt un script une fois et le decoupe en tranches
    (debut, fin, genre), ou genre vaut "code", "chaine", "commentaire"
    ou "regex".

    POURQUOI UN VRAI PARCOURS, ET NON DES EXPRESSIONS REGULIERES
    Une premiere version cherchait les commentaires avec find("/*"). Le
    formulaire contient accept="image/*" : ce « /* » dans une chaine
    ouvrait un commentaire qui ne se fermait jamais, et le tiers du
    script qui suivait n'etait ni traduit ni signale — il sortait en
    francais au milieu de la page anglaise, sans que rien ne le dise.
    Une version encore anterieure faisait l'erreur symetrique : une
    apostrophe francaise dans un commentaire ouvrait une fausse chaine.
    On ne peut pas reconnaitre l'un sans reconnaitre les autres ; d'ou
    ce parcours unique, qui connait les quatre genres a la fois.
    """
    i, n = 0, len(code)
    tranches, depart, dernier = [], 0, ""
    while i < n:
        c = code[i]
        if c in "\"'`":
            tranches.append((depart, i, "code"))
            q, j = c, i + 1
            while j < n:
                if code[j] == "\\":
                    j += 2
                    continue
                if code[j] == q:
                    j += 1
                    break
                if q != "`" and code[j] == "\n":
                    break
                j += 1
            j = min(j, n)
            tranches.append((i, j, "chaine"))
            i = depart = j
            dernier = q
            continue
        if c == "/" and i + 1 < n and code[i + 1] == "/":
            tranches.append((depart, i, "code"))
            j = code.find("\n", i)
            j = n if j < 0 else j
            tranches.append((i, j, "commentaire"))
            i = depart = j
            continue
        if c == "/" and i + 1 < n and code[i + 1] == "*":
            tranches.append((depart, i, "code"))
            j = code.find("*/", i)
            j = n if j < 0 else j + 2
            tranches.append((i, j, "commentaire"))
            i = depart = j
            continue
        if c == "/" and (dernier == "" or dernier in AVANT_REGEX):
            # une expression reguliere : ses guillemets et ses « /* » ne
            # sont pas du texte. /[&<>"]/g en contient un.
            j, classe = i + 1, False
            while j < n:
                d = code[j]
                if d == "\\":
                    j += 2
                    continue
                if d == "\n":
                    break
                if d == "[":
                    classe = True
                elif d == "]":
                    classe = False
                elif d == "/" and not classe:
                    j += 1
                    break
                j += 1
            while j < n and code[j].isalpha():
                j += 1
            tranches.append((depart, i, "code"))
            tranches.append((i, min(j, n), "regex"))
            i = depart = min(j, n)
            dernier = "/"
            continue
        if not c.isspace():
            dernier = c
        i += 1
    tranches.append((depart, n, "code"))
    return [(a, b, g) for a, b, g in tranches if b > a]


def desechapper(texte):
    """Rend sa forme lisible a une chaine de script : dans le code,
    « J\\'accepte » s'ecrit avec une barre, pas le dictionnaire."""
    out, i, n = [], 0, len(texte)
    while i < n:
        if texte[i] == "\\" and i + 1 < n and texte[i + 1] in "\"'":
            out.append(texte[i + 1])
            i += 2
        else:
            out.append(texte[i])
            i += 1
    return "".join(out)


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
        # Une meme phrase s'ecrit avec une espace fine insecable dans la
        # page (« 1 000 € ») et, le plus souvent, avec une espace
        # ordinaire dans le dictionnaire, ou personne ne la distingue a
        # l'oeil. Comme str.split() tient la fine pour une espace, la cle
        # normalisee ne tombait pas sur la bonne entree et la phrase
        # ressortait en francais. On indexe donc chaque entree sous sa
        # forme normalisee, quelle que soit l'espace employee.
        self.normalises = {}
        for cle, valeur in self.mots.items():
            self.normalises.setdefault(" ".join(cle.split()), (cle, valeur))

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
        trouve = self.normalises.get(cle) if cle else None
        if trouve is None:
            return None
        origine, valeur = trouve
        self.employes.add(origine)
        avant = brut[:len(brut) - len(brut.lstrip())]
        apres = brut[len(brut.rstrip()):]
        return avant + valeur + apres

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
                # Les espaces de bord sont deja rendues par _rendre : les
                # rajouter ici les doublait. Le HTML fond deux espaces en
                # une, donc cela ne se voyait pas — raison de plus pour ne
                # pas le laisser.
                return ">" + neuf + "<"

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
        # Le parcours sait distinguer une chaîne d'un commentaire, d'une
        # expression régulière et du reste du code. Ce qui n'est pas une
        # chaîne n'est ni traduit ni signalé.
        def un_script(k):
            corps = k.group(2)
            sortie = []
            for a, b, genre in parcourir(corps):
                bout = corps[a:b]
                if genre != "chaine" or len(bout) < 2 or bout[-1] != bout[0]:
                    sortie.append(bout)
                    continue
                guillemet, texte = bout[0], bout[1:-1]
                # un gabarit à trous : y toucher casserait l'interpolation
                if guillemet == "`" and "${" in texte:
                    sortie.append(bout)
                    continue
                if "\\" in texte and not re.search(r"[A-Za-zÀ-ÿ]", texte):
                    sortie.append(bout)
                    continue
                cle = desechapper(texte)
                neuf = self._rendre(cle)
                if neuf is None:
                    noter(cle)
                    sortie.append(bout)
                    continue
                sortie.append(guillemet
                              + neuf.replace("\\", "\\\\").replace(guillemet, "\\" + guillemet)
                              + guillemet)
            return k.group(1) + "".join(sortie) + k.group(3)

        page = re.sub(r"(<script\b[^>]*>)(.*?)(</script>)", un_script, page, flags=re.S)
        return page, manquants

    def inemployes(self):
        return [c for c in self.mots if c not in self.employes]
