#include "retro/engine.hpp"

#include <algorithm>
#include <cmath>

namespace retro {
namespace {
constexpr float Degrees(float degrees) { return degrees * kPi / 180.0f; }

// Reproducible spread, not a cryptographic generator. Only the server selects
// seeds for authoritative hits; a real transport must not accept client seeds.
float Random01(std::uint32_t& state) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return static_cast<float>(state >> 8) * (1.0f / 16777216.0f);
}
} // namespace

Weapon::Weapon(WeaponStats stats)
    : stats_(stats), ammo_(stats.magazineSize), reserve_(stats.reserveAmmo) {}

void Weapon::Tick(float dt) {
    if (!std::isfinite(dt) || dt <= 0) return;
    cooldown_ = std::max(0.0f, cooldown_ - dt);
    if (reloadRemaining_ > 0) {
        reloadRemaining_ = std::max(0.0f, reloadRemaining_ - dt);
        if (reloadRemaining_ == 0) {
            const int transferred = std::min(stats_.magazineSize - ammo_, reserve_);
            ammo_ += transferred;
            reserve_ -= transferred;
        }
    }
    idleTime_ = std::min(1.0f, idleTime_ + dt);
    // A short pause resets the pattern. Trigger release alone does not remove
    // the accuracy penalty, so rapidly tapping cannot evade burst spread.
    if (idleTime_ >= 0.45f) burst_ = 0;
}

void Weapon::ReleaseTrigger() { triggerHeld_ = false; }

std::optional<Shot> Weapon::Shoot(Player& player, std::uint32_t seed) {
    const bool risingEdge = !triggerHeld_;
    triggerHeld_ = true;
    if (!player.Alive() || player.switchRemaining > 0 || Reloading() ||
        ammo_ <= 0 || cooldown_ > 0.000001f ||
        (!stats_.automatic && !risingEdge) || !Finite(player.state.position) ||
        !Finite(player.state.velocity) || !std::isfinite(player.state.yaw) ||
        !std::isfinite(player.state.pitch)) return std::nullopt;

    const float spread = CalculateSpread(player);
    const float yaw = player.state.yaw;
    const float pitch = player.state.pitch;
    const Vec3 forward = AimDirection(yaw, pitch);
    const Vec3 right{std::cos(yaw), 0, -std::sin(yaw)};
    const Vec3 up{-std::sin(yaw)*std::sin(pitch), std::cos(pitch),
                  -std::cos(yaw)*std::sin(pitch)};
    Shot shot{player.Eye(), {}, stats_.damage, stats_.range};
    shot.directions.reserve(static_cast<std::size_t>(stats_.pellets));
    std::uint32_t random = seed != 0 ? seed : 0x9e3779b9u;
    for (int pellet=0; pellet<stats_.pellets; ++pellet) {
        // Uniform disk in the plane perpendicular to the aim direction.
        const float radius = std::sqrt(Random01(random)) * std::tan(spread);
        const float angle = 2.0f * kPi * Random01(random);
        shot.directions.push_back(Normalize(forward + right*(radius*std::cos(angle))
                                           + up*(radius*std::sin(angle))));
    }
    --ammo_;
    cooldown_ = stats_.interval;
    burst_ = std::min(32, burst_ + 1);
    idleTime_ = 0;
    // This shot uses the pre-kick aim. Kick affects the next shot and camera.
    ApplyRecoil(player);
    return shot;
}

bool Weapon::Reload() {
    if (Reloading() || ammo_ >= stats_.magazineSize || reserve_ <= 0) return false;
    reloadRemaining_ = stats_.reloadTime;
    return true;
}

float Weapon::CalculateSpread(const Player& player) const {
    const float speed = std::hypot(player.state.velocity.x, player.state.velocity.z);
    const float movement = std::isfinite(speed) ? std::clamp(speed/5.8f, 0.0f, 1.0f) : 1.0f;
    float spread = stats_.baseSpread + stats_.movementSpread*movement;
    spread += std::min(burst_, 10) * Degrees(0.10f);
    if (!player.state.grounded) spread += stats_.airborneSpread;
    if (player.state.grounded && player.state.crouched) spread *= 0.65f;
    return std::clamp(spread, 0.0f, 0.25f);
}

void Weapon::ApplyRecoil(Player& player) const {
    if (!std::isfinite(player.state.yaw) || !std::isfinite(player.state.pitch)) return;
    const Vec3 recoil = RecoilPattern(std::max(0, burst_-1));
    const float scale = player.state.crouched && player.state.grounded ? 0.8f : 1.0f;
    player.state.yaw = std::remainder(player.state.yaw + recoil.x*scale, 2.0f*kPi);
    player.state.pitch = std::clamp(player.state.pitch + recoil.y*scale,
                                   -kPi/2.0f+0.01f, kPi/2.0f-0.01f);
}

Pistol::Pistol()
    : Weapon({WeaponKind::Pistol, 400, 12, 60, 28, 1,
              0.23333334f, 1.5f, 80.0f, Degrees(0.35f), Degrees(1.5f), Degrees(4.0f), false}) {}
Rifle::Rifle()
    : Weapon({WeaponKind::Rifle, 2700, 30, 90, 32, 1,
              0.10f, 2.2f, 120.0f, Degrees(0.22f), Degrees(1.8f), Degrees(4.0f), true}) {}
Sniper::Sniper()
    : Weapon({WeaponKind::Sniper, 4500, 5, 25, 105, 1,
              1.1f, 2.8f, 200.0f, Degrees(0.03f), Degrees(3.0f), Degrees(6.0f), false}) {}
Shotgun::Shotgun()
    : Weapon({WeaponKind::Shotgun, 1800, 8, 32, 12, 8,
              0.8f, 2.4f, 35.0f, Degrees(3.5f), Degrees(1.5f), Degrees(3.0f), false}) {}

Vec3 Pistol::RecoilPattern(int index) const {
    return {Degrees(index%2 == 0 ? 0.12f : -0.12f), Degrees(1.1f), 0};
}
Vec3 Rifle::RecoilPattern(int index) const {
    static constexpr std::array<Vec3,8> pattern{{
        {0.0f,0.65f,0}, {-0.15f,0.75f,0}, {0.1f,0.85f,0}, {0.25f,0.95f,0},
        {0.4f,1.0f,0}, {0.3f,1.0f,0}, {-0.3f,1.0f,0}, {-0.4f,1.0f,0}
    }};
    const Vec3 degrees = pattern[static_cast<std::size_t>(index)%pattern.size()];
    return {Degrees(degrees.x), Degrees(degrees.y), 0};
}
Vec3 Sniper::RecoilPattern(int) const { return {0, Degrees(3.0f), 0}; }
Vec3 Shotgun::RecoilPattern(int index) const {
    return {Degrees(index%2 == 0 ? -0.3f : 0.3f), Degrees(2.5f), 0};
}

std::unique_ptr<Weapon> MakeWeapon(WeaponKind kind) {
    switch (kind) {
        case WeaponKind::Pistol: return std::make_unique<Pistol>();
        case WeaponKind::Rifle: return std::make_unique<Rifle>();
        case WeaponKind::Sniper: return std::make_unique<Sniper>();
        case WeaponKind::Shotgun: return std::make_unique<Shotgun>();
    }
    return nullptr;
}
} // namespace retro
