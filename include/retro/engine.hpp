#pragma once

#include <array>
#include <cstdint>
#include <deque>
#include <memory>
#include <optional>
#include <unordered_map>
#include <vector>

namespace retro {
constexpr float kTickDt = 1.0f / 30.0f;
constexpr float kPi = 3.14159265358979323846f;
struct Vec3 {
    float x{}, y{}, z{};
    Vec3 operator+(Vec3 b) const { return {x+b.x,y+b.y,z+b.z}; }
    Vec3 operator-(Vec3 b) const { return {x-b.x,y-b.y,z-b.z}; }
    Vec3 operator*(float s) const { return {x*s,y*s,z*s}; }
    Vec3& operator+=(Vec3 b) { *this=*this+b; return *this; }
};
float Dot(Vec3 a, Vec3 b);
float Length(Vec3 v);
Vec3 Normalize(Vec3 v);
bool Finite(Vec3 v);
Vec3 AimDirection(float yaw, float pitch); // radians; +Y up, yaw 0 looks +Z
struct Aabb { Vec3 min, max; };
bool Overlaps(const Aabb& a, const Aabb& b);
std::optional<float> RayAabb(Vec3 origin, Vec3 direction, const Aabb& box, float range);
struct World {
    std::vector<Aabb> solids;
    bool Collides(const Aabb& bounds) const;
    std::optional<float> Raycast(Vec3 origin, Vec3 direction, float range) const;
};
enum class Team { Attackers, Defenders };
enum class WeaponKind { Pistol, Rifle, Sniper, Shotgun };
struct InputFrame {
    float forward{}, strafe{}, yaw{}, pitch{};
    bool jump{}, crouch{}, fire{}, reload{};
    bool plant{}, defuse{};
    int selectSlot{-1};
    int purchase{-1}; // -1 or WeaponKind ordinal; server checks phase/zone/funds
};
struct PlayerState {
    Vec3 position{0,0,0}; // feet, in meters
    Vec3 velocity{};
    float yaw{}, pitch{};
    bool grounded{}, crouched{}, jumpHeld{};
    int health{100}, armor{}, money{800};
};
struct WeaponStats {
    WeaponKind kind;
    int price, magazineSize, reserveAmmo, damage, pellets;
    float interval, reloadTime, range, baseSpread, movementSpread, airborneSpread;
    bool automatic;
};
struct Shot { Vec3 origin; std::vector<Vec3> directions; int damage; float range; };
class Player;
class Weapon {
public:
    explicit Weapon(WeaponStats stats);
    virtual ~Weapon() = default;
    const WeaponStats& Stats() const { return stats_; }
    int Ammo() const { return ammo_; }
    int Reserve() const { return reserve_; }
    bool Reloading() const { return reloadRemaining_ > 0; }
    int Burst() const { return burst_; }
    void Tick(float dt);
    void ReleaseTrigger();
    virtual std::optional<Shot> Shoot(Player& player, std::uint32_t seed);
    bool Reload();
    float CalculateSpread(const Player& player) const;
    virtual void ApplyRecoil(Player& player) const;
protected:
    virtual Vec3 RecoilPattern(int index) const = 0; // x=yaw, y=pitch, radians
private:
    WeaponStats stats_;
    int ammo_, reserve_, burst_{};
    float cooldown_{}, reloadRemaining_{}, idleTime_{};
    bool triggerHeld_{};
};
class Pistol final : public Weapon {
public: Pistol();
private: Vec3 RecoilPattern(int index) const override;
};
class Rifle final : public Weapon {
public: Rifle();
private: Vec3 RecoilPattern(int index) const override;
};
class Sniper final : public Weapon {
public: Sniper();
private: Vec3 RecoilPattern(int index) const override;
};
class Shotgun final : public Weapon {
public: Shotgun();
private: Vec3 RecoilPattern(int index) const override;
};
std::unique_ptr<Weapon> MakeWeapon(WeaponKind kind);
class Player {
public:
    explicit Player(int id=0, Team team=Team::Attackers);
    int id;
    Team team;
    PlayerState state;
    std::vector<std::unique_ptr<Weapon>> inventory;
    std::size_t currentSlot{};
    float switchRemaining{};
    bool Alive() const { return state.health > 0; }
    float Height() const { return state.crouched ? 1.1f : 1.8f; }
    Vec3 Eye() const { return state.position + Vec3{0,Height()-0.15f,0}; }
    Aabb Bounds() const;
    void UpdateMovement(const InputFrame& input, float dt, const World& world);
    void TickWeapons(float dt);
    bool SwitchWeapon(std::size_t slot);
    Weapon* CurrentWeapon();
    const Weapon* CurrentWeapon() const;
    bool TakeDamage(int damage); // true only on alive -> dead transition
    void Respawn(Vec3 position);
};

enum class Mode { Tdm, Defuse };
enum class Phase { Buy, Live, Finished };
struct Match {
    explicit Match(Mode mode=Mode::Defuse);
    Mode mode;
    Phase phase;
    float phaseRemaining;
    std::array<int,2> score{};
    std::optional<Team> winner;
    std::vector<Aabb> buyZones;
    std::vector<Aabb> bombSites;
    bool bombPlanted{};
    Vec3 bombPosition{};
    float bombRemaining{};
    int bombCarrier{-1};
    void Tick(float dt, std::vector<Player>& players);
    bool BuyWeapon(Player& player, WeaponKind kind);
    void OnKill(Player& killer, const Player& victim);
    bool PlantBomb(Player& player, bool held, float dt);
    bool DefuseBomb(Player& player, bool held, float dt);
    void StartRound(std::vector<Player>& players);
    void FinishRound(Team winningTeam, std::vector<Player>& players);
private:
    int planter_{-1}, defuser_{-1};
    float plantProgress_{}, defuseProgress_{};
    bool defused_{};
    std::unordered_map<int, Vec3> spawnPositions_;
    std::unordered_map<int, float> respawnRemaining_;
    std::unordered_map<int, bool> rewardedDeaths_;
    bool plantTouched_{}, defuseTouched_{}, bombDropped_{};
};

// Wire format is intentionally not implemented. Authenticated transport binds
// a connection to playerId; player IDs in untrusted payloads must never do so.
struct Command { std::uint32_t sequence{}; InputFrame input; };
struct PlayerSnapshot { int id; PlayerState state; };
struct Snapshot {
    std::uint32_t tick{}, acknowledgedSequence{};
    std::vector<PlayerSnapshot> players;
};
struct HitResult { int victimId; int damage; bool killed; };
class Server {
public:
    explicit Server(World world, Mode mode=Mode::Tdm, std::uint32_t seed=0x74521u);
    World world;
    Match match;
    std::vector<Player> players;
    std::uint32_t tick{};
    bool ReceiveCommand(int authenticatedPlayerId, const Command& command);
    void Tick(); // exactly 30 Hz, never uses client delta time
    Snapshot GetSnapshot(int playerId) const;
    std::vector<HitResult> ServerProcessHit(Player& shooter, const Shot& shot);
private:
    struct Connection {
        std::deque<Command> pending;
        std::uint32_t lastReceived{}, lastProcessed{};
    };
    std::unordered_map<int,Connection> connections_;
    std::uint32_t randomState_;
    Player* FindPlayer(int id);
};
class Predictor {
public:
    Player local;
    explicit Predictor(int playerId);
    void Predict(const Command& command, const World& world);
    bool Reconcile(const Snapshot& snapshot, const World& world);
    std::size_t PendingCount() const { return pending_.size(); }
private:
    std::deque<Command> pending_;
    std::uint32_t lastSnapshotTick_{}, lastSequence_{};
    bool hasSnapshot_{};
};
class Interpolator {
public:
    void Push(const Snapshot& snapshot);
    std::optional<Vec3> Position(int playerId, double renderTick) const;
private:
    std::deque<Snapshot> snapshots_;
};
} // namespace retro
