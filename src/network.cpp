#include "retro/engine.hpp"

#include <algorithm>
#include <cmath>
#include <stdexcept>
#include <utility>

namespace retro {
namespace {
bool ValidInput(const InputFrame& i) {
    return std::isfinite(i.forward) && std::isfinite(i.strafe) &&
        std::abs(i.forward) <= 1 && std::abs(i.strafe) <= 1 &&
        std::isfinite(i.yaw) && std::abs(i.yaw) <= 2*kPi &&
        std::isfinite(i.pitch) && std::abs(i.pitch) <= kPi/2.0f-0.01f &&
        i.selectSlot >= -1 && i.selectSlot < 8 && i.purchase >= -1 && i.purchase < 4;
}
}
Server::Server(World map, Mode mode, std::uint32_t seed)
    : world(std::move(map)), match(mode), randomState_(seed ? seed : 1) {}
Player* Server::FindPlayer(int id) {
    for (auto& p : players) if (p.id == id) return &p;
    return nullptr;
}
bool Server::ReceiveCommand(int authenticatedPlayerId, const Command& command) {
    if (!FindPlayer(authenticatedPlayerId) || !ValidInput(command.input)) return false;
    auto& connection = connections_[authenticatedPlayerId];
    // One command consumed per authoritative tick; queues cannot buy extra speed.
    // Session reconnect resets sequence before uint32 overflow (no wrap in a session).
    if (command.sequence <= connection.lastReceived ||
        command.sequence - connection.lastReceived > 128 || connection.pending.size() >= 8)
        return false;
    connection.lastReceived = command.sequence;
    connection.pending.push_back(command);
    return true;
}
void Server::Tick() {
    ++tick;
    std::vector<InputFrame> inputs;
    inputs.reserve(players.size());
    for (auto& player : players) {
        auto& connection = connections_[player.id];
        InputFrame input;
        input.yaw = player.state.yaw;
        input.pitch = player.state.pitch;
        if (!connection.pending.empty()) {
            auto command = connection.pending.front();
            connection.pending.pop_front();
            connection.lastProcessed = command.sequence;
            input = command.input;
        }
        inputs.push_back(input);
        player.TickWeapons(kTickDt);
        if (player.Alive()) player.UpdateMovement(input, kTickDt, world);
    }
    // All hitboxes now belong to the same authoritative tick.
    for (std::size_t index=0; index<players.size(); ++index) {
        auto& player = players[index];
        const auto& input = inputs[index];
        if (!player.Alive()) continue;
        if (input.purchase >= 0) match.BuyWeapon(player, static_cast<WeaponKind>(input.purchase));
        if (input.selectSlot >= 0) player.SwitchWeapon(static_cast<std::size_t>(input.selectSlot));
        auto* weapon = player.CurrentWeapon();
        if (weapon) {
            if (!input.fire) weapon->ReleaseTrigger();
            if (input.reload) weapon->Reload();
            if (input.fire && match.phase == Phase::Live) {
                // The server chooses the seed. This PRNG is not authentication.
                randomState_ ^= randomState_ << 13;
                randomState_ ^= randomState_ >> 17;
                randomState_ ^= randomState_ << 5;
                if (auto shot = weapon->Shoot(player, randomState_)) ServerProcessHit(player, *shot);
            }
        }
    }
    // Deaths from this tick interrupt planting/defusing before progress is awarded.
    for (std::size_t index=0; index<players.size(); ++index) {
        auto& player = players[index];
        const auto& input = inputs[index];
        if (!player.Alive()) continue;
        if (input.plant) match.PlantBomb(player, true, kTickDt);
        if (input.defuse) match.DefuseBomb(player, true, kTickDt);
    }
    match.Tick(kTickDt, players);
}
Snapshot Server::GetSnapshot(int playerId) const {
    Snapshot snapshot;
    snapshot.tick = tick;
    const auto connection = connections_.find(playerId);
    if (connection != connections_.end()) snapshot.acknowledgedSequence = connection->second.lastProcessed;
    for (const auto& player : players) snapshot.players.push_back({player.id, player.state});
    return snapshot;
}
std::vector<HitResult> Server::ServerProcessHit(Player& shooter, const Shot& shot) {
    // Internal server API: only call with Shot returned by server-owned Weapon::Shoot.
    // A network message may request fire but cannot provide Shot, damage or victim ID.
    std::vector<HitResult> hits;
    if (!shooter.Alive() || match.phase != Phase::Live || !Finite(shot.origin) ||
        !std::isfinite(shot.range) || shot.range <= 0 || shot.damage <= 0) return hits;
    for (Vec3 direction : shot.directions) {
        if (!Finite(direction) || Length(direction) < 0.99f || Length(direction) > 1.01f) continue;
        direction = Normalize(direction);
        float nearest = world.Raycast(shot.origin, direction, shot.range).value_or(shot.range);
        Player* victim = nullptr;
        for (auto& target : players) {
            if (target.id == shooter.id || !target.Alive()) continue;
            const auto distance = RayAabb(shot.origin, direction, target.Bounds(), shot.range);
            if (distance && *distance < nearest) { nearest = *distance; victim = &target; }
        }
        // A teammate blocks the ray, but friendly fire is disabled.
        if (!victim || victim->team == shooter.team) continue;
        const int before = victim->state.health;
        const bool killed = victim->TakeDamage(shot.damage);
        hits.push_back({victim->id, before-victim->state.health, killed});
        if (killed) match.OnKill(shooter, *victim);
    }
    return hits;
}
Predictor::Predictor(int playerId) : local(playerId) {}
void Predictor::Predict(const Command& command, const World& world) {
    if (!ValidInput(command.input) || command.sequence <= lastSequence_)
        throw std::invalid_argument("invalid prediction command");
    if (pending_.size() >= 256) throw std::overflow_error("prediction history full: resync required");
    lastSequence_ = command.sequence;
    pending_.push_back(command);
    local.UpdateMovement(command.input, kTickDt, world);
}
bool Predictor::Reconcile(const Snapshot& snapshot, const World& world) {
    if ((hasSnapshot_ && snapshot.tick <= lastSnapshotTick_) ||
        snapshot.acknowledgedSequence > lastSequence_) return false;
    const auto player = std::find_if(snapshot.players.begin(), snapshot.players.end(),
        [this](const PlayerSnapshot& p) { return p.id == local.id; });
    if (player == snapshot.players.end()) return false;
    // Snap physics immediately, then replay unacknowledged input through identical physics.
    // A visual-only camera offset can decay separately (see architecture notes).
    local.state = player->state;
    while (!pending_.empty() && pending_.front().sequence <= snapshot.acknowledgedSequence)
        pending_.pop_front();
    for (const auto& command : pending_) local.UpdateMovement(command.input, kTickDt, world);
    hasSnapshot_ = true;
    lastSnapshotTick_ = snapshot.tick;
    return true;
}
void Interpolator::Push(const Snapshot& snapshot) {
    if (!snapshots_.empty() && snapshot.tick <= snapshots_.back().tick) return;
    snapshots_.push_back(snapshot);
    while (snapshots_.size() > 32) snapshots_.pop_front();
}
std::optional<Vec3> Interpolator::Position(int playerId, double renderTick) const {
    if (snapshots_.empty() || !std::isfinite(renderTick)) return std::nullopt;
    auto position = [playerId](const Snapshot& s) -> std::optional<Vec3> {
        for (const auto& p : s.players) if (p.id == playerId) return p.state.position;
        return std::nullopt;
    };
    if (renderTick <= snapshots_.front().tick) return position(snapshots_.front());
    for (std::size_t i=1; i<snapshots_.size(); ++i) {
        const auto& b = snapshots_[i];
        if (renderTick > b.tick) continue;
        const auto& a = snapshots_[i-1];
        const auto from = position(a), to = position(b);
        if (!from || !to) return std::nullopt;
        const float t = static_cast<float>((renderTick-a.tick)/(b.tick-a.tick));
        return *from + (*to-*from)*t;
    }
    // No unbounded extrapolation through geometry during packet loss.
    return position(snapshots_.back());
}
} // namespace retro
