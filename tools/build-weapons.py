"""Original, offline view-model source. Run: blender -b -t 2 --python tools/build-weapons.py
Exports evaluated bevelled meshes to a classic JS bundle (works from file://).
Coordinates intentionally match the client: X right, Y up, muzzle toward -Z.
"""
import bpy, math, json, base64, struct
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
MATS={}
for name,color in {'steel':(.46,.50,.55,1),'black':(.045,.055,.065,1),'edge':(.17,.20,.23,1),'grip':(.065,.075,.07,1),'skin':(.13,.28,.30,1),'gold':(.58,.36,.12,1),'glass':(.035,.15,.22,1),'cloth':(.16,.21,.18,1),'rubber':(.025,.03,.032,1)}.items():
 m=bpy.data.materials.new(name);m.diffuse_color=color;MATS[name]=m
current='pistol'; tag='body'
def finish(obj,name,material,bevel=0):
 obj.name=current+'__'+tag+'__'+name;obj.data.materials.append(MATS[material]);obj['kind']=current;obj['part']=tag
 if bevel:
  mod=obj.modifiers.new('Machined edge bevel','BEVEL');mod.width=bevel;mod.segments=3
  mod.affect='EDGES'
  norm=obj.modifiers.new('Weighted surface normals','WEIGHTED_NORMAL');norm.keep_sharp=True;norm.weight=50
 return obj
def cube(name,pos,size,material='black',bevel=.004):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);return finish(o,name,material,bevel)
def profile(name,points,width,material='black',bevel=.004,x=0):
 n=len(points);v=[(xx,y,z) for xx in [x-width/2,x+width/2] for z,y in points];f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
 for i in range(n):j=(i+1)%n;f.append((i,j,j+n,i+n))
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],f);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT');o.select_set(False)
 return finish(o,name,material,bevel)
def cylinder(name,pos,radius,length,material='steel',axis='z',sides=32):
 bpy.ops.mesh.primitive_cylinder_add(vertices=sides,radius=radius,depth=length,location=pos);o=bpy.context.object
 if axis=='x':o.rotation_euler.y=math.pi/2
 if axis=='y':o.rotation_euler.x=math.pi/2
 for face in o.data.polygons:face.use_smooth=len(face.vertices)==4
 return finish(o,name,material,.0015)
def tube(name,pos,radius,length,material='black',thickness=.006,sides=32):
 x,y,z=pos;verts=[]
 for zz,rr in [(-length/2,radius),(length/2,radius),(-length/2,radius-thickness),(length/2,radius-thickness)]:
  verts.extend((x+math.cos(i*2*math.pi/sides)*rr,y+math.sin(i*2*math.pi/sides)*rr,z+zz) for i in range(sides))
 faces=[]
 for i in range(sides):j=(i+1)%sides;faces.extend([(i,j,j+sides,i+sides),(i+2*sides,i+3*sides,j+3*sides,j+2*sides),(i,i+2*sides,j+2*sides,j),(i+sides,j+sides,j+3*sides,i+3*sides)])
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o)
 for i,p in enumerate(mesh.polygons):p.use_smooth=i%4<2
 return finish(o,name,material,.001)
def bolt(x,y,z):cylinder('Torx screw',(x,y,z),.009,.004,'steel','x',16);cylinder('Screw socket',(x+.0025,y,z),.003,.005,'black','x',6)
def guard(z,y,width=.09):
 # Continuous extruded trigger guard outline, genuinely open in the middle.
 cu=bpy.data.curves.new('Trigger guard curve','CURVE');cu.dimensions='3D';cu.bevel_depth=.007;cu.bevel_resolution=3
 spline=cu.splines.new('POLY');pts=[(0,y+.025,z+.08),(0,y-.045,z+.085),(0,y-.075,z+.04),(0,y-.075,z-.055),(0,y-.035,z-.085),(0,y+.04,z-.085)];spline.points.add(len(pts)-1)
 for p,v in zip(spline.points,pts):p.co=(*v,1)
 o=bpy.data.objects.new('Guard',cu);bpy.context.collection.objects.link(o);finish(o,'Open trigger guard','black')
 profile('Curved trigger',[(z-.015,y+.025),(z+.005,y-.015),(z-.005,y-.04),(z-.023,y-.035),(z-.015,y-.01),(z-.026,y+.025)],.018,'steel',.002)
def pistol():
 global current,tag
 current='pistol';tag='body'
 # A large frame pistol with a faceted slide, tapering barrel shroud and swept grip.
 profile('Lower frame',[(-.36,.012),(-.36,-.04),(-.12,-.06),(-.085,-.075),(.005,-.09),(.075,-.05),(.125,-.005),(.1,.035),(-.25,.035)],.098,'edge',.007)
 profile('Grip core',[(.025,-.045),(.10,-.05),(.16,-.26),(.12,-.30),(.035,-.29),(-.035,-.11)],.095,'black',.012)
 profile('Textured grip panel',[(.02,-.09),(.088,-.085),(.134,-.25),(.112,-.275),(.052,-.265),(-.006,-.115)],.005,'grip',.005,x=.052)
 for side in [-1,1]:
  profile('Inlaid grip skin',[(.022,-.105),(.071,-.10),(.12,-.245),(.10,-.26),(.062,-.252),(.005,-.125)],.004,'skin',.003,x=side*.057)
  cylinder('Grip medallion',(side*.061,-.18,.058),.016,.003,'gold','x',24)
 cylinder('Hammer axle',(0,.02,.13),.018,.12,'black','x')
 profile('Skeleton hammer',[(.09,.018),(.14,.017),(.158,.047),(.148,.06),(.126,.04)],.032,'steel',.003)
 for i in range(8):cube('Left slide serration',(-.055,.074,.018+i*.009),(.006,.072,.003),'black',.001)
 for i in range(15):o=cube('Grip checkering',(.056,-.12-i*.009,.025+i*.004),(.004,.002,.075),'edge',.0007);o.rotation_euler.x=-.28
 for y,z in [(-.12,.04),(-.245,.105)]:bolt(.058,y,z)
 guard(-.04,-.085)
 cylinder('Safety selector',(.058,.012,.082),.014,.009,'black','x');cube('Slide stop',(.059,-.01,.025),(.014,.012,.072),'steel',.003)
 tag='magazine';profile('Magazine heel',[(.055,-.27),(.145,-.27),(.155,-.30),(.065,-.31)],.104,'rubber',.006)
 tag='slide'
 profile('Faceted slide',[(-.385,.04),(-.38,.105),(-.33,.13),(.09,.13),(.12,.1),(.125,.035)],.105,'steel',.009)
 # Recessed ejection port with barrel visible inside.
 cube('Ejection port',(.054,.08,-.085),(.003,.046,.087),'black',.006);cube('Chamber steel',(.056,.065,-.083),(.003,.013,.072),'edge',.002)
 for i in range(9):cube('Rear slide serration',(.055,.074,.018+i*.009),(.006,.072,.003),'black',.001)
 for i in range(6):cube('Forward slide serration',(.055,.078,-.31+i*.009),(.005,.06,.003),'edge',.001)
 tube('Polygon barrel crown',(0,.075,-.39),.035,.035,'steel',.012,12);tube('Bore rifling',(0,.075,-.412),.022,.014,'black',.004,24)
 cube('Rear sight',(0,.145,.074),(.08,.027,.032),'black',.003);cube('Rear notch',(0,.158,.08),(.022,.014,.034),'steel',.001)
 cube('Front sight',(0,.145,-.33),(.018,.023,.027),'black',.002);cube('Front sight dot',(0,.151,-.317),(.008,.008,.003),'gold',.001)
 tag='body'
def rifle(sniper=False,shotgun=False):
 global current,tag
 current='sniper' if sniper else 'shotgun' if shotgun else 'rifle';tag='body'
 # The receiver is modelled as an extruded outline rather than a rectangular block.
 profile('Lower receiver',[(-.18,.025),(-.18,-.065),(-.125,-.105),(-.06,-.105),(-.025,-.06),(.085,-.065),(.11,-.015),(.08,.045)],.10,'black',.007)
 profile('Upper receiver',[(-.22,.03),(-.22,.105),(-.16,.13),(.06,.13),(.11,.095),(.11,.035)],.115,'edge',.007)
 cube('Ejection recess',(.059,.073,-.063),(.003,.033,.115),'black',.006);cube('Bolt carrier',(.061,.074,-.063),(.003,.018,.1),'steel',.002)
 cube('Dust cover hinge',(.066,.035,-.06),(.012,.01,.13),'steel',.002)
 for z in [-.13,.045]:bolt(.065,-.012,z)
 cylinder('Fire selector',(.066,-.021,.031),.013,.008,'steel','x');cube('Safety lever',(.072,-.025,.042),(.01,.008,.038),'edge',.002)
 profile('Swept pistol grip',[(.03,-.05),(.10,-.055),(.18,-.24),(.15,-.28),(.07,-.27),(.003,-.10)],.076,'grip',.012)
 for i in range(7):cube('Grip finger grooves',(.041,-.10-i*.02,.035+i*.009),(.006,.005,.055),'rubber',.001)
 guard(-.03,-.08)
 cylinder('Buffer tube',(0,.055,.22),.033,.29,'edge');
 profile('Sculpted adjustable stock',[(.14,.11),(.45,.11),(.48,.065),(.48,-.14),(.44,-.16),(.30,-.09),(.26,-.01),(.14,.015)],.095,'grip',.013)
 cube('Rubber buttpad',(0,-.025,.477),(.105,.25,.021),'rubber',.008)
 for i in range(7):cube('Buttpad ribs',(0,-.12+i*.03,.491),(.10,.008,.005),'edge',.001)
 profile('Stock cheek rest',[(.16,.12),(.41,.12),(.43,.07),(.25,.055)],.103,'skin',.007)
 if sniper:
  profile('AW stock chassis',[(-.38,-.01),(-.36,-.09),(-.18,-.12),(.12,-.075),(.40,-.12),(.45,-.045),(.42,.055),(-.26,.055)],.13,'skin',.015)
  cylinder('Bolt handle stem',(.10,.095,.06),.013,.10,'steel','x');bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=.026,location=(.158,.09,.06));finish(bpy.context.object,'Bolt knob','black')
 # Barrel bore and muzzle are actual open rings.
 length=.68 if sniper else .61 if shotgun else .49
 tube('Free floating barrel',(0,.07,-.30-length/2),.023,length,'edge',.009)
 end=-.30-length
 tube('Muzzle brake',(0,.07,end),.035,.08,'steel',.014)
 for z in [end-.02,end+.005,end+.025]:
  for x in [-.031,.031]:cube('Brake side port',(x,.07,z),(.004,.025,.01),'black',.002)
 # Octagonal slotted handguard: open gaps between lengthwise rails.
 if not sniper:
  for i in range(8):
   a=i*math.pi/4;rail=cube('Handguard rib',(math.cos(a)*.066,.07+math.sin(a)*.066,-.37),(.026,.025,.31),'skin' if i%2 else 'black',.006);rail.rotation_euler.z=a
  for z in [-.23,-.49]:tube('Handguard collar',(0,.07,z),.079,.025,'edge',.009,12)
  for i in range(8):cube('M-LOK inner slot',(.069,.068,-.245-i*.03),(.007,.019,.016),'black',.003)
 for i in range(18):cube('Picatinny rail tooth',(0,.155,-.48+i*.032),(.077,.018,.013),'black',.002)
 if sniper:
  for z in [-.24,-.02]:cube('Scope mount',(0,.19,z),(.08,.09,.055),'black',.004);tube('Scope ring',(0,.28,z),.067,.04,'black',.01)
  tube('Optic tube',(0,.28,-.12),.055,.47,'edge',.007)
  tube('Objective housing',(0,.28,-.38),.091,.14,'black',.009)
  tube('Ocular housing',(0,.28,.145),.071,.075,'black',.009)
  cylinder('Scope lens',(0,.28,.181),.061,.003,'glass');cylinder('Objective lens',(0,.28,-.45),.08,.003,'glass')
  cylinder('Elevation turret',(0,.365,-.12),.033,.065,'black','y');cylinder('Windage turret',(.077,.28,-.12),.031,.06,'black','x')
  for i in range(16):cube('Focus ring knurl',(.06*math.cos(i*math.pi/8),.28+.06*math.sin(i*math.pi/8),.10),(.006,.006,.03),'steel',.001)
 else:
  cube('Rear sight base',(0,.18,.045),(.08,.03,.045),'black',.003)
  for x in [-.033,.033]:cube('Sight ears',(x,.21,.045),(.012,.055,.035),'black',.003)
  tube('Rear aperture',(0,.215,.045),.016,.018,'black',.008,24)
  profile('Front sight tower',[(-.54,.08),(-.54,.21),(-.56,.23),(-.58,.21),(-.58,.08)],.025,'black',.003)
 tag='magazine'
 profile('Curved magazine',[(-.14,-.06),(-.05,-.065),(-.04,-.19),(-.065,-.30),(-.11,-.34),(-.18,-.30),(-.15,-.18)],.073,'edge',.009)
 for i in range(4):cube('Magazine pressed channel',(.039,-.17-i*.025,-.105-i*.007),(.004,.012,.066),'black',.003)
 tag='body'
 if shotgun:tube('Magazine tube',(0,-.035,-.48),.028,.56,'black',.008);profile('Pump grip',[(-.46,-.08),(-.27,-.08),(-.25,.035),(-.45,.04)],.14,'grip',.012)
for f in [pistol,lambda:rifle(),lambda:rifle(sniper=True),lambda:rifle(shotgun=True)]:f()
# Curves are converted only for export; evaluated modifiers and smooth normals are preserved.
scene=bpy.context.scene;deps=bpy.context.evaluated_depsgraph_get();groups={}
for obj in list(scene.objects):
 if obj.type not in {'MESH','CURVE'}:continue
 evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles();matrix=obj.matrix_world;normalmat=matrix.to_3x3().inverted().transposed()
 key=(obj['kind'],obj['part'],obj.data.materials[0].name);out=groups.setdefault(key,{'p':[],'n':[],'uv':[]})
 for tri in mesh.loop_triangles:
  for li in tri.loops:
   v=matrix@mesh.vertices[mesh.loops[li].vertex_index].co;n=normalmat@mesh.corner_normals[li].vector;n.normalize();out['p'].extend(v);out['n'].extend(n)
   # Triplanar-like projection chosen per face avoids stretching on end caps.
   if abs(n.x)>.5:out['uv'].extend((v.z*2.5,v.y*2.5))
   elif abs(n.y)>.5:out['uv'].extend((v.x*4,v.z*2.5))
   else:out['uv'].extend((v.x*4,v.y*2.5))
 evaluated.to_mesh_clear()
def pack(arr):return base64.b64encode(struct.pack('<%df'%len(arr),*arr)).decode()
result={}
for (kind,part,material),arrays in groups.items():result.setdefault(kind,[]).append({'part':part,'mat':material,**{k:pack(v) for k,v in arrays.items()}})
out=ROOT/'web/models/weapons-meshes.js';out.write_text('/* Original meshes generated by tools/build-weapons.py; no runtime model fetch. */\nwindow.RetroWeaponMeshes='+json.dumps(result,separators=(',',':'))+';\n')
print('EXPORTED',len(groups),'mesh groups',sum(len(v['p'])//9 for v in groups.values()),'triangles',out.stat().st_size,'bytes')
# Source generator is the editable model source; avoid checking in a redundant .blend binary.
