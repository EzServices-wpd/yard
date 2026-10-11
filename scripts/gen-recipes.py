"""Writes src/lib/yard/recipes.json, the seed recipe store (spec 001). Run: python3 scripts/gen-recipes.py"""
import json, math, os
R=[]
def P(role,name,box,kind="panel",on=None,repeat=None,stock=None,cat=None):
    d={"role":role,"name":name,"box":[round(v,4) for v in box],"kind":kind}
    if on: d["on"]=on
    if repeat: d["repeat"]=repeat
    if stock: d["stock"]=stock
    if cat: d["catalogId"]=cat
    return d
def rec(key,title,size,parts,defining,syn=(),**kw):
    r={"key":key,"synonyms":list(syn),"version":1,"trust":"candidate","title":title,"size":dict(zip(["width","height","depth"],size)),"defining":defining,"parts":parts,"notes":kw.pop("notes",[])}
    r.update(kw); R.append(r)
POP="popsicle-standard"; CB="cardboard-corrugated-sheet"; L24="lumber-2x4-8"; L26="lumber-2x6-8"; L44="lumber-4x4-8"; L14="lumber-1x4-8"; PLY="plywood-3-4-4x8"; DOW="dowel-1-2-36"; PLY4="plywood-1-4-4x8"

# Ferris wheel: upright wheel on an axle between two A-frames
fw=[P("base","Base",[0,0,0,1,.03,1]),
 P("a-frame","Left front leg",[.40,.03,0,.04,.5,.1],"member",["Base"]),P("a-frame","Left back leg",[.40,.03,.9,.04,.5,.1],"member",["Base"]),
 P("a-frame","Right front leg",[.56,.03,0,.04,.5,.1],"member",["Base"]),P("a-frame","Right back leg",[.56,.03,.9,.04,.5,.1],"member",["Base"]),
 P("axle","Axle",[.44,.5,0,.12,.04,1],"member",["Left front leg","Left back leg","Right front leg","Right back leg"]),
 P("wheel","Front rim",[.03,.06,.25,.94,.92,.04],"panel",["Axle"]),P("wheel","Back rim",[.03,.06,.71,.94,.92,.04],"panel",["Axle"]),
 P("spoke","Front spoke",[.48,.06,.21,.04,.92,.04],"member",["Front rim"]),P("spoke","Back spoke",[.48,.06,.75,.04,.92,.04],"member",["Back rim"])]
for i,(x,y) in enumerate([(.45,.93),(.03,.5),(.88,.5),(.45,.07)]):
    fw.append(P("gondola",f"Gondola {i+1}",[x,y-.05,.29,.09,.07,.42],"panel",["Front rim","Back rim"]))
rec("ferris-wheel","Ferris wheel",(18,19,8),fw,["wheel","axle","a-frame","gondola"],["ferris"],stock=POP,sheet=POP,moving=[{"part":"Front rim","motion":"spin"}],notes=["The wheel stands upright on its axle between two A-frames and turns."])

# Glider
gl=[P("fuselage","Fuselage",[.47,0,0,.06,.3,1],"member"),
 P("wing","Wing",[0,.3,.25,1,.1,.25],"panel",["Fuselage"]),
 P("tail","Tailplane",[.32,.3,.86,.36,.08,.14],"panel",["Fuselage"]),
 P("fin","Fin",[.485,.38,.86,.03,.6,.14],"panel",["Tailplane"]),
 P("nose","Nose weight",[.46,.05,0,.08,.2,.06],"panel",["Fuselage"])]
rec("glider","Balsa glider",(16,2.5,12),gl,["fuselage","wing","tail","fin"],["balsa glider","glider plane"],stock="popsicle-jumbo",sheet=PLY4,notes=["Glue only; thin balsa splits on screws.","Sand the wing's leading edge round for lift."])

# Toy airplane with propeller and wheels on an axle
ta=[P("wheel","Left wheel",[.2,0,.22,.05,.16,.12],"panel"),P("wheel","Right wheel",[.75,0,.22,.05,.16,.12],"panel"),
 P("axle","Axle",[.25,.06,.25,.5,.04,.06],"member",["Left wheel","Right wheel"]),
 P("fuselage","Fuselage",[.42,.1,.06,.16,.3,.94],"member",["Axle"]),
 P("wing","Wing",[0,.25,.25,1,.07,.22],"panel",["Fuselage"]),
 P("tail","Tailplane",[.3,.4,.86,.4,.05,.14],"panel",["Fuselage"]),
 P("fin","Fin",[.485,.45,.86,.03,.4,.14],"panel",["Tailplane"]),
 P("propeller","Prop shaft",[.49,.23,0,.02,.04,.06],"member",["Fuselage"]),
 P("propeller","Propeller",[.3,.235,0,.4,.03,.02],"panel",["Prop shaft"])]
rec("toy-airplane","Toy airplane",(14,7,14),ta,["fuselage","wing","tail","wheel","axle","propeller"],["airplane","plane"],modifiers=["propeller"],stock=L14,sheet=L14,moving=[{"part":"Propeller","motion":"spin"},{"part":"Left wheel","motion":"spin"}],notes=["The propeller spins on a dowel shaft; the wheels turn on a through axle."])

# Reindeer
rd=[]
for nm,x,z in [("Front left leg",.7,.1),("Front right leg",.7,.7),("Back left leg",.15,.1),("Back right leg",.15,.7)]:
    rd.append(P("leg",nm,[x,0,z,.08,.45,.2],"member"))
rd+= [P("body","Body",[.12,.45,.1,.7,.2,.8],"member",["Front left leg","Front right leg","Back left leg","Back right leg"]),
 P("neck","Neck",[.72,.65,.3,.1,.15,.4],"member",["Body"]),
 P("head","Head",[.72,.8,.3,.26,.1,.4],"member",["Neck"]),
 P("antler","Left antler",[.74,.9,.3,.03,.1,.05],"member",["Head"]),P("antler","Right antler",[.74,.9,.65,.03,.1,.05],"member",["Head"]),
 P("antler","Left tine",[.62,.95,.3,.12,.03,.05],"member",["Left antler"]),P("antler","Right tine",[.62,.95,.65,.12,.03,.05],"member",["Right antler"]),
 P("tail","Tail",[.06,.58,.45,.06,.05,.1],"member",["Body"])]
rec("reindeer","Reindeer",(36,40,10),rd,["leg","body","head","antler"],[],stock=L24,sheet=L24,notes=["Antlers branch from the head; screw each joint with two 2½″ screws."])

# Marble run
mr=[P("base","Base",[0,0,0,1,.04,1]),P("backboard","Back board",[0,.04,0,1,.96,.15],"panel",["Base"])]
for i,y in enumerate([.8,.6,.4,.2]):
    x=.05 if i%2==0 else .2
    mr.append(P("ramp",f"Ramp {i+1}",[x,y,.15,.75,.03,.6],"panel",["Back board"]))
    mr.append(P("ramp",f"Ramp {i+1} rail",[x,y+.03,.72,.75,.04,.03],"panel",[f"Ramp {i+1}"]))
for i,y in enumerate([.6,.4,.2]):
    x=.8 if i%2==0 else .05
    mr.append(P("drop",f"Drop {i+1}",[x,y+.03,.15,.15,.17,.02],"panel",["Back board"]))
mr+= [P("start","Start cup",[.05,.83,.15,.15,.06,.3],"panel",["Ramp 1"]),P("catch","Catch tray",[.7,.04,.15,.3,.06,.6],"panel",["Base"])]
rec("marble-run","Marble run",(24,30,8),mr,["ramp","drop","catch","backboard"],["marble maze"],stock=CB,sheet=CB,moving=[],notes=["Tilt each ramp about 5° down toward its drop; the marble zig-zags to the catch tray."])

# Tipi
tp=[]
for nm,x,z in [("Pole 1",.05,.05),("Pole 2",.9,.05),("Pole 3",.05,.9),("Pole 4",.9,.9)]:
    tp.append(P("pole",nm,[x,0,z,.05,1,.05],"member"))
tp+= [P("tie","Back tie",[0,.92,.05,1,.04,.05],"member",["Pole 1","Pole 2"]),P("tie","Front tie",[0,.92,.9,1,.04,.05],"member",["Pole 3","Pole 4"]),
 P("cover","Canvas cover 1",[.05,.02,.1,.9,.9,.01],"cover",["Pole 1","Pole 2"]),
 P("cover","Canvas cover 2",[.1,.02,.1,.01,.9,.8],"cover",["Pole 1","Pole 3"]),
 P("cover","Canvas cover 3",[.89,.02,.1,.01,.9,.8],"cover",["Pole 2","Pole 4"]),
 P("cover","Canvas cover 4",[.05,.02,.89,.3,.9,.01],"cover",["Pole 3"]),P("cover","Canvas cover 5",[.65,.02,.89,.3,.9,.01],"cover",["Pole 4"])]
rec("tipi","Kids tipi",(48,66,48),tp,["pole","cover"],[],stock="dowel-1-1-4-36",sheet="other",notes=["A kid-size play tipi: lash the poles at the top and drape the fabric cover, with a door gap at the front."])

# Treasure chest
tc=[P("bottom","Bottom",[0,0,0,1,.08,1]),
 P("wall","Front wall",[0,.08,.92,1,.62,.08],"panel",["Bottom"]),P("wall","Back wall",[0,.08,0,1,.62,.08],"panel",["Bottom"]),
 P("wall","Left wall",[0,.08,.08,.08,.62,.84],"panel",["Bottom"]),P("wall","Right wall",[.92,.08,.08,.08,.62,.84],"panel",["Bottom"]),
 P("lid","Lid",[0,.7,0,1,.12,1],"panel",["Front wall","Back wall","Left wall","Right wall"]),
 P("hinge","Hinge",[.2,.64,0,.12,.12,.02],"hardware",["Back wall"]),
 P("latch","Latch",[.45,.6,.98,.1,.15,.02],"hardware",["Front wall"])]
rec("treasure-chest","Treasure chest",(10,7,6),tc,["wall","lid","hinge"],["pirate chest"],stock=POP,sheet=POP,moving=[{"part":"Lid","motion":"hinge"}],notes=["A craft-size chest; the lid swings up on a hinge at the back."])

# Compost bin bays
cp=[P("post","Back post",[0,0,0,.035,1,.1],"member",repeat="between",stock=L44),
 P("post","Front post",[0,0,.9,.035,1,.1],"member",repeat="between",stock=L44),
 P("slat","Back slats",[0,.04,0,1,.96,.03],"panel",["Back post"],"each"),
 P("divider","Bay wall",[0,.04,.1,.02,.96,.8],"panel",["Back post","Front post"],"between"),
 P("slat","Front slats",[0,.04,.97,1,.5,.03],"panel",["Front post"],"each")]
rec("compost-bin","Compost bin",(36,36,36),cp,["post","slat","divider"],["compost bay","compost bins"],outdoor=True,count={"word":"bays","default":1,"unit":{"width":36}},stock=L26,sheet=L26,notes=["Open slatted bays share their posts; no floor or roof so the pile drains and breathes.","Front slats lift out to turn the pile.","Set the posts in the ground 12″ deep."])

# Deck stairs
ds=[P("stringer","Left stringer",[0,0,0,.04,1,1],"member"),
 P("stringer","Center stringer",[.48,0,0,.04,1,1],"member"),P("stringer","Right stringer",[.96,0,0,.04,1,1],"member"),
 P("tread","Tread",[0,.85,0,1,.15,1],"panel",["Left stringer","Center stringer","Right stringer"],"stair"),
 P("riser","Riser",[0,0,.95,1,.85,.05],"panel",["Left stringer","Center stringer","Right stringer"],"stair")]
rec("deck-stairs","Deck stairs",(36,22.5,31.5),ds,["stringer","tread","riser"],["deck steps","porch steps","porch stairs","outdoor stairs"],outdoor=True,count={"word":"steps","default":3,"unit":{"height":7.5,"depth":10.5}},stock="lumber-2x12-8",sheet=L26,notes=["Cut the stringers to a sawtooth: 7½″ rise and 10½″ run per step; set the stringer feet on pier blocks and bolt the top to the deck rim."])

# Pergola (feet)
pg=[]
for nm,x,z in [("Post 1",.08,.08),("Post 2",.89,.08),("Post 3",.08,.89),("Post 4",.89,.89)]:
    pg.append(P("post",nm,[x,0,z,.03,.9,.03],"member",stock=L44))
pg+= [P("beam","Front beam",[0,.9,.08,1,.06,.03],"member",["Post 1","Post 2"],stock="lumber-2x8-8"),
 P("beam","Back beam",[0,.9,.89,1,.06,.03],"member",["Post 3","Post 4"],stock="lumber-2x8-8")]
for i in range(8):
    pg.append(P("rafter",f"Rafter {i+1}",[.04+i*.13,.96,0,.015,.04,1],"member",["Front beam","Back beam"],stock=L26))
rec("pergola","Pergola",(120,96,120),pg,["post","beam","rafter"],[],feet=True,outdoor=True,stock=L44,sheet=L26,notes=["4×4 posts set in concrete footings, doubled beams, rafters on top."])

# Taj Mahal
tj=[P("plinth","Plinth",[0,0,0,1,.08,1])]
for nm,x,z in [("Minaret 1",.02,.02),("Minaret 2",.92,.02),("Minaret 3",.02,.92),("Minaret 4",.92,.92)]:
    tj.append(P("minaret",nm,[x,.08,z,.06,.72,.06],"member",["Plinth"]))
    tj.append(P("minaret",nm+" cap",[x-.01,.8,z-.01,.08,.05,.08],"panel",[nm]))
tj+= [P("hall","Front wall",[.2,.08,.78,.6,.42,.02],"panel",["Plinth"]),P("hall","Back wall",[.2,.08,.2,.6,.42,.02],"panel",["Plinth"]),
 P("hall","Left wall",[.2,.08,.22,.02,.42,.56],"panel",["Plinth"]),P("hall","Right wall",[.78,.08,.22,.02,.42,.56],"panel",["Plinth"]),
 P("iwan","Front iwan",[.4,.1,.8,.2,.36,.02],"panel",["Front wall"]),P("iwan","Back iwan",[.4,.1,.18,.2,.36,.02],"panel",["Back wall"]),
 P("iwan","Left iwan",[.18,.1,.4,.02,.36,.2],"panel",["Left wall"]),P("iwan","Right iwan",[.8,.1,.4,.02,.36,.2],"panel",["Right wall"]),
 P("roof","Roof",[.2,.5,.2,.6,.02,.6],"panel",["Front wall","Back wall","Left wall","Right wall"]),
 P("drum","Drum",[.38,.52,.38,.24,.1,.24],"panel",["Roof"]),
 P("dome","Dome",[.32,.62,.32,.36,.26,.36],"panel",["Drum"]),
 P("finial","Finial",[.49,.88,.49,.02,.12,.02],"member",["Dome"])]
for nm,x,z in [("Chhatri 1",.22,.22),("Chhatri 2",.7,.22),("Chhatri 3",.22,.7),("Chhatri 4",.7,.7)]:
    tj.append(P("chhatri",nm,[x,.52,z,.08,.1,.08],"panel",["Roof"]))
rec("taj-mahal","Taj Mahal",(24,20,24),tj,["plinth","minaret","dome","drum","iwan"],["taj"],stock=CB,sheet=CB,notes=["Onion dome on a drum over the square hall, four arched iwans and four corner minarets on the plinth."])

# Colosseum: elliptical ring of piers with three arcade tiers
co=[P("arena","Arena floor",[.1,0,.1,.8,.03,.8])]
N=16; pts=[]
for i in range(N):
    a=2*math.pi*i/N; x=.5+.46*math.cos(a)-.03; z=.5+.46*math.sin(a)-.03
    pts.append((x,z)); co.append(P("pier",f"Pier {i+1}",[x,0,z,.06,1,.06],"member"))
for t,y in enumerate([.31,.63,.95]):
    for i in range(N):
        (x1,z1),(x2,z2)=pts[i],pts[(i+1)%N]
        x=min(x1,x2); z=min(z1,z2)
        co.append(P("arcade",f"Arcade {t+1}-{i+1}",[x,y,z,max(x1,x2)+.06-x,.05,max(z1,z2)+.06-z],"panel",[f"Pier {i+1}",f"Pier {(i+1)%N+1}"]))
rec("colosseum","Colosseum",(30,12,24),co,["pier","arcade","arena"],["coliseum","roman amphitheater"],stock=CB,sheet=CB,notes=["An elliptical ring of piers with three tiers of arcades around an open arena."])

# Murphy bed queen
mb=[P("base","Plinth",[.03,0,.05,.94,.04,.9]),
 P("cabinet","Left side",[0,0,0,.03,1,1],"panel"),P("cabinet","Right side",[.97,0,0,.03,1,1],"panel"),
 P("cabinet","Top",[0,.97,0,1,.03,1],"panel",["Left side","Right side"]),P("cabinet","Back",[.03,.04,0,.94,.93,.04],"panel",["Left side","Right side"]),
 P("pivot","Fold bracket",[.03,.04,.4,.03,.06,.2],"hardware",["Left side"]),
 P("bed","Bed frame left rail",[.03,.04,.3,.03,.9,.6],"member",["Fold bracket"]),
 P("bed","Bed frame right rail",[.94,.04,.3,.03,.9,.6],"member",["Right side"]),
 P("bed","Bed face",[.03,.04,.9,.94,.9,.06],"panel",["Bed frame left rail","Bed frame right rail"]),
 P("leg","Fold-out leg",[.06,.9,.6,.88,.04,.3],"member",["Bed frame left rail","Bed frame right rail"])]
rec("murphy-bed","Murphy bed",(66,86,18),mb,["cabinet","bed","pivot","leg"],["wall bed","fold down bed"],stock=L26,sheet=PLY,moving=[{"part":"Bed face","motion":"pivot"}],notes=["The queen bed frame pivots down out of the wall cabinet on its fold brackets; the leg folds out to carry the foot.","Lag the cabinet to two wall studs before the bed is mounted."])

# Mudroom locker bays
ml=[P("side","Side",[0,0,0,.02,1,1],"panel",repeat="between"),
 P("back","Back",[0,.08,0,1,.9,.03],"panel",["Side"]),
 P("top","Top",[0,.98,0,1,.02,1],"panel",["Side"]),
 P("bench","Bench seat",[0,.25,0,1,.02,1],"panel",["Side"],"each"),
 P("shelf","Top shelf",[0,.8,0,1,.02,1],"panel",["Side"],"each"),
 P("kick","Kick",[0,0,.92,1,.08,.08],"panel",["Side"],"each"),
 P("hook","Coat hook",[.4,.62,.03,.2,.06,.15],"hardware",["Back"],"each")]
rec("mudroom-locker","Mudroom locker",(54,72,16),ml,["side","bench","shelf","hook"],["entry locker","locker"],count={"word":"bays","default":3,"unit":{"width":18}},stock=PLY,sheet=PLY,notes=["Tall open locker bays with a bench seat, a top shelf and a coat hook in each; anchor the top to a wall stud."])

# Floating desk
fd=[P("cleat","Wall cleat",[0,.9,0,1,.05,.05],"member"),
 P("arm","Left support arm",[.1,.9,.05,.04,.05,.85],"member",["Wall cleat"]),P("arm","Right support arm",[.86,.9,.05,.04,.05,.85],"member",["Wall cleat"]),
 P("top","Desktop",[0,.95,0,1,.05,1],"panel",["Wall cleat","Left support arm","Right support arm"])]
rec("floating-desk","Floating desk",(48,30,20),fd,["cleat","top","arm"],["wall desk","wall mounted desk"],wall=True,stock=L24,sheet=PLY,notes=["The top cantilevers off a wall cleat lagged into studs at desk height; no legs."])

# Under-stairs shelf: stepped uprights under the slope
us=[]; H=[1,.75,.5,.25]; xs=[0,.32,.64,.96]
for i,(x,h) in enumerate(zip(xs,H)):
    us.append(P("upright",f"Upright {i+1}",[x,0,0,.04,h,1],"panel"))
for i in range(3):
    top=H[i+1]
    us.append(P("slope",f"Sloped top {i+1}",[xs[i]+.04,top-.03,0,xs[i+1]-xs[i]-.04,.03,1],"panel",[f"Upright {i+1}",f"Upright {i+2}"]))
    for j,y in enumerate([0,top/2]):
        us.append(P("shelf",f"Shelf {i+1}-{j+1}",[xs[i]+.04,y,0,xs[i+1]-xs[i]-.04,.03,1],"panel",[f"Upright {i+1}",f"Upright {i+2}"]))
rec("under-stairs-shelf","Under-stairs shelves",(48,72,12),us,["upright","slope","shelf"],["under stairs shelf","under-stair shelf","under stair shelf"],stock=PLY,sheet=PLY,notes=["Uprights step down with the stair slope; scribe each top to the stringer."])

# Sandbox with corner seats
sb=[P("wall","Back wall",[0,0,0,1,1,.03],"panel"),P("wall","Front wall",[0,0,.97,1,1,.03],"panel"),
 P("wall","Left wall",[0,0,.03,.03,1,.94],"panel"),P("wall","Right wall",[.97,0,.03,.03,1,.94],"panel")]
for i,(x,z) in enumerate([(0,0),(.8,0),(0,.8),(.8,.8)]):
    sb.append(P("seat",f"Corner seat {i+1}",[x,1-.15,z,.2,.15,.2],"panel",["Back wall" if z==0 else "Front wall"]))
rec("sandbox","Sandbox",(48,10,48),sb,["wall","seat"],["sand box"],modifiers=["seat"],outdoor=True,stock=L26,sheet=L26,notes=["No floor: set it in the ground on a level bed and lay landscape fabric under the sand so it drains."])

json.dump({"schema":1,"recipes":R},open(os.path.join(os.path.dirname(__file__),"..","src","lib","yard","recipes.json"),"w"),indent=1)
print(len(R))
