#include <exception>
#include <iostream>
#ifdef NDEBUG
#error Tests require assertions enabled
#endif
void RunMovementTests();
void RunWeaponTests();
void RunMatchTests();
void RunNetworkTests();
int main() {
    try {
        RunMovementTests(); std::cout << "PASS movement, collision, health\n";
        RunWeaponTests(); std::cout << "PASS weapons, recoil, reload\n";
        RunMatchTests(); std::cout << "PASS economy, TDM, defuse\n";
        RunNetworkTests(); std::cout << "PASS authority, hits, prediction, interpolation\n";
    } catch (const std::exception& e) {
        std::cerr << "FAIL " << e.what() << '\n'; return 1;
    }
    std::cout << "4 suites passed\n";
}
