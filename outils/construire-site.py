#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construit le site public de VD SERVICES \u00e0 partir des pages de docs/.

    python3 outils/construire-site.py

Sortie : site/index.html et site/formulaire/index.html, pr\u00eats \u00e0 d\u00e9poser sur Vercel.
Le formulaire est extrait du prototype de docs/parcours-qr.html : m\u00eames \u00e9crans,
m\u00eames questions, sans le chronom\u00e8tre ni la fiche de d\u00e9monstration, et avec
l'envoi r\u00e9el au bout. Les deux fichiers de site/ sont donc des produits : ne les
modifiez pas \u00e0 la main, changez docs/ puis relancez ce script.
"""
import io, os, re

src = io.open("docs/parcours-qr.html", encoding="utf-8").read().split("\n")
def bloc(a, b):            # lignes 1-indexées, bornes incluses
    return "\n".join(src[a-1:b])

theme   = bloc(6, 43)       # variables de couleur, clair et sombre
ecran   = bloc(248, 301)    # tout ce qui s'affiche dans l'écran du téléphone
consts  = bloc(471, 568)    # listes de métiers, prestations, gestes, libellés
moteur  = bloc(589, 845)    # dots, back, aides, okContact, grp, tiles, render

# --- le moteur est repris tel quel, à trois endroits près -------------------
old_done = moteur[moteur.index('  else if(step==="done"){'):moteur.index("  sc.innerHTML=h;")]
new_done = '''  else if(step==="envoi"){
    h+='<div class="ok"><div class="mark mark-att">…</div><p class="q">Envoi en cours</p>'
      +'<p class="qs">Quelques secondes.</p></div>';
  }
  else if(step==="done"){
    h+=ecranFinal();
  }
'''
moteur = moteur.replace(old_done, new_done)

old_tel = """    h+='<a class="cta urg" href="tel:+33400000010">Appeler l\\'entreprise d\\'astreinte</a>';"""
new_tel = """    h+='<a class="cta urg" href="tel:'+CONFIG.telAstreinte+'">Appeler l\\'entreprise d\\'astreinte</a>';"""
assert moteur.count(old_tel) == 1
moteur = moteur.replace(old_tel, new_tel)

old_tel2 = """    h+='<a class="cta" style="margin-top:0;background:var(--ink)" href="tel:+33400000011">Appeler le second contact</a>';"""
new_tel2 = """    h+='<a class="cta" style="margin-top:0;background:var(--ink)" href="tel:'+CONFIG.telSecond+'">Appeler le second contact</a>';"""
assert moteur.count(old_tel2) == 1
moteur = moteur.replace(old_tel2, new_tel2)

page = u'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Signaler un besoin — VD Services</title>
<meta name="description" content="Décrivez votre besoin en moins d'une minute. VD Services trouve l'entreprise, compare les devis et suit les travaux. Secteur Fréjus – Nice.">
<meta name="robots" content="index,follow">
<meta name="theme-color" content="#2E4E77">
<meta property="og:title" content="Signaler un besoin — VD Services">
<meta property="og:description" content="Décrivez votre besoin en moins d'une minute.">
<meta property="og:type" content="website">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap">
<style>
__THEME__
*{box-sizing:border-box}
html,body{margin:0;padding:0}
body{background:var(--ground);color:var(--ink);font-family:var(--body);font-size:16px;line-height:1.6;
  -webkit-font-smoothing:antialiased;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
h1,h2,h3{font-family:var(--display);font-weight:600;margin:0}
p{margin:0}
a{color:var(--accent-ink)}
button,input,select,textarea{font:inherit;color:inherit}
.app{max-width:520px;margin-inline:auto;padding:0 16px 40px}
.bande{height:4px;display:flex;margin:0 -16px 0}
.bande i{flex:1}
.bande i:nth-child(1){background:var(--urg)}
.bande i:nth-child(2){background:var(--dep)}
.bande i:nth-child(3){background:var(--pro)}
.bande i:nth-child(4){background:var(--ene)}
.screen{padding:20px 0 0;min-height:60vh}
.pied{margin-top:30px;padding-top:16px;border-top:1px solid var(--line);font-size:.74rem;color:var(--ink-3);line-height:1.5}
.pied a{color:var(--ink-3)}
.recap{font-family:var(--mono);font-size:.74rem;line-height:1.6;background:var(--surface);border:1px solid var(--line);
  border-radius:10px;padding:13px;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left;margin-top:14px;
  max-height:240px;overflow-y:auto}
__ECRAN__
/* ces trois-là passent après l'écran repris du prototype, pour le surcharger */
.ok .mark-att{background:var(--accent-soft);border-color:var(--accent);color:var(--accent-ink)}
.ok .mark-err{background:var(--dep-soft);border-color:var(--dep);color:var(--dep)}
.cta.sec{background:none;color:var(--ink);border:1px solid var(--line-strong);margin-top:10px}
</style>
</head>
<body>
<div class="app">
  <div class="bande"><i></i><i></i><i></i><i></i></div>
  <div class="screen" id="screen"></div>
  <p class="pied">
    <strong>VD SERVICES</strong> — consultation, pilotage, coordination et assistance.
    Mandelieu-la-Napoule, secteur Fréjus – Nice.
    Vos coordonnées ne servent qu'au traitement de cette demande et ne sont transmises qu'à l'entreprise retenue.
    Conservation trois ans. <a href="/">Retour au site</a>
  </p>
</div>

<script>
/* -------------------------------------------------------------------------
   À RENSEIGNER AVANT LA MISE EN LIGNE
   endpoint      : adresse qui reçoit la demande (fonction Vercel, Formspree,
                   Make, n8n…). Tant qu'elle est vide, la demande part par la
                   messagerie du visiteur, et la page le dit franchement.
   mail          : adresse de repli, utilisée dans ce cas.
   telAstreinte  : numéro affiché en urgence. telSecond : le second contact.
   ------------------------------------------------------------------------- */
/* libellés des corps de métier tels qu'ils apparaissent dans la plateforme :
   l'écran dit « Eau, fuite, WC » au demandeur, le récapitulatif dit « Plomberie ». */
var METIERS={plomberie:"Plomberie",electricite:"Électricité",chauffage:"Chauffage",
  clim:"Climatisation, VMC",serrurerie:"Serrurerie",couverture:"Couverture, étanchéité",
  peinture:"Peinture",platrerie:"Plâtrerie",carrelage:"Carrelage, sols",menuiserie:"Menuiserie",
  verts:"Espaces verts",menage:"Ménage, nettoyage",autre:"Autre"};
var CONFIG={
  endpoint:"",
  mail:"contact@vdservices.fr",
  telAstreinte:"+33400000010",
  telSecond:"+33400000011"
};

__CONSTS__

var S,step,REF,ENVOI,RECAP,RESCODE,lastStep=null;
/* le prototype mesurait le temps de remplissage : sans objet ici */
function startClock(){}
function stopClock(){}
function bump(){}
function paint(){}

function param(n){
  try{return new URLSearchParams(location.search).get(n)||""}catch(e){return ""}
}
function init(){
  S={intent:null,defi:false,projet:null,trades:[],presta:[],gestes:[],entite:null,organisme:"",service:"",fonction:"",nature:null,site:"",nbDevis:null,montant:null,dateLimite:"",pieces:[],refInterne:"",logement:null,anciennete:null,occupation:null,usage:null,personnes:null,revenus:null,chauffage:null,dpe:null,devisSigne:null,lieu:null,statut:null,residence:"",adresse:"",precision:"",ag:null,delai:null,budget:null,description:"",nom:"",tel:"",email:"",photo:false,creneau:null,consent:false};
  step="intent";REF="";ENVOI="";RECAP="";
  RESCODE=param("res");
  if(RESCODE)S.residence=RESCODE.replace(/-/g," ").replace(/\\b\\w/g,function(c){return c.toUpperCase()});
  var b=param("besoin")||param("i");
  if(["urgence","depannage","projet","energie","public"].indexOf(b)>=0){
    S.intent=b;step=b==="public"?"entite":"trade";
  }
  render();
}

__MOTEUR__

/* ---------- référence, récapitulatif et envoi ---------- */
function reference(){
  var d=new Date(),p=function(n){return String(n).padStart(2,"0")};
  var lettre={urgence:"U",depannage:"D",projet:"P",energie:"E",public:"C"}[S.intent]||"X";
  return "VD-"+String(d.getFullYear()).slice(2)+p(d.getMonth()+1)+p(d.getDate())+"-"+lettre
    +Math.random().toString(36).slice(2,5).toUpperCase();
}
function lib(o,k){return k&&o[k]?o[k]:""}
function recapitulatif(){
  var L=[],a=function(k,v){if(v)L.push(k+" : "+v)};
  L.push("DEMANDE "+REF);
  L.push("");
  a("Nature",lib({urgence:"Urgence",depannage:"Dépannage",projet:"Projet de travaux",
    energie:"Travaux énergétiques financés",public:"Consultation publique"},S.intent));
  a("Corps de métier",S.trades.map(function(id){return METIERS[id]||id}).join(", "));
  if(S.projet)a("Projet",(PROJETS.filter(function(x){return x.id===S.projet})[0]||{}).l);
  a("Prestations",S.presta.map(function(k){return k.split("|")[1]}).join(", "));
  a("Lieu",lib(LIEUX,S.lieu));
  a("Demandeur",S.statut?(STATUTS.filter(function(x){return x.id===S.statut})[0]||{}).l:"");
  a("Résidence",S.residence);
  a("Adresse",[S.adresse,S.precision].filter(Boolean).join(" — "));
  if(S.intent==="public"){
    a("Organisme",[lib(ENTITES,S.entite),S.organisme,S.service].filter(Boolean).join(" — "));
    a("Fonction",S.fonction);
    a("Nature du besoin",lib(NATURES,S.nature));
    a("Site",S.site);
    a("Devis demandés",S.nbDevis);
    a("Montant estimé",lib(MONTANTS,S.montant));
    a("Remise des offres",S.dateLimite);
    a("Pièces exigées",S.pieces.join(", "));
    a("Référence interne",S.refInterne);
  }
  if(S.intent==="energie"){
    a("Gestes visés",S.gestes.map(function(g){
      var x=GESTES.filter(function(y){return y.id===g})[0];return x?x.l:g}).join(", "));
    a("Logement",[lib(LOGEMENTS,S.logement),lib(ANCIENS,S.anciennete),lib(USAGES,S.usage)].filter(Boolean).join(" — "));
    a("Occupation",lib(OCCUPS,S.occupation));
    a("Foyer",[S.personnes?S.personnes+" personne(s)":"",lib(REVENUS,S.revenus)].filter(Boolean).join(" — "));
    a("Chauffage",[lib(CHAUFFAGES,S.chauffage),S.dpe?"DPE "+lib(DPES,S.dpe):""].filter(Boolean).join(" — "));
    a("Devis déjà signé",S.devisSigne);
  }
  a("Échéance",[lib(DELAIS,S.delai),S.budget||"",S.ag?"vote AG : "+S.ag:""].filter(Boolean).join(" — "));
  a("Description",S.description);
  a("Créneau souhaité",lib(CRENEAUX,S.creneau));
  a("Photos à joindre",S.photo?"oui":"");
  L.push("");
  a("Nom",S.nom);
  a("Téléphone",S.tel);
  a("E-mail",S.email);
  if(RESCODE)a("QR code",RESCODE);
  L.push("");
  L.push("Envoyé depuis le formulaire VD Services le "+new Date().toLocaleString("fr-FR")+".");
  return L.join("\\n");
}
function charge(){
  var o={};
  Object.keys(S).forEach(function(k){o[k]=S[k]});
  o.ref=REF;o.resCode=RESCODE;o.recu=new Date().toISOString();
  o.recapitulatif=RECAP;o.source=param("depuis")||"qr";
  return o;
}
function lienMail(){
  return "mailto:"+CONFIG.mail
    +"?subject="+encodeURIComponent("Demande "+REF+" — "+(S.nom||"")+" "+(S.residence||S.adresse||""))
    +"&body="+encodeURIComponent(RECAP);
}
function envoyer(){
  REF=reference();RECAP=recapitulatif();
  if(!CONFIG.endpoint){ENVOI="mail";step="done";render();return}
  step="envoi";render();
  var fini=false;
  var stop=setTimeout(function(){if(!fini){fini=true;ENVOI="erreur";step="done";render()}},12000);
  fetch(CONFIG.endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(charge())})
    .then(function(r){if(!r.ok)throw new Error(r.status);return r})
    .then(function(){if(fini)return;fini=true;clearTimeout(stop);ENVOI="ok";step="done";render()})
    .catch(function(){if(fini)return;fini=true;clearTimeout(stop);ENVOI="erreur";step="done";render()});
}
function ecranFinal(){
  var suite={urgence:"Je vous rappelle dans les minutes qui viennent.",
    depannage:"Je vous rappelle aujourd'hui, intervention sous 72 heures.",
    energie:"Je vous rappelle sous 48 heures avec le point sur les aides mobilisables.",
    public:"Je vous rappelle sous 48 heures et je lance la consultation auprès des entreprises du secteur."}[S.intent]
    ||"Je vous rappelle sous 48 heures pour convenir d'une visite.";
  if(ENVOI==="ok"){
    return '<div class="ok"><div class="mark">\\u2713</div><p class="q">Demande enregistrée</p>'
      +'<p class="qs">'+suite+'</p><span class="ref">réf. '+esc(REF)+'</span>'
      +'<button class="cta sec" data-copier="1">Copier le récapitulatif</button>'
      +'<p class="note">Gardez cette référence, elle suffit à retrouver votre dossier.</p></div>';
  }
  if(ENVOI==="erreur"){
    return '<div class="ok"><div class="mark mark-err">!</div><p class="q">L\\'envoi n\\'a pas abouti</p>'
      +'<p class="qs">Rien n\\'est perdu : envoyez-la par message, ou appelez.</p>'
      +'<a class="cta" href="'+esc(lienMail())+'">Envoyer par e-mail</a>'
      +'<a class="cta sec" href="tel:'+esc(CONFIG.telAstreinte)+'">Appeler VD Services</a>'
      +'<button class="cta sec" data-copier="1">Copier le récapitulatif</button>'
      +'<div class="recap" id="recap">'+esc(RECAP)+'</div></div>';
  }
  return '<div class="ok"><div class="mark mark-att">\\u2709</div><p class="q">Dernière étape : envoyez-la</p>'
    +'<p class="qs">Votre demande est prête. Touchez le bouton, votre messagerie s\\'ouvre avec le récapitulatif déjà écrit. '
    +'Il ne reste qu\\'à l\\'envoyer'+(S.photo?", et à y joindre vos photos":"")+'.</p>'
    +'<a class="cta" href="'+esc(lienMail())+'">Envoyer ma demande</a>'
    +'<a class="cta sec" href="tel:'+esc(CONFIG.telAstreinte)+'">Préférer un appel</a>'
    +'<button class="cta sec" data-copier="1">Copier le récapitulatif</button>'
    +'<span class="ref">réf. '+esc(REF)+'</span>'
    +'<div class="recap" id="recap">'+esc(RECAP)+'</div>'
    +'<p class="note">'+suite+'</p></div>';
}
function copier(){
  var t=RECAP;
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(fait,manuel);
  }else manuel();
  function fait(){toast("Récapitulatif copié")}
  function manuel(){
    var z=document.getElementById("recap");
    if(z&&window.getSelection){
      var r=document.createRange();r.selectNodeContents(z);
      var s=window.getSelection();s.removeAllRanges();s.addRange(r);
      toast("Sélectionné : copiez avec le menu du téléphone");
    }else toast("Copie impossible sur ce navigateur");
  }
}
function toast(m){
  var d=document.createElement("p");
  d.className="note";d.textContent=m;d.style.textAlign="center";
  var z=document.getElementById("screen");
  if(z)z.appendChild(d);
  setTimeout(function(){d.remove()},2600);
}

/* ---------- interactions ---------- */
document.getElementById("screen").addEventListener("click",function(e){
  var b=e.target.closest("button, a");
  if(!b)return;
  if(b.dataset.copier){e.preventDefault();copier();return}
  if(b.tagName==="A")return;
  if(b.disabled)return;
  var d=b.dataset;
  if(d.go==="done"){envoyer();return}
  if(d.intent){S.intent=d.intent;S.trades=[];S.presta=[];S.gestes=[];S.projet=null;step=d.intent==="public"?"entite":"trade"}
  else if(d.projet){
    var pr=PROJETS.filter(function(x){return x.id===d.projet})[0];
    S.projet=pr.id;S.trades=pr.t.slice();S.presta=[];step="where";
  }
  else if(d.trade){
    if(S.intent==="projet"||S.intent==="public"){
      var i=S.trades.indexOf(d.trade);
      if(i>=0)S.trades.splice(i,1);else S.trades.push(d.trade);
    }else{S.trades=[d.trade];step=S.intent==="urgence"?"call":"where"}
  }
  else if(d.presta){
    var ip=S.presta.indexOf(d.presta);
    if(ip>=0)S.presta.splice(ip,1);else S.presta.push(d.presta);
  }
  else if(d.addtrade){if(S.trades.indexOf(d.addtrade)<0)S.trades.push(d.addtrade)}
  else if(d.geste){
    var ig=S.gestes.indexOf(d.geste);
    if(ig>=0)S.gestes.splice(ig,1);else S.gestes.push(d.geste);
    S.trades=[];
    S.gestes.forEach(function(gid){
      var g=GESTES.filter(function(x){return x.id===gid})[0];
      if(g)g.t.forEach(function(t){if(S.trades.indexOf(t)<0)S.trades.push(t)});
    });
  }
  else if(d.defi){S.defi=!S.defi}
  else if(d.entite){S.entite=d.entite;S.statut="pro";S.lieu="commun"}
  else if(d.fonction){S.fonction=S.fonction===d.fonction?"":d.fonction}
  else if(d.nature){S.nature=d.nature}
  else if(d.nbdevis){S.nbDevis=d.nbdevis}
  else if(d.montant){S.montant=d.montant}
  else if(d.piece){
    var ip2=S.pieces.indexOf(d.piece);
    if(ip2>=0)S.pieces.splice(ip2,1);else S.pieces.push(d.piece);
  }
  else if(d.logement){S.logement=d.logement;S.lieu=d.logement==="copro"?"commun":"privatif"}
  else if(d.anciennete){S.anciennete=d.anciennete}
  else if(d.occupation){S.occupation=d.occupation;
    S.statut={occupant:"occupant",bailleur:"bailleur",locataire:"locataire",syndicat:"syndic"}[d.occupation]||null}
  else if(d.usage){S.usage=d.usage}
  else if(d.personnes){S.personnes=d.personnes}
  else if(d.revenus){S.revenus=d.revenus}
  else if(d.chauffage){S.chauffage=d.chauffage}
  else if(d.dpe){S.dpe=d.dpe}
  else if(d.devis){S.devisSigne=d.devis}
  else if(d.lieu){S.lieu=d.lieu}
  else if(d.statut){S.statut=S.statut===d.statut?null:d.statut}
  else if(d.ag){S.ag=d.ag}
  else if(d.delai){S.delai=d.delai}
  else if(d.budget){S.budget=S.budget===d.budget?null:d.budget}
  else if(d.photo){S.photo=!S.photo}
  else if(d.creneau){S.creneau=d.creneau}
  else if(d.go){step=d.go}
  else return;
  render();
});
document.getElementById("screen").addEventListener("input",function(e){
  var t=e.target;
  if(t.dataset.set){
    S[t.dataset.set]=t.value;
    var cta=document.querySelector("#screen .cta[data-go]");
    if(cta){
      cta.disabled = step==="call" ? S.tel.length<8
        : step==="where" ? !(S.lieu&&S.statut&&S.adresse.length>4)
        : step==="scope" ? !(S.delai&&(S.presta.length||S.description.length>5))
        : !okContact();
    }
  }
  if(t.dataset.consent){
    S.consent=t.checked;
    var c=document.querySelector("#screen .cta[data-go]");
    if(c)c.disabled=!okContact();
  }
});
init();
</script>
</body>
</html>
'''

page = (page.replace("__THEME__", theme)
            .replace("__ECRAN__", ecran)
            .replace("__CONSTS__", consts)
            .replace("__MOTEUR__", moteur))

os.makedirs("site/formulaire", exist_ok=True)
io.open("site/formulaire/index.html", "w", encoding="utf-8").write(page)

# --- page d'accueil : même contenu, lien du formulaire en relatif ----------
acc = io.open("docs/site-accueil.html", encoding="utf-8").read()
old = 'var FORMULAIRE="https://claude.ai/artifact/S1hvTF1fVn4QCeM41UTFoo";'
assert acc.count(old) == 1, "le lien du formulaire a changé dans docs/site-accueil.html"
acc = acc.replace(old, 'var FORMULAIRE="/formulaire";')
acc = acc.replace(
  "/* Adresse du formulaire de demande. \u00c0 remplacer par l'adresse d\u00e9finitive\n   le jour de la mise en ligne, par exemple https://vdservices.fr/demande */",
  "/* Adresse du formulaire de demande, servi par le m\u00eame domaine. */")

i = acc.index("</style>") + len("</style>")
tete, corps = acc[:i], acc[i:]
head = (u'<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        u'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        u'<meta name="theme-color" content="#2E4E77">\n'
        u'<meta name="description" content="VD Services, Mandelieu-la-Napoule. Vous d\u00e9crivez le probl\u00e8me, '
        u'je choisis l\u2019entreprise, je n\u00e9gocie les devis et je suis les travaux. Secteur Fr\u00e9jus \u2013 Nice.">\n'
        u'<meta name="robots" content="index,follow">\n'
        u'<meta property="og:title" content="VD Services \u2014 un souci ? On s\u2019en occupe.">\n'
        u'<meta property="og:description" content="Courtier en travaux sur la C\u00f4te d\u2019Azur, de Fr\u00e9jus \u00e0 Nice.">\n'
        u'<meta property="og:type" content="website">\n'
        + tete + u'\n</head>\n<body>')
acc = head + corps + u"\n</body>\n</html>\n"
io.open("site/index.html", "w", encoding="utf-8").write(acc)
print("site/index.html             ", len(acc), "car.")
print("site/formulaire/index.html  ", len(page), "car.")
