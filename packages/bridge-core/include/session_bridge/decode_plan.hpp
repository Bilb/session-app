#pragma once

#include "decode_bound.hpp"

#include <cstddef>
#include <span>

namespace session_bridge {

/// The plan for drawing these encoded bytes, from libsession's reading of their header alone: no
/// pixel is decoded. Bytes it does not read as a picture, or whose header is damaged, are
/// unmeasured.
DecodePlan decode_plan(std::span<const std::byte> bytes);

}  // namespace session_bridge
