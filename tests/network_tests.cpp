#include "retro/engine.hpp"
#include <algorithm>
#include <cassert>
#include <cmath>
#include <limits>

namespace {
using namespace retro;
World Floor() { return {{{{-50,-1,-50},{50,0,50}}}}; }
Server Duel(bool wall=false) {
    auto map = Floor();
    if (wall) map.solids.push_back({{-2,0,2},{2,3,2.1f}});
    Server s(map);
    s.players.emplace_back(1,Team::Attackers);
    s.players.emplace_back(2,Team::Defenders);
    s.players[1].state.position={0,0,5};
    return s;
}
void Enqueue(Server& server, std::uint32_t sequence, InputFrame input={}) {
    assert(server.ReceiveCommand(1,{sequence,input}));
    server.Tick();
}
}
void RunNetworkTests() {
    using namespace retro;
    // Reject spoofed IDs, invalid floats/axes, replay, giant sequence jumps, queue flooding.
    auto s=Duel();
    assert(!s.ReceiveCommand(777,{1,{}}));
    InputFrame bad; bad.forward=std::numeric_limits<float>::quiet_NaN();
    assert(!s.ReceiveCommand(1,{1,bad}));
    bad.forward=2; assert(!s.ReceiveCommand(1,{1,bad}));
    assert(!s.ReceiveCommand(1,{1000,{}}));
    // Recoil can legitimately reach the same pitch limit used by the camera.
    auto steep=Duel();
    InputFrame look; look.pitch=kPi/2.0f-0.01f;
    assert(steep.ReceiveCommand(1,{1,look}));
    Predictor steepClient(1); steepClient.Predict({1,look},steep.world);
    InputFrame move; move.forward=1;
    for (unsigned n=1;n<=8;++n) assert(s.ReceiveCommand(1,{n,move}));
    assert(!s.ReceiveCommand(1,{9,move}));
    assert(!s.ReceiveCommand(1,{1,move}));
    s.Tick();
    assert(s.players[0].state.position.z<0.18f);
    assert(s.GetSnapshot(1).acknowledgedSequence==1);

    // Fire goes through the authoritative weapon; one accepted press costs one bullet.
    auto duel=Duel(); InputFrame fire; fire.fire=true;
    Enqueue(duel,1,fire);
    assert(duel.players[0].CurrentWeapon()->Ammo()==11);
    assert(duel.players[1].state.health==72);
    for (unsigned n=2;n<=12;++n) Enqueue(duel,n,fire);
    assert(duel.players[0].CurrentWeapon()->Ammo()==11); // pistol needs release
    auto blocked=Duel(true);
    Enqueue(blocked,1,fire);
    assert(blocked.players[1].state.health==100);
    auto buying=Duel(); buying.match=Match(Mode::Defuse);
    Enqueue(buying,1,fire);
    assert(buying.players[0].CurrentWeapon()->Ammo()==12);

    // Geometry is sampled after ALL players move, independent of roster order.
    auto movingTargetHealth=[](bool reverse) {
        auto moving=Duel();
        moving.players[1].state.position.x=0.25f;
        moving.players[1].state.velocity.x=5.2f;
        if (reverse) std::reverse(moving.players.begin(),moving.players.end());
        InputFrame shoot; shoot.fire=true;
        InputFrame dodge; dodge.strafe=1;
        assert(moving.ReceiveCommand(1,{1,shoot}));
        assert(moving.ReceiveCommand(2,{1,dodge}));
        moving.Tick();
        for (const auto& p:moving.players) if (p.id==2) return p.state.health;
        return -1;
    };
    assert(movingTargetHealth(false)==100);
    assert(movingTargetHealth(true)==100);

    // Direct internal ray tests: cover and the closest body stop rays, including allies.
    auto closest=Duel();
    closest.players.emplace_back(3,Team::Defenders);
    closest.players.back().state.position={0,0,10};
    Shot ray{closest.players[0].Eye(),{{0,0,1}},100,100};
    auto hits=closest.ServerProcessHit(closest.players[0],ray);
    assert(hits.size()==1 && hits[0].victimId==2 && hits[0].killed);
    assert(closest.players[2].state.health==100);
    assert(closest.players[0].state.money==1100);
    assert(closest.match.score[0]==1);
    auto allies=Duel(); allies.players[1].team=Team::Attackers;
    allies.players.emplace_back(3,Team::Defenders);
    allies.players.back().state.position={0,0,10};
    assert(allies.ServerProcessHit(allies.players[0],ray).empty());
    assert(allies.players[2].state.health==100);

    // Delayed acknowledgement corrects drift and replays only commands not yet acknowledged.
    auto predicted=Duel(); Predictor client(1);
    for (unsigned n=1;n<=6;++n) {
        Command command{n,move};
        client.Predict(command,predicted.world);
        if (n<=3) { assert(predicted.ReceiveCommand(1,command)); predicted.Tick(); }
    }
    client.local.state.position.x=9; // simulate prediction divergence
    const auto snapshot=predicted.GetSnapshot(1);
    assert(client.Reconcile(snapshot,predicted.world));
    assert(client.PendingCount()==3);
    for (unsigned n=4;n<=6;++n) Enqueue(predicted,n,move);
    assert(Length(client.local.state.position-predicted.players[0].state.position)<1e-5f);
    assert(!client.Reconcile(snapshot,predicted.world));
    assert(client.Reconcile(predicted.GetSnapshot(1),predicted.world));
    assert(client.PendingCount()==0);

    Interpolator buffer;
    Snapshot a,b; a.tick=10; b.tick=14;
    PlayerState left,right; right.position={4,0,0};
    a.players.push_back({1,left}); b.players.push_back({1,right});
    buffer.Push(a); buffer.Push(b); buffer.Push(a); // stale packet ignored
    assert(std::abs(buffer.Position(1,12)->x-2)<1e-6f);
    assert(buffer.Position(1,100)->x==4); // no unlimited extrapolation
    assert(!buffer.Position(99,12));
}
