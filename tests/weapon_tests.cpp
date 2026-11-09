#include "retro/engine.hpp"

#include <cassert>
#include <cmath>
#include <limits>

using namespace retro;
namespace {
void Advance(Weapon& weapon, float seconds) {
    const int ticks = static_cast<int>(std::ceil(seconds/kTickDt))+1;
    for (int i=0; i<ticks; ++i) weapon.Tick(kTickDt);
}
bool Near(float a, float b, float epsilon=0.00001f) { return std::abs(a-b) < epsilon; }
}

void RunWeaponTests() {
    Player player;
    player.state.grounded = true;
    Pistol pistol;
    assert(!pistol.Reload());
    const auto first = pistol.Shoot(player, 123u);
    assert(first && first->directions.size() == 1 && pistol.Ammo() == 11);
    assert(Near(first->origin.y, 1.65f));
    assert(player.state.pitch > 0); // Visible camera kick.
    assert(!pistol.Shoot(player, 123u));
    Advance(pistol, pistol.Stats().interval);
    assert(!pistol.Shoot(player, 123u)); // Semi-auto requires a fresh edge.
    pistol.ReleaseTrigger();
    assert(pistol.Shoot(player, 123u));
    assert(pistol.Ammo() == 10);
    pistol.ReleaseTrigger();
    assert(!pistol.Shoot(player, 123u)); // Fresh trigger cannot bypass rate limit.

    const int totalBefore = pistol.Ammo()+pistol.Reserve();
    assert(pistol.Reload());
    assert(!pistol.Reload());
    pistol.ReleaseTrigger();
    assert(!pistol.Shoot(player, 123u));
    pistol.Tick(0.1f);
    assert(pistol.Ammo() == 10 && pistol.Reloading());
    Advance(pistol, pistol.Stats().reloadTime);
    assert(pistol.Ammo() == 12 && !pistol.Reloading());
    assert(pistol.Ammo()+pistol.Reserve() == totalBefore);

    Rifle rifle;
    player.state.pitch = 0;
    const float standing = rifle.CalculateSpread(player);
    player.state.crouched = true;
    assert(rifle.CalculateSpread(player) < standing);
    player.state.crouched = false;
    player.state.velocity = {5.8f,0,0};
    const float moving = rifle.CalculateSpread(player);
    assert(moving > standing);
    player.state.grounded = false;
    assert(rifle.CalculateSpread(player) > moving);
    player.state.grounded = true;
    player.state.velocity = {};
    assert(rifle.Shoot(player, 7));
    const float burstSpread = rifle.CalculateSpread(player);
    assert(burstSpread > standing);
    Advance(rifle, rifle.Stats().interval);
    assert(rifle.Shoot(player, 7)); // Held trigger works for automatic weapons.
    Advance(rifle, 0.6f);
    assert(rifle.Burst() == 0 && Near(rifle.CalculateSpread(player), standing));

    Rifle reference;
    Rifle repeated;
    Player a, b;
    a.state.grounded = b.state.grounded = true;
    const auto one = reference.Shoot(a, 0xabcdu);
    const auto two = repeated.Shoot(b, 0xabcdu);
    assert(one && two);
    assert(Near(one->directions[0].x, two->directions[0].x));
    assert(Near(one->directions[0].y, two->directions[0].y));
    assert(Near(Length(one->directions[0]), 1.0f));

    Shotgun shotgun;
    player.state.pitch = player.state.yaw = 0;
    const auto pellets = shotgun.Shoot(player, 0);
    assert(pellets && pellets->directions.size() == 8 && shotgun.Ammo() == 7);
    bool different = false;
    for (const Vec3 direction : pellets->directions) {
        assert(Finite(direction) && Near(Length(direction), 1.0f));
        assert(direction.z > 0.99f);
        if (!Near(direction.x, pellets->directions.front().x)) different = true;
    }
    assert(different);

    Sniper sniper;
    player.state.health = 0;
    assert(!sniper.Shoot(player, 1));
    player.state.health = 100;
    player.switchRemaining = 0.25f;
    sniper.ReleaseTrigger();
    assert(!sniper.Shoot(player, 1));
    player.switchRemaining = 0;
    sniper.ReleaseTrigger();
    assert(sniper.Shoot(player, 1));
    assert(sniper.Ammo() == 4);
    player.state.pitch = kPi/2.0f;
    sniper.ApplyRecoil(player);
    assert(player.state.pitch < kPi/2.0f);
    sniper.Tick(std::numeric_limits<float>::quiet_NaN());
    assert(sniper.Ammo() == 4);
    assert(!MakeWeapon(static_cast<WeaponKind>(99)));

    // Run completely out of reserve; partial final reload conserves ammunition.
    Pistol depleted;
    for (int i=0; i<72; ++i) {
        if (depleted.Ammo() == 0) {
            assert(depleted.Reload());
            Advance(depleted, depleted.Stats().reloadTime);
        }
        depleted.ReleaseTrigger();
        assert(depleted.Shoot(player, static_cast<std::uint32_t>(i+1)));
        Advance(depleted, depleted.Stats().interval);
    }
    assert(depleted.Ammo() == 0 && depleted.Reserve() == 0);
    assert(!depleted.Reload());
    depleted.ReleaseTrigger();
    assert(!depleted.Shoot(player, 1));
}
