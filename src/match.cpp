#include "retro/engine.hpp"

#include <algorithm>
#include <cmath>

namespace retro {
namespace {
constexpr int kMaximumMoney = 16000;
constexpr int kTdmTarget = 25;
constexpr float kInteractionRange = 1.5f;

std::size_t TeamIndex(Team team) { return team == Team::Attackers ? 0 : 1; }

void Credit(Player& player, int amount) {
    player.state.money = std::clamp(player.state.money, 0, kMaximumMoney);
    player.state.money = std::min(kMaximumMoney, player.state.money + amount);
}

bool Contains(const Aabb& box, Vec3 point) {
    return Finite(point) && point.x >= box.min.x && point.x <= box.max.x &&
        point.y >= box.min.y && point.y <= box.max.y &&
        point.z >= box.min.z && point.z <= box.max.z;
}

bool InZone(const std::vector<Aabb>& zones, const Player& player) {
    return std::any_of(zones.begin(), zones.end(), [&](const Aabb& zone) {
        return Contains(zone, player.state.position);
    });
}

bool ValidStep(float dt) { return std::isfinite(dt) && dt > 0 && dt <= 0.1f; }

bool Stationary(const Player& player) {
    return Finite(player.state.velocity) && player.state.grounded &&
        Length(player.state.velocity) < 0.1f;
}
} // namespace

Match::Match(Mode selectedMode)
    : mode(selectedMode), phase(selectedMode == Mode::Tdm ? Phase::Live : Phase::Buy),
      phaseRemaining(selectedMode == Mode::Tdm ? 600.0f : 15.0f) {}

bool Match::BuyWeapon(Player& player, WeaponKind kind) {
    if (phase != Phase::Buy || !player.Alive() || !InZone(buyZones, player)) return false;
    auto weapon = MakeWeapon(kind);
    if (!weapon || player.state.money < weapon->Stats().price) return false;
    for (const auto& owned : player.inventory) {
        if (owned && owned->Stats().kind == kind) return false;
    }
    const int price = weapon->Stats().price;
    player.inventory.push_back(std::move(weapon)); // allocate before spending
    player.state.money = std::min(player.state.money, kMaximumMoney) - price;
    return true;
}

void Match::OnKill(Player& killer, const Player& victim) {
    if (phase != Phase::Live || killer.id == victim.id || killer.team == victim.team ||
        victim.Alive() || rewardedDeaths_[victim.id]) return;
    // This hook is called only by the authoritative damage path on a death transition.
    rewardedDeaths_[victim.id] = true;
    Credit(killer, 300);
    if (mode == Mode::Tdm) ++score[TeamIndex(killer.team)];
    if (victim.id == bombCarrier && !bombPlanted) {
        bombCarrier = -1;
        bombPosition = victim.state.position;
        bombDropped_ = true;
        planter_ = -1;
        plantProgress_ = 0;
    }
}

bool Match::PlantBomb(Player& player, bool held, float dt) {
    const bool eligible = mode == Mode::Defuse && phase == Phase::Live && !bombPlanted &&
        player.Alive() && player.team == Team::Attackers && player.id == bombCarrier &&
        InZone(bombSites, player) && Stationary(player);
    if (!held || !ValidStep(dt) || !eligible) {
        if (planter_ == player.id) { planter_ = -1; plantProgress_ = 0; }
        return false;
    }
    plantTouched_ = true;
    if (planter_ != player.id) { planter_ = player.id; plantProgress_ = 0; }
    plantProgress_ += dt;
    if (plantProgress_ + 0.00001f < 3.0f) return false;
    bombPlanted = true;
    bombDropped_ = false;
    bombCarrier = -1;
    bombPosition = player.state.position;
    bombRemaining = 40;
    plantProgress_ = 0;
    planter_ = -1;
    return true;
}

bool Match::DefuseBomb(Player& player, bool held, float dt) {
    const bool eligible = mode == Mode::Defuse && phase == Phase::Live && bombPlanted &&
        !defused_ && player.Alive() && player.team == Team::Defenders && Stationary(player) &&
        Finite(player.state.position) && Length(player.state.position - bombPosition) <= kInteractionRange;
    if (!held || !ValidStep(dt) || !eligible) {
        if (defuser_ == player.id) { defuser_ = -1; defuseProgress_ = 0; }
        return false;
    }
    // Only one player can accumulate progress; another defender cannot steal it.
    if (defuser_ != -1 && defuser_ != player.id) return false;
    defuseTouched_ = true;
    if (defuser_ != player.id) { defuser_ = player.id; defuseProgress_ = 0; }
    defuseProgress_ += dt;
    if (defuseProgress_ + 0.00001f < 5.0f) return false;
    defused_ = true;
    return true; // Tick awards the round with access to all players.
}

void Match::StartRound(std::vector<Player>& players) {
    phase = mode == Mode::Tdm ? Phase::Live : Phase::Buy;
    phaseRemaining = mode == Mode::Tdm ? 600.0f : 15.0f;
    winner.reset();
    bombPlanted = false;
    bombDropped_ = false;
    bombRemaining = 0;
    bombCarrier = planter_ = defuser_ = -1;
    plantProgress_ = defuseProgress_ = 0;
    plantTouched_ = defuseTouched_ = defused_ = false;
    respawnRemaining_.clear();
    rewardedDeaths_.clear();
    if (mode == Mode::Tdm) score = {};
    for (auto& player : players) {
        auto [spawn, inserted] = spawnPositions_.emplace(player.id, player.state.position);
        (void)inserted;
        player.Respawn(spawn->second);
        if (bombCarrier == -1 && player.team == Team::Attackers) bombCarrier = player.id;
    }
}

void Match::FinishRound(Team winningTeam, std::vector<Player>& players) {
    if (phase == Phase::Finished) return;
    winner = winningTeam;
    phase = Phase::Finished;
    phaseRemaining = 5;
    if (mode == Mode::Defuse) ++score[TeamIndex(winningTeam)];
    for (auto& player : players) Credit(player, player.team == winningTeam ? 3250 : 1400);
}

void Match::Tick(float dt, std::vector<Player>& players) {
    if (!ValidStep(dt)) return;
    for (const auto& player : players) spawnPositions_.emplace(player.id, player.state.position);
    if (!plantTouched_) { planter_ = -1; plantProgress_ = 0; }
    if (!defuseTouched_) { defuser_ = -1; defuseProgress_ = 0; }
    plantTouched_ = defuseTouched_ = false;

    if (phase == Phase::Finished) {
        if (mode == Mode::Defuse) {
            phaseRemaining = std::max(0.0f, phaseRemaining - dt);
            if (phaseRemaining <= 0) StartRound(players);
        }
        return;
    }
    phaseRemaining = std::max(0.0f, phaseRemaining - dt);
    if (phase == Phase::Buy) {
        // The caller normally calls StartRound after constructing the roster.
        if (bombCarrier == -1) {
            for (const auto& player : players) {
                if (player.Alive() && player.team == Team::Attackers) { bombCarrier = player.id; break; }
            }
        }
        if (phaseRemaining <= 0) { phase = Phase::Live; phaseRemaining = 115; }
        return;
    }
    if (mode == Mode::Tdm) {
        if (score[0] >= kTdmTarget || score[1] >= kTdmTarget || phaseRemaining <= 0) {
            if (score[0] == score[1]) {
                phase = Phase::Finished; // tied time limit: no winner or win bonus
                winner.reset();
            } else FinishRound(score[0] > score[1] ? Team::Attackers : Team::Defenders, players);
            return;
        }
        for (auto& player : players) {
            if (player.Alive()) { respawnRemaining_.erase(player.id); continue; }
            auto [timer, inserted] = respawnRemaining_.emplace(player.id, 3.0f);
            (void)inserted;
            timer->second -= dt;
            if (timer->second <= 0) {
                player.Respawn(spawnPositions_.at(player.id));
                respawnRemaining_.erase(player.id);
                rewardedDeaths_.erase(player.id);
            }
        }
        return;
    }

    if (defused_) { FinishRound(Team::Defenders, players); return; }
    if (bombPlanted) {
        bombRemaining = std::max(0.0f, bombRemaining - dt);
        if (bombRemaining <= 0) { FinishRound(Team::Attackers, players); return; }
    } else if (phaseRemaining <= 0) { FinishRound(Team::Defenders, players); return; }

    if (bombDropped_) {
        for (const auto& player : players) {
            if (player.Alive() && player.team == Team::Attackers &&
                Length(player.state.position - bombPosition) <= kInteractionRange) {
                bombCarrier = player.id;
                bombDropped_ = false;
                break;
            }
        }
    }
    std::array<int,2> total{}, alive{};
    for (const auto& player : players) {
        ++total[TeamIndex(player.team)];
        if (player.Alive()) ++alive[TeamIndex(player.team)];
    }
    // An incomplete lobby is not an elimination win.
    if (total[0] == 0 || total[1] == 0) return;
    if (alive[1] == 0) FinishRound(Team::Attackers, players);
    else if (alive[0] == 0 && !bombPlanted) FinishRound(Team::Defenders, players);
}
} // namespace retro
