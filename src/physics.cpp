#include "retro/engine.hpp"

#include <algorithm>
#include <cmath>

namespace retro {
float Dot(Vec3 a, Vec3 b) { return a.x*b.x + a.y*b.y + a.z*b.z; }
float Length(Vec3 v) { return std::hypot(v.x,v.y,v.z); }
Vec3 Normalize(Vec3 v) {
    const float length=Length(v);
    return std::isfinite(length) && length>1e-8f ? v*(1.0f/length) : Vec3{};
}
bool Finite(Vec3 v) { return std::isfinite(v.x)&&std::isfinite(v.y)&&std::isfinite(v.z); }
Vec3 AimDirection(float yaw, float pitch) {
    if (!std::isfinite(yaw) || !std::isfinite(pitch)) return {};
    const float c=std::cos(pitch);
    return {std::sin(yaw)*c,std::sin(pitch),std::cos(yaw)*c};
}
namespace {
bool Valid(const Aabb& b) {
    return Finite(b.min)&&Finite(b.max) && b.min.x<=b.max.x && b.min.y<=b.max.y && b.min.z<=b.max.z;
}
}
bool Overlaps(const Aabb& a, const Aabb& b) {
    // Touching faces are support/contact, not penetration.
    return Valid(a)&&Valid(b) &&
        a.min.x<b.max.x && a.max.x>b.min.x &&
        a.min.y<b.max.y && a.max.y>b.min.y &&
        a.min.z<b.max.z && a.max.z>b.min.z;
}
std::optional<float> RayAabb(Vec3 origin, Vec3 direction, const Aabb& box, float range) {
    if (!Finite(origin)||!Finite(direction)||!Valid(box)||!std::isfinite(range)||range<0) return {};
    direction=Normalize(direction);
    if (Length(direction)<0.5f) return {};
    const std::array<float,3> o{origin.x,origin.y,origin.z};
    const std::array<float,3> d{direction.x,direction.y,direction.z};
    const std::array<float,3> lo{box.min.x,box.min.y,box.min.z};
    const std::array<float,3> hi{box.max.x,box.max.y,box.max.z};
    float entry=0.0f, exit=range;
    for (std::size_t axis=0;axis<3;++axis) {
        if (std::abs(d[axis])<1e-8f) {
            if (o[axis]<lo[axis] || o[axis]>hi[axis]) return {};
            continue;
        }
        float a=(lo[axis]-o[axis])/d[axis];
        float b=(hi[axis]-o[axis])/d[axis];
        if (a>b) std::swap(a,b);
        entry=std::max(entry,a);
        exit=std::min(exit,b);
        if (entry>exit) return {};
    }
    return entry;
}
bool World::Collides(const Aabb& bounds) const {
    for (const auto& solid:solids) if (Overlaps(bounds,solid)) return true;
    return false;
}
std::optional<float> World::Raycast(Vec3 origin, Vec3 direction, float range) const {
    std::optional<float> nearest;
    for (const auto& solid:solids) {
        auto distance=RayAabb(origin,direction,solid,range);
        if (distance && (!nearest || *distance<*nearest)) nearest=distance;
    }
    return nearest;
}
} // namespace retro
