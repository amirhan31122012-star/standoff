#include "retro/engine.hpp"

#include <cmath>
#include <limits>
#include <stdexcept>

namespace {
void Check(bool condition,const char* message) {
    if (!condition) throw std::runtime_error(message);
}
bool Near(float a,float b,float tolerance=0.001f) { return std::abs(a-b)<tolerance; }
retro::World Floor() { return {{{{-100,-1,-100},{100,0,100}}}}; }
}
void RunMovementTests() {
    using namespace retro;
    auto world=Floor();
    Player p;
    InputFrame in;
    for (int i=0;i<30;++i) p.UpdateMovement(in,kTickDt,world);
    Check(Near(p.state.position.y,0)&&p.state.grounded,"floor supports player");
    in.forward=1;
    for (int i=0;i<30;++i) p.UpdateMovement(in,kTickDt,world);
    Check(p.state.position.z>4.8f && p.state.position.z<5.3f,"responsive forward movement");
    p.Respawn({0,0,0});
    in.strafe=1;
    for (int i=0;i<30;++i) p.UpdateMovement(in,kTickDt,world);
    Check(std::hypot(p.state.velocity.x,p.state.velocity.z)<=5.201f,"diagonal speed normalized");
    p.Respawn({0,0,0});
    in={}; in.forward=1; in.yaw=kPi/2;
    for (int i=0;i<10;++i) p.UpdateMovement(in,kTickDt,world);
    Check(p.state.position.x>1 && std::abs(p.state.position.z)<0.001f,"movement follows view yaw");

    p.Respawn({0,0,0}); in={}; in.jump=true;
    p.UpdateMovement(in,kTickDt,world);
    Check(p.state.position.y>0 && !p.state.grounded,"jump launches player");
    for (int i=0;i<60;++i) p.UpdateMovement(in,kTickDt,world);
    Check(Near(p.state.position.y,0)&&p.state.grounded,"holding jump does not autojump");
    in.jump=false; p.UpdateMovement(in,kTickDt,world);
    in.jump=true; p.UpdateMovement(in,kTickDt,world);
    Check(p.state.position.y>0,"jump rearmed after release");

    world.solids.push_back({{1.0f,0,-5},{1.01f,4,5}});
    p.Respawn({0,0,0}); in={}; in.strafe=1;
    for (int i=0;i<30;++i) p.UpdateMovement(in,kTickDt,world);
    Check(Near(p.state.position.x,0.7f)&&!world.Collides(p.Bounds()),"thin wall blocks movement");
    p.Respawn({0,0,0}); p.state.velocity.x=100;
    p.UpdateMovement({},kTickDt,world);
    Check(p.state.position.x<=0.701f,"sweep prevents high speed tunneling");

    world=Floor(); world.solids.push_back({{-1,1.25f,-1},{1,2,1}});
    p.Respawn({0,0,0}); in={}; in.crouch=true;
    p.UpdateMovement(in,kTickDt,world);
    Check(p.state.crouched,"crouch shrinks body");
    in.crouch=false; p.UpdateMovement(in,kTickDt,world);
    Check(p.state.crouched&&!world.Collides(p.Bounds()),"cannot stand through ceiling");
    p.state.position.x=2; p.UpdateMovement(in,kTickDt,world);
    Check(!p.state.crouched,"stand when headroom clears");

    p.state.armor=40;
    Check(!p.TakeDamage(30)&&p.state.health==85&&p.state.armor==25,"armor absorbs half damage");
    Check(p.TakeDamage(200)&&p.state.health==0,"lethal damage reports transition");
    Check(!p.TakeDamage(200),"dead target cannot die twice");
    p.Respawn({0,0,0});
    in={}; in.forward=std::numeric_limits<float>::quiet_NaN();
    p.UpdateMovement(in,kTickDt,Floor());
    Check(Finite(p.state.position)&&Finite(p.state.velocity),"nonfinite input rejected");

    const Aabb box{{-1,-1,5},{1,1,6}};
    const auto hit=RayAabb({0,0,0},{0,0,1},box,10);
    Check(hit&&Near(*hit,5),"ray slab distance");
    Check(!RayAabb({2,0,0},{0,0,1},box,10),"parallel ray outside slab misses");
    Check(!RayAabb({0,0,0},{0,0,1},box,4),"ray range respected");
    Check(!RayAabb({0,0,0},{0,0,0},box,10),"zero direction rejected");
    const auto inside=RayAabb({0,0,5.5f},{1,0,0},box,10);
    Check(inside&&Near(*inside,0),"inside ray starts at zero distance");
}
