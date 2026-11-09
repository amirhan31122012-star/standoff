#include "retro/engine.hpp"

#include <algorithm>
#include <cmath>

namespace retro {
namespace {
constexpr float kRadius=0.30f;
constexpr float kGravity=20.0f;
constexpr float kJumpSpeed=6.8f;
constexpr float kSupportDepth=0.003f;
float Approach(float value, float target, float delta) {
    return value+std::clamp(target-value,-delta,delta);
}
float Component(Vec3 v,int axis) { return axis==0 ? v.x : axis==1 ? v.y : v.z; }
void AddComponent(Vec3& v,int axis,float delta) {
    if (axis==0) v.x+=delta;
    else if (axis==1) v.y+=delta;
    else v.z+=delta;
}
void ClearComponent(Vec3& v,int axis) {
    if (axis==0) v.x=0;
    else if (axis==1) v.y=0;
    else v.z=0;
}
bool Supported(const Player& player,const World& world) {
    auto b=player.Bounds();
    b.min.y-=kSupportDepth;
    b.max.y-=kSupportDepth;
    return world.Collides(b);
}
// Sweep one axis against every solid, clamp travel at the first contacted face.
// Unlike end-position overlap alone, this also catches thin walls crossed in a tick.
bool SweepAxis(Player& player,const World& world,int axis,float delta) {
    if (delta==0) return false;
    const auto body=player.Bounds();
    float allowed=delta;
    for (const auto& box:world.solids) {
        bool transverseOverlap=true;
        for (int other=0;other<3;++other) {
            if (other==axis) continue;
            if (Component(body.min,other)>=Component(box.max,other) ||
                Component(body.max,other)<=Component(box.min,other)) transverseOverlap=false;
        }
        if (!transverseOverlap) continue;
        if (delta>0 && Component(body.max,axis)<=Component(box.min,axis)) {
            allowed=std::min(allowed,Component(box.min,axis)-Component(body.max,axis));
        } else if (delta<0 && Component(body.min,axis)>=Component(box.max,axis)) {
            allowed=std::max(allowed,Component(box.max,axis)-Component(body.min,axis));
        }
    }
    AddComponent(player.state.position,axis,allowed);
    const bool hit=allowed!=delta;
    if (hit) ClearComponent(player.state.velocity,axis);
    return hit;
}
}
Player::Player(int playerId,Team playerTeam):id(playerId),team(playerTeam) {
    inventory.push_back(MakeWeapon(WeaponKind::Pistol));
}
Aabb Player::Bounds() const {
    return {state.position+Vec3{-kRadius,0,-kRadius},state.position+Vec3{kRadius,Height(),kRadius}};
}
void Player::UpdateMovement(const InputFrame& input,float dt,const World& world) {
    if (!std::isfinite(dt) || dt<=0 || !Finite(state.position) || !Finite(state.velocity)) return;
    dt=std::min(dt,kTickDt); // Simulation time is owned by the fixed-tick caller.
    if (!Alive()) { state.velocity={}; return; }
    if (std::isfinite(input.yaw)) state.yaw=std::remainder(input.yaw,2*kPi);
    if (std::isfinite(input.pitch)) state.pitch=std::clamp(input.pitch,-kPi*0.5f+0.01f,kPi*0.5f-0.01f);

    if (input.crouch) state.crouched=true;
    else if (state.crouched) {
        state.crouched=false;
        if (world.Collides(Bounds())) state.crouched=true;
    }
    state.grounded=state.velocity.y<=0 && Supported(*this,world);
    const float forward=std::isfinite(input.forward) ? std::clamp(input.forward,-1.0f,1.0f) : 0;
    const float strafe=std::isfinite(input.strafe) ? std::clamp(input.strafe,-1.0f,1.0f) : 0;
    Vec3 desired{std::sin(state.yaw)*forward+std::cos(state.yaw)*strafe,0,
                 std::cos(state.yaw)*forward-std::sin(state.yaw)*strafe};
    if (Length(desired)>1) desired=Normalize(desired);
    desired=desired*(state.crouched?2.7f:5.2f);
    // Ground friction is represented by quick convergence to the input velocity.
    const float acceleration=state.grounded?60.0f:20.0f;
    state.velocity.x=Approach(state.velocity.x,desired.x,acceleration*dt);
    state.velocity.z=Approach(state.velocity.z,desired.z,acceleration*dt);
    if (input.jump && !state.jumpHeld && state.grounded) {
        state.velocity.y=kJumpSpeed;
        state.grounded=false;
    }
    state.jumpHeld=input.jump;
    state.velocity.y=std::max(state.velocity.y-kGravity*dt,-50.0f);
    SweepAxis(*this,world,0,state.velocity.x*dt);
    SweepAxis(*this,world,2,state.velocity.z*dt);
    const float verticalTravel=state.velocity.y*dt;
    const bool verticalHit=SweepAxis(*this,world,1,verticalTravel);
    state.grounded=(verticalHit && verticalTravel<0) ||
                   (state.velocity.y<=0 && Supported(*this,world));
}
void Player::TickWeapons(float dt) {
    if (!std::isfinite(dt)||dt<=0) return;
    dt=std::min(dt,kTickDt);
    switchRemaining=std::max(0.0f,switchRemaining-dt);
    for (auto& weapon:inventory) if (weapon) weapon->Tick(dt);
}
bool Player::SwitchWeapon(std::size_t slot) {
    if (!Alive() || slot>=inventory.size() || !inventory[slot] || slot==currentSlot || switchRemaining>0) return false;
    if (auto* old=CurrentWeapon()) old->ReleaseTrigger();
    currentSlot=slot;
    switchRemaining=0.25f;
    return true;
}
Weapon* Player::CurrentWeapon() {
    return currentSlot<inventory.size() ? inventory[currentSlot].get() : nullptr;
}
const Weapon* Player::CurrentWeapon() const {
    return currentSlot<inventory.size() ? inventory[currentSlot].get() : nullptr;
}
bool Player::TakeDamage(int damage) {
    if (!Alive() || damage<=0) return false;
    // Armor absorbs half the incoming damage until its integer pool is exhausted.
    const int absorbed=std::min(std::max(state.armor,0),damage/2);
    state.armor=std::max(0,state.armor-absorbed);
    state.health=std::max(0,state.health-(damage-absorbed));
    if (!Alive()) state.velocity={};
    return !Alive();
}
void Player::Respawn(Vec3 position) {
    if (!Finite(position)) return;
    const int money=state.money;
    state=PlayerState{};
    state.money=money;
    state.position=position;
    inventory.clear();
    inventory.push_back(MakeWeapon(WeaponKind::Pistol));
    currentSlot=0;
    switchRemaining=0;
}
} // namespace retro
