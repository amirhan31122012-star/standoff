CXX ?= g++
CPPFLAGS += -Iinclude
CXXFLAGS ?= -O2 -g
CXXFLAGS += -std=c++17 -Wall -Wextra -Wpedantic -Werror -MMD -MP
BUILD ?= build
CORE := src/physics.cpp src/player.cpp src/weapon.cpp src/match.cpp src/network.cpp
CORE_OBJ := $(CORE:%.cpp=$(BUILD)/%.o)
TEST_SRC := $(wildcard tests/*.cpp)
TEST_OBJ := $(TEST_SRC:%.cpp=$(BUILD)/%.o)

.PHONY: all test demo sanitize clean
all: $(BUILD)/demo $(BUILD)/tests_runner
$(BUILD)/demo: $(CORE_OBJ) $(BUILD)/src/main.o
	$(CXX) $(CXXFLAGS) $^ $(LDFLAGS) -o $@
$(BUILD)/tests_runner: $(CORE_OBJ) $(TEST_OBJ)
	$(CXX) $(CXXFLAGS) $^ $(LDFLAGS) -o $@
$(BUILD)/%.o: %.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CPPFLAGS) $(CXXFLAGS) -c $< -o $@
test: $(BUILD)/tests_runner
	./$(BUILD)/tests_runner
demo: $(BUILD)/demo
	./$(BUILD)/demo
sanitize:
	$(MAKE) BUILD=build/sanitize CXXFLAGS='-O1 -g -std=c++17 -Wall -Wextra -Wpedantic -Werror -MMD -MP -fno-omit-frame-pointer -fsanitize=address,undefined' LDFLAGS='-fsanitize=address,undefined' test
clean:
	rm -rf build
-include $(CORE_OBJ:.o=.d) $(TEST_OBJ:.o=.d) $(BUILD)/src/main.d
