#include "retro/engine.hpp"

#include <cassert>
#include <cmath>
#include <limits>

namespace {
using namespace retro;

std::vector<Player> Roster() {
    std::vector<Player> players;
    players.emplace_back(1, Team::Attackers);
    players.emplace_back(2, Team::Defenders);
    players[0].state.position = {0,0,0};
    players[1].state.position = {5,0,0};
    return players;
}

void Advance(Match& match, std::vector<Player>& players, int ticks) {
    for (int i=0;i<ticks;++i) match.Tick(kTickDt, players);
}
}

void RunMatchTests() {
    using namespace retro;
    {
        auto players = Roster();
        Match match;
        match.buyZones.push_back({{-2,-1,-2},{2,2,2}});
        auto& buyer = players[0];
        assert(!match.BuyWeapon(buyer, WeaponKind::Rifle)); // insufficient funds
        buyer.state.money = 16000;
        const int before = buyer.state.money;
        const int price = Rifle().Stats().price;
        assert(match.BuyWeapon(buyer, WeaponKind::Rifle));
        assert(buyer.state.money == before-price && buyer.inventory.size() == 2);
        assert(!match.BuyWeapon(buyer, WeaponKind::Rifle));
        assert(!match.BuyWeapon(buyer, static_cast<WeaponKind>(99)));
        buyer.state.position.x = 10;
        assert(!match.BuyWeapon(buyer, WeaponKind::Sniper));
        buyer.state.position.x = 0;
        match.phase = Phase::Live;
        assert(!match.BuyWeapon(buyer, WeaponKind::Sniper));
    }
    {
        auto players = Roster();
        Match match(Mode::Tdm);
        players[0].state.money = 15900;
        players[1].state.health = 0;
        match.OnKill(players[0],players[1]);
        assert(players[0].state.money == 16000 && match.score[0] == 1);
        match.OnKill(players[0],players[1]);
        assert(match.score[0] == 1); // duplicate death event is ignored
        Advance(match, players, 91);
        assert(players[1].Alive());
        players[1].state.health = 0;
        match.OnKill(players[0],players[1]);
        assert(match.score[0] == 2);
        match.score[0] = 25;
        match.Tick(kTickDt,players);
        assert(match.phase == Phase::Finished && match.winner == Team::Attackers);
    }
    {
        auto players = Roster();
        Match match;
        match.StartRound(players);
        assert(match.bombCarrier == players[0].id);
        Advance(match, players, 451);
        assert(match.phase == Phase::Live);
        match.bombSites.push_back({{-2,-1,-2},{2,2,2}});
        auto& attacker = players[0];
        attacker.state.grounded = true;
        attacker.state.velocity = {};
        for (int i=0;i<60;++i) {
            assert(!match.PlantBomb(attacker,true,kTickDt));
            match.Tick(kTickDt,players);
        }
        match.PlantBomb(attacker,false,kTickDt);
        for (int i=0;i<60;++i) {
            assert(!match.PlantBomb(attacker,true,kTickDt));
            match.Tick(kTickDt,players);
        }
        assert(!match.bombPlanted); // release reset the accumulated two seconds
        for (int i=0;i<31 && !match.bombPlanted;++i) {
            match.PlantBomb(attacker,true,kTickDt);
            match.Tick(kTickDt,players);
        }
        assert(match.bombPlanted && match.bombRemaining > 39);
        attacker.state.health = 0;
        match.Tick(kTickDt,players);
        assert(match.phase == Phase::Live); // planted bomb survives attackers' death
        auto& defender = players[1];
        defender.state.position = match.bombPosition;
        defender.state.grounded = true;
        defender.state.velocity = {};
        for (int i=0;i<151 && match.phase == Phase::Live;++i) {
            match.DefuseBomb(defender,true,kTickDt);
            match.Tick(kTickDt,players);
        }
        assert(match.phase == Phase::Finished && match.winner == Team::Defenders);
        const int cash = defender.state.money;
        match.FinishRound(Team::Defenders,players);
        assert(defender.state.money == cash && match.score[1] == 1);
        Advance(match, players, 151);
        assert(match.phase == Phase::Buy && attacker.Alive());
    }
    {
        auto players = Roster();
        Match match;
        match.phase = Phase::Live;
        match.phaseRemaining = 1;
        match.bombPlanted = true;
        match.bombRemaining = 2;
        Advance(match, players, 31);
        assert(match.phase == Phase::Live); // round clock cannot stop a planted bomb
        Advance(match, players, 31);
        assert(match.winner == Team::Attackers);
    }
    {
        auto players = Roster();
        Match match;
        const float remaining = match.phaseRemaining;
        match.Tick(std::numeric_limits<float>::quiet_NaN(),players);
        match.Tick(-1,players);
        match.Tick(1000,players);
        assert(match.phaseRemaining == remaining);
        match.phase = Phase::Live;
        match.phaseRemaining = 0.01f;
        match.Tick(kTickDt,players);
        assert(match.winner == Team::Defenders);
    }
    {
        auto players = Roster();
        players.emplace_back(3,Team::Attackers);
        Match match;
        match.StartRound(players);
        match.phase = Phase::Live;
        match.bombSites.push_back({{-2,-1,-2},{2,2,2}});
        auto& attacker = players[0];
        attacker.state.grounded = true;
        for (int i=0;i<60;++i) {
            match.PlantBomb(attacker,true,kTickDt);
            match.Tick(kTickDt,players);
        }
        match.Tick(kTickDt,players); // a missing input frame interrupts the action
        for (int i=0;i<60;++i) {
            match.PlantBomb(attacker,true,kTickDt);
            match.Tick(kTickDt,players);
        }
        assert(!match.bombPlanted);
        attacker.state.velocity.x = 1;
        assert(!match.PlantBomb(attacker,true,kTickDt));
        attacker.state.health = 0;
        match.OnKill(players[1],attacker);
        assert(match.bombCarrier == -1);
        match.Tick(kTickDt,players);
        assert(match.bombCarrier == players[2].id); // teammate picks up dropped bomb
        const int money = players[1].state.money;
        match.OnKill(players[1],players[1]);
        assert(players[1].state.money == money);
        players[2].state.health = 0;
        match.Tick(kTickDt,players);
        assert(match.winner == Team::Defenders);
    }
}
