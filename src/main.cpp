#include "retro/engine.hpp"
#include <iostream>

int main() {
    using namespace retro;
    World arena{{{{-30,-1,-30},{30,0,30}},{{-5,0,10},{5,3,10.5f}}}};
    Server server(arena,Mode::Tdm);
    server.players.emplace_back(1,Team::Attackers);
    server.players.emplace_back(2,Team::Defenders);
    server.players[1].state.position={0,0,5};
    Predictor client(1);
    Interpolator remote;
    for (std::uint32_t sequence=1;sequence<=90;++sequence) {
        InputFrame input;
        input.fire=sequence==1 || sequence==16 || sequence==31 || sequence==46;
        // Absolute camera angles include user recoil compensation in this demo.
        Command command{sequence,input};
        client.Predict(command,arena);
        if (!server.ReceiveCommand(1,command)) return 1;
        server.Tick();
        const auto snapshot=server.GetSnapshot(1);
        if (!client.Reconcile(snapshot,arena)) return 2;
        remote.Push(snapshot);
    }
    const auto& player=server.players.front();
    std::cout << "Simulation: 90 ticks at 30 Hz\n"
              << "Attacker score: " << server.match.score[0] << '\n'
              << "Money: " << player.state.money << '\n'
              << "Pistol ammo: " << player.CurrentWeapon()->Ammo() << '\n'
              << "Pending prediction commands: " << client.PendingCount() << '\n';
    return server.match.score[0]==1 && player.state.money==1100 &&
           player.CurrentWeapon()->Ammo()==8 && client.PendingCount()==0 ? 0 : 3;
}
