#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construit la plateforme VD SERVICES en application autonome.

    python3 outils/construire-app.py

Entrée  : docs/regie-copro.html, la plateforme écrite pour la base de Claude.
Sortie  : site/app/index.html, la même plateforme branchée sur Supabase.

Le principe : on ne réécrit pas les écrans. On remplace ce qui touchait à
Claude — la base, la connexion, le stockage des fichiers, le téléchargement —
par l'équivalent Supabase, et tout le reste suit sans y toucher.
Ne modifiez pas site/app/ à la main : changez docs/ ou l'adaptateur, puis
relancez ce script.
"""
import io, os, re

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = io.open(os.path.join(RACINE, "docs/regie-copro.html"), encoding="utf-8").read()
adaptateur = io.open(os.path.join(RACINE, "outils/supabase-adaptateur.js"), encoding="utf-8").read()

def rep(vieux, neuf, quoi):
    global src
    n = src.count(vieux)
    assert n == 1, u"%s : %d occurrence(s) au lieu d'une" % (quoi, n)
    src = src.replace(vieux, neuf, 1)

# ---------------------------------------------------------------------
# 1. L'adaptateur, posé juste avant l'état de la plateforme
# ---------------------------------------------------------------------
rep("/* ---------- état ---------- */",
    adaptateur + "\n/* ---------- état ---------- */",
    "insertion de l'adaptateur")

# ---------------------------------------------------------------------
# 2. Le démarrage : on n'attend plus Claude, on reprend une session
# ---------------------------------------------------------------------
vieux_boot = src[src.index("function coll(name){"):src.index("boot();") + len("boot();")]
neuf_boot = u'''function attendre(ms){return new Promise(function(r){setTimeout(r,ms)})}

/* La plateforme démarre fermée. Si une session valable traîne dans le
   navigateur on la reprend, sinon l'écran de connexion s'affiche. */
async function boot(){
  etatCx="attente";cxErr="";db=null;ready=false;paint();
  var j=sbReprendre();
  if(!j){etatCx="deconnecte";ready=true;paint();return}
  SB.jeton=j.access_token;
  try{
    var p=await sbMonProfil();
    if(!p)throw new Error("aucun profil : votre compte existe mais n'a pas de rôle");
    SB.moi=p;
    SESS={role:p.role==="admin"?"admin":"syndic",clientId:p.client_id||null,apercu:false};
    sessSave();
    db=faireDb();
    etatCx="ok";
    await toutRelire();
  }catch(e){
    cxErr=(e&&e.message)||"erreur";
    sbDeconnexion();
    SESS={role:null,clientId:null,apercu:false};
    etatCx="deconnecte";
  }
  ready=true;paint();
}
boot();'''
rep(vieux_boot, neuf_boot, "remplacement de boot()")

# ---------------------------------------------------------------------
# 3. L'écran de connexion : e-mail et mot de passe, plus de code d'accès
# ---------------------------------------------------------------------
deb = src.index("function paintGate(){")
fin = src.index("/* ---------- copropriétés d'un syndic ---------- */")
neuf_gate = u'''function paintGate(){
  var g=document.getElementById("gate"),sh=document.getElementById("shell");
  if(!g)return;
  if(SESS.role){g.hidden=true;g.innerHTML="";if(sh)sh.style.display="";return}
  if(sh)sh.style.display="none";
  g.hidden=false;
  var h='<div class="gbox"><div class="grule"><i></i><i></i><i></i><i></i></div><div class="gbody">'
    +'<p class="eyebrow">VD Services</p><h1>Connexion</h1>'
    +'<p class="gsub">Le même écran pour le back-office et pour les syndics : '
    +'c\\'est votre compte qui décide de ce que vous voyez.</p>'
    +'<div class="gcards" style="grid-template-columns:minmax(0,1fr)">'
    +'<form class="gcard" data-gate="supabase">'
    +'<div class="field"><label for="g-mail">Adresse e-mail</label>'
    +'<input id="g-mail" type="email" autocomplete="username" autocapitalize="off" spellcheck="false"></div>'
    +'<div class="field"><label for="g-mdp">Mot de passe</label>'
    +'<input id="g-mdp" type="password" autocomplete="current-password"></div>'
    +'<button class="btn" type="submit"'+(gateEnCours?" disabled":"")+'>'
    +(gateEnCours?"Connexion…":"Entrer")+'</button>'
    +'<button type="button" class="lienf" data-act="mdp-oublie" '
    +'style="background:none;border:0;padding:0;margin-top:14px;text-align:left;cursor:pointer;'
    +'color:var(--accent-ink);text-decoration:underline;text-underline-offset:3px;font-size:.84rem">'
    +'Mot de passe oublié</button>'
    +'</form></div>';
  if(gateErr)h+='<p class="gerr">'+E(gateErr)+'</p>';
  if(gateInfo)h+='<p class="note" style="margin-top:12px;color:var(--pro)">'+E(gateInfo)+'</p>';
  h+='<p class="gatt">Vos identifiants sont vérifiés par la base, et la session '
    +'expire d\\'elle-même. Un syndic connecté ici ne voit que son propre parc : '
    +'ce n\\'est pas l\\'écran qui le limite, ce sont les règles de la base.</p>';
  h+='</div></div>';
  g.innerHTML=h;
}
function connexion(){
  var mail=(document.getElementById("g-mail")||{}).value||"";
  var mdp=(document.getElementById("g-mdp")||{}).value||"";
  if(!mail||!mdp){gateErr="Il faut une adresse et un mot de passe.";paintGate();return}
  gateErr="";gateInfo="";gateEnCours=true;paintGate();
  sbConnexion(mail.trim(),mdp)
    .then(function(j){
      sbGarder(j);SB.jeton=j.access_token;
      return sbMonProfil();
    })
    .then(function(p){
      if(!p)throw new Error("Votre compte existe mais aucun rôle ne lui est attribué. Contactez VD Services.");
      SB.moi=p;
      SESS={role:p.role==="admin"?"admin":"syndic",clientId:p.client_id||null,apercu:false};
      sessSave();
      route=(SESS.role==="syndic")?{v:"syndic",id:null}:{v:"dashboard",id:null};
      db=faireDb();etatCx="ok";gateEnCours=false;
      return toutRelire();
    })
    .then(function(){paint()})
    .catch(function(e){
      gateEnCours=false;
      gateErr=(e&&e.message)||"Connexion refusée.";
      sbDeconnexion();
      paintGate();
    });
}
function deconnexion(){
  sbDeconnexion();
  SESS={role:null,clientId:null,apercu:false};
  DATA.demandes=[];DATA.clients=[];DATA.prestataires=[];DATA.interventions=[];
  DATA.devis=[];DATA.residences=[];DATA.documents=[];DATA.bordereaux=[];DATA.photos=[];
  selK=null;gateErr="";gateInfo="";etatCx="deconnecte";
  paint();
}

'''
src = src[:deb] + neuf_gate + src[fin:]

# le drapeau d'attente et le message de confirmation
rep('var SESS={role:null,clientId:null,apercu:false},gateErr="",selK=null;',
    'var SESS={role:null,clientId:null,apercu:false},gateErr="",gateInfo="",gateEnCours=false,selK=null;',
    "drapeaux de l'écran de connexion")

# ---------------------------------------------------------------------
# 4. Le téléchargement de la sauvegarde : un lien, plus une capacité
# ---------------------------------------------------------------------
vieux_dl = src[src.index("function enregistrerFichier(nom,contenu,type){"):
               src.index("function versCSV(lignes,colonnes){")]
neuf_dl = u'''function enregistrerFichier(nom,contenu,type){
  try{
    var blob=new Blob([contenu],{type:type||"application/json;charset=utf-8"});
    var a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download=nom;
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000);
    return Promise.resolve(true);
  }catch(e){return Promise.resolve(false)}
}
'''
src = src.replace(vieux_dl, neuf_dl, 1)

# ---------------------------------------------------------------------
# 5. Le dépôt des pièces d'une entreprise : le casier Supabase
# ---------------------------------------------------------------------
vieux_tv = src[src.index("async function televerser(files,pid,type){"):
               src.index("async function restaurer(file){")]
neuf_tv = u'''async function televerser(files,pid,type){
  var etat=document.getElementById("up-etat");
  function dire(t){if(etat)etat.textContent=t}
  if(!db){dire("Base indisponible.");return}
  for(var i=0;i<files.length;i++){
    var f=files[i];
    try{
      dire("Envoi de "+f.name+"…");
      var ext=(f.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
      var chemin=pid+"/"+type+"-"+Date.now()+"."+ext;
      await sbEnvoyerFichier("documents",chemin,f);
      await db.collection("documents").add({
        prestataireId:pid,type:type,nom:f.name,chemin:chemin,
        typeMime:f.type,taille:f.size,ajouteLe:new Date().toISOString()});
      dire(f.name+" enregistré. Complétez les dates et le numéro sur la fiche.");
    }catch(err){
      dire("Échec sur "+f.name+" : "+((err&&(err.message||err.code))||"erreur"));
    }
  }
}
'''
src = src.replace(vieux_tv, neuf_tv, 1)

# la lecture automatique des pièces passait par Claude : elle n'existe plus ici
vieux_an = src[src.index("async function analyser(type,file){"):
               src.index("/* ---------- vue : clients ---------- */")]
neuf_an = u'''/* La lecture automatique des attestations passait par Claude, qui n'est pas
   présent sur votre domaine. Le fichier est stocké, les champs se saisissent
   à la main sur la fiche. */
async function analyser(type,file){
  throw new Error("la lecture automatique n'est pas disponible sur cette version");
}

'''
src = src.replace(vieux_an, neuf_an, 1)

# ---------------------------------------------------------------------
# 5 bis. Les deux derniers appels à Claude
# ---------------------------------------------------------------------
# l'export PNG d'un QR code
rep(u"""      (window.claude&&window.claude.use?window.claude.use("downloads"):Promise.resolve(null))
        .then(function(dl){
          if(dl)return dl.save({filename:nomf,data:blob});
          var w=window.open("","_blank");
          if(w){var rd=new FileReader();rd.onload=function(){w.document.write('<img src="'+rd.result+'" style="max-width:100%">');w.document.close()};rd.readAsDataURL(blob)}
        }).catch(function(){toast("Enregistrement refus\u00e9")});""",
    u"""      var a=document.createElement("a");
      a.href=URL.createObjectURL(blob);a.download=nomf;
      document.body.appendChild(a);a.click();
      setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000);""",
    "export PNG du QR code")

# le fichier d'une pi\u00e8ce supprim\u00e9e part du casier
rep(u"""    if(dc4.assetId){
      (window.claude&&window.claude.use?window.claude.use("assets"):Promise.resolve(null))
        .then(function(as){if(as)as.delete(dc4.assetId).catch(function(){})});
    }""",
    u"""    if(dc4.chemin)sbSupprimerFichier("documents",dc4.chemin).catch(function(){});""",
    "suppression du fichier d'une pi\u00e8ce")

# ---------------------------------------------------------------------
# 6. Les actions de l'écran de connexion
# ---------------------------------------------------------------------
rep('''  if(act==="deconnexion"){deconnexion();return}''',
    '''  if(act==="deconnexion"){deconnexion();return}
  if(act==="mdp-oublie"){
    var m=(document.getElementById("g-mail")||{}).value||"";
    if(!m){gateErr="Indiquez d'abord votre adresse e-mail.";paintGate();return}
    sbMotDePasseOublie(m.trim());
    gateErr="";gateInfo="Si cette adresse a un compte, un lien de réinitialisation vient de partir.";
    paintGate();return;
  }''',
    "action mot de passe oublié")

rep('''  ev.preventDefault();
  connexion(f.dataset.gate);''',
    '''  ev.preventDefault();
  connexion();''',
    "soumission du formulaire de connexion")

# l'écran « base injoignable » parlait de Claude
rep('''  if(etatCx==="ok")
    return '<div class="empty"><h3>Rien à afficher ici</h3><p>Changez de filtre, ou créez une fiche avec le bouton en haut à droite.</p></div>';''',
    '''  if(etatCx==="ok")
    return '<div class="empty"><h3>Rien à afficher ici</h3><p>Changez de filtre, ou créez une fiche avec le bouton en haut à droite.</p></div>';
  if(etatCx==="deconnecte")
    return '<div class="empty"><h3>Session expirée</h3><p>Reconnectez-vous pour retrouver vos données.</p></div>';''',
    "message de session expirée")

# ---------------------------------------------------------------------
# 6 bis. Les photos : une table à part, chargée comme les autres
# ---------------------------------------------------------------------
rep(u'''var DATA={demandes:[],prestataires:[],clients:[],interventions:[],bordereaux:[],reglages:[],documents:[],residences:[],devis:[]};''',
    u'''var DATA={demandes:[],prestataires:[],clients:[],interventions:[],bordereaux:[],reglages:[],documents:[],residences:[],devis:[],photos:[]};''',
    "ajout de la table photos")

# la photo s'affiche vraiment, au lieu d'annoncer un stockage a brancher
vieux_ph = src[src.index(u'  if(act==="photo"){'):src.index(u'  if(act==="note"){')]
neuf_ph = u'''  if(act==="photo"||act==="photo-apres"){
    var lot = act==="photo" ? (d.photos||[]) : ((interDe(d)||{}).photosApres||[]);
    var ph = lot[Number(b.dataset.v)]||{};
    openDlg(act==="photo"?"Photo du signalement":"Photo après travaux",
      E(ph.nom||""),
      '<div id="ph-zone" class="photo" style="aspect-ratio:4/3;font-size:.8rem;cursor:default">Chargement…</div>'
      +'<p class="note" style="margin-top:12px">Déposée le '+E(ph.ajouteLe?dt(ph.ajouteLe):"—")
      +(ph.taille?' · '+Math.round(ph.taille/1024)+' Ko':"")+'. Lien valable une heure, '
      +'le casier reste privé.</p>',
      '<button class="btn ghost" data-act="dlg-close">Fermer</button>');
    if(ph.chemin){
      sbLienSigne("photos",ph.chemin).then(function(u){
        var z=document.getElementById("ph-zone");
        if(z)z.innerHTML='<img src="'+E(u)+'" alt="'+E(ph.nom||"")+'" '
          +'style="width:100%;height:100%;object-fit:contain;border-radius:4px">';
      }).catch(function(){
        var z=document.getElementById("ph-zone");
        if(z)z.textContent="Image introuvable dans le casier.";
      });
    }else{
      var z0=document.getElementById("ph-zone");
      if(z0)z0.textContent="Aucun fichier joint à cette ligne.";
    }
    return;
  }
'''
src = src.replace(vieux_ph, neuf_ph, 1)

# l'ancien gestionnaire des photos d'apres travaux fait double emploi
vieux_pa = src[src.index(u'  if(act==="photo-apres"){'):src.index(u'  if(act==="fact-copy"){')]
src = src.replace(vieux_pa, u"", 1)

# ---------------------------------------------------------------------
# 7. Le document complet
# ---------------------------------------------------------------------
i = src.index("</style>") + len("</style>")
tete, corps = src[:i], src[i:]
page = (u'<!doctype html>\n<html lang="fr">\n<head>\n<meta charset="utf-8">\n'
        u'<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
        u'<meta name="theme-color" content="#2E4E77">\n'
        u'<meta name="robots" content="noindex,nofollow">\n'
        + tete + u'\n</head>\n<body>' + corps + u'\n</body>\n</html>\n')

os.makedirs(os.path.join(RACINE, "site/app"), exist_ok=True)
io.open(os.path.join(RACINE, "site/app/index.html"), "w", encoding="utf-8").write(page)
print("site/app/index.html %d caractères" % len(page))
